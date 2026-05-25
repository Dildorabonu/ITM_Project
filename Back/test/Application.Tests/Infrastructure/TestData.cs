using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;

namespace Application.Tests.Infrastructure;

/// <summary>
/// Tez-tez ishlatiladigan User / Role / Permission seed helperlari.
/// Har bir metod default qiymatlar bilan ishlaydi, override qilish ham mumkin.
/// </summary>
public static class TestData
{
    public static Role SeedRole(
        DatabaseContext context,
        string name = "Admin",
        bool isActive = true,
        Guid? id = null)
    {
        var role = new Role
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };

        context.Roles.Add(role);
        context.SaveChanges();
        return role;
    }

    public static User SeedUser(
        DatabaseContext context,
        string login = "admin",
        string firstName = "Test",
        string lastName = "User",
        string passwordHash = "$2a$11$test.hash.placeholder",
        Guid? roleId = null,
        Guid? departmentId = null,
        bool isActive = true,
        bool isHead = false,
        Guid? id = null)
    {
        var user = new User
        {
            Id = id ?? Guid.NewGuid(),
            Login = login,
            FirstName = firstName,
            LastName = lastName,
            PasswordHash = passwordHash,
            RoleId = roleId,
            DepartmentId = departmentId,
            IsActive = isActive,
            IsHead = isHead,
            CreatedAt = DateTime.UtcNow,
        };

        context.Users.Add(user);
        context.SaveChanges();
        return user;
    }

    public static Permission SeedPermission(
        DatabaseContext context,
        PermissionModule module,
        PermissionAction action,
        Guid? id = null)
    {
        var permission = new Permission
        {
            Id = id ?? Guid.NewGuid(),
            Module = module,
            Action = action,
        };

        context.Permissions.Add(permission);
        context.SaveChanges();
        return permission;
    }

    /// <summary>
    /// Role ga bitta yoki bir nechta permissionlarni RolePermission orqali ulaydi.
    /// </summary>
    public static void AttachPermissions(DatabaseContext context, Guid roleId, params Guid[] permissionIds)
    {
        foreach (var pid in permissionIds)
        {
            context.RolePermissions.Add(new RolePermission
            {
                RoleId = roleId,
                PermissionId = pid,
            });
        }
        context.SaveChanges();
    }
}
