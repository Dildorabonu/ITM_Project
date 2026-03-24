namespace Application.DTOs.TechProcesses;

public class TechProcessMaterialResponseDto
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal AvailableQty { get; set; }
    public string Status { get; set; } = string.Empty;
}
