using Application.DTOs;
using Application.DTOs.Contracts;
using Core.Enums;

namespace Application.Services;

public interface IContractService
{
    Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(ContractStatus? status = null, Guid? departmentId = null);
    Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(ContractCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, ContractUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, ContractStatus status);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
