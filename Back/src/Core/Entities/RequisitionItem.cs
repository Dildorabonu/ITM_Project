namespace Core.Entities;

public class RequisitionItem
{
    public Guid Id { get; set; }
    public Guid RequisitionId { get; set; }

    // Tizimda mavjud material (ixtiyoriy)
    public Guid? MaterialId { get; set; }

    // Erkin matn bilan kiritilgan material (blank forma uchun)
    public string? FreeTextName { get; set; }
    public string? FreeTextUnit { get; set; }
    public string? FreeTextSpec { get; set; }

    public decimal Quantity { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Requisition? Requisition { get; set; }
    public Material? Material { get; set; }
}
