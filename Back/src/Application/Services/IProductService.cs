using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;

namespace Application.Services;

public interface IProductService
{
    Task<ApiResult<PagedResult<ProductResponseDto>>> GetAllAsync(int page, int pageSize, string? search, Guid? departmentId);
    Task<ApiResult<IEnumerable<ProductResponseDto>>> GetByDepartmentAsync(Guid departmentId);
    Task<ApiResult<ProductResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(ProductCreateDto dto);
    Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ProductCreateDto> dtos);
    Task<ApiResult<int>> UpdateAsync(Guid id, ProductUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
