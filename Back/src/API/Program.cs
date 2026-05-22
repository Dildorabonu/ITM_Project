using System.Text;
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
    }
}
