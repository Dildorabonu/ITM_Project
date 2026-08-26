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

    public AuthService(
        DatabaseContext context,
        IOptions<JwtOptions> jwtOptions,
        IHttpContextAccessor httpContextAccessor,
        IOptions<LockoutOptions>? lockoutOptions = null)
    {
        _context = context;
        _jwtOptions = jwtOptions.Value;
        _lockout = lockoutOptions?.Value ?? new LockoutOptions();
        _httpContextAccessor = httpContextAccessor;
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
        var (accessToken, accessExpiresAt) = BuildAccessToken(user.Id, userDto);

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
        var (accessToken, accessExpiresAt) = BuildAccessToken(user.Id, userDto);

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
        // Entity'ni yuklab, o'zgartirib, qayta saqlash o'rniga bitta UPDATE bayonoti.
        var revokedAt = DateTime.UtcNow;
        var affected = await _context.RefreshTokens
            .Where(rt => rt.Token == refreshToken && !rt.IsRevoked)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedAt, revokedAt)
                .SetProperty(rt => rt.RevokedReason, "ManualRevoke"));

        return affected > 0
            ? ApiResult<bool>.Success(true)
            : ApiResult<bool>.Failure(["Refresh token not found or already revoked."]);
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

    private (string Token, DateTime ExpiresAt) BuildAccessToken(Guid userId, AuthUserDto user)
    {
        return TokenHelper.GenerateToken(
            userId, user.Login, user.Role, _jwtOptions,
            user.FirstName, user.LastName, user.Permissions, user.DepartmentId);
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
