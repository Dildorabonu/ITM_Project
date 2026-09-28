using Core.Enums;

namespace Application.DTOs.Requisitions;

public class RequisitionCreateDto
{
    // Ixtiyoriy — bo'sh qoldirilsa nom manba hujjatdan avtomatik yasaladi
    // (shartnoma no yoki bo'lim nomi bo'yicha). Blank forma bo'sh yuboradi.
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

    // Klient qo'llagan zaxira foizi; null yoki 0 — aniq me'yor. Faqat moslik
    // tekshiruvi uchun: hisob-kitob bazadagi amaldagi foiz bilan bajariladi.
    public decimal? AllowancePercent { get; set; }

    public List<RequisitionItemCreateDto> Items { get; set; } = [];
}
