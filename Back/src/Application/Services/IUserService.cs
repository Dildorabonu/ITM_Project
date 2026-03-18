using Application.DTOs;
using Application.DTOs.Users;

namespace Application.Services;

public interface IUserService
{
    Task<ApiResult<IEnumerable<UserResponseDto>>> GetAllAsync();
    Task<ApiResult<UserResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<UserResponseDto>> CreateAsync(UserCreateDto dto);
    Task<ApiResult<UserResponseDto>> UpdateAsync(Guid id, UserUpdateDto dto);
    Task<ApiResult<bool>> DeleteAsync(Guid id);
}
