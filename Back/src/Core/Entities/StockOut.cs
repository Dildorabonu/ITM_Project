namespace Core.Entities;

public class StockOut
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public decimal Quantity { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? ContractId { get; set; }
    public Guid IssuedBy { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }

    // Navigation properties
    public Material? Material { get; set; }
    public Department? Department { get; set; }
    public Contract? Contract { get; set; }
    public User? Issuer { get; set; }
}
