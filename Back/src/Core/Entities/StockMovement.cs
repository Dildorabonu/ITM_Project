using Core.Enums;

namespace Core.Entities;

// Yagona ombor harakatlari jurnali (append-only ledger).
// Har qanday Product miqdori (markaziy ombor yoki bo'lim ombori, Material yoki FreeText)
// o'zgarganda bitta qator yoziladi. StockIn/StockOut'dan farqi: bu yerda FreeText itemlar
// va bo'lim-ombor harakatlari ham qamrab olinadi.
//
// MUHIM: jurnal deploy momentidan oldinga qarab to'ldiriladi — tarixiy backfill yo'q.
// Hisobotlar uchun yangi "source of truth" shu jadval; StockIn/StockOut esa legacy
// (faqat Material-asosli) bo'lib qoladi.
public class StockMovement
{
    public Guid Id { get; set; }
    public StockMovementType Type { get; set; }

    // Miqdori real o'zgargan inventar qatori
    public Guid ProductId { get; set; }

    // Katalog-asosli bo'lsa Material; FreeText bo'lsa null
    public Guid? MaterialId { get; set; }

    // IN: faqat Target; OUT: faqat Source; TRANSFER: ikkalasi ham
    public Guid? SourceDepartmentId { get; set; }
    public Guid? TargetDepartmentId { get; set; }

    public decimal Quantity { get; set; }       // har doim musbat
    public decimal QuantityAfter { get; set; }   // mutatsiyadan keyingi Product.Quantity snapshot

    public Guid? RequisitionId { get; set; }
    public Guid? ContractId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }

    // Navigation properties
    public Product? Product { get; set; }
    public Material? Material { get; set; }
    public Department? SourceDepartment { get; set; }
    public Department? TargetDepartment { get; set; }
    public Requisition? Requisition { get; set; }
    public Contract? Contract { get; set; }
    public User? User { get; set; }
}
