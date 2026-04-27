namespace Application.DTOs.Requisitions;

public class RequisitionWarehouseCheckDto
{
    public List<RequisitionWarehouseCheckItemDto> Items { get; set; } = [];
}

public class RequisitionWarehouseCheckItemDto
{
    public Guid ItemId { get; set; }
    public decimal AvailableQuantity { get; set; }
    public string? WarehouseNotes { get; set; }
}
