namespace Core.Entities;

public class ContractTaskDailyLog
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateOnly Date { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ContractTask? Task { get; set; }
    public User? Creator { get; set; }
}
