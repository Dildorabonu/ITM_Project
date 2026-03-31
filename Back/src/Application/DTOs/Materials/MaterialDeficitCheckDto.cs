namespace Application.DTOs.Materials;

public class MaterialDeficitCheckDto
{
    public string CostNormItemName { get; set; } = string.Empty;
    public string CostNormItemUnit { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal AvailableQty { get; set; }
    public decimal DeficitQty { get; set; }
    public bool ExistsInInventory { get; set; }
    public Guid? MaterialId { get; set; }
    public string Status { get; set; } = string.Empty;
}
