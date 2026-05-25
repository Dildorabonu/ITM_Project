using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using API.Authentication;
using API.Authorization;
using Application;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

namespace API
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddDbContext<DatabaseContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddApplication(builder.Configuration);

            // Override UploadsPath to absolute path relative to ContentRoot
            builder.Services.PostConfigure<FileStorageOptions>(o =>
            {
                if (!Path.IsPathRooted(o.UploadsPath))
                    o.UploadsPath = Path.Combine(builder.Environment.ContentRootPath, o.UploadsPath);
                Directory.CreateDirectory(o.UploadsPath);
            });

            var jwtOptions = builder.Configuration
                .GetSection(JwtOptions.SectionName)
                .Get<JwtOptions>()!;

            var authCookieOptions = builder.Configuration
                .GetSection(AuthCookieOptions.SectionName)
                .Get<AuthCookieOptions>() ?? new AuthCookieOptions();

            // Development'da HTTP localhost ishlatilganda Secure=true cookie'ni bloklaydi —
            // shuning uchun Development'da default tarzda Secure=false ga o'tkazamiz, agar
            // konfiguratsiyada aniq qiymat yo'q bo'lsa.
            if (builder.Environment.IsDevelopment()
                && builder.Configuration.GetSection(AuthCookieOptions.SectionName)["Secure"] is null)
            {
                builder.Services.PostConfigure<AuthCookieOptions>(o => o.Secure = false);
            }

            builder.Services.AddSingleton<IAuthCookieWriter, AuthCookieWriter>();

            builder.Services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtOptions.Issuer,
                        ValidAudience = jwtOptions.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(jwtOptions.SecretKey)),
                        ClockSkew = TimeSpan.Zero
                    };

                    // Authorization headerda token yo'q bo'lsa, httpOnly access_token cookie'dan o'qish
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = ctx =>
                        {
                            if (string.IsNullOrEmpty(ctx.Token))
                            {
                                var cookie = ctx.Request.Cookies[authCookieOptions.AccessTokenName];
                                if (!string.IsNullOrEmpty(cookie))
                                    ctx.Token = cookie;
                            }
                            return Task.CompletedTask;
                        }
                    };
                });

            builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
            builder.Services.AddAuthorization(options =>
            {
                var modules = Enum.GetValues<PermissionModule>().Select(m => m.ToString());
                var actions = Enum.GetValues<PermissionAction>().Select(a => a.ToString());
                foreach (var module in modules)
                    foreach (var action in actions)
                    {
                        var perm = $"{module}.{action}";
                        options.AddPolicy(perm, policy =>
                            policy.Requirements.Add(new PermissionRequirement(perm)));
                    }
            });

            builder.Services.AddCors(options =>
            {
                options.AddDefaultPolicy(policy =>
                {
                    policy.SetIsOriginAllowed(origin =>
                          {
                              if (string.IsNullOrEmpty(origin)) return false;
                              if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                              var host = uri.Host;
                              return host == "localhost"
                                  || host == "127.0.0.1"
                                  || host.StartsWith("192.168.")
                                  || host.StartsWith("10.")
                                  || host.StartsWith("172.");
                          })
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
            });

            builder.Services.AddMemoryCache();

            builder.Services.AddRateLimiter(options =>
            {
                options.AddPolicy("login", httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: GetClientIp(httpContext),
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 5,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));

                options.AddPolicy("refresh", httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: GetClientIp(httpContext),
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));

                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                {
                    if (!httpContext.Request.Path.StartsWithSegments("/api"))
                        return RateLimitPartition.GetNoLimiter("__skip");

                    var key = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                              ?? GetClientIp(httpContext);

                    return RateLimitPartition.GetSlidingWindowLimiter(
                        partitionKey: key,
                        factory: _ => new SlidingWindowRateLimiterOptions
                        {
                            PermitLimit = 300,
                            Window = TimeSpan.FromMinutes(1),
                            SegmentsPerWindow = 6,
                            QueueLimit = 0
                        });
                });

                options.OnRejected = async (ctx, token) =>
                {
                    ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
                        ctx.HttpContext.Response.Headers.RetryAfter = ((int)retry.TotalSeconds).ToString();
                    await ctx.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        succeeded = false,
                        statusCode = 429,
                        errors = new[] { "So'rovlar chegarasi oshib ketdi. Iltimos, biroz kutib turing." }
                    }, token);
                };
            });

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "ITM API", Version = "v1" });

                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Enter your JWT token"
                });

                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                var swaggerUser = builder.Configuration["SWAGGER_USERNAME"];
                var swaggerPass = builder.Configuration["SWAGGER_PASSWORD"];

                app.UseWhen(
                    ctx => ctx.Request.Path.StartsWithSegments("/swagger"),
                    branch => branch.Use(async (ctx, next) =>
                    {
                        if (string.IsNullOrEmpty(swaggerUser) || string.IsNullOrEmpty(swaggerPass))
                        {
                            ctx.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                            await ctx.Response.WriteAsync(
                                "Swagger ochiq emas — SWAGGER_USERNAME va SWAGGER_PASSWORD env o'zgaruvchilari sozlanmagan.");
                            return;
                        }

                        string? authHeader = ctx.Request.Headers["Authorization"];
                        if (authHeader != null
                            && authHeader.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                var encoded = authHeader.Substring("Basic ".Length).Trim();
                                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
                                var sep = decoded.IndexOf(':');
                                if (sep > 0)
                                {
                                    var user = decoded.Substring(0, sep);
                                    var pass = decoded.Substring(sep + 1);

                                    var userBytes = Encoding.UTF8.GetBytes(user);
                                    var expectedUserBytes = Encoding.UTF8.GetBytes(swaggerUser);
                                    var passBytes = Encoding.UTF8.GetBytes(pass);
                                    var expectedPassBytes = Encoding.UTF8.GetBytes(swaggerPass);

                                    var userOk = userBytes.Length == expectedUserBytes.Length
                                        && CryptographicOperations.FixedTimeEquals(userBytes, expectedUserBytes);
                                    var passOk = passBytes.Length == expectedPassBytes.Length
                                        && CryptographicOperations.FixedTimeEquals(passBytes, expectedPassBytes);

                                    if (userOk && passOk)
                                    {
                                        await next();
                                        return;
                                    }
                                }
                            }
                            catch (FormatException) { }
                        }

                        ctx.Response.Headers["WWW-Authenticate"] = "Basic realm=\"ITM Swagger\", charset=\"UTF-8\"";
                        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    }));

                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseCors();

            // Barcha javoblarda MIME sniffing'ni o'chirish — yuklangan fayllarni
            // browser noto'g'ri turdek talqin qilishining oldini oladi.
            app.Use(async (ctx, next) =>
            {
                ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
                await next();
            });

            // Yuklangan fayllarni (rasmlarni) statik fayl sifatida serve qilish
            var uploadsPath = app.Services.GetRequiredService<IOptions<FileStorageOptions>>().Value.UploadsPath;
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
                RequestPath = "/uploads",
                OnPrepareResponse = ctx =>
                {
                    ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                }
            });

            app.UseRateLimiter();

            app.UseAuthentication();

            // CSRF Double-Submit Cookie himoyasi — autentifikatsiyadan keyin, lekin
            // authorization'gacha tekshiramiz. Login va refresh'dan tashqari barcha
            // state-changing (POST/PUT/PATCH/DELETE) /api so'rovlari uchun majburiy.
            app.UseMiddleware<CsrfValidationMiddleware>();

            app.UseAuthorization();

            app.MapControllers();

            await app.Services.ApplyMigrationsAsync();

            // Mavjud ishlab chiqarishdagi shartnomalar uchun ManufacturedProducts jadvalini
            // bir martalik sinxronlash — yangi sync logikasi ishga tushishidan oldin tasdiqlangan
            // mahsulotlar uchun yozuv yo'q bo'lishi mumkin.
            using (var scope = app.Services.CreateScope())
            {
                var ctx = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
                var syncService = scope.ServiceProvider.GetRequiredService<IManufacturedProductService>();

                var contractIds = await ctx.Contracts
                    .Where(c => c.IsActive &&
                                (c.Status == ContractStatus.InProduction || c.Status == ContractStatus.Completed))
                    .Select(c => c.Id)
                    .ToListAsync();

                foreach (var cid in contractIds)
                    await syncService.SyncForContractAsync(cid);
            }

            // ActivityLog jadvali bo'sh bo'lsa — mavjud yozuvlardan bir marta to'ldiramiz.
            using (var scope = app.Services.CreateScope())
            {
                var ctx = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
                if (!await ctx.ActivityLogs.AnyAsync())
                    await ActivityLogBackfill.RunAsync(ctx);
            }

            // Pre-warm user lookup cache so first request is instant
            using (var scope = app.Services.CreateScope())
            {
                var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
                await userService.GetLookupAsync();
            }

            app.Run();
        }

        private static string GetClientIp(HttpContext httpContext)
            => httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
