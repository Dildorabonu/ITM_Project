using Application.DTOs;
using Application.DTOs.ProductCatalog;
using Application.Helpers;

namespace Application.Services;

public interface IProductCatalogService
{
    // Boshqaruv sahifasi uchun — sahifalangan ro'yxat + har yozuvning ishlatilish soni.
    Task<ApiResult<PagedResult<ProductCatalogResponseDto>>> GetAllAsync(int page, int pageSize, string? search);

    // Shartnoma formasi uchun yengil qidiruv (faqat tanlash uchun kerakli maydonlar).
    Task<ApiResult<PagedResult<ProductCatalogLookupDto>>> LookupAsync(int page, int pageSize, string? search);

    // "Ko'rish" infografikasi — bitta mahsulot bo'yicha bog'langan shartnomalar va ishlab chiqarish yig'indilari.
    Task<ApiResult<ProductCatalogDetailDto>> GetDetailAsync(Guid id);

    Task<ApiResult<ProductCatalogResponseDto>> CreateAsync(ProductCatalogCreateDto dto, Guid userId);
    Task<ApiResult<ProductCatalogResponseDto>> UpdateAsync(Guid id, ProductCatalogUpdateDto dto);
    Task<ApiResult<bool>> DeleteAsync(Guid id);
}
