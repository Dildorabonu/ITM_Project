using Core.Enums;

namespace Application.DTOs.Shipments;

public class ShipmentBatchCreateDto
{
    public Guid ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public Guid? DepartmentId { get; set; }
    public decimal Amount { get; set; }
    public ShipmentBatchKind Kind { get; set; } = ShipmentBatchKind.Production;
    // CustomerPickup uchun: qaysi ishlab chiqarish partiyasidan olinayotgani.
    public Guid? SourceBatchId { get; set; }
}
