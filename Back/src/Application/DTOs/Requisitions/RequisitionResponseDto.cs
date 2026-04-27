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
    public Guid? ContractId { get; set; }
    public string? ContractNo { get; set; }

    // Individual
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }

    public string Purpose { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }

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
    public Guid? WarehouseCheckedBy { get; set; }
    public string? WarehouseCheckedByName { get; set; }
    public DateTime? WarehouseCheckedAt { get; set; }

    // Tasdiqlash
    public Guid? ApprovedBy { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? QrCodeData { get; set; }  // Base64 PNG

    // Yaratuvchi
    public Guid CreatedBy { get; set; }
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
