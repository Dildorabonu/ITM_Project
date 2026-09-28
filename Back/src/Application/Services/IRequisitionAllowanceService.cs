using Application.DTOs;
using Application.DTOs.Requisitions;

namespace Application.Services;

public interface IRequisitionAllowanceService
{
    Task<ApiResult<IEnumerable<RequisitionAllowanceRateDto>>> GetAllAsync();
    Task<ApiResult<Guid>> CreateAsync(RequisitionAllowanceSaveDto dto, Guid userId);
    Task<decimal> GetCurrentPercentAsync();
}
