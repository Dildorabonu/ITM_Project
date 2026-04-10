using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Enums;

namespace Application.Services;

public interface IRequisitionService
{
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, RequisitionStatus? status = null);
    Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy);
    Task<ApiResult<bool>> SubmitAsync(Guid id, Guid currentUserId);         // Draft → Pending
    Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId);           // Pending → Approved + QR
    Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto); // Pending → Rejected
    Task<ApiResult<bool>> SendToWarehouseAsync(Guid id, Guid currentUserId); // Approved → SentToWarehouse
}
