using Application.DTOs;
using Application.DTOs.StockMovements;
using Application.Helpers;

namespace Application.Services;

public interface IStockMovementService
{
    // Ombor harakatlari jurnalini filtrlab, sahifalab qaytaradi (CreatedAt DESC).
    // Yozish logikasi RequisitionService ichida — bu faqat o'qish.
    Task<ApiResult<PagedResult<StockMovementResponseDto>>> GetAsync(StockMovementFilter filter);

    // Filtr tugmachalaridagi sonlar. GetAsync bilan bir xil filtrlarni qo'llaydi,
    // faqat Type dan qat'i nazar — aks holda bitta tur tanlangach qolgan
    // tugmachalar nolga tushib qolardi.
    Task<ApiResult<StockMovementSummaryDto>> GetSummaryAsync(StockMovementFilter filter);
}
