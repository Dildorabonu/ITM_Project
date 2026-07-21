namespace Application.DTOs.Shipments;

// Har bir shartnoma mahsuloti uchun mijozga topshirishga tayyor (omborga
// kirim qilingan) miqdor — PickupModal'da mavjud qoldiqni ko'rsatish uchun.
public class ShipmentReadyDto
{
    public Guid ContractProductId { get; set; }
    public decimal ReadyQuantity { get; set; }
}
