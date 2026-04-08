using Core.Enums;

namespace Application.DTOs.Notifications;

public class NotificationResponseDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public Guid? ContractId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}
