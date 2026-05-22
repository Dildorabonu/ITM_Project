namespace Core.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }
    public string Token { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public Guid FamilyId { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRevoked { get; set; } = false;
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
    public string? CreatedByIp { get; set; }
    public string? UserAgent { get; set; }

    public User User { get; set; } = null!;
}
