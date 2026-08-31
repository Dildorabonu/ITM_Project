using Application.DTOs;
using Application.DTOs.Auth;

namespace Application.Services;

public interface IAuthService
{
    Task<ApiResult<AuthResponseDto>> LoginAsync(LoginDto dto);
    Task<ApiResult<AuthResponseDto>> RefreshTokenAsync(string refreshToken);
    Task<ApiResult<bool>> RevokeTokenAsync(string refreshToken);
    Task<ApiResult<AuthResponseDto>> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<ApiResult<List<SessionDto>>> GetSessionsAsync(Guid userId, string? currentRefreshToken);
    Task<ApiResult<bool>> RevokeSessionAsync(Guid userId, Guid familyId, string? currentRefreshToken);
    Task<ApiResult<int>> RevokeOtherSessionsAsync(Guid userId, string? currentRefreshToken);
    Task<ApiResult<AuthUserDto>> GetUserAsync(Guid userId);
}
