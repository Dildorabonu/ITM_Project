namespace Application.DTOs.Materials;

public class MaterialUpdateDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? MinQuantity { get; set; }
    public string? Location { get; set; }
}
