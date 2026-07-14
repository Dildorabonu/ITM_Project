using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractDepartmentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; }
}

public class ContractResponseDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<ContractDepartmentDto> Departments { get; set; } = [];
    public ContractType ContractType { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public ContractStatus Status { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    // Mijozga topshirish hisobi: faol (bekor qilinmagan) mahsulotlar umumiy miqdori
    // va shu shartnoma bo'yicha jo'natilgan (ShipmentBatch) partiyalar yig'indisi.
    // Faqat paged ro'yxatda to'ldiriladi — arxivdagi "Yakunlangan" tab badge'i uchun.
    public decimal TotalQuantity { get; set; }
    public decimal ShippedQuantity { get; set; }
    public string? CreatedByFullName { get; set; }
    public List<ContractUserDto> AssignedUsers { get; set; } = [];
    public List<ContractProductResponseDto> Products { get; set; } = [];
}
