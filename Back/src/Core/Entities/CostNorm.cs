using Core.Enums;

namespace Core.Entities;

public class CostNorm
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DrawingStatus Status { get; set; } = DrawingStatus.Draft;
    public bool IsActive { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Contract? Contract { get; set; }
    public User? Creator { get; set; }
    public ICollection<CostNormItem> Items { get; set; } = [];
}
