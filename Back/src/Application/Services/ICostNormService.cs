using Application.DTOs;
using Application.DTOs.CostNorms;

namespace Application.Services;

public interface ICostNormService
{
    Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null, bool? isActive = null);
    Task<ApiResult<Guid>> CreateAsync(CostNormCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, CostNormUpdateDto dto);
    Task<ApiResult<int>> ApproveAsync(Guid id);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
