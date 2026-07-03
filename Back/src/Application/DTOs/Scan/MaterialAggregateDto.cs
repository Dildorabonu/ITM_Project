namespace Application.DTOs.Scan;

// Skanerlangan Product bog'langan Material/SKU bo'yicha umumiy zaxira ko'rinishi.
// Bo'limlar kesimida (Departments) breakdown bilan birga keladi.
public class MaterialAggregateDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    // Shu Materialga bog'langan barcha Product qatorlari miqdorining yig'indisi.
    public decimal TotalQuantity { get; set; }

    // Material katalogidagi (Material.Quantity) qiymat — legacy hisob.
    public decimal CatalogQuantity { get; set; }

    public decimal MinQuantity { get; set; }
    public string? Location { get; set; }

    public List<MaterialDepartmentBreakdownDto> Departments { get; set; } = [];
}

// Material zaxirasining bitta bo'lim bo'yicha bo'lagi.
public class MaterialDepartmentBreakdownDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
}