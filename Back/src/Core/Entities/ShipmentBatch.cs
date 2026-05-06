namespace Core.Entities;

public class ShipmentBatch
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public Guid? DepartmentId { get; set; }
    public int BatchNo { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Contract? Contract { get; set; }
    public ContractProduct? ContractProduct { get; set; }
    public Department? Department { get; set; }
    public User? Creator { get; set; }
}
