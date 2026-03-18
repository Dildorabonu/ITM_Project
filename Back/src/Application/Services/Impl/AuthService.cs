using Application.DTOs;
using Application.DTOs.Auth;
using Application.Helpers;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class AuthService : IAuthService
{
    private readonly DatabaseContext _context;
    private readonly JwtOptions _jwtOptions;

    public AuthService(DatabaseContext context, IOptions<JwtOptions> jwtOptions)
    {
        _context = context;
        _jwtOptions = jwtOptions.Value;
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

        var roleName = user.Role?.Name ?? string.Empty;
        var permissions = user.Role?.RolePermissions
            .Select(rp => rp.Permission.Key)
            .ToList() ?? [];

        var (accessToken, _) = TokenHelper.GenerateToken(
            user.Id, user.Login, roleName, _jwtOptions, permissions);

        var refreshTokenValue = TokenHelper.GenerateRefreshToken();
        var refreshExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenExpirationDays);

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = refreshExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenValue
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

        if (token is null || token.IsRevoked || token.ExpiresAt < DateTime.UtcNow)
            return ApiResult<AuthResponseDto>.Failure(["Invalid or expired refresh token."]);

        if (!token.User.IsActive)
            return ApiResult<AuthResponseDto>.Failure(["User account is inactive."]);

        token.IsRevoked = true;

        var roleName = token.User.Role?.Name ?? string.Empty;
        var permissions = token.User.Role?.RolePermissions
            .Select(rp => rp.Permission.Key)
            .ToList() ?? [];

        var (accessToken, _) = TokenHelper.GenerateToken(
            token.User.Id, token.User.Login, roleName, _jwtOptions, permissions);

        var newRefreshTokenValue = TokenHelper.GenerateRefreshToken();
        var refreshExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenExpirationDays);

        var newRefreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = newRefreshTokenValue,
            UserId = token.User.Id,
            ExpiresAt = refreshExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _context.RefreshTokens.Add(newRefreshToken);
        await _context.SaveChangesAsync();

        return ApiResult<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = newRefreshTokenValue
        });
    }

    public async Task<ApiResult<bool>> RevokeTokenAsync(string refreshToken)
    {
        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (token is null || token.IsRevoked)
            return ApiResult<bool>.Failure(["Refresh token not found or already revoked."]);

        token.IsRevoked = true;
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }
}
