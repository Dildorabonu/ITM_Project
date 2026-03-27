using Application.Options;
using Application.Services;
using Application.Services.Impl;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class ApplicationDependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));

        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IContractService, ContractService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<ITechProcessService, TechProcessService>();
        services.AddScoped<ITechnicalDrawingService, TechnicalDrawingService>();

        return services;
    }
}
