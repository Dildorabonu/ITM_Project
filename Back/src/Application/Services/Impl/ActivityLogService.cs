using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SysTask = System.Threading.Tasks.Task;

namespace Application.Services.Impl;

public class ActivityLogService : IActivityLogService
{
    private readonly DatabaseContext _context;
    private readonly ILogger<ActivityLogService> _logger;

    public ActivityLogService(DatabaseContext context, ILogger<ActivityLogService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async SysTask LogAsync(string kind, string title, string? subtitle, Guid? actorId, Guid? refId)
    {
        try
        {
            string? actorName = null;
            if (actorId.HasValue)
            {
                actorName = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == actorId.Value)
                    .Select(u => (u.FirstName + " " + u.LastName).Trim())
                    .FirstOrDefaultAsync();
            }

            var entry = new ActivityLog
            {
                Id = Guid.NewGuid(),
                Kind = kind,
                Title = title,
                Subtitle = subtitle,
                ActorId = actorId,
                ActorName = string.IsNullOrWhiteSpace(actorName) ? null : actorName,
                RefId = refId,
                CreatedAt = DateTime.UtcNow,
            };

            _context.ActivityLogs.Add(entry);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ActivityLog yozishda xatolik: {Kind} / {Title}", kind, title);
        }
    }
}
