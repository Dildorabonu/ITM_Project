using Core.Enums;

namespace Application.DTOs.ManufacturedProducts;

public class ManufacturedProductCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProducedQuantity { get; set; }
    public ProductUnit Unit { get; set; }
    public ManufacturingStatus Status { get; set; } = ManufacturingStatus.InProgress;
    public Guid DepartmentId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
}
