using Application.DTOs;
using Application.DTOs.Departments;

namespace Application.Services;

public interface IDepartmentService
{
    Task<ApiResult<IEnumerable<DepartmentResponseDto>>> GetAllAsync();
    Task<ApiResult<DepartmentResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(DepartmentCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, DepartmentUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
