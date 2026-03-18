using Core.Enums;

namespace Core.Entities;

public class TechProcess
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ProcessStatus Status { get; set; }
    public int CurrentStep { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Contract? Contract { get; set; }
    public User? Approver { get; set; }
    public ICollection<TechStep> Steps { get; set; } = [];
    public ICollection<TechProcessMaterial> Materials { get; set; } = [];
}
