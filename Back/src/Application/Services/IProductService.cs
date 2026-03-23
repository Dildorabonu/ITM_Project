using Application.DTOs;
using Application.DTOs.Products;

namespace Application.Services;

public interface IProductService
{
    Task<ApiResult<IEnumerable<ProductResponseDto>>> GetAllAsync();
    Task<ApiResult<IEnumerable<ProductResponseDto>>> GetByDepartmentAsync(Guid departmentId);
    Task<ApiResult<ProductResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(ProductCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, ProductUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
