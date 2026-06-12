using Application.DTOs;
using Application.DTOs.TechProcesses;
using Core.Enums;

namespace Application.Services;

public interface ITechProcessService
{
    Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ProcessStatus? status = null, bool? isActive = null);
    Task<ApiResult<TechProcessResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(TechProcessCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, TechProcessUpdateDto dto);
    Task<ApiResult<int>> ApproveAsync(Guid id, Guid approvedBy);
}
