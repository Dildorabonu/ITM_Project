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
    }

    private static async System.Threading.Tasks.Task SeedPermissionsAsync(DatabaseContext context)
    {
        var modules = Enum.GetValues<PermissionModule>();
        var actions = Enum.GetValues<PermissionAction>();

        // Eski, endi ishlatilmaydigan permission'larni o'chirish
        var validModules = modules.ToList();
        var validActions = actions.ToList();

        var allExisting = await context.Permissions.ToListAsync();
        var outdatedPermissions = allExisting
            .Where(p => !validModules.Contains(p.Module) || !validActions.Contains(p.Action))
            .ToList();

        if (outdatedPermissions.Count > 0)
        {
            context.Permissions.RemoveRange(outdatedPermissions);
            await context.SaveChangesAsync();
        }

        // Yangi permission'larni qo'shish
        foreach (var module in modules)
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
