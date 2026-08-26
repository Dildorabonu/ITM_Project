using System.Collections.Concurrent;
using System.Security.Claims;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace API.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

    // "Contracts.View" -> (Module, Action). Policy nomlari cheklangan to'plam,
    // shuning uchun parse natijasi bir marta hisoblanib keshlanadi.
    private static readonly ConcurrentDictionary<string, (PermissionModule Module, PermissionAction Action)?> ParsedKeys = new();

    public PermissionAuthorizationHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        // Ruxsatni JWT 'perm' claim (login paytidagi muzlatilgan snapshot) emas, har
        // so'rovda bazadan jonli o'qiymiz. Aks holda rolga ruxsat berilganda foydalanuvchi
        // qayta login qilmaguncha (yoki token muddati tugamaguncha) o'zgarish kuchga kirmaydi.
        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return;

        var parsed = ParsedKeys.GetOrAdd(requirement.Permission, static key =>
        {
            var dot = key.IndexOf('.');
            if (dot <= 0 || dot == key.Length - 1)
                return null;

            if (!Enum.TryParse<PermissionModule>(key[..dot], out var module) ||
                !Enum.TryParse<PermissionAction>(key[(dot + 1)..], out var action))
                return null;

            return (module, action);
        });

        if (parsed is not { } permission)
            return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        // Barcha ruxsat juftliklarini yuklab xotirada solishtirish o'rniga, bitta
        // EXISTS so'rovi — (Module, Action) unique indeksidan foydalanib bool qaytaradi.
        var granted = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId
                        && u.IsActive
                        && u.Role!.RolePermissions.Any(rp =>
                               rp.Permission.Module == permission.Module &&
                               rp.Permission.Action == permission.Action));

        if (granted)
            context.Succeed(requirement);
    }
}
