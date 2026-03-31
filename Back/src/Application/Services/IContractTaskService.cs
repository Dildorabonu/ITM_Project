using Application.DTOs;
using Application.DTOs.ContractTasks;

namespace Application.Services;

public interface IContractTaskService
{
    Task<ApiResult<IEnumerable<ContractTaskResponseDto>>> GetByContractIdAsync(Guid contractId);
    Task<ApiResult<ContractTaskResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(ContractTaskCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ContractTaskCreateDto> dtos, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, ContractTaskUpdateDto dto);
    Task<ApiResult<int>> DeleteAsync(Guid id);
    Task<ApiResult<Guid>> LogProgressAsync(Guid taskId, ContractTaskLogCreateDto dto, Guid createdBy);
    Task<ApiResult<IEnumerable<ContractTaskLogResponseDto>>> GetLogsAsync(Guid taskId);
}
