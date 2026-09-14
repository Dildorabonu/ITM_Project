using Core.Enums;

namespace Application.DTOs.Scan;

// Ombor skaneri lookup natijasi: Product kartasi + Material/SKU agregati +
// yorliq uchun QR PNG (base64).
public class ScanLookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? QrCode { get; set; }

    public decimal Quantity { get; set; }
    public decimal Reserved { get; set; }

    // Available = Quantity - Reserved (omborchi amal qila oladigan miqdor).
    public decimal Available { get; set; }

    public ProductUnit Unit { get; set; }

    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;

    public string InvoiceNumber { get; set; } = string.Empty;

    // QR kodning PNG ko'rinishi (base64) — yorliq uchun qo'shimcha so'rovsiz.
    public string? QrPngBase64 { get; set; }

    // Bog'langan Material/SKU bo'yicha umumiy zaxira (FreeText bo'lsa null).
    public MaterialAggregateDto? Material { get; set; }
}
