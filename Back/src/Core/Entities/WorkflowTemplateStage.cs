using Core.Enums;

namespace Core.Entities;

// One ordered stage within a WorkflowTemplate. Presence of the row = the stage
// is enabled; OrderIndex defines sequence. (ContractProductId, StageType) unique.
public class WorkflowTemplateStage
{
    public Guid Id { get; set; }
    public Guid WorkflowTemplateId { get; set; }
    public StageType StageType { get; set; }
    public int OrderIndex { get; set; }

    // Navigation
    public WorkflowTemplate? WorkflowTemplate { get; set; }
}
