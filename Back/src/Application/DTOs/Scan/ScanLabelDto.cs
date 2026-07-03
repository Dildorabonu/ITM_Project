using Core.Enums;

namespace Application.DTOs.Scan;

// 58mm termal yorliq chop etish uchun minimal ma'lumot.
public class ScanLabelDto
{
    public string QrPngBase64 { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public decimal Quantity { get; set; }
    public ProductUnit Unit { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
}