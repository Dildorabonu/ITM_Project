using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using API.Authentication;
using API.Authorization;
using API.Licensing;
using API.Middleware;
using Application;
using Application.Helpers;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
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

            // Cookie Secure attribute endi har bir so'rov sxemasiga qarab hisoblanadi
            // (AuthCookieOptions.SecurePolicy = SameAsRequest). HTTP LAN'da Secure qo'yilmaydi,
            // HTTPS orqasida esa avtomatik qo'yiladi — alohida Development override kerak emas.

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
                        },

                        // Access token stateless: seans tugatilsa ham imzosi va muddati
                        // to'g'ri bo'lib qolaveradi. Shuning uchun tokendagi seans hali
                        // tirikmi — shu yerda tekshiriladi (javob keshlanadi).
                        OnTokenValidated = async ctx =>
                        {
                            var claim = ctx.Principal?.FindFirst("sess")?.Value;
                            if (!Guid.TryParse(claim, out var sessionId))
                                return;

                            var guard = ctx.HttpContext.RequestServices.GetRequiredService<ISessionGuard>();
                            if (!await guard.IsActiveAsync(sessionId, ctx.HttpContext.RequestAborted))
                                ctx.Fail("Session revoked.");
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
                    // Origin host majburiy ravishda haqiqiy xususiy/loopback IP (yoki localhost)
                    // bo'lishi tekshiriladi — hujumchi nazoratidagi domen nomlari rad etiladi.
                    // Shu sababli AllowCredentials xavfsiz: faqat ishonchli LAN origin'larga beriladi.
                    policy.SetIsOriginAllowed(TrustedOriginValidator.IsTrustedLanOrigin)
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
                            PermitLimit = 300,
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

            // Litsenziyani har daqiqada qayta tekshiruvchi fon xizmati.
            builder.Services.AddHostedService<LicenseRefreshService>();

            // Hisoblagichni Modbus TCP orqali faol so'rab turuvchi fon xizmati —
            // backend o'zi qurilmaning 502-portidan registrlarni o'qiydi.
            builder.Services.Configure<MeterPollerOptions>(
                builder.Configuration.GetSection(MeterPollerOptions.SectionName));
            builder.Services.AddHostedService<API.Services.MeterPollerService>();

            builder.Services.AddHostedService<API.Services.EnergyRollupBackgroundService>();

            // Global exception handler — ushlanmagan xatoliklar mijozga stack trace sifatida
            // chiqmasligi uchun. AddProblemDetails ExceptionHandlerMiddleware talabi
            // (handler false qaytargan kamdan-kam holat uchun zaxira javob).
            builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
            builder.Services.AddProblemDetails();

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

            // Eng birinchi middleware — undan keyingi butun zanjirdagi xatoliklarni ushlaydi
            // (forwarded headers, swagger, CORS, auth va controllerlar shu ichida qoladi).
            app.UseExceptionHandler();

            // Xavfsizlik headerlari (nosniff, X-Frame-Options, Referrer-Policy,
            // Permissions-Policy, cheklovchi CSP) — zanjirning eng boshida, shunda
            // xatolik javoblari va statik fayllar ham qamrab olinadi.
            app.UseMiddleware<SecurityHeadersMiddleware>();

            // Backendga so'rov faqat frontend proksisi orqali keladi, ya'ni TCP ulanish
            // manzili har doim proksining o'zi. Haqiqiy mijoz manzili X-Forwarded-For
            // orqali bilinadi — lekin uni ISHONCHLI proksi qo'ygan bo'lsagina.
            //
            // Next.js rewrite proksisi bu sarlavhani o'zi yozmaydi, mijoz yuborganini
            // esa shundoq uzatib yuboradi. Shuning uchun "loopback'ga ishonish" bu
            // yerda "har kimga ishonish" bilan teng: mijoz o'zi X-Forwarded-For yozib,
            // seanslar ro'yxatidagi IP'ni ham, IP bo'yicha rate-limit'ni ham
            // xohlagancha aldab ketardi. Shu sababli ro'yxat bo'sh bo'lsa sarlavha
            // butunlay e'tiborga olinmaydi.
            //
            // Oldiga chinakam reverse proxy (nginx/Caddy/IIS) qo'yilganda uning manzili
            // appsettings dagi "TrustedProxies" ga yoziladi. ForwardLimit = 1 — faqat
            // eng o'ngdagi qiymat olinadi, uni o'sha proksi qo'ygan bo'ladi; mijoz
            // oldindan yozib yuborgan soxta qiymatlar chapda qolib, e'tiborsiz ketadi.
            var trustedProxies = (builder.Configuration.GetSection("TrustedProxies").Get<string[]>() ?? [])
                .Select(value => IPAddress.TryParse(value, out var address) ? address : null)
                .Where(address => address is not null)
                .ToList();

            if (trustedProxies.Count > 0)
            {
                var forwardedOptions = new ForwardedHeadersOptions
                {
                    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
                    ForwardLimit = 1
                };
                forwardedOptions.KnownNetworks.Clear();
                forwardedOptions.KnownProxies.Clear();
                foreach (var proxy in trustedProxies)
                    forwardedOptions.KnownProxies.Add(proxy!);

                app.UseForwardedHeaders(forwardedOptions);
            }

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

            // Litsenziya muddati tugagan/yaroqsiz bo'lsa barcha /api so'rovlar bloklanadi
            // (login ham). Autentifikatsiyadan oldin turadi — to'liq blok uchun.
            app.UseMiddleware<LicenseEnforcementMiddleware>();

            // Yuklangan fayllarni (rasmlarni) statik fayl sifatida serve qilish
            var uploadsPath = app.Services.GetRequiredService<IOptions<FileStorageOptions>>().Value.UploadsPath;
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
                // Xavfsizlik headerlari SecurityHeadersMiddleware da barcha javoblar
                // uchun qo'yiladi — bu yerda takrorlash shart emas.
                RequestPath = "/uploads",

                // /uploads/req-items ostidagi fayl nomlari — Guid, ular hech qachon
                // qayta ishlatilmaydi va o'zgarmaydi. Shuning uchun "immutable" qilib
                // keshlaymiz: brauzer rasmni bir marta olgach, talabnoma har ochilganda
                // qayta so'ramaydi. Boshqa papkalarda (attachments) fayl nomi original
                // nomdan olinadi va o'chirilgandan keyin takrorlanishi mumkin —
                // ularga kesh qo'ymaymiz.
                OnPrepareResponse = ctx =>
                {
                    if (ctx.Context.Request.Path.StartsWithSegments("/uploads/req-items", StringComparison.OrdinalIgnoreCase))
                        ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
                }
            });

            app.UseAuthentication();

            // Rate limiter MUST run after authentication so the global limiter can
            // partition by the authenticated user id (ClaimTypes.NameIdentifier).
            // Otherwise httpContext.User is empty and every request falls back to the
            // proxy IP — collapsing the per-user 300/min budget into one shared bucket.
            app.UseRateLimiter();

            // CSRF Double-Submit Cookie himoyasi — autentifikatsiyadan keyin, lekin
            // authorization'gacha tekshiramiz. Login va refresh'dan tashqari barcha
            // state-changing (POST/PUT/PATCH/DELETE) /api so'rovlari uchun majburiy.
            app.UseMiddleware<CsrfValidationMiddleware>();

            app.UseAuthorization();

            app.MapControllers();

            await app.Services.ApplyMigrationsAsync();

            // Litsenziyani startda bir marta tekshiramiz — birinchi so'rovlar to'g'ri
            // holat bilan qarshi olinishi uchun (LicenseGuard to'ldiriladi).
            using (var scope = app.Services.CreateScope())
            {
                var licenseService = scope.ServiceProvider.GetRequiredService<ILicenseService>();
                await licenseService.RefreshAsync();
            }

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

            // NameNormalized hali to'ldirilmagan mahsulotlar uchun bir martalik backfill
            // (yangi ustun qo'shilganda mavjud yozuvlar bo'sh bo'ladi).
            using (var scope = app.Services.CreateScope())
            {
                var ctx = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
                var toFix = await ctx.Products.Where(p => p.NameNormalized == "").ToListAsync();
                if (toFix.Count > 0)
                {
                    foreach (var p in toFix)
                        p.NameNormalized = TextNormalizer.Normalize(p.Name);
                    await ctx.SaveChangesAsync();
                }
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
