using Application.DTOs;
using Application.DTOs.Permissions;

namespace Application.Services;

public interface IPermissionService
{
    Task<ApiResult<IEnumerable<PermissionResponseDto>>> GetAllAsync();
    Task<ApiResult<PermissionResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(PermissionCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, PermissionUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
