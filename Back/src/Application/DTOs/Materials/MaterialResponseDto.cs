using Core.Enums;

namespace Application.DTOs.Materials;

public class MaterialResponseDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal MinQuantity { get; set; }
    public string? Location { get; set; }
    public MaterialStatus Status { get; set; }
    public DateTime UpdatedAt { get; set; }
}
