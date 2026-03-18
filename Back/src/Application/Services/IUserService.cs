using Application.DTOs;
using Application.DTOs.Users;

namespace Application.Services;

public interface IUserService
{
    Task<ApiResult<IEnumerable<UserResponseDto>>> GetAllAsync();
    Task<ApiResult<UserResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(UserCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, UserUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
