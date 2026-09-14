namespace Application.DTOs.Products;

// Yangi mahsulot kiritishda topilgan "o'xshash" (fuzzy) mavjud mahsulot.
// Autocomplete dropdowni va dublikat ogohlantirishi uchun minimal maydonlar.
public class ProductSimilarDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
}
