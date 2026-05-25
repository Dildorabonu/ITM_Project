namespace Core.Entities;

public class LoginAttempt
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Login { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
    public bool Success { get; set; }

    public User? User { get; set; }
}
