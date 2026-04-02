using Application.DTOs;
using Application.DTOs.Notifications;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services.Impl;

public class NotificationService : INotificationService
{
    private static readonly Guid SuperAdminRoleId = new("00000000-0000-0000-0000-000000000001");

    private readonly DatabaseContext _context;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(DatabaseContext context, ILogger<NotificationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetByUserAsync(Guid userId)
    {
        var notifs = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .AsNoTracking()
            .Select(n => new NotificationResponseDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Title = n.Title,
                Body = n.Body,
                Type = n.Type,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt,
            })
            .Take(100)
            .ToListAsync();

        return ApiResult<IEnumerable<NotificationResponseDto>>.Success(notifs);
    }

    public async Task<ApiResult<IEnumerable<NotificationResponseDto>>> GetAllNotificationsAsync()
    {
        var notifs = await _context.Notifications
            .OrderByDescending(n => n.CreatedAt)
            .AsNoTracking()
            .Select(n => new NotificationResponseDto
            {
                Id = n.Id,
                Title = n.Title,
                Body = n.Body,
                Type = n.Type,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt,
                UserId = n.UserId,
            })
            .Take(500)
            .ToListAsync();

        var deduped = notifs
            .DistinctBy(n => new { n.Title, n.Body })
            .ToList();

        return ApiResult<IEnumerable<NotificationResponseDto>>.Success(deduped);
    }

    public async Task<ApiResult<int>> GetUnreadCountAsync(Guid userId)
    {
        var count = await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        return ApiResult<int>.Success(count);
    }

    public async Task<ApiResult<int>> GetAllUnreadCountAsync()
    {
        var count = await _context.Notifications.CountAsync(n => !n.IsRead);
        return ApiResult<int>.Success(count);
    }

    public async Task<ApiResult<int>> MarkAsReadAsync(Guid id, Guid userId)
    {
        var notif = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notif is null)
            return ApiResult<int>.Failure(["Bildirishnoma topilmadi."], 404);

        notif.IsRead = true;
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> MarkAsReadByIdAsync(Guid id)
    {
        var notif = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id);

        if (notif is null)
            return ApiResult<int>.Failure(["Bildirishnoma topilmadi."], 404);

        notif.IsRead = true;
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> MarkAllAsReadAsync(Guid userId)
    {
        await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> MarkAllReadForAllAsync()
    {
        await _context.Notifications
            .Where(n => !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var notif = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id);

        if (notif is null)
            return ApiResult<int>.Failure(["Bildirishnoma topilmadi."], 404);

        await _context.Notifications
            .Where(n => n.Title == notif.Title && n.Body == notif.Body)
            .ExecuteDeleteAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteOwnAsync(Guid id, Guid userId)
    {
        var notif = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notif is null)
            return ApiResult<int>.Failure(["Bildirishnoma topilmadi."], 404);

        _context.Notifications.Remove(notif);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task CreateAsync(Guid userId, string title, string body, NotificationType type)
    {
        try
        {
            var notification = new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = title,
                Body = body,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bildirishnoma yaratishda xatolik: {Title}", title);
        }
    }

    public async Task NotifyAllAsync(string title, string body, NotificationType type)
    {
        try
        {
            var userIds = await _context.Users
                .Where(u => u.IsActive)
                .Select(u => u.Id)
                .ToListAsync();

            var notifications = userIds.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Barcha foydalanuvchilarga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }

    public async Task NotifyDepartmentAndUsersAsync(Guid departmentId, IEnumerable<Guid> assignedUserIds, string title, string body, NotificationType type)
    {
        try
        {
            var extraIds = assignedUserIds.ToHashSet();

            // Bo'lim xodimlari + biriktirilgan hodimlar + SuperAdmin
            var userIds = await _context.Users
                .Where(u => u.IsActive && (
                    u.DepartmentId == departmentId ||
                    extraIds.Contains(u.Id) ||
                    u.RoleId == SuperAdminRoleId))
                .Select(u => u.Id)
                .Distinct()
                .ToListAsync();

            var notifications = userIds.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bo'lim va hodimlariga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }

    public async Task NotifyDepartmentAsync(Guid departmentId, string title, string body, NotificationType type)
    {
        try
        {
            // Bo'lim xodimlari + SuperAdmin doim oladi
            var userIds = await _context.Users
                .Where(u => u.IsActive && (u.DepartmentId == departmentId || u.RoleId == SuperAdminRoleId))
                .Select(u => u.Id)
                .Distinct()
                .ToListAsync();

            var notifications = userIds.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bo'limga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }
}
