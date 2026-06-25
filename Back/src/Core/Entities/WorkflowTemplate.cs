namespace Core.Entities;

// A reusable, admin-defined production workflow: an ordered subset of the known
// stage types. Contracts pick a template at creation; the chosen stages are
// snapshotted onto each ContractProduct (so a contract can later diverge).
public class WorkflowTemplate
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? Creator { get; set; }
    public ICollection<WorkflowTemplateStage> Stages { get; set; } = [];
}
