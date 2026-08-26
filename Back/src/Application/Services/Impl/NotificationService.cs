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

    private const int ListLimit = 100;
    private const int UnreadPreviewLimit = 10;

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
            .Take(ListLimit)
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
            .ToListAsync();

        return ApiResult<IEnumerable<NotificationResponseDto>>.Success(notifs);
    }

    // Qo'ng'iroq belgisi har 30 soniyada shu yerga uriladi — shuning uchun javob
    // faqat hisob va ochiladigan ro'yxat ko'rsatadigan bir nechta sarlavhadan iborat.
    public async Task<ApiResult<NotificationUnreadDto>> GetUnreadAsync(Guid userId)
    {
        var unread = _context.Notifications.Where(n => n.UserId == userId && !n.IsRead);

        var count = await unread.CountAsync();

        List<NotificationPreviewDto> items = count == 0
            ? []
            : await unread
                .OrderByDescending(n => n.CreatedAt)
                .Take(UnreadPreviewLimit)
                .Select(n => new NotificationPreviewDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Body = n.Body,
                })
                .ToListAsync();

        return ApiResult<NotificationUnreadDto>.Success(new NotificationUnreadDto
        {
            Count = count,
            Items = items,
        });
    }

    public async Task<ApiResult<bool>> MarkAsReadAsync(Guid id, Guid userId)
    {
        // Yozuvni o'qib olib, keyin saqlash o'rniga bitta UPDATE — egasi WHERE da
        // tekshiriladi, ya'ni begona bildirishnoma avvalgidek 404 qaytaradi.
        var updated = await _context.Notifications
            .Where(n => n.Id == id && n.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        if (updated == 0)
            return ApiResult<bool>.Failure(["Bildirishnoma topilmadi."], 404);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> MarkAllAsReadAsync(Guid userId)
    {
        await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> DeleteOwnAsync(Guid id, Guid userId)
    {
        // 404 va 403 ni ajratish uchun faqat egasining Id si o'qiladi — butun yozuv emas.
        var ownerId = await _context.Notifications
            .Where(n => n.Id == id)
            .Select(n => (Guid?)n.UserId)
            .FirstOrDefaultAsync();

        if (ownerId is null)
            return ApiResult<bool>.Failure(["Bildirishnoma topilmadi."], 404);

        if (ownerId != userId)
            return ApiResult<bool>.Failure(["Bu bildirishnomani o'chirish huquqi yo'q."], 403);

        await _context.Notifications
            .Where(n => n.Id == id)
            .ExecuteDeleteAsync();

        return ApiResult<bool>.Success(true);
    }

    public async Task CreateAsync(Guid userId, string title, string body, NotificationType type, Guid? contractId = null)
    {
        try
        {
            await SaveManyAsync([userId], title, body, type, contractId);
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
            await SaveManyAsync(userIds, title, body, type, contractId);
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
            await SaveManyAsync(await ActiveSuperAdminIdsAsync(), title, body, type, contractId);
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
            var superAdminIds = await ActiveSuperAdminIdsAsync();
            await SaveManyAsync(userIds.Concat(superAdminIds), title, body, type, contractId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Foydalanuvchilar va superadminlarga bildirishnoma yuborishda xatolik: {Title}", title);
        }
    }

    private Task<List<Guid>> ActiveSuperAdminIdsAsync() =>
        _context.Users
            .Where(u => u.IsActive && u.RoleId == SuperAdminRoleId)
            .Select(u => u.Id)
            .ToListAsync();

    private async Task SaveManyAsync(IEnumerable<Guid> userIds, string title, string body, NotificationType type, Guid? contractId)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return;

        var createdAt = DateTime.UtcNow;

        _context.Notifications.AddRange(ids.Select(uid => new Core.Entities.Notification
        {
            Id = Guid.NewGuid(),
            UserId = uid,
            Title = title,
            Body = body,
            Type = type,
            ContractId = contractId,
            IsRead = false,
            CreatedAt = createdAt,
        }));

        await _context.SaveChangesAsync();
    }
}
