using Core.Enums;

namespace Application.DTOs.Products;

// "Bo'lim ombori" ro'yxati uchun yengil DTO — faqat jadvalda ko'rsatiladigan
// maydonlar. ProductResponseDto dan ajratilgan: departmentId/departmentName va
// availableQuantity bu sahifada ishlatilmaydi, shuning uchun yuborilmaydi.
public class DepartmentProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public ProductUnit Unit { get; set; }
    public DateTime CreatedAt { get; set; }
}
