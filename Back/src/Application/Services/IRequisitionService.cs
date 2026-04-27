using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Enums;

namespace Application.Services;

public interface IRequisitionService
{
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, RequisitionStatus? status = null);
    Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy);

    // Omborchi tekshiruvi: PendingWarehouseCheck → Split (avto-bo'linish), child IDlarni qaytaradi
    Task<ApiResult<List<Guid>>> WarehouseCheckAsync(Guid id, RequisitionWarehouseCheckDto dto, Guid checkerId);

    // Yaratuvchi bo'lib yuboradi (legacy: WarehouseChecked statusdagi talabnomalar uchun)
    Task<ApiResult<List<Guid>>> SplitAsync(Guid id, Guid currentUserId);

    // Direktor: PendingApproval → ReadyForWarehouseRelease yoki ReadyForPurchase + QR
    Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId);

    // Direktor: PendingApproval → Rejected
    Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto);

    Task<ApiResult<bool>> DeleteAsync(Guid id, Guid currentUserId);
}
