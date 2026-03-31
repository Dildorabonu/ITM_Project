namespace Application.DTOs.ContractTasks;

public class ContractTaskUpdateDto
{
    public string? Name { get; set; }
    public decimal? CompletedAmount { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal? Importance { get; set; }
    public int? OrderNo { get; set; }
}
