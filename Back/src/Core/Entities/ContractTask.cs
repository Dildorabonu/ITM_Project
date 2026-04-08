namespace Core.Entities;

public class ContractTask
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public int OrderNo { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CompletedAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Importance { get; set; } // 0–100 foiz
    public bool IsActive { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Contract? Contract { get; set; }
    public User? Creator { get; set; }
    public ICollection<ContractTaskDailyLog> DailyLogs { get; set; } = [];
}
