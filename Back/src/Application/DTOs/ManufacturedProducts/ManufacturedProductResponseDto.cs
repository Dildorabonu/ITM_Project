using Core.Enums;

namespace Application.DTOs.ManufacturedProducts;

public class ManufacturedProductResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProducedQuantity { get; set; }
    public ProductUnit Unit { get; set; }
    public ManufacturingStatus Status { get; set; }
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public Guid? ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public string? ContractNo { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ManufacturedProductStatsDto
{
    public int Total { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
}
