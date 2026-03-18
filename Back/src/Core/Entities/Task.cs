using Core.Enums;

namespace Core.Entities;

public class Task
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public Priority Priority { get; set; }
    public TimeOnly? ScheduledTime { get; set; }
    public Guid? AssignedTo { get; set; }
    public Guid CreatedBy { get; set; }
    public DateOnly TaskDate { get; set; }
    public WorkTaskStatus Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Department? Department { get; set; }
    public User? Assignee { get; set; }
    public User? Creator { get; set; }
}
