using Core.Enums;

namespace Application.DTOs.Products;

public class ProductCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public ProductUnit Unit { get; set; }
    public Guid DepartmentId { get; set; }
}
