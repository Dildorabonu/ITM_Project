using Core.Enums;

namespace Core.Entities;

public class Requisition
{
    public Guid Id { get; set; }
    // Manba hujjatdan avtomatik yasaladi: "<ShartnomaNo> shartnoma talabnomasi"
    // yoki "<Bo'lim> bo'lim talabnomasi"; bola talabnomalarga -W / -P qo'shiladi.
    public string RequisitionNo { get; set; } = string.Empty;
    public RequisitionType Type { get; set; }
    public RequisitionStatus Status { get; set; } = RequisitionStatus.PendingWarehouseCheck;

    // Shartnoma bo'yicha bo'lsa
    public Guid? ContractId { get; set; }

    // Individual bo'lsa — qaysi bo'lim uchun
    public Guid? DepartmentId { get; set; }

    public string Purpose { get; set; } = string.Empty;  // Maqsad/izoh
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }

    // Imzolash ma'lumotlari (blank forma uchun)
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    public string? SignDate { get; set; }

    // ── Parent / Child ─────────────────────────────────────────────────
    public Guid? ParentRequisitionId { get; set; }       // Child esa parent IDsi
    public RequisitionSource? Source { get; set; }       // Faqat child'da: Warehouse / Purchase

    // ── Ombor tekshiruvi ───────────────────────────────────────────────
    public Guid? WarehouseCheckedBy { get; set; }
    public DateTime? WarehouseCheckedAt { get; set; }
    public string? WarehouseCheckQrCodeData { get; set; }  // Base64 PNG — omborchi imzosi

    // ── Direktor tasdiqlash ────────────────────────────────────────────
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? QrCodeData { get; set; }  // Base64 PNG — direktor imzosi

    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Contract? Contract { get; set; }
    public Department? Department { get; set; }
    public User? Creator { get; set; }
    public User? Approver { get; set; }
    public User? WarehouseChecker { get; set; }
    public Requisition? Parent { get; set; }
    public ICollection<Requisition> Children { get; set; } = [];
    public ICollection<RequisitionItem> Items { get; set; } = [];
}
