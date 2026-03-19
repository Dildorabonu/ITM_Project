using Application.DTOs;
using Application.DTOs.Roles;

namespace Application.Services;

public interface IRoleService
{
    Task<ApiResult<IEnumerable<RoleResponseDto>>> GetAllAsync();
    Task<ApiResult<RoleResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<object>> CreateAsync(RoleCreateDto dto);
    Task<ApiResult<object>> UpdateAsync(Guid id, RoleUpdateDto dto);
    Task<ApiResult<object>> DeleteAsync(Guid id);
    Task<ApiResult<IEnumerable<Guid>>> GetPermissionsAsync(Guid id);
    Task<ApiResult<object>> SetPermissionsAsync(Guid id, SetPermissionsDto dto);
}
