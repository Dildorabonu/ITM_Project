namespace Application.DTOs.Products;

// Yangi mahsulot kiritishda topilgan "o'xshash" (fuzzy) mavjud mahsulot.
// Similarity — pg_trgm similarity() qiymati (0..1), 1 ga yaqin = juda o'xshash.
public class ProductSimilarDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public double Similarity { get; set; }
}
