using Application.DTOs;
using Application.DTOs.Notifications;
using Core.Enums;

namespace Application.Services;

public interface INotificationService
{
    Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetByUserAsync(Guid userId);
    Task<ApiResult<NotificationUnreadDto>> GetUnreadAsync(Guid userId);
    Task<ApiResult<bool>> MarkAsReadAsync(Guid id, Guid userId);
    Task<ApiResult<bool>> MarkAllAsReadAsync(Guid userId);
    Task<ApiResult<bool>> DeleteOwnAsync(Guid id, Guid userId);
    Task CreateAsync(Guid userId, string title, string body, NotificationType type, Guid? contractId = null);
    Task NotifyManyAsync(IEnumerable<Guid> userIds, string title, string body, NotificationType type, Guid? contractId = null);
    Task NotifySuperAdminsAsync(string title, string body, NotificationType type, Guid? contractId = null);
    Task NotifyUsersAndSuperAdminsAsync(IEnumerable<Guid> userIds, string title, string body, NotificationType type, Guid? contractId = null);
}
