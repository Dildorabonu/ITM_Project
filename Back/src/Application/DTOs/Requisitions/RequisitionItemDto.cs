namespace Application.DTOs.Requisitions;

public class RequisitionItemCreateDto
{
    // Tizimda mavjud material orqali
    public Guid? MaterialId { get; set; }

    // Blank forma: erkin matn
    public string? FreeTextName { get; set; }
    public string? FreeTextUnit { get; set; }
    public string? FreeTextSpec { get; set; }
    public string? FreeTextPhoto { get; set; }

    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}

public class RequisitionItemResponseDto
{
    public Guid Id { get; set; }
    public Guid? MaterialId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string? FreeTextSpec { get; set; }
    public string? FreeTextPhoto { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}
