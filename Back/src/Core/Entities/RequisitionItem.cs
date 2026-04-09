namespace Core.Entities;

public class RequisitionItem
{
    public Guid Id { get; set; }
    public Guid RequisitionId { get; set; }
    public Guid MaterialId { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Requisition? Requisition { get; set; }
    public Material? Material { get; set; }
}
