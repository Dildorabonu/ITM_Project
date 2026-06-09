namespace Application.DTOs.Shipments;

public class ShipmentBatchResponseDto
{
    public Guid Id { get; set; }
    public string? DepartmentName { get; set; }
    public int BatchNo { get; set; }
    public decimal Amount { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
