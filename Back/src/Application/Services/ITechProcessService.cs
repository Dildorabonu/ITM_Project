using Application.DTOs;
using Application.DTOs.TechProcesses;
using Core.Enums;

namespace Application.Services;

public interface ITechProcessService
{
    Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ProcessStatus? status = null);
    Task<ApiResult<TechProcessResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetByContractIdAsync(Guid contractId);
    Task<ApiResult<Guid>> CreateAsync(TechProcessCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, TechProcessUpdateDto dto);
    Task<ApiResult<int>> ApproveAsync(Guid id, Guid approvedBy);
    Task<ApiResult<int>> SendToWarehouseAsync(Guid id);
    Task<ApiResult<int>> DeleteAsync(Guid id);

}
