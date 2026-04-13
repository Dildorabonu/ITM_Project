using Core.Enums;

namespace Core.Entities;

public class Requisition
{
    public Guid Id { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;  // REQ-2026-0001
    public RequisitionType Type { get; set; }
    public RequisitionStatus Status { get; set; } = RequisitionStatus.Draft;

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

    // Tasdiqlash
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? QrCodeData { get; set; }  // Base64 PNG — chop etishda ishlatiladi

    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Contract? Contract { get; set; }
    public Department? Department { get; set; }
    public User? Creator { get; set; }
    public User? Approver { get; set; }
    public ICollection<RequisitionItem> Items { get; set; } = [];
}
