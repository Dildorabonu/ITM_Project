namespace Application.DTOs.Products;

// Fayldan import qilishda yuboriladigan bitta qator.
public class ProductDuplicateCheckItemDto
{
    public int Index { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
}

// Har bir qator uchun dublikat tekshiruvi natijasi.
public class ProductDuplicateCheckResultDto
{
    public int Index { get; set; }

    // Bazada normalized bo'yicha aynan bir xil mahsulot (chinakam dublikat) — bloklanadi.
    public ProductSimilarDto? ExactDuplicate { get; set; }

    // Shu fayl ichida normalized bo'yicha takror (xuddi shu bo'limda) — bloklanadi.
    public bool DuplicateInFile { get; set; }

    // 40%+ o'xshash mavjud mahsulotlar — faqat ogohlantirish.
    public IEnumerable<ProductSimilarDto> Similar { get; set; } = [];
}
