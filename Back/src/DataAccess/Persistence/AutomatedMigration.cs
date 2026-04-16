using Core.Entities;
using Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Linq;

namespace DataAccess.Persistence;

public static class AutomatedMigration
{
    public static async System.Threading.Tasks.Task ApplyMigrationsAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
        await context.Database.MigrateAsync();
        await SeedPermissionsAsync(context);
        await SeedSuperAdminUserAsync(context);
        await SeedSuperAdminPermissionsAsync(context);
        await SeedDepartmentsAsync(context);
    }

    private static readonly Dictionary<PermissionModule, PermissionAction[]> ModuleActions = new()
    {
        [PermissionModule.Users]              = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete],
        [PermissionModule.Roles]              = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete],
        [PermissionModule.Departments]        = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete],
        [PermissionModule.Products]           = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete],
        [PermissionModule.Contracts]          = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll, PermissionAction.Approve],
        [PermissionModule.TechProcess]        = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll],
        [PermissionModule.TechnicalDrawings]  = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll],
        [PermissionModule.CostNorm]           = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll],
        [PermissionModule.MaterialInventory]  = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll, PermissionAction.SendToWarehouse],
        [PermissionModule.Tasks]              = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll],
        [PermissionModule.Notifications]      = [PermissionAction.View, PermissionAction.ViewAll],
        [PermissionModule.Requisitions]       = [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete, PermissionAction.ViewAll, PermissionAction.Approve, PermissionAction.SendToWarehouse],
    };

    private static async System.Threading.Tasks.Task SeedPermissionsAsync(DatabaseContext context)
    {
        // Ortiqcha (endi kerak bo'lmagan) permission'larni o'chirish
        var allExisting = await context.Permissions.ToListAsync();
        var outdatedPermissions = allExisting
            .Where(p => !ModuleActions.TryGetValue(p.Module, out var allowed) || !allowed.Contains(p.Action))
            .ToList();

        if (outdatedPermissions.Count > 0)
        {
            var outdatedIds = outdatedPermissions.Select(p => p.Id).ToHashSet();
            var rolePermsToDelete = await context.RolePermissions
                .Where(rp => outdatedIds.Contains(rp.PermissionId))
                .ToListAsync();

            context.RolePermissions.RemoveRange(rolePermsToDelete);
            context.Permissions.RemoveRange(outdatedPermissions);
            await context.SaveChangesAsync();
        }

        // Yangi permission'larni qo'shish
        foreach (var (module, actions) in ModuleActions)
        {
            foreach (var action in actions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Module == module && p.Action == action);

                if (!exists)
                {
                    context.Permissions.Add(new Permission
                    {
                        Id = Guid.NewGuid(),
                        Module = module,
                        Action = action,
                    });
                }
            }
        }

        await context.SaveChangesAsync();
    }

    private static async System.Threading.Tasks.Task SeedSuperAdminUserAsync(DatabaseContext context)
    {
        var superAdminRoleId = new Guid("00000000-0000-0000-0000-000000000001");
        var superAdminUserId = new Guid("00000000-0000-0000-0000-000000000001");

        if (!await context.Users.AnyAsync(u => u.Id == superAdminUserId))
        {
            var superAdminUser = new User
            {
                Id = superAdminUserId,
                FirstName = "Super",
                LastName = "Admin",
                Login = "superadmin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                RoleId = superAdminRoleId,
                DepartmentId = null,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            };

            context.Users.Add(superAdminUser);
            await context.SaveChangesAsync();
        }
    }

    private static async System.Threading.Tasks.Task SeedDepartmentsAsync(DatabaseContext context)
    {
        var seedDepartments = new[]
        {
            // Bo'limlar
            (Name: "Sifat nazorati bo'limi",                                                                          Type: DepartmentType.Bolim),
            (Name: "Konstruktorlik bo'limi",                                                                          Type: DepartmentType.Bolim),
            (Name: "Texnologiya bo'limi",                                                                             Type: DepartmentType.Bolim),
            (Name: "Istiqbolli loyihalarni va innovatsiani rivojlantirish hamda hamkorlar bilan ishlash bo'limi",     Type: DepartmentType.Bolim),
            (Name: "Axborot tizimlar va dasturiy ta'minot bo'limi",                                                   Type: DepartmentType.Bolim),
            (Name: "Marketing, savdo va xarid bo'limi",                                                               Type: DepartmentType.Bolim),
            (Name: "Iqtisodiy rejalashtirish bo'limi",                                                                Type: DepartmentType.Bolim),
            (Name: "Buxgalteriya bo'limi",                                                                            Type: DepartmentType.Bolim),
            (Name: "Kadrlar va umumiy bo'lim",                                                                        Type: DepartmentType.Bolim),
            (Name: "Xo'jalik ishlari bo'limi",                                                                        Type: DepartmentType.Bolim),
            (Name: "Energetika bo'limi",                                                                              Type: DepartmentType.Bolim),
            (Name: "Nazorat va qo'riqlash bo'limi",                                                                   Type: DepartmentType.Bolim),
            (Name: "Omborxona",                                                                                        Type: DepartmentType.Bolim),

            // Ishlab chiqarish sexlari
            (Name: "Mexanika va metalga qayta ishlov berish sexi",                                                    Type: DepartmentType.IshlabChiqarish),
            (Name: "Optik-elektron mahsulotlar ishlab chiqarish sexi",                                                Type: DepartmentType.IshlabChiqarish),
            (Name: "Himoya vositalarini ishlab chiqarish sexi",                                                       Type: DepartmentType.IshlabChiqarish),
            (Name: "Tikuv sexi",                                                                                      Type: DepartmentType.IshlabChiqarish),
            (Name: "Uchuvchisiz uchish apparatlariga radioelektron qarshi kurashish vositalarini ishlab chiqarish sexi", Type: DepartmentType.IshlabChiqarish),

            // Boshqaruv
            (Name: "Korxona boshqaruvi",                                                                              Type: DepartmentType.Boshqaruv),
        };

        foreach (var (name, type) in seedDepartments)
        {
            var exists = await context.Departments.AnyAsync(d => d.Name == name);
            if (!exists)
            {
                context.Departments.Add(new Department
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    Type = type,
                    EmployeeCount = 0,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        await context.SaveChangesAsync();
    }

    private static async System.Threading.Tasks.Task SeedSuperAdminPermissionsAsync(DatabaseContext context)
    {
        var superAdminRoleId = new Guid("00000000-0000-0000-0000-000000000001");

        var allPermissions = await context.Permissions.ToListAsync();

        foreach (var permission in allPermissions)
        {
            var exists = await context.RolePermissions
                .AnyAsync(rp => rp.RoleId == superAdminRoleId && rp.PermissionId == permission.Id);

            if (!exists)
            {
                context.RolePermissions.Add(new RolePermission
                {
                    RoleId = superAdminRoleId,
                    PermissionId = permission.Id,
                });
            }
        }

        await context.SaveChangesAsync();
    }
}
