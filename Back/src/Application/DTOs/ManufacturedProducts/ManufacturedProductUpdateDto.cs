using Core.Enums;

namespace Application.DTOs.ManufacturedProducts;

public class ManufacturedProductUpdateDto
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? ProducedQuantity { get; set; }
    public ProductUnit? Unit { get; set; }
    public ManufacturingStatus? Status { get; set; }
    public Guid? DepartmentId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
}
