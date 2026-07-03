using Core.Enums;

namespace Application.DTOs.Scan;

// Ombor skaneridan bajariladigan amal: chiqim (Out), ko'chirish (Transfer) yoki
// tuzatish (Adjust). Quantity ma'nosi Type ga bog'liq:
//   Out/Transfer — ayriladigan/ko'chiriladigan miqdor (musbat);
//   Adjust       — yangi absolut miqdor (delta emas).
public class ScanActionDto
{
    public Guid ProductId { get; set; }
    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }

    // Faqat Transfer uchun shart — maqsad bo'lim.
    public Guid? TargetDepartmentId { get; set; }

    public string? Notes { get; set; }
}