using Application.DTOs;
using Application.DTOs.Departments;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IDepartmentService
{
    Task<ApiResult<IEnumerable<DepartmentResponseDto>>> GetLookupAsync();
    Task<ApiResult<IEnumerable<DepartmentResponseDto>>> GetAllAsync();
    Task<ApiResult<PagedResult<DepartmentResponseDto>>> GetPagedAsync(PaginationParams pagination, string? search = null, DepartmentType? type = null);
    Task<ApiResult<DepartmentResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(DepartmentCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, DepartmentUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
