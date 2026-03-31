namespace Application.DTOs.ContractTasks;

public class ContractTaskCreateDto
{
    public Guid ContractId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CompletedAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Importance { get; set; }
}
