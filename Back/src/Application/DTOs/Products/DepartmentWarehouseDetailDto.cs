using Core.Enums;

namespace Application.DTOs.Products;

// Bitta bo'lim ombori sahifasining to'liq javobi: sarlavha uchun bo'lim nomi/turi
// + jadval uchun mahsulotlar. Sahifa ilgari nom/tur uchun alohida
// /api/department/{id} chaqirardi (DepartmentResponseDto ning 6 maydonidan
// faqat 2 tasi ishlatilardi) — endi bitta so'rov yetarli.
public class DepartmentWarehouseDetailDto
{
    public string DepartmentName { get; set; } = string.Empty;
    public DepartmentType DepartmentType { get; set; }
    public List<DepartmentProductDto> Products { get; set; } = [];
}
