using Application.DTOs;
using Application.DTOs.Requisitions;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IRequisitionService
{
    /// Navbat ekranlari (tekshiruv / tasdiqlash / xarid qabuli) uchun yengil ro'yxat.
    Task<ApiResult<IEnumerable<RequisitionQueueDto>>> GetAllAsync(Guid currentUserId, bool viewAll, RequisitionStatus? status = null);

    /// Jadval ro'yxati — materialsiz va QR'siz sarlavha qatorlari.
    Task<ApiResult<PagedResult<RequisitionListDto>>> GetPagedAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, RequisitionStatus? status = null, bool? completed = null, bool? rejected = null);

    /// To'liq detal — QR imzolari, materiallar va childlar bilan.
    Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id);

    /// Badge raqamlari uchun yengil COUNT (tekshiruv / tasdiqlash navbati).
    Task<ApiResult<int>> GetCountByStatusAsync(Guid currentUserId, bool viewAll, RequisitionStatus status);

    /// Faol ro'yxat ostidagi "Yaqinda yakunlangan" bloki: oxirgi N kunda real
    /// bajarilgan talabnomalar, eng ko'pi 10 ta.
    Task<ApiResult<IEnumerable<RequisitionListDto>>> GetRecentCompletedAsync(Guid currentUserId, bool viewAll, int days);
    Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy);

    // Omborchi tekshiruvi: PendingWarehouseCheck → Split (avto-bo'linish), child IDlarni qaytaradi
    Task<ApiResult<List<Guid>>> WarehouseCheckAsync(Guid id, RequisitionWarehouseCheckDto dto, Guid checkerId);

    // Direktor: PendingApproval → ReadyForWarehouseRelease yoki ReadyForPurchase + QR
    Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId);

    // Direktor: PendingApproval → Rejected
    Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto);

    // Omborchi: ReadyForWarehouseRelease → Released
    // Material qty kamaytiriladi, StockOut yoziladi, bo'lim Productiga avto qo'shiladi
    Task<ApiResult<bool>> ReleaseAsync(Guid id, Guid releaserId);

    // Omborchi: sotib olingan mahsulot kelganda omborxonaga qabul qiladi
    // ReadyForPurchase → ReadyForWarehouseRelease. Markaziy ombor Productiga upsert,
    // StockIn yoziladi, item.ReservedProductId band qilinadi (keyin Release bo'limga beradi)
    Task<ApiResult<bool>> ReceivePurchaseAsync(Guid id, Guid receiverId);
}
