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

    public async Task<ApiResult<AuthResponseDto>> LoginAsync(LoginDto dto)
    {
        var (ip, _) = GetRequestContext();
        var now = DateTime.UtcNow;

        var user = await _context.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
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
            }

            return ApiResult<AuthResponseDto>.Failure(["Invalid login or password."], statusCode: 401);
        }

        await RecordAttemptAsync(user.Id, dto.Login, ip, success: true);
        if (user.LockoutEnd.HasValue)
            user.LockoutEnd = null;

        var (accessToken, accessExpiresAt) = BuildAccessToken(user);

        var refreshToken = CreateRefreshToken(user.Id, familyId: Guid.NewGuid());
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshTokenExpiresAt = refreshToken.ExpiresAt,
            User = BuildUserDto(user)
        });
    }

    public async Task<ApiResult<bool>> UnlockUserAsync(Guid userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
            return ApiResult<bool>.Failure([$"User with id '{userId}' not found."], statusCode: 404);

        if (user.LockoutEnd is null)
            return ApiResult<bool>.Success(true);

        user.LockoutEnd = null;
        await _context.SaveChangesAsync();
        return ApiResult<bool>.Success(true);
    }

    private async System.Threading.Tasks.Task RecordAttemptAsync(Guid? userId, string login, string? ip, bool success)
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

    public async Task<ApiResult<AuthResponseDto>> RefreshTokenAsync(string refreshToken)
    {
        var token = await _context.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.Role)
                    .ThenInclude(r => r!.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
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

        if (!token.User.IsActive)
            return ApiResult<AuthResponseDto>.Failure(["User account is inactive."]);

        var newToken = CreateRefreshToken(token.UserId, token.FamilyId);
        _context.RefreshTokens.Add(newToken);

        MarkRevoked(token, "Rotated");
        token.ReplacedByTokenId = newToken.Id;

        await _context.SaveChangesAsync();

        var (accessToken, accessExpiresAt) = BuildAccessToken(token.User);

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = newToken.Token,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshTokenExpiresAt = newToken.ExpiresAt,
            User = BuildUserDto(token.User)
        });
    }

    public async Task<ApiResult<bool>> RevokeTokenAsync(string refreshToken)
    {
        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (token is null || token.IsRevoked)
            return ApiResult<bool>.Failure(["Refresh token not found or already revoked."]);

        MarkRevoked(token, "ManualRevoke");
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<AuthUserDto>> GetUserAsync(Guid userId)
    {
        var user = await _context.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

        if (user is null)
            return ApiResult<AuthUserDto>.Failure(["User not found."]);

        return ApiResult<AuthUserDto>.Success(BuildUserDto(user));
    }

    private (string Token, DateTime ExpiresAt) BuildAccessToken(User user)
    {
        var roleName = user.Role?.Name ?? string.Empty;
        var permissions = user.Role?.RolePermissions
            .Select(rp => rp.Permission.Key)
            .ToList() ?? [];

        return TokenHelper.GenerateToken(
            user.Id, user.Login, roleName, _jwtOptions,
            user.FirstName, user.LastName, permissions, user.DepartmentId);
    }

    private static AuthUserDto BuildUserDto(User user)
    {
        return new AuthUserDto
        {
            Id = user.Id,
            Login = user.Login,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Role = user.Role?.Name ?? string.Empty,
            DepartmentId = user.DepartmentId,
            Permissions = user.Role?.RolePermissions
                .Select(rp => rp.Permission.Key)
                .ToList() ?? []
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
