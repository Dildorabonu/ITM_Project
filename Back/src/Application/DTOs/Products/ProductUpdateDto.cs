using Core.Enums;

namespace Application.DTOs.Products;

public class ProductUpdateDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Quantity { get; set; }
    public ProductUnit? Unit { get; set; }
    public Guid? DepartmentId { get; set; }
}
