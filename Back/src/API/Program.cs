using System.Text;
using API.Authorization;
using Application;
using Application.Options;
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
                    policy.WithOrigins("http://localhost:3000", "https://localhost:3000",
                                      "http://localhost:3001", "https://localhost:3001")
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
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
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseCors();

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            await app.Services.ApplyMigrationsAsync();

            app.Run();
        }
    }
}
