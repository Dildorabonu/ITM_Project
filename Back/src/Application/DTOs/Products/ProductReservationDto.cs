using Core.Enums;

namespace Application.DTOs.Products;

public class ProductReservationDto
{
    // Manba mahsulot (Omborxonadagi)
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public ProductUnit Unit { get; set; }

    // Muzlatilgan miqdor (shu talabnoma uchun)
    public decimal ReservedQuantity { get; set; }

    // Sabab: talabnoma maqsadi
    public Guid RequisitionId { get; set; }
    public string RequisitionNo { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;

    // Qaysi bo'lim uchun muzlatilgan
    public string? TargetDepartmentName { get; set; }

    // Holat — direktor tasdig'ini kutmoqda yoki tasdiqlanib chiqarish kutmoqda
    public RequisitionStatus Status { get; set; }
    public string StatusLabel { get; set; } = string.Empty;

    // Vaqt
    public DateTime? WarehouseCheckedAt { get; set; }
}
