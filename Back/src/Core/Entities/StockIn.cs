namespace Core.Entities;

public class StockIn
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public decimal Quantity { get; set; }
    public string? Supplier { get; set; }
    public Guid ReceivedBy { get; set; }
    public Guid? ContractId { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }

    // Navigation properties
    public Material? Material { get; set; }
    public User? Receiver { get; set; }
    public Contract? Contract { get; set; }
}
