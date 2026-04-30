using Application.DTOs;
using Application.DTOs.ManufacturedProducts;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IManufacturedProductService
{
    Task<ApiResult<PagedResult<ManufacturedProductResponseDto>>> GetAllAsync(
        int page, int pageSize, string? search, Guid? departmentId, ManufacturingStatus? status);
    Task<ApiResult<ManufacturedProductStatsDto>> GetStatsAsync();
    Task<ApiResult<ManufacturedProductResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId);
    Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
