using Application.DTOs;
using Application.DTOs.Auth;

namespace Application.Services;

public interface IAuthService
{
    Task<ApiResult<AuthResponseDto>> LoginAsync(LoginDto dto);
    Task<ApiResult<AuthResponseDto>> RefreshTokenAsync(string refreshToken);
    Task<ApiResult<bool>> RevokeTokenAsync(string refreshToken);
    Task<ApiResult<AuthResponseDto>> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<ApiResult<AuthUserDto>> GetUserAsync(Guid userId);
}
