namespace Application.DTOs.Notifications;

/// <summary>
/// Qo'ng'iroq belgisi uchun yengil javob: hisob + bir nechta oxirgi sarlavha.
/// Butun ro'yxatni (100 tagacha to'liq yozuv) 30 soniyada bir marta tortishning o'rniga.
/// </summary>
public class NotificationUnreadDto
{
    public int Count { get; set; }
    public IReadOnlyList<NotificationPreviewDto> Items { get; set; } = [];
}

public class NotificationPreviewDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}
