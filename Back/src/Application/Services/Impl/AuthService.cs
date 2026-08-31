using Application.DTOs;
using Application.DTOs.Auth;
using Application.Helpers;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class AuthService : IAuthService
{
    private readonly DatabaseContext _context;
    private readonly JwtOptions _jwtOptions;
    private readonly LockoutOptions _lockout;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ISessionGuard? _sessionGuard;

    public AuthService(
        DatabaseContext context,
        IOptions<JwtOptions> jwtOptions,
        IHttpContextAccessor httpContextAccessor,
        IOptions<LockoutOptions>? lockoutOptions = null,
        ISessionGuard? sessionGuard = null)
    {
        _context = context;
        _jwtOptions = jwtOptions.Value;
        _lockout = lockoutOptions?.Value ?? new LockoutOptions();
        _httpContextAccessor = httpContextAccessor;
        _sessionGuard = sessionGuard;
    }

    /// <summary>Autentifikatsiya uchun kerak bo'lgan User maydonlari — butun entity emas.</summary>
    private sealed record AuthUserRow(
        Guid Id, string Login, string FirstName, string LastName, Guid? RoleId, Guid? DepartmentId);

    /// <summary>Rol nomi + permission kalitlari — JWT claim'lari va AuthUserDto uchun yagona manba.</summary>
    private sealed record RoleContext(string Name, List<string> Permissions)
    {
        public static RoleContext Empty => new(string.Empty, []);
    }

    public async Task<ApiResult<AuthResponseDto>> LoginAsync(LoginDto dto)
    {
        var (ip, _) = GetRequestContext();
        var now = DateTime.UtcNow;

        // Faqat User qatorining o'zi olinadi. Rol/permission grafi (Roles × RolePermissions ×
        // Permissions JOIN) endi faqat parol to'g'ri chiqqanda, alohida yengil so'rov bilan
        // yuklanadi — muvaffaqiyatsiz urinishlar umuman JOIN qilmaydi.
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Login == dto.Login && u.IsActive);

        if (user is not null && user.LockoutEnd.HasValue && user.LockoutEnd.Value > now)
        {
            await RecordAttemptAsync(user.Id, dto.Login, ip, success: false);
            var minutesLeft = Math.Max(1, (int)Math.Ceiling((user.LockoutEnd.Value - now).TotalMinutes));
            return ApiResult<AuthResponseDto>.Failure(
                [$"Hisob {minutesLeft} daqiqaga vaqtincha bloklangan. Iltimos, keyinroq urinib ko'ring."],
                statusCode: 423);
        }

        if (user is null || !PasswordHelper.VerifyPassword(dto.Password, user.PasswordHash))
        {
            await RecordAttemptAsync(user?.Id, dto.Login, ip, success: false);

            if (user is not null)
            {
                var recentFailures = await CountFailuresInWindowAsync(user.Id, now, user.LockoutEnd);
                if (recentFailures >= _lockout.MaxFailedAttempts)
                {
                    user.LockoutEnd = now.Add(_lockout.LockoutDuration);
                    await _context.SaveChangesAsync();
                    return ApiResult<AuthResponseDto>.Failure(
                        [$"Hisob {_lockout.LockoutMinutes} daqiqaga bloklandi. Ko'p marta noto'g'ri parol kiritildi."],
                        statusCode: 423);
                }

                var remaining = _lockout.MaxFailedAttempts - recentFailures;
                return ApiResult<AuthResponseDto>.Failure(
                    [$"Login yoki parol noto'g'ri. Yana {remaining} ta urinish qoldi."],
                    statusCode: 401);
            }

            return ApiResult<AuthResponseDto>.Failure(["Login yoki parol noto'g'ri."], statusCode: 401);
        }

        // Muvaffaqiyatli kirish — urinish yozuvi, lockout tozalash va yangi refresh token
        // bitta SaveChanges'da yoziladi (avval ikkita alohida yozuv bor edi).
        AddAttempt(user.Id, dto.Login, ip, success: true);
        user.LockoutEnd = null;

        var refreshToken = CreateRefreshToken(user.Id, familyId: Guid.NewGuid());
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        var role = await LoadRoleContextAsync(user.RoleId);
        var userDto = BuildUserDto(user.Login, user.FirstName, user.LastName, user.DepartmentId, role);
        var (accessToken, accessExpiresAt) = BuildAccessToken(user.Id, userDto, refreshToken.FamilyId);

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshTokenExpiresAt = refreshToken.ExpiresAt,
            User = userDto
        });
    }

    public async Task<ApiResult<AuthResponseDto>> RefreshTokenAsync(string refreshToken)
    {
        // Token bilan birga butun User → Role → RolePermissions → Permissions grafini
        // yuklash o'rniga, avval tokenning o'zi tekshiriladi; foydalanuvchi ma'lumoti
        // faqat token haqiqiy bo'lgandagina proyeksiya orqali olinadi.
        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (token is null)
            return ApiResult<AuthResponseDto>.Failure(["Invalid refresh token."]);

        // Reuse detection: revoked token presented again → assume compromise, kill whole family
        if (token.IsRevoked)
        {
            await RevokeFamilyAsync(token.FamilyId, "ReuseDetected");
            return ApiResult<AuthResponseDto>.Failure(["Refresh token reuse detected. All sessions revoked."]);
        }

        if (token.ExpiresAt < DateTime.UtcNow)
        {
            MarkRevoked(token, "Expired");
            await _context.SaveChangesAsync();
            return ApiResult<AuthResponseDto>.Failure(["Refresh token expired."]);
        }

        var user = await LoadActiveUserAsync(token.UserId);
        if (user is null)
            return ApiResult<AuthResponseDto>.Failure(["User account is inactive."]);

        var newToken = CreateRefreshToken(token.UserId, token.FamilyId);
        _context.RefreshTokens.Add(newToken);

        MarkRevoked(token, "Rotated");
        token.ReplacedByTokenId = newToken.Id;

        await _context.SaveChangesAsync();

        var role = await LoadRoleContextAsync(user.RoleId);
        var userDto = BuildUserDto(user.Login, user.FirstName, user.LastName, user.DepartmentId, role);
        var (accessToken, accessExpiresAt) = BuildAccessToken(user.Id, userDto, newToken.FamilyId);

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = newToken.Token,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshTokenExpiresAt = newToken.ExpiresAt,
            User = userDto
        });
    }

    public async Task<ApiResult<bool>> RevokeTokenAsync(string refreshToken)
    {
        var familyId = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.Token == refreshToken && !rt.IsRevoked)
            .Select(rt => (Guid?)rt.FamilyId)
            .FirstOrDefaultAsync();

        // Entity'ni yuklab, o'zgartirib, qayta saqlash o'rniga bitta UPDATE bayonoti.
        var revokedAt = DateTime.UtcNow;
        var affected = await _context.RefreshTokens
            .Where(rt => rt.Token == refreshToken && !rt.IsRevoked)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedAt, revokedAt)
                .SetProperty(rt => rt.RevokedReason, "ManualRevoke"));

        if (affected > 0 && familyId.HasValue)
            _sessionGuard?.MarkRevoked(familyId.Value);

        return affected > 0
            ? ApiResult<bool>.Success(true)
            : ApiResult<bool>.Failure(["Refresh token not found or already revoked."]);
    }

    public async Task<ApiResult<AuthResponseDto>> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        if (string.IsNullOrEmpty(dto.NewPassword))
            return ApiResult<AuthResponseDto>.Failure(["Yangi parol kiritilishi kerak."]);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);
        if (user is null)
            return ApiResult<AuthResponseDto>.Failure(["Foydalanuvchi topilmadi."]);

        // 401 qaytarib bo'lmaydi: klientdagi interceptor uni tugagan sessiya deb bilib,
        // refresh qilishga urinadi va foydalanuvchini login sahifasiga uloqtiradi.
        if (!PasswordHelper.VerifyPassword(dto.CurrentPassword ?? string.Empty, user.PasswordHash))
            return ApiResult<AuthResponseDto>.Failure(["Joriy parol noto'g'ri."]);

        if (!PasswordHelper.IsStrong(dto.NewPassword))
            return ApiResult<AuthResponseDto>.Failure([PasswordHelper.StrengthRequirement]);

        if (PasswordHelper.VerifyPassword(dto.NewPassword, user.PasswordHash))
            return ApiResult<AuthResponseDto>.Failure(["Yangi parol joriy paroldan farq qilishi kerak."]);

        user.PasswordHash = PasswordHelper.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();

        // Eski seanslar (boshqa qurilma, boshqa brauzer) yopiladi — yangi token esa
        // shu so'rovni yuborgan klientga qaytariladi, ya'ni u tizimda qoladi.
        await RevokeAllUserTokensAsync(userId, "PasswordChanged");

        var refreshToken = CreateRefreshToken(user.Id, familyId: Guid.NewGuid());
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        var role = await LoadRoleContextAsync(user.RoleId);
        var userDto = BuildUserDto(user.Login, user.FirstName, user.LastName, user.DepartmentId, role);
        var (accessToken, accessExpiresAt) = BuildAccessToken(user.Id, userDto, refreshToken.FamilyId);

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshTokenExpiresAt = refreshToken.ExpiresAt,
            User = userDto
        });
    }

    /// <summary>
    /// Bitta seans = bitta token oilasi. Token har yangilanganda o'sha oilada yangi qator
    /// paydo bo'ladi, shuning uchun ro'yxat oila bo'yicha guruhlanadi: aks holda bitta
    /// qurilma o'nlab qator bo'lib chiqadi.
    /// </summary>
    public async Task<ApiResult<List<SessionDto>>> GetSessionsAsync(Guid userId, string? currentRefreshToken)
    {
        var now = DateTime.UtcNow;

        var live = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.UserId == userId && !rt.IsRevoked && rt.ExpiresAt > now)
            .Select(rt => new { rt.FamilyId, rt.Token, rt.CreatedAt, rt.ExpiresAt, rt.CreatedByIp, rt.UserAgent })
            .ToListAsync();

        if (live.Count == 0)
            return ApiResult<List<SessionDto>>.Success([]);

        var familyIds = live.Select(x => x.FamilyId).Distinct().ToList();

        // Seans boshlangan payt oilaning eng eski tokenida — u aylanish paytida bekor
        // qilingani uchun yuqoridagi so'rovga tushmaydi.
        var startedAt = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.UserId == userId && familyIds.Contains(rt.FamilyId))
            .GroupBy(rt => rt.FamilyId)
            .Select(g => new { FamilyId = g.Key, StartedAt = g.Min(x => x.CreatedAt) })
            .ToDictionaryAsync(x => x.FamilyId, x => x.StartedAt);

        var sessions = live
            .GroupBy(x => x.FamilyId)
            .Select(g =>
            {
                var newest = g.OrderByDescending(x => x.CreatedAt).First();
                return new SessionDto
                {
                    Id = g.Key,
                    IpAddress = newest.CreatedByIp,
                    UserAgent = newest.UserAgent,
                    StartedAt = startedAt.TryGetValue(g.Key, out var start) ? start : newest.CreatedAt,
                    LastActiveAt = newest.CreatedAt,
                    ExpiresAt = newest.ExpiresAt,
                    IsCurrent = currentRefreshToken is not null && g.Any(x => x.Token == currentRefreshToken),
                };
            })
            .OrderByDescending(s => s.IsCurrent)
            .ThenByDescending(s => s.LastActiveAt)
            .ToList();

        return ApiResult<List<SessionDto>>.Success(sessions);
    }

    public async Task<ApiResult<bool>> RevokeSessionAsync(Guid userId, Guid familyId, string? currentRefreshToken)
    {
        var now = DateTime.UtcNow;

        var tokens = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.UserId == userId && rt.FamilyId == familyId && !rt.IsRevoked && rt.ExpiresAt > now)
            .Select(rt => rt.Token)
            .ToListAsync();

        if (tokens.Count == 0)
            return ApiResult<bool>.Failure(["Seans topilmadi."], statusCode: 404);

        if (currentRefreshToken is not null && tokens.Contains(currentRefreshToken))
            return ApiResult<bool>.Failure(["Joriy seansni bu yerdan tugatib bo'lmaydi — \"Chiqish\" tugmasidan foydalaning."]);

        await RevokeFamilyAsync(familyId, "SessionRevoked");

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<int>> RevokeOtherSessionsAsync(Guid userId, string? currentRefreshToken)
    {
        var now = DateTime.UtcNow;

        var currentFamily = currentRefreshToken is null
            ? null
            : await _context.RefreshTokens
                .AsNoTracking()
                .Where(rt => rt.UserId == userId && rt.Token == currentRefreshToken)
                .Select(rt => (Guid?)rt.FamilyId)
                .FirstOrDefaultAsync();

        var doomed = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.UserId == userId && !rt.IsRevoked && rt.ExpiresAt > now
                         && (currentFamily == null || rt.FamilyId != currentFamily))
            .Select(rt => rt.FamilyId)
            .Distinct()
            .ToListAsync();

        if (doomed.Count == 0)
            return ApiResult<int>.Success(0);

        var revokedAt = DateTime.UtcNow;
        await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked && doomed.Contains(rt.FamilyId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedAt, revokedAt)
                .SetProperty(rt => rt.RevokedReason, "SessionRevoked"));

        foreach (var familyId in doomed)
            _sessionGuard?.MarkRevoked(familyId);

        return ApiResult<int>.Success(doomed.Count);
    }

    public async Task<ApiResult<AuthUserDto>> GetUserAsync(Guid userId)
    {
        var user = await LoadActiveUserAsync(userId);
        if (user is null)
            return ApiResult<AuthUserDto>.Failure(["User not found."]);

        var role = await LoadRoleContextAsync(user.RoleId);
        return ApiResult<AuthUserDto>.Success(
            BuildUserDto(user.Login, user.FirstName, user.LastName, user.DepartmentId, role));
    }

    /// <summary>
    /// Aktiv foydalanuvchining faqat auth uchun kerakli maydonlarini oladi — PasswordHash,
    /// LockoutEnd, CreatedAt va navigatsiya kolleksiyalari o'qilmaydi, change tracking ham yo'q.
    /// </summary>
    private Task<AuthUserRow?> LoadActiveUserAsync(Guid userId)
    {
        return _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive)
            .Select(u => new AuthUserRow(u.Id, u.Login, u.FirstName, u.LastName, u.RoleId, u.DepartmentId))
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Rol nomi va permission kalitlarini bitta proyeksiya so'rovi bilan oladi. Permission
    /// entity'lari materializatsiya qilinmaydi — faqat Module/Action juftliklari o'qiladi.
    /// </summary>
    private async Task<RoleContext> LoadRoleContextAsync(Guid? roleId)
    {
        if (roleId is null)
            return RoleContext.Empty;

        var row = await _context.Roles
            .AsNoTracking()
            .Where(r => r.Id == roleId.Value)
            .Select(r => new
            {
                r.Name,
                Permissions = r.RolePermissions
                    .Select(rp => new { rp.Permission.Module, rp.Permission.Action })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (row is null)
            return RoleContext.Empty;

        // Kalit (Module.Action) entity yuklamasdan, faqat shu ikki ustundan xotirada yig'iladi.
        return new RoleContext(row.Name, row.Permissions.Select(p => $"{p.Module}.{p.Action}").ToList());
    }

    private void AddAttempt(Guid? userId, string login, string? ip, bool success)
    {
        _context.LoginAttempts.Add(new LoginAttempt
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Login = login.Length > 64 ? login[..64] : login,
            IpAddress = ip,
            AttemptedAt = DateTime.UtcNow,
            Success = success
        });
    }

    private async System.Threading.Tasks.Task RecordAttemptAsync(Guid? userId, string login, string? ip, bool success)
    {
        AddAttempt(userId, login, ip, success);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Faqat aktiv oyna ichidagi muvaffaqiyatsiz urinishlarni sanaydi. Hisoblash boshlanish
    /// nuqtasi quyidagilarning eng kechi: (1) aylanma oyna boshi, (2) oxirgi muvaffaqiyatli
    /// kirish, (3) oldingi blokning tugash vaqti.
    ///
    /// (3) — abadiy bloklanish (DoS) hujumini bartaraf etadigan asosiy shart: blokni
    /// keltirib chiqargan urinishlar har doim <c>LockoutEnd</c> dan oldin yoziladi, shuning
    /// uchun blok muddati tugagach ular hisobdan chiqib ketadi va hisob qayta bloklanmaydi.
    /// Blok davomida yozilgan urinishlar ham (vaqti &lt; LockoutEnd) shu tarzda chiqarib tashlanadi.
    /// </summary>
    private async Task<int> CountFailuresInWindowAsync(Guid userId, DateTime now, DateTime? currentLockoutEnd)
    {
        var since = now - _lockout.AttemptWindow;

        var lastSuccess = await _context.LoginAttempts
            .Where(a => a.UserId == userId && a.Success)
            .OrderByDescending(a => a.AttemptedAt)
            .Select(a => (DateTime?)a.AttemptedAt)
            .FirstOrDefaultAsync();

        if (lastSuccess.HasValue && lastSuccess.Value > since)
            since = lastSuccess.Value;

        if (currentLockoutEnd.HasValue && currentLockoutEnd.Value > since)
            since = currentLockoutEnd.Value;

        return await _context.LoginAttempts
            .CountAsync(a => a.UserId == userId && !a.Success && a.AttemptedAt > since);
    }

    private (string Token, DateTime ExpiresAt) BuildAccessToken(Guid userId, AuthUserDto user, Guid sessionId)
    {
        return TokenHelper.GenerateToken(
            userId, user.Login, user.Role, _jwtOptions,
            user.FirstName, user.LastName, user.Permissions, user.DepartmentId, sessionId);
    }

    private static AuthUserDto BuildUserDto(
        string login, string firstName, string lastName, Guid? departmentId, RoleContext role)
    {
        return new AuthUserDto
        {
            Login = login,
            FirstName = firstName,
            LastName = lastName,
            Role = role.Name,
            DepartmentId = departmentId,
            Permissions = role.Permissions
        };
    }

    private RefreshToken CreateRefreshToken(Guid userId, Guid familyId)
    {
        var (ip, ua) = GetRequestContext();
        return new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = TokenHelper.GenerateRefreshToken(),
            UserId = userId,
            FamilyId = familyId,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false,
            CreatedByIp = ip,
            UserAgent = ua
        };
    }

    private async System.Threading.Tasks.Task RevokeFamilyAsync(Guid familyId, string reason)
    {
        var now = DateTime.UtcNow;
        await _context.RefreshTokens
            .Where(rt => rt.FamilyId == familyId && !rt.IsRevoked)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedAt, now)
                .SetProperty(rt => rt.RevokedReason, reason));

        _sessionGuard?.MarkRevoked(familyId);
    }

    private async System.Threading.Tasks.Task RevokeAllUserTokensAsync(Guid userId, string reason)
    {
        var families = await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .Select(rt => rt.FamilyId)
            .Distinct()
            .ToListAsync();

        var now = DateTime.UtcNow;
        await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedAt, now)
                .SetProperty(rt => rt.RevokedReason, reason));

        foreach (var familyId in families)
            _sessionGuard?.MarkRevoked(familyId);
    }

    private static void MarkRevoked(RefreshToken token, string reason)
    {
        token.IsRevoked = true;
        token.RevokedAt = DateTime.UtcNow;
        token.RevokedReason = reason;
    }

    private (string? Ip, string? UserAgent) GetRequestContext()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null) return (null, null);

        var ip = httpContext.Connection.RemoteIpAddress?.ToString();
        var ua = httpContext.Request.Headers.UserAgent.ToString();
        if (string.IsNullOrWhiteSpace(ua)) ua = null;
        else if (ua.Length > 512) ua = ua[..512];
        return (ip, ua);
    }
}
