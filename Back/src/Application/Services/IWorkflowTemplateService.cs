using Application.DTOs;
using Application.DTOs.Workflows;

namespace Application.Services;

public interface IWorkflowTemplateService
{
    Task<ApiResult<IEnumerable<WorkflowTemplateResponseDto>>> GetAllAsync(bool? isActive = null);
    Task<ApiResult<WorkflowTemplateResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(WorkflowTemplateCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, WorkflowTemplateUpdateDto dto);
    Task<ApiResult<int>> SetDefaultAsync(Guid id);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
