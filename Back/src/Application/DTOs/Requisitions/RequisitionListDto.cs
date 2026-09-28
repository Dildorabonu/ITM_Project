using Core.Enums;

namespace Application.DTOs.Requisitions;

/// <summary>
/// Ro'yxat qatori (paged / "yaqinda yakunlangan"). Jadval faqat sarlavha
/// maydonlarini ko'rsatadi — materiallar, QR rasmlari (base64 PNG), imzo va
/// izoh maydonlari bu yerda uzatilmaydi, ular faqat detal so'rovida keladi.
/// Label matnlari ham yuborilmaydi: klientda enum → matn lug'ati bor
/// (REQUISITION_STATUS_LABELS / REQUISITION_TYPE_LABELS).
/// </summary>
public class RequisitionListDto
{
    public Guid Id { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;
    public RequisitionType Type { get; set; }
    public RequisitionStatus Status { get; set; }

    public string? ContractNo { get; set; }
    public string? DepartmentName { get; set; }

    public decimal? AllowancePercent { get; set; }

    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Split parent uchun childlarning eng kechki CompletedAt i.
    public DateTime? CompletedAt { get; set; }

    // Bo'lingan talabnomada "bajarilgan / rad etilgan" holati childlardan
    // hisoblanadi — ro'yxatga faqat shu statuslar kerak, to'liq child obyekti emas.
    public List<RequisitionStatus> ChildStatuses { get; set; } = [];
}
