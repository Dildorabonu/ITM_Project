using Application.DTOs;
using Application.DTOs.CostNorms;

namespace Application.Services;

public interface ICostNormService
{
    Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null);
    Task<ApiResult<CostNormResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetByContractIdAsync(Guid contractId);
    Task<ApiResult<Guid>> CreateAsync(CostNormCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, CostNormUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
