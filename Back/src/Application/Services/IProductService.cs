using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IProductService
{
    Task<ApiResult<PagedResult<ProductResponseDto>>> GetAllAsync(int page, int pageSize, string? search, Guid? departmentId, Guid? restrictToDepartmentId = null, DepartmentType? departmentType = null);
    Task<ApiResult<PagedResult<ProductReservationDto>>> GetReservationsAsync(int page, int pageSize, string? search, Guid? restrictToDepartmentId = null);
    Task<ApiResult<IEnumerable<ProductSimilarDto>>> FindSimilarAsync(string name, Guid? departmentId, Guid? restrictToDepartmentId = null);
    Task<ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>> CheckDuplicatesAsync(IEnumerable<ProductDuplicateCheckItemDto> items, Guid? restrictToDepartmentId = null);
    Task<ApiResult<int>> CreateAsync(ProductCreateDto dto);
    Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ProductCreateDto> dtos);
    Task<ApiResult<int>> UpdateAsync(Guid id, ProductUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
