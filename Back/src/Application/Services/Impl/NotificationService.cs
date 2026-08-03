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
                Title = n.Title,
                Body = n.Body,
                Type = n.Type,
                ContractId = n.ContractId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt,
            })
            .Take(100)
            .ToListAsync();

        return ApiResult<IEnumerable<NotificationResponseDto>>.Success(notifs);
    }

    public async Task<ApiResult<int>> GetUnreadCountAsync(Guid userId)
    {
        var count = await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);

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

    public async Task<ApiResult<int>> MarkAllAsReadAsync(Guid userId)
    {
        await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteOwnAsync(Guid id, Guid userId)
    {
        var notif = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id);

        if (notif is null)
            return ApiResult<int>.Failure(["Bildirishnoma topilmadi."], 404);

        if (notif.UserId != userId)
            return ApiResult<int>.Failure(["Bu bildirishnomani o'chirish huquqi yo'q."], 403);

        _context.Notifications.Remove(notif);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task CreateAsync(Guid userId, string title, string body, NotificationType type, Guid? contractId = null)
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
                ContractId = contractId,
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

    // Bir nechta foydalanuvchiga bitta bildirishnomani yuboradi — CreateAsync ni
    // tsiklda chaqirishdan farqli, hammasi bitta SaveChangesAsync bilan yoziladi.
    // (Tsiklda chaqirish har bir qabul qiluvchi uchun alohida DB round-trip
    // qilib, talabnoma yaratish javobini sezilarli kechiktirardi.)
    public async Task NotifyManyAsync(IEnumerable<Guid> userIds, string title, string body, NotificationType type, Guid? contractId = null)
    {
        try
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0)
                return;

            var notifications = ids.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                ContractId = contractId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bir nechta foydalanuvchiga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }

    public async Task NotifySuperAdminsAsync(string title, string body, NotificationType type, Guid? contractId = null)
    {
        try
        {
            var superAdminIds = await _context.Users
                .Where(u => u.IsActive && u.RoleId == SuperAdminRoleId)
                .Select(u => u.Id)
                .ToListAsync();

            var notifications = superAdminIds.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                ContractId = contractId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SuperAdminlarga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }

    public async Task NotifyUsersAndSuperAdminsAsync(IEnumerable<Guid> userIds, string title, string body, NotificationType type, Guid? contractId = null)
    {
        try
        {
            var superAdminIds = await _context.Users
                .Where(u => u.IsActive && u.RoleId == SuperAdminRoleId)
                .Select(u => u.Id)
                .ToListAsync();

            var allIds = userIds.Union(superAdminIds).Distinct().ToList();

            var notifications = allIds.Select(uid => new Core.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = title,
                Body = body,
                Type = type,
                ContractId = contractId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Foydalanuvchilar va superadminlarga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }
}
