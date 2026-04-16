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
        await SeedDefaultRolesAsync(context);
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
        [PermissionModule.WarehouseCheck]      = [PermissionAction.View],
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

    private static async System.Threading.Tasks.Task SeedDefaultRolesAsync(DatabaseContext context)
    {
        var roles = new[]
        {
            new
            {
                Id = new Guid("51501175-3742-4610-8b84-f79495340122"),
                Name = "Mexanika",
                Description = "Tex jarayon & Normalar",
                CreatedAt = new DateTime(2026, 4, 16, 8, 41, 3, 307, DateTimeKind.Utc).AddTicks(2440),
                Permissions = new[] {
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.Create),
                    (PermissionModule.TechProcess, PermissionAction.Update),
                    (PermissionModule.TechProcess, PermissionAction.Delete),
                    (PermissionModule.TechProcess, PermissionAction.ViewAll),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.ViewAll),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.CostNorm, PermissionAction.Create),
                    (PermissionModule.CostNorm, PermissionAction.Update),
                    (PermissionModule.CostNorm, PermissionAction.Delete),
                    (PermissionModule.CostNorm, PermissionAction.ViewAll),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("2fe2f5d4-233c-4d58-9ff5-0e043a9fb5a4"),
                Name = "Kontruktor",
                Description = "Texnik chizmalar",
                CreatedAt = new DateTime(2026, 4, 16, 9, 12, 49, 772, DateTimeKind.Utc).AddTicks(4530),
                Permissions = new[] {
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.Create),
                    (PermissionModule.TechnicalDrawings, PermissionAction.Update),
                    (PermissionModule.TechnicalDrawings, PermissionAction.Delete),
                    (PermissionModule.TechnicalDrawings, PermissionAction.ViewAll),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("3cc44a5d-1871-4711-bc0a-9a7753c1a887"),
                Name = "Marketing",
                Description = "Shartnomalar tuzish",
                CreatedAt = new DateTime(2026, 4, 16, 9, 14, 58, 377, DateTimeKind.Utc).AddTicks(6550),
                Permissions = new[] {
                    (PermissionModule.Departments, PermissionAction.View),
                    (PermissionModule.Products, PermissionAction.View),
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.Contracts, PermissionAction.Create),
                    (PermissionModule.Contracts, PermissionAction.Update),
                    (PermissionModule.Contracts, PermissionAction.Delete),
                    (PermissionModule.Contracts, PermissionAction.ViewAll),
                    (PermissionModule.Contracts, PermissionAction.Approve),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("5910edfc-f5bd-4d09-9d38-48d59a70bbaf"),
                Name = "Ishlab chiqarish",
                Description = "ishlab chiqarish tuzilmalari boshliqlari",
                CreatedAt = new DateTime(2026, 4, 16, 9, 29, 29, 601, DateTimeKind.Utc).AddTicks(7680),
                Permissions = new[] {
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.Tasks, PermissionAction.View),
                    (PermissionModule.Tasks, PermissionAction.Create),
                    (PermissionModule.Tasks, PermissionAction.Update),
                    (PermissionModule.Tasks, PermissionAction.Delete),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("8f9db59d-b4cc-45cf-b9fa-4643e8a5cc41"),
                Name = "Boshqaruv",
                Description = "Boshqaruv tuzilmasidagilar uchun",
                CreatedAt = new DateTime(2026, 4, 16, 9, 33, 56, 564, DateTimeKind.Utc).AddTicks(3690),
                Permissions = new[] {
                    (PermissionModule.Users, PermissionAction.View),
                    (PermissionModule.Roles, PermissionAction.View),
                    (PermissionModule.Products, PermissionAction.View),
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.Contracts, PermissionAction.ViewAll),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.ViewAll),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.ViewAll),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.CostNorm, PermissionAction.ViewAll),
                    (PermissionModule.Tasks, PermissionAction.View),
                    (PermissionModule.Tasks, PermissionAction.ViewAll),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.ViewAll),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("58dbcbab-b38a-45bd-b4ee-22feed5b2089"),
                Name = "Omborchi",
                Description = "Omborchi",
                CreatedAt = new DateTime(2026, 4, 16, 9, 34, 54, 378, DateTimeKind.Utc).AddTicks(2200),
                Permissions = new[] {
                    (PermissionModule.Products, PermissionAction.View),
                    (PermissionModule.Products, PermissionAction.Create),
                    (PermissionModule.Products, PermissionAction.Update),
                    (PermissionModule.Products, PermissionAction.Delete),
                    (PermissionModule.WarehouseCheck, PermissionAction.View),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.ViewAll),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
            new
            {
                Id = new Guid("02126cf3-623a-4cbc-af64-78a634a2c727"),
                Name = "Bo'lim boshlig'i",
                Description = "Bo'lim boshlig'lari uchun",
                CreatedAt = new DateTime(2026, 4, 16, 9, 36, 32, 411, DateTimeKind.Utc).AddTicks(900),
                Permissions = new[] {
                    (PermissionModule.Departments, PermissionAction.View),
                    (PermissionModule.Products, PermissionAction.View),
                    (PermissionModule.Contracts, PermissionAction.View),
                    (PermissionModule.TechProcess, PermissionAction.View),
                    (PermissionModule.TechnicalDrawings, PermissionAction.View),
                    (PermissionModule.CostNorm, PermissionAction.View),
                    (PermissionModule.Notifications, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.View),
                    (PermissionModule.Requisitions, PermissionAction.Create),
                    (PermissionModule.Requisitions, PermissionAction.Update),
                    (PermissionModule.Requisitions, PermissionAction.Delete),
                    (PermissionModule.Requisitions, PermissionAction.Approve),
                    (PermissionModule.Requisitions, PermissionAction.SendToWarehouse),
                }
            },
        };

        var allPermissions = await context.Permissions.ToListAsync();

        foreach (var roleDef in roles)
        {
            if (!await context.Roles.AnyAsync(r => r.Id == roleDef.Id))
            {
                context.Roles.Add(new Role
                {
                    Id = roleDef.Id,
                    Name = roleDef.Name,
                    Description = roleDef.Description,
                    IsActive = true,
                    CreatedAt = roleDef.CreatedAt,
                });
                await context.SaveChangesAsync();
            }

            foreach (var (module, action) in roleDef.Permissions)
            {
                var permission = allPermissions.FirstOrDefault(p => p.Module == module && p.Action == action);
                if (permission == null) continue;

                var exists = await context.RolePermissions
                    .AnyAsync(rp => rp.RoleId == roleDef.Id && rp.PermissionId == permission.Id);

                if (!exists)
                {
                    context.RolePermissions.Add(new RolePermission
                    {
                        RoleId = roleDef.Id,
                        PermissionId = permission.Id,
                    });
                }
            }
        }

        await context.SaveChangesAsync();
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
