namespace Application.DTOs.Requisitions;

public class RequisitionItemCreateDto
{
    public Guid MaterialId { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}

public class RequisitionItemResponseDto
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}
