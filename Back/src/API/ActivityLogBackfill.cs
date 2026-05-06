using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using SysTask = System.Threading.Tasks.Task;

namespace API;

internal static class ActivityLogBackfill
{
    public static async SysTask RunAsync(DatabaseContext ctx)
    {
        var entries = new List<ActivityLog>();

        var contracts = await ctx.Contracts
            .AsNoTracking()
            .Include(c => c.Creator)
            .OrderByDescending(c => c.CreatedAt)
            .Take(200)
            .ToListAsync();
        foreach (var c in contracts)
        {
            entries.Add(new ActivityLog
            {
                Id = Guid.NewGuid(),
                Kind = "contract",
                Title = $"Yangi shartnoma: {c.ContractNo}",
                Subtitle = c.ContractParty,
                ActorId = c.CreatedBy,
                ActorName = c.Creator != null ? $"{c.Creator.FirstName} {c.Creator.LastName}".Trim() : null,
                RefId = c.Id,
                CreatedAt = c.CreatedAt,
            });
        }

        var logs = await ctx.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive)
            .Include(l => l.Creator)
            .Include(l => l.Task).ThenInclude(t => t!.Contract)
            .OrderByDescending(l => l.CreatedAt)
            .Take(200)
            .ToListAsync();
        foreach (var l in logs)
        {
            entries.Add(new ActivityLog
            {
                Id = Guid.NewGuid(),
                Kind = "task-log",
                Title = $"{l.Amount} {(l.Task?.Name ?? "vazifa")}",
                Subtitle = l.Task?.Contract?.ContractNo,
                ActorId = l.CreatedBy,
                ActorName = l.Creator != null ? $"{l.Creator.FirstName} {l.Creator.LastName}".Trim() : null,
                RefId = l.TaskId,
                CreatedAt = l.CreatedAt,
            });
        }

        var shipments = await ctx.ShipmentBatches
            .AsNoTracking()
            .Include(s => s.Creator)
            .Include(s => s.Contract)
            .OrderByDescending(s => s.CreatedAt)
            .Take(200)
            .ToListAsync();
        foreach (var s in shipments)
        {
            entries.Add(new ActivityLog
            {
                Id = Guid.NewGuid(),
                Kind = "shipment",
                Title = $"Partiya #{s.BatchNo} — {s.Amount}",
                Subtitle = s.Contract?.ContractNo,
                ActorId = s.CreatedBy,
                ActorName = s.Creator != null ? $"{s.Creator.FirstName} {s.Creator.LastName}".Trim() : null,
                RefId = s.Id,
                CreatedAt = s.CreatedAt,
            });
        }

        var manufactured = await ctx.ManufacturedProducts
            .AsNoTracking()
            .Include(m => m.Creator)
            .Include(m => m.Department)
            .OrderByDescending(m => m.CreatedAt)
            .Take(200)
            .ToListAsync();
        foreach (var m in manufactured)
        {
            entries.Add(new ActivityLog
            {
                Id = Guid.NewGuid(),
                Kind = "manufactured",
                Title = $"Ishlab chiq.: {m.Name}",
                Subtitle = m.Department?.Name,
                ActorId = m.CreatedBy,
                ActorName = m.Creator != null ? $"{m.Creator.FirstName} {m.Creator.LastName}".Trim() : null,
                RefId = m.Id,
                CreatedAt = m.CreatedAt,
            });
        }

        if (entries.Count == 0) return;

        ctx.ActivityLogs.AddRange(entries);
        await ctx.SaveChangesAsync();
    }
}
