using Core.Enums;

namespace Core.Entities;

public class Contract
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public ContractType ContractType { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public ContractStatus Status { get; set; }
    public Guid? WorkflowTemplateId { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public ContractDeactivationReason? DeactivationReason { get; set; }
    public string? DeactivationNote { get; set; }
    public DateTime? DeactivatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? Creator { get; set; }
    public WorkflowTemplate? WorkflowTemplate { get; set; }
    public ICollection<ContractProduct> Products { get; set; } = [];
    public ICollection<ContractDepartment> ContractDepartments { get; set; } = [];
    public ICollection<ContractUser> ContractUsers { get; set; } = [];
    public ICollection<TechProcess> TechProcesses { get; set; } = [];
    public ICollection<StockIn> StockIns { get; set; } = [];
    public ICollection<StockOut> StockOuts { get; set; } = [];
    public ICollection<TechnicalDrawing> TechnicalDrawings { get; set; } = [];
    public ICollection<CostNorm> CostNorms { get; set; } = [];
    public ICollection<ContractTask> ContractTasks { get; set; } = [];
}
