using Core.Enums;

namespace Application.DTOs.Requisitions;

public class RequisitionCreateDto
{
    // Yaratuvchi tomonidan blank formada qo'lda kiritiladi — majburiy.
    public string RequisitionNo { get; set; } = string.Empty;

    public RequisitionType Type { get; set; }

    // Type = Contract bo'lsa majburiy
    public Guid? ContractId { get; set; }

    // Type = Individual bo'lsa majburiy
    public Guid? DepartmentId { get; set; }

    public string Purpose { get; set; } = string.Empty;
    public string? Notes { get; set; }

    // Imzolash ma'lumotlari (blank forma uchun)
    public string? SignerName { get; set; }
    public string? SignerTitle { get; set; }
    public string? SignDate { get; set; }

    public List<RequisitionItemCreateDto> Items { get; set; } = [];
}
