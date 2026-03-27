namespace Application.DTOs.CostNorms;

public class CostNormCreateDto
{
    public Guid ContractId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<CostNormItemCreateDto> Items { get; set; } = [];
}
