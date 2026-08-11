using Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace DataAccess.Persistence;

public class DatabaseContext : DbContext
{
    public DatabaseContext(DbContextOptions<DatabaseContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<Department> Departments { get; set; }
    public DbSet<Contract> Contracts { get; set; }
    public DbSet<ContractProduct> ContractProducts { get; set; }
    public DbSet<ProductCatalog> ProductCatalogs { get; set; }
    public DbSet<ContractProductDepartment> ContractProductDepartments { get; set; }
    public DbSet<ContractProductUser> ContractProductUsers { get; set; }
    public DbSet<ContractUser> ContractUsers { get; set; }
    public DbSet<ContractDepartment> ContractDepartments { get; set; }
    public DbSet<TechProcess> TechProcesses { get; set; }
    public DbSet<Material> Materials { get; set; }
    public DbSet<StockIn> StockIns { get; set; }
    public DbSet<StockOut> StockOuts { get; set; }
    public DbSet<StockMovement> StockMovements { get; set; }
    public DbSet<Core.Entities.Task> Tasks { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Attachment> Attachments { get; set; }
    public DbSet<TechnicalDrawing> TechnicalDrawings { get; set; }
    public DbSet<CostNorm> CostNorms { get; set; }
    public DbSet<ContractTask> ContractTasks { get; set; }
    public DbSet<ContractTaskDailyLog> ContractTaskDailyLogs { get; set; }
    public DbSet<CostNormItem> CostNormItems { get; set; }
    public DbSet<Requisition> Requisitions { get; set; }
    public DbSet<RequisitionItem> RequisitionItems { get; set; }
    public DbSet<ManufacturedProduct> ManufacturedProducts { get; set; }
    public DbSet<ShipmentBatch> ShipmentBatches { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<LoginAttempt> LoginAttempts { get; set; }
    public DbSet<LicenseState> LicenseStates { get; set; }
    public DbSet<MeterReading> MeterReadings { get; set; }
    public DbSet<MeterEnergyHourly> MeterEnergyHourly { get; set; }
    public DbSet<EnergyTariff> EnergyTariffs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Mahsulot nomlari bo'yicha "o'xshashlik" (fuzzy) qidiruvi uchun PostgreSQL
        // pg_trgm kengaytmasi. EF.Functions.TrigramsSimilarity shu orqali ishlaydi.
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DatabaseContext).Assembly);
    }
}
