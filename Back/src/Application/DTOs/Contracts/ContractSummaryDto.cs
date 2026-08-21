using System.Text.Json.Serialization;
using Core.Enums;

namespace Application.DTOs.Contracts;

// Ro'yxat/lookup endpointlari (`GET /api/contract`, `/paged`, `/my-tasks`) uchun
// yengil DTO. Faqat jadval, badge va dropdownlar chizish uchun kerak bo'lgan
// maydonlar bor — to'liq ma'lumot (izohlar, biriktirilgan xodimlar, yaratuvchi,
// katalog kodi) faqat `GET /api/contract/{id}` da qaytariladi.
public class ContractSummaryProductDto
{
    public Guid Id { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public ContractProductStatus Status { get; set; }

    // Quyidagilar faqat kerak bo'lgan endpointda to'ldiriladi; null bo'lsa
    // JSON javobga umuman qo'shilmaydi.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Notes { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ContractDepartmentDto>? Departments { get; set; }
}

public class ContractSummaryDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractParty { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public ContractType ContractType { get; set; }
    public ContractStatus Status { get; set; }
    public bool IsActive { get; set; }

    // Mijozga topshirish hisobi — faqat `/paged` da hisoblanadi (arxivdagi
    // "Yakunlangan" tab badge'i uchun).
    public decimal TotalQuantity { get; set; }
    public decimal ShippedQuantity { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ContractDepartmentDto>? Departments { get; set; }

    public List<ContractSummaryProductDto> Products { get; set; } = [];
}
