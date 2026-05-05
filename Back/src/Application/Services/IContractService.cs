using Application.DTOs;
using Application.DTOs.Contracts;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface IContractService
{
    Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ContractStatus? status = null, Guid? departmentId = null, bool? isActive = null);
    Task<ApiResult<PagedResult<ContractResponseDto>>> GetPagedAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, ContractStatus? status = null, Priority? priority = null, bool? isActive = null);
    Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<ContractCreateResultDto>> CreateAsync(ContractCreateDto dto, Guid createdBy);
    Task<ApiResult<ContractCreateResultDto>> UpdateAsync(Guid id, ContractUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, ContractStatus status);
    Task<ApiResult<int>> DeactivateAsync(Guid id, ContractDeactivateDto dto);
    Task<ApiResult<int>> ActivateAsync(Guid id);
    Task<ApiResult<IEnumerable<ContractUserDto>>> GetUsersAsync(Guid contractId);
    Task<ApiResult<int>> AssignUsersAsync(Guid contractId, List<ContractUserAssignItem> users);
    Task<ApiResult<int>> RemoveUserAsync(Guid contractId, Guid userId);
    Task<ApiResult<IEnumerable<ContractResponseDto>>> GetMyProductionTasksAsync(Guid userId, bool viewAll, bool? isActive = null);
    Task<ApiResult<PagedResult<ContractReadinessDto>>> GetReadinessOverviewAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, bool? isActive = null);
}
