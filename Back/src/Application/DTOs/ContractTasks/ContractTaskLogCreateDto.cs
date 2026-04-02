namespace Application.DTOs.ContractTasks;

public class ContractTaskLogCreateDto
{
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateOnly Date { get; set; }
}
