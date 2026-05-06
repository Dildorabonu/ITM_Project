namespace Core.Entities;

public class ActivityLog
{
    public Guid Id { get; set; }

    // "contract" | "task-log" | "shipment" | "manufactured"
    public string Kind { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }

    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }

    public Guid? RefId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Actor { get; set; }
}
