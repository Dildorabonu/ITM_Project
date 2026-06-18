using Core.Enums;

namespace Core.Entities;

public class Product
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    // Nomning kanonik (translit + normalize) ko'rinishi — fuzzy/dublikat qidiruvi uchun.
    // TextNormalizer.Normalize(Name) orqali to'ldiriladi, qo'lda o'zgartirilmaydi.
    public string NameNormalized { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Quantity { get; set; }

    // Omborchi tasdiqlagan, direktor tasdiqini kutayotgan miqdor.
    // Omborchi tekshiruvida foydalanuvchi ko'radigan miqdor: Quantity - ReservedQuantity.
    public decimal ReservedQuantity { get; set; }

    public ProductUnit Unit { get; set; }
    public Guid DepartmentId { get; set; }

    // Katalog mahsulotiga (Material) bog'lanish — string-match upsert o'rniga.
    // FreeText (katalogda yo'q) mahsulotlar uchun null bo'ladi.
    public Guid? MaterialId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Department? Department { get; set; }
    public Material? Material { get; set; }
}
