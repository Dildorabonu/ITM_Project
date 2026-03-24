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
    public DbSet<ContractUser> ContractUsers { get; set; }
    public DbSet<TechProcess> TechProcesses { get; set; }
    public DbSet<TechStep> TechSteps { get; set; }
    public DbSet<Material> Materials { get; set; }
    public DbSet<StockIn> StockIns { get; set; }
    public DbSet<StockOut> StockOuts { get; set; }
    public DbSet<TechProcessMaterial> TechProcessMaterials { get; set; }
    public DbSet<Core.Entities.Task> Tasks { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Attachment> Attachments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DatabaseContext).Assembly);
    }
}
