namespace Application.DTOs.ProductCatalog;

public class ProductCatalogCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
}

public class ProductCatalogUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
}

public class ProductCatalogResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
    // Nechta shartnoma mahsuloti shu katalog yozuviga bog'langan — o'chirishdan oldin ogohlantirish uchun.
    public int UsageCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
