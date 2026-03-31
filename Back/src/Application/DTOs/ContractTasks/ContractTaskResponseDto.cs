namespace Application.DTOs.ContractTasks;

public class ContractTaskResponseDto
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public int OrderNo { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CompletedAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Importance { get; set; }
    public decimal PercentComplete { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
