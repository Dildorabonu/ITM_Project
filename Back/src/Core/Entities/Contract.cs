using Core.Enums;

namespace Core.Entities;

public class Contract
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public Guid? DepartmentId { get; set; }
    public Priority Priority { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public ContractStatus Status { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Department? Department { get; set; }
    public User? Creator { get; set; }
    public ICollection<ContractUser> ContractUsers { get; set; } = [];
    public ICollection<TechProcess> TechProcesses { get; set; } = [];
    public ICollection<StockIn> StockIns { get; set; } = [];
    public ICollection<StockOut> StockOuts { get; set; } = [];
    public ICollection<TechnicalDrawing> TechnicalDrawings { get; set; } = [];
    public ICollection<CostNorm> CostNorms { get; set; } = [];
}
