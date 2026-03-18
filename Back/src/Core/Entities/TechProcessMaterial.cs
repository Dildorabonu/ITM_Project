namespace Core.Entities;

public class TechProcessMaterial
{
    public Guid Id { get; set; }
    public Guid TechProcessId { get; set; }
    public Guid MaterialId { get; set; }
    public decimal RequiredQty { get; set; }
    public decimal AvailableQty { get; set; }
    public string Status { get; set; } = string.Empty;

    // Navigation properties
    public TechProcess? TechProcess { get; set; }
    public Material? Material { get; set; }
}
