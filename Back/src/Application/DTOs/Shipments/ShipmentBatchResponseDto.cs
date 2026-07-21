using Core.Enums;

namespace Application.DTOs.Shipments;

public class ShipmentBatchResponseDto
{
    public Guid Id { get; set; }
    public Guid? ContractProductId { get; set; }
    public ShipmentBatchKind Kind { get; set; }
    // Olib ketish qaysi partiyadan bo'lgani (CustomerPickup uchun).
    public Guid? SourceBatchId { get; set; }
    public int? SourceBatchNo { get; set; }
    public string? DepartmentName { get; set; }
    public int BatchNo { get; set; }
    public decimal Amount { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
