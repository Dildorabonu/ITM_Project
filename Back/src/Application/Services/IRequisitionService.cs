using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Enums;

namespace Application.Services;

public interface IRequisitionService
{
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, RequisitionStatus? status = null);
    Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy);

    // Omborchi tekshiruvi: PendingWarehouseCheck → WarehouseChecked
    Task<ApiResult<bool>> WarehouseCheckAsync(Guid id, RequisitionWarehouseCheckDto dto, Guid checkerId);

    // Yaratuvchi bo'lib yuboradi: WarehouseChecked → Split (parent), 2 ta child PendingApproval
    Task<ApiResult<List<Guid>>> SplitAsync(Guid id, Guid currentUserId);

    // Direktor: PendingApproval → ReadyForWarehouseRelease yoki ReadyForPurchase + QR
    Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId);

    // Direktor: PendingApproval → Rejected
    Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto);

    Task<ApiResult<bool>> DeleteAsync(Guid id, Guid currentUserId);
}
