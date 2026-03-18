using Application.DTOs;
using Application.DTOs.Permissions;

namespace Application.Services;

public interface IPermissionService
{
    Task<ApiResult<IEnumerable<PermissionModuleResponseDto>>> GetAllGroupedAsync();
    Task<ApiResult<PermissionResponseDto>> GetByIdAsync(Guid id);
}
