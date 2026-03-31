namespace Application.DTOs.Materials;

public class MaterialCreateDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal MinQuantity { get; set; }
    public string? Location { get; set; }
}
