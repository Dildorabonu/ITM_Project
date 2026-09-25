using Core.Enums;

namespace Application.DTOs.Scan;

// Ombor skaneridan bajariladigan amal: chiqim (Out) yoki tuzatish (Adjust).
// Quantity ma'nosi Type ga bog'liq:
//   Out    — maqsad bo'limga o'tkaziladigan miqdor (musbat);
//   Adjust — yangi absolut miqdor (delta emas).
public class ScanActionDto
{
    public Guid ProductId { get; set; }
    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }

    // Faqat Out uchun shart — maqsad bo'lim.
    public Guid? TargetDepartmentId { get; set; }

    public string? Notes { get; set; }
}