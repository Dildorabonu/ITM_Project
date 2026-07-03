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
        services.Configure<AuthCookieOptions>(configuration.GetSection(AuthCookieOptions.SectionName));
        services.Configure<LockoutOptions>(configuration.GetSection(LockoutOptions.SectionName));

        services.AddHttpContextAccessor();

        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IDepartmentWarehouseService, DepartmentWarehouseService>();
        services.AddScoped<IContractService, ContractService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<ITechProcessService, TechProcessService>();
        services.AddScoped<ITechnicalDrawingService, TechnicalDrawingService>();
        services.AddScoped<ICostNormService, CostNormService>();
        services.AddScoped<IContractTaskService, ContractTaskService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IRequisitionService, RequisitionService>();
        services.AddScoped<IStockMovementService, StockMovementService>();
        services.AddScoped<IFileStorageService, FileStorageService>();
        services.AddScoped<IManufacturedProductService, ManufacturedProductService>();
        services.AddScoped<IProductCatalogService, ProductCatalogService>();
        services.AddScoped<IShipmentBatchService, ShipmentBatchService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IActivityLogService, ActivityLogService>();
        services.AddScoped<IQrCodeService, QrCodeService>();
        services.AddScoped<IScanService, ScanService>();

        return services;
    }
}
