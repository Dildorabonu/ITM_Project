using Core.Enums;

namespace Core.Entities;

public class ManufacturedProduct
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProducedQuantity { get; set; }
    public ProductUnit Unit { get; set; }
    public ManufacturingStatus Status { get; set; } = ManufacturingStatus.InProgress;
    public Guid DepartmentId { get; set; }
    public Guid? ContractId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Department? Department { get; set; }
    public Contract? Contract { get; set; }
    public User? Creator { get; set; }
}
