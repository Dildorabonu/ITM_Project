using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DataAccess.Persistence;

public static class AutomatedMigration
{
    public static async System.Threading.Tasks.Task ApplyMigrationsAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
        await context.Database.MigrateAsync();
        await SeedSuperAdminUserAsync(context);
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
}
