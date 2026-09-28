using Core.Enums;

namespace Application.DTOs.Requisitions;

public class RequisitionResponseDto
{
    public Guid Id { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;
    public RequisitionType Type { get; set; }
    public string TypeLabel { get; set; } = string.Empty;
    public RequisitionStatus Status { get; set; }
    public string StatusLabel { get; set; } = string.Empty;

    // Shartnoma bo'yicha
    public string? ContractNo { get; set; }

    // Individual
    public string? DepartmentName { get; set; }

    public string Purpose { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }

    // Me'yorga qo'shilgan zaxira foizi; null — aniq me'yor.
    public decimal? AllowancePercent { get; set; }

    // Imzolash ma'lumotlari
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    public string? SignDate { get; set; }

    // Parent / Child
    public Guid? ParentRequisitionId { get; set; }
    public string? ParentRequisitionNo { get; set; }
    public RequisitionSource? Source { get; set; }
    public string? SourceLabel { get; set; }
    public List<RequisitionChildSummaryDto> Children { get; set; } = [];

    // Ombor tekshiruvi
    public string? WarehouseCheckedByName { get; set; }
    public DateTime? WarehouseCheckedAt { get; set; }
    public string? WarehouseCheckQrCodeData { get; set; }  // Base64 PNG — omborchi imzosi

    // Tasdiqlash
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? QrCodeData { get; set; }  // Base64 PNG — direktor imzosi

    // Real yakunlangan payt: split parent uchun childlarning eng kechki CompletedAt i.
    public DateTime? CompletedAt { get; set; }

    // Yaratuvchi
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public List<RequisitionItemResponseDto> Items { get; set; } = [];
}

public class RequisitionChildSummaryDto
{
    public Guid Id { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;
    public RequisitionStatus Status { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
    public RequisitionSource Source { get; set; }
    public string SourceLabel { get; set; } = string.Empty;
    public int ItemCount { get; set; }
}
