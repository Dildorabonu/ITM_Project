using Application.DTOs;
using Application.DTOs.Products;

namespace Application.Services;

// "Bo'lim omborlari" — bo'limlar kesimida mahsulot zaxirasini ko'rish (faqat o'qish).
// Korxona omborxonasi (ProductService) CRUD mantig'idan ajratilgan.
public interface IDepartmentWarehouseService
{
    Task<ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>> GetDepartmentSummariesAsync(Guid? restrictToDepartmentId = null);
    Task<ApiResult<IEnumerable<ProductResponseDto>>> GetByDepartmentAsync(Guid departmentId);
}
