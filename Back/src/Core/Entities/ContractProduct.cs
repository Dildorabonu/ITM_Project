using Core.Enums;

namespace Core.Entities;

public class ContractProduct
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string? Notes { get; set; }
    public ContractProductStatus Status { get; set; } = ContractProductStatus.DrawingPending;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Contract? Contract { get; set; }
    public ICollection<TechnicalDrawing> TechnicalDrawings { get; set; } = [];
    public ICollection<TechProcess> TechProcesses { get; set; } = [];
    public ICollection<CostNorm> CostNorms { get; set; } = [];
    public ICollection<ContractTask> ContractTasks { get; set; } = [];
    public ICollection<ContractProductDepartment> ProductDepartments { get; set; } = [];
    public ICollection<ContractProductUser> ProductUsers { get; set; } = [];
}
