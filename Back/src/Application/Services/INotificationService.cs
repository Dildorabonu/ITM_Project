using Application.DTOs;
using Application.DTOs.Notifications;
using Core.Enums;

namespace Application.Services;

public interface INotificationService
{
    Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetByUserAsync(Guid userId);
    Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetAllNotificationsAsync();
    Task<ApiResult<int>> GetUnreadCountAsync(Guid userId);
    Task<ApiResult<int>> MarkAsReadAsync(Guid id, Guid userId);
    Task<ApiResult<int>> MarkAllAsReadAsync(Guid userId);
    Task<ApiResult<int>> DeleteAsync(Guid id, Guid userId);
    Task CreateAsync(Guid userId, string title, string body, NotificationType type);
    Task NotifyAllAsync(string title, string body, NotificationType type);
    Task NotifyDepartmentAsync(Guid departmentId, string title, string body, NotificationType type);
}
