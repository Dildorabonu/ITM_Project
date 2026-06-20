using System.Security.Claims;
using DataAccess.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace API.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

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

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        // Permission.Key (Module.Action) computed property — mapped ustun emas, shuning uchun
        // Module/Action juftliklarini bazadan olib, kalitni xotirada solishtiramiz.
        var pairs = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive)
            .SelectMany(u => u.Role!.RolePermissions
                .Select(rp => new { rp.Permission.Module, rp.Permission.Action }))
            .ToListAsync();

        if (pairs.Any(p => $"{p.Module}.{p.Action}" == requirement.Permission))
            context.Succeed(requirement);
    }
}
