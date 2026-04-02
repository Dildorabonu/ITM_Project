using Application.DTOs;
using Application.DTOs.Notifications;
using Core.Enums;

namespace Application.Services;

public interface INotificationService
{
    Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetByUserAsync(Guid userId);
    Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetAllNotificationsAsync();
    Task<ApiResult<int>> GetUnreadCountAsync(Guid userId);
    Task<ApiResult<int>> GetAllUnreadCountAsync();
    Task<ApiResult<int>> MarkAsReadAsync(Guid id, Guid userId);
    Task<ApiResult<int>> MarkAsReadByIdAsync(Guid id);
    Task<ApiResult<int>> MarkAllAsReadAsync(Guid userId);
    Task<ApiResult<int>> MarkAllReadForAllAsync();
    Task<ApiResult<int>> DeleteAsync(Guid id);
    Task<ApiResult<int>> DeleteOwnAsync(Guid id, Guid userId);
    Task CreateAsync(Guid userId, string title, string body, NotificationType type);
    Task NotifyAllAsync(string title, string body, NotificationType type);
    Task NotifyDepartmentAsync(Guid departmentId, string title, string body, NotificationType type);
    Task NotifyDepartmentAndUsersAsync(Guid departmentId, IEnumerable<Guid> assignedUserIds, string title, string body, NotificationType type);
}
