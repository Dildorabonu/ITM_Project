namespace Core.Entities;

public class CostNormItem
{
    public Guid Id { get; set; }
    public Guid CostNormId { get; set; }
    public bool IsSection { get; set; }
    public string? SectionName { get; set; }
    public string? No { get; set; }
    public string? Name { get; set; }
    public string? Unit { get; set; }
    public string? ReadyQty { get; set; }
    public string? WasteQty { get; set; }
    public string? TotalQty { get; set; }
    public string? PhotoRaw { get; set; }
    public string? PhotoSemi { get; set; }
    public string? ImportType { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    // Section qatorida foydalanuvchi tanlagan mas'ul bo'lim; oddiy qatorlarga
    // saqlash paytida o'z section'idan ko'chiriladi (bo'lim kesimida sarf so'rovlari uchun).
    public Guid? DepartmentId { get; set; }

    // Navigation properties
    public CostNorm? CostNorm { get; set; }
    public Department? Department { get; set; }
}
