using Application.DTOs;
using Application.DTOs.Contracts;
using Core.Enums;

namespace Application.Services;

public interface IContractService
{
    Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(ContractStatus? status = null, Guid? departmentId = null);
    Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(ContractCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, ContractUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, ContractStatus status);
    Task<ApiResult<int>> DeleteAsync(Guid id);
    Task<ApiResult<IEnumerable<ContractUserDto>>> GetUsersAsync(Guid contractId);
    Task<ApiResult<int>> AssignUsersAsync(Guid contractId, List<Guid> userIds);
    Task<ApiResult<int>> RemoveUserAsync(Guid contractId, Guid userId);
}
