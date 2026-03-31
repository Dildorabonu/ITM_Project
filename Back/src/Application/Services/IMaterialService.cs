using Application.DTOs;
using Application.DTOs.Materials;

namespace Application.Services;

public interface IMaterialService
{
    Task<ApiResult<IEnumerable<MaterialResponseDto>>> GetAllAsync(string? category = null);
    Task<ApiResult<MaterialResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(MaterialCreateDto dto);
    Task<ApiResult<int>> CreateBulkAsync(IEnumerable<MaterialCreateDto> dtos);
    Task<ApiResult<int>> UpdateAsync(Guid id, MaterialUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
    Task<ApiResult<IEnumerable<MaterialDeficitCheckDto>>> CheckDeficitByCostNormAsync(Guid costNormId);
}
