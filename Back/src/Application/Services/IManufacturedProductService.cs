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
    Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId);
    Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);

    /// <summary>
    /// Shartnoma holati / tex jarayon / xarajat normasi o'zgargan har safar chaqiriladi —
    /// mahsulotlarning ManufacturedProducts jadvalidagi yozuvlarini moslab keladi.
    /// </summary>
    System.Threading.Tasks.Task SyncForContractAsync(Guid contractId);

    /// <summary>
    /// Vazifa progress logi qo'shilganda yoki ombor vazifasi yangilanganda chaqiriladi —
    /// shu mahsulotning ProducedQuantity-ni yangilaydi.
    /// </summary>
    System.Threading.Tasks.Task UpdateProducedQuantityAsync(Guid contractId, Guid? contractProductId);
}
