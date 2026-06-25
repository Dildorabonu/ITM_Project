using Core.Enums;

namespace Application.DTOs.Workflows;

public class WorkflowTemplateResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public List<StageType> Stages { get; set; } = [];
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WorkflowTemplateCreateDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    // Ordered, enabled stage types (no duplicates).
    public List<StageType> Stages { get; set; } = [];
}

public class WorkflowTemplateUpdateDto
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsDefault { get; set; }
    // When provided, replaces the template's stage list (ordered, no duplicates).
    public List<StageType>? Stages { get; set; }
}
