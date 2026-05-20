using Core.Enums;

namespace Application.DTOs.Products;

public class DepartmentWarehouseSummaryDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public DepartmentType DepartmentType { get; set; }
    public int ProductCount { get; set; }
    public decimal TotalQuantity { get; set; }
}
