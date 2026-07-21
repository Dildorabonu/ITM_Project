namespace Application.DTOs.Shipments;

// Mijozga topshirishni avtomatik taqsimlash: umumiy miqdor eng eski ishlab
// chiqarish partiyasidan boshlab (FIFO) bo'linadi — har partiyadan olingan
// qismi alohida CustomerPickup yozuvi bo'ladi.
public class ShipmentPickupAutoCreateDto
{
    public Guid ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public Guid? DepartmentId { get; set; }
    public decimal Amount { get; set; }
}
