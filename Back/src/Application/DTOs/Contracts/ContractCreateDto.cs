using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractCreateDto
{
    public string ContractNo { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<Guid> DepartmentIds { get; set; } = [];
    public ContractType ContractType { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<ContractProductCreateDto> Products { get; set; } = [];

    // Chosen production workflow. WorkflowStages (ordered) overrides the template
    // for this contract; if omitted, the template's stages are used; if both are
    // omitted, the default template applies. Applied to every product.
    public Guid? WorkflowTemplateId { get; set; }
    public List<StageType>? WorkflowStages { get; set; }
}
