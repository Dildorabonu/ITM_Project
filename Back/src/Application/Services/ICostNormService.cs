using Application.DTOs;
using Application.DTOs.CostNorms;

namespace Application.Services;

public interface ICostNormService
{
    Task<ApiResult<IEnumerable<CostNormListItemDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null, bool? isActive = null);
    Task<ApiResult<CostNormResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(CostNormCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, CostNormUpdateDto dto);
    Task<ApiResult<int>> ApproveAsync(Guid id);
}
