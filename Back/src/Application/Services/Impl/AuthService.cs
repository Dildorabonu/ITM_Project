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
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuthService(DatabaseContext context, IOptions<JwtOptions> jwtOptions, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _jwtOptions = jwtOptions.Value;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<ApiResult<AuthResponseDto>> LoginAsync(LoginDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Login == dto.Login && u.IsActive);

        if (user is null || !PasswordHelper.VerifyPassword(dto.Password, user.PasswordHash))
            return ApiResult<AuthResponseDto>.Failure(["Invalid login or password."]);

        var accessToken = BuildAccessToken(user);

        var refreshToken = CreateRefreshToken(user.Id, familyId: Guid.NewGuid());
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token
        });
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

        var accessToken = BuildAccessToken(token.User);

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = newToken.Token
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

    private string BuildAccessToken(User user)
    {
        var roleName = user.Role?.Name ?? string.Empty;
        var permissions = user.Role?.RolePermissions
            .Select(rp => rp.Permission.Key)
            .ToList() ?? [];

        var (accessToken, _) = TokenHelper.GenerateToken(
            user.Id, user.Login, roleName, _jwtOptions,
            user.FirstName, user.LastName, permissions, user.DepartmentId);

        return accessToken;
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
