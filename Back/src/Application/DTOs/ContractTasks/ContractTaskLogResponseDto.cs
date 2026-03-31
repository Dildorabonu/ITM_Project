namespace Application.DTOs.ContractTasks;

public class ContractTaskLogResponseDto
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateOnly Date { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
