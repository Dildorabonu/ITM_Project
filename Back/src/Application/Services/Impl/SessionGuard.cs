using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Application.Services.Impl;

public class SessionGuard : ISessionGuard
{
    // Faol javob qisqa muddat keshlanadi: shu jarayondan tashqarida bekor qilingan
    // seans ham (masalan server qayta ishga tushgach) ko'pi bilan shuncha yashaydi.
    private static readonly TimeSpan ActiveTtl = TimeSpan.FromSeconds(30);

    // Bekor qilingan seans hech qachon qayta faollashmaydi, shuning uchun uzoqroq turadi.
    private static readonly TimeSpan RevokedTtl = TimeSpan.FromMinutes(30);

    private readonly DatabaseContext _context;
    private readonly IMemoryCache _cache;

    public SessionGuard(DatabaseContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<bool> IsActiveAsync(Guid familyId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(Key(familyId), out bool cached))
            return cached;

        var now = DateTime.UtcNow;
        var active = await _context.RefreshTokens
            .AsNoTracking()
            .AnyAsync(rt => rt.FamilyId == familyId && !rt.IsRevoked && rt.ExpiresAt > now, ct);

        _cache.Set(Key(familyId), active, active ? ActiveTtl : RevokedTtl);

        return active;
    }

    public void MarkRevoked(Guid familyId) =>
        _cache.Set(Key(familyId), false, RevokedTtl);

    private static string Key(Guid familyId) => $"session:{familyId}";
}
