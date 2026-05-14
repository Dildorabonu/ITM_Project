namespace Core.Entities;

public class RequisitionItem
{
    public Guid Id { get; set; }
    public Guid RequisitionId { get; set; }

    // Tizimda mavjud material (ixtiyoriy)
    public Guid? MaterialId { get; set; }

    // Erkin matn bilan kiritilgan material (blank forma uchun)
    public string? FreeTextName { get; set; }
    public string? FreeTextUnit { get; set; }
    public string? FreeTextSpec { get; set; }
    public string? FreeTextPhoto { get; set; }  // URL yoki base64 data URL

    public decimal Quantity { get; set; }
    public string? Notes { get; set; }

    // ── Ombor tekshiruvi natijasi ─────────────────────────────────────
    public decimal? AvailableQuantity { get; set; }   // Omborchi kiritgan: nechtasi bor
    public string? WarehouseNotes { get; set; }       // Omborchi izohi

    // Child'ni parent bilan bog'lash uchun: parent itemdagi asl miqdor
    // ("100 dan 10 ta bor" ko'rsatishda kerak)
    public decimal? OriginalQuantity { get; set; }

    // Omborchi tasdiqlaganda muzlatilgan Product (Rejectda rezervni qaytarish uchun)
    public Guid? ReservedProductId { get; set; }

    // Navigation properties
    public Requisition? Requisition { get; set; }
    public Material? Material { get; set; }
    public Product? ReservedProduct { get; set; }
}
