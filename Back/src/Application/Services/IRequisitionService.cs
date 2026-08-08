using Application.DTOs;
using Application.DTOs.Requisitions;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IRequisitionService
{
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, RequisitionStatus? status = null);
    Task<ApiResult<PagedResult<RequisitionResponseDto>>> GetPagedAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, RequisitionStatus? status = null, bool? completed = null, bool? rejected = null);
    Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id);

    /// Ombor tekshiruvini kutayotgan talabnomalar soni — sidebar badge uchun yengil so'rov.
    Task<ApiResult<int>> GetPendingWarehouseCheckCountAsync(Guid currentUserId, bool viewAll);

    /// Faol ro'yxat ostidagi "Yaqinda yakunlangan" bloki: oxirgi N kunda real
    /// bajarilgan talabnomalar, eng ko'pi 10 ta.
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetRecentCompletedAsync(Guid currentUserId, bool viewAll, int days);
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
