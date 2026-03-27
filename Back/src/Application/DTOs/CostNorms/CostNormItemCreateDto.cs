namespace Application.DTOs.CostNorms;

public class CostNormItemCreateDto
{
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
}
