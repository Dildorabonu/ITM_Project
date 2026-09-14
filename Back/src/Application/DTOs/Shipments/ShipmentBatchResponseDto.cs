namespace Application.DTOs.Shipments;

// Partiya qatori — ro'yxatda va yaratilgandan keyin qaytariladi. Faqat UI
// ko'rsatadigan maydonlar: tur (Kind) so'rovda filtr sifatida beriladi, shu
// sababli javobda takrorlanmaydi.
public class ShipmentBatchResponseDto
{
    public Guid Id { get; set; }
    public Guid? ContractProductId { get; set; }
    // Olib ketish qaysi partiyadan bo'lgani (CustomerPickup uchun).
    public Guid? SourceBatchId { get; set; }
    public int? SourceBatchNo { get; set; }
    public string? DepartmentName { get; set; }
    public int BatchNo { get; set; }
    public decimal Amount { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
