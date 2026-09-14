using Core.Enums;

namespace Application.DTOs.Requisitions;

/// <summary>
/// Navbat ekranlari (ombor tekshiruvi, tasdiqlash, xaridni qabul qilish) uchun
/// qator. Materiallarning faqat ko'rinadigan maydonlari boradi; QR rasmlari,
/// imzo/izoh maydonlari, child ro'yxati va label matnlari bu yerda kerak emas
/// (label'ni klient enum lug'atidan oladi).
/// </summary>
public class RequisitionQueueDto
{
    public Guid Id { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;
    public RequisitionType Type { get; set; }
    public RequisitionStatus Status { get; set; }
    public RequisitionSource? Source { get; set; }

    public string? ContractNo { get; set; }
    public string? DepartmentName { get; set; }
    public string Purpose { get; set; } = string.Empty;

    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? WarehouseCheckedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public List<RequisitionQueueItemDto> Items { get; set; } = [];
}

public class RequisitionQueueItemDto
{
    public Guid Id { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}
