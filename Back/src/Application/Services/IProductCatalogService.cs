using Application.DTOs;
using Application.DTOs.ProductCatalog;
using Application.Helpers;

namespace Application.Services;

public interface IProductCatalogService
{
    // Boshqaruv sahifasi uchun — sahifalangan ro'yxat + har yozuvning ishlatilish soni.
    // archived = true bo'lsa "ishlab chiqarilishi tugatilganlar" ro'yxati qaytadi.
    Task<ApiResult<PagedResult<ProductCatalogResponseDto>>> GetAllAsync(int page, int pageSize, string? search, bool archived);

    // Shartnoma formasi uchun yengil qidiruv (faqat tanlash uchun kerakli maydonlar).
    Task<ApiResult<PagedResult<ProductCatalogLookupDto>>> LookupAsync(int page, int pageSize, string? search);

    // "Ko'rish" infografikasi — bitta mahsulot bo'yicha bog'langan shartnomalar va ishlab chiqarish yig'indilari.
    Task<ApiResult<ProductCatalogDetailDto>> GetDetailAsync(Guid id);

    Task<ApiResult<ProductCatalogResponseDto>> CreateAsync(ProductCatalogCreateDto dto, Guid userId);
    Task<ApiResult<ProductCatalogResponseDto>> UpdateAsync(Guid id, ProductCatalogUpdateDto dto);
    // Ishlab chiqarilishi tugatilganlarga o'tkazish. Yakunlanmagan shartnomasi bo'lsa rad etiladi.
    Task<ApiResult<bool>> ArchiveAsync(Guid id);
    Task<ApiResult<bool>> RestoreAsync(Guid id);
}
