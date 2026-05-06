using Application.DTOs;
using Application.DTOs.Dashboard;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class DashboardService : IDashboardService
{
    private readonly DatabaseContext _context;

    public DashboardService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<DashboardSummaryDto>> GetSummaryAsync(int trendDays = 30)
    {
        if (trendDays <= 0) trendDays = 30;
        if (trendDays > 180) trendDays = 180;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var trendStart = today.AddDays(-(trendDays - 1));
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var prevMonthStart = monthStart.AddMonths(-1);
        var weekStart = today.AddDays(-6);
        var prevWeekStart = today.AddDays(-13);
        var prevWeekEnd = today.AddDays(-7);

        // ── KPIs (single pass over Contracts) ──────────────────────────────
        var contracts = await _context.Contracts
            .AsNoTracking()
            .Select(c => new { c.Id, c.Status, c.Priority, c.EndDate, c.IsActive, c.CreatedAt })
            .ToListAsync();

        var totalContracts = contracts.Count;
        var activeContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed && c.Status != ContractStatus.Cancelled);
        var completedContracts = contracts.Count(c => c.Status == ContractStatus.Completed);
        var cancelledContracts = contracts.Count(c => c.Status == ContractStatus.Cancelled);

        var completedThisMonth = contracts.Count(c =>
            c.Status == ContractStatus.Completed &&
            DateOnly.FromDateTime(c.CreatedAt) >= monthStart);
        var completedPrevMonth = contracts.Count(c =>
            c.Status == ContractStatus.Completed &&
            DateOnly.FromDateTime(c.CreatedAt) >= prevMonthStart &&
            DateOnly.FromDateTime(c.CreatedAt) < monthStart);

        var overdueContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed &&
            c.Status != ContractStatus.Cancelled &&
            c.EndDate < today);

        var criticalDeadlines = contracts.Count(c =>
            c.Status != ContractStatus.Completed &&
            c.Status != ContractStatus.Cancelled &&
            c.EndDate >= today &&
            c.EndDate <= today.AddDays(7));

        // Status distribution
        var statusBuckets = Enum.GetValues<ContractStatus>()
            .Select(s => new ContractStatusBucketDto
            {
                Status = s,
                Label = StatusLabel(s),
                Count = contracts.Count(c => c.Status == s),
            })
            .ToList();

        // Priority distribution (active only)
        var priorityBuckets = Enum.GetValues<Priority>()
            .Select(p => new PriorityBucketDto
            {
                Priority = p,
                Label = PriorityLabel(p),
                Count = contracts.Count(c =>
                    c.Priority == p &&
                    c.Status != ContractStatus.Completed &&
                    c.Status != ContractStatus.Cancelled),
            })
            .ToList();

        // ── Products & Manufacturing ───────────────────────────────────────
        var totalProducts = await _context.ContractProducts
            .Where(p => p.IsActive).CountAsync();
        var inProductionProducts = await _context.ContractProducts
            .Where(p => p.IsActive && p.Status == ContractProductStatus.InProduction)
            .CountAsync();

        var manufacturedAgg = await _context.ManufacturedProducts
            .AsNoTracking()
            .GroupBy(m => m.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        var mfgInProgress = manufacturedAgg.FirstOrDefault(x => x.Status == ManufacturingStatus.InProgress)?.Count ?? 0;
        var mfgCompleted = manufacturedAgg.FirstOrDefault(x => x.Status == ManufacturingStatus.Completed)?.Count ?? 0;
        var mfgTotal = mfgInProgress + mfgCompleted;

        // ── Shipments ─────────────────────────────────────────────────────
        // DateOnly.ToDateTime returns Kind=Unspecified; Npgsql requires Kind=Utc for timestamptz.
        var trendStartUtc    = DateTime.SpecifyKind(trendStart.ToDateTime(TimeOnly.MinValue),    DateTimeKind.Utc);
        var weekStartUtc     = DateTime.SpecifyKind(weekStart.ToDateTime(TimeOnly.MinValue),     DateTimeKind.Utc);
        var prevWeekStartUtc = DateTime.SpecifyKind(prevWeekStart.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var prevWeekEndUtc   = DateTime.SpecifyKind(prevWeekEnd.ToDateTime(TimeOnly.MaxValue),   DateTimeKind.Utc);

        var totalShipments = await _context.ShipmentBatches.CountAsync();
        var shipmentsThisWeek = await _context.ShipmentBatches
            .Where(s => s.CreatedAt >= weekStartUtc).CountAsync();
        var shipmentsPrevWeek = await _context.ShipmentBatches
            .Where(s => s.CreatedAt >= prevWeekStartUtc && s.CreatedAt <= prevWeekEndUtc).CountAsync();

        // ── Users / Departments ────────────────────────────────────────────
        var totalUsers = await _context.Users.Where(u => u.IsActive).CountAsync();
        var departments = await _context.Departments.AsNoTracking().ToListAsync();
        var activeDepartments = departments.Count(d => d.IsActive);
        var totalEmployees = departments.Sum(d => d.EmployeeCount);

        // ── Production trend (daily logs) ──────────────────────────────────
        var dailyLogsRaw = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive && l.Date >= trendStart && l.Date <= today)
            .Select(l => new { l.Date, l.Amount })
            .ToListAsync();

        var productionByDate = dailyLogsRaw
            .GroupBy(l => l.Date)
            .ToDictionary(g => g.Key, g => new { Sum = g.Sum(x => x.Amount), Count = g.Count() });

        var productionTrend = new List<ProductionTrendPointDto>();
        for (int i = 0; i < trendDays; i++)
        {
            var d = trendStart.AddDays(i);
            productionByDate.TryGetValue(d, out var v);
            productionTrend.Add(new ProductionTrendPointDto
            {
                Date = d,
                Amount = v?.Sum ?? 0,
                LogCount = v?.Count ?? 0,
            });
        }

        var loggedThisWeek = dailyLogsRaw
            .Where(l => l.Date >= weekStart && l.Date <= today)
            .Sum(l => l.Amount);
        var loggedPrevWeek = dailyLogsRaw
            .Where(l => l.Date >= prevWeekStart && l.Date <= prevWeekEnd)
            .Sum(l => l.Amount);

        // ── Shipment trend ────────────────────────────────────────────────
        var shipmentRaw = await _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.CreatedAt >= trendStartUtc)
            .Select(s => new { s.CreatedAt, s.Amount })
            .ToListAsync();

        var shipByDate = shipmentRaw
            .GroupBy(s => DateOnly.FromDateTime(s.CreatedAt))
            .ToDictionary(g => g.Key, g => new { Sum = g.Sum(x => x.Amount), Count = g.Count() });

        var shipmentTrend = new List<ProductionTrendPointDto>();
        for (int i = 0; i < trendDays; i++)
        {
            var d = trendStart.AddDays(i);
            shipByDate.TryGetValue(d, out var v);
            shipmentTrend.Add(new ProductionTrendPointDto
            {
                Date = d,
                Amount = v?.Sum ?? 0,
                LogCount = v?.Count ?? 0,
            });
        }

        // ── Department workload ───────────────────────────────────────────
        var deptContractCounts = await _context.ContractDepartments
            .Where(cd => cd.IsActive
                         && cd.Contract.Status != ContractStatus.Completed
                         && cd.Contract.Status != ContractStatus.Cancelled)
            .GroupBy(cd => cd.DepartmentId)
            .Select(g => new { DepartmentId = g.Key, Count = g.Count() })
            .ToListAsync();
        var deptContractDict = deptContractCounts.ToDictionary(x => x.DepartmentId, x => x.Count);

        var deptManufacturedCounts = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.InProgress)
            .GroupBy(m => m.DepartmentId)
            .Select(g => new { DepartmentId = g.Key, Count = g.Count() })
            .ToListAsync();
        var deptManufacturedDict = deptManufacturedCounts.ToDictionary(x => x.DepartmentId, x => x.Count);

        var deptLogged = await _context.ContractTaskDailyLogs
            .Where(l => l.IsActive && l.Date >= weekStart && l.Date <= today
                        && l.Creator != null && l.Creator.DepartmentId != null)
            .GroupBy(l => l.Creator!.DepartmentId)
            .Select(g => new { DepartmentId = g.Key!.Value, Sum = g.Sum(x => x.Amount) })
            .ToListAsync();
        var deptLoggedDict = deptLogged.ToDictionary(x => x.DepartmentId, x => x.Sum);

        var departmentWorkload = departments
            .Where(d => d.IsActive)
            .Select(d => new DepartmentWorkloadDto
            {
                Id = d.Id,
                Name = d.Name,
                Type = d.Type,
                EmployeeCount = d.EmployeeCount,
                ActiveContracts = deptContractDict.GetValueOrDefault(d.Id),
                ActiveManufactured = deptManufacturedDict.GetValueOrDefault(d.Id),
                LoggedAmount = deptLoggedDict.GetValueOrDefault(d.Id),
            })
            .OrderByDescending(d => d.ActiveContracts + d.ActiveManufactured)
            .ThenByDescending(d => d.LoggedAmount)
            .ToList();

        // ── Manufacturing progress (in-progress, top 8) ───────────────────
        var manufacturingProgress = await _context.ManufacturedProducts
            .AsNoTracking()
            .Where(m => m.Status == ManufacturingStatus.InProgress)
            .Include(m => m.Department)
            .Include(m => m.Contract)
            .OrderByDescending(m => m.CreatedAt)
            .Take(8)
            .Select(m => new ManufacturingProgressDto
            {
                Id = m.Id,
                Name = m.Name,
                Code = m.Code,
                Unit = m.Unit,
                Quantity = m.Quantity,
                ProducedQuantity = m.ProducedQuantity,
                Status = m.Status,
                DepartmentName = m.Department != null ? m.Department.Name : null,
                ContractNo = m.Contract != null ? m.Contract.ContractNo : null,
                StartedAt = m.StartedAt,
                ProgressPercent = m.Quantity > 0
                    ? (double)(m.ProducedQuantity / m.Quantity) * 100.0
                    : 0,
            })
            .ToListAsync();

        // ── Upcoming deadlines (active contracts, sorted by endDate) ──────
        var upcomingRaw = await _context.Contracts
            .AsNoTracking()
            .Where(c => c.Status != ContractStatus.Completed && c.Status != ContractStatus.Cancelled)
            .OrderBy(c => c.EndDate)
            .Take(8)
            .Select(c => new
            {
                c.Id,
                c.ContractNo,
                c.ContractParty,
                c.EndDate,
                c.Status,
                c.Priority,
                FirstProduct = c.Products
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => p.ProductType)
                    .FirstOrDefault(),
                Tasks = c.ContractTasks
                    .Where(t => t.IsActive)
                    .Select(t => new { t.CompletedAmount, t.TotalAmount, t.Importance }),
            })
            .ToListAsync();

        var upcomingDeadlines = upcomingRaw.Select(c =>
        {
            var totalImp = c.Tasks.Sum(t => t.Importance);
            double progress = 0;
            if (totalImp > 0)
            {
                var weighted = c.Tasks.Sum(t =>
                    t.TotalAmount > 0
                        ? (double)(t.CompletedAmount / t.TotalAmount) * (double)t.Importance
                        : 0);
                progress = weighted / (double)totalImp * 100.0;
            }
            return new UpcomingDeadlineDto
            {
                Id = c.Id,
                ContractNo = c.ContractNo,
                ContractParty = c.ContractParty,
                EndDate = c.EndDate,
                Status = c.Status,
                Priority = c.Priority,
                DaysRemaining = c.EndDate.DayNumber - today.DayNumber,
                OverallProgress = Math.Round(progress, 1),
                PrimaryProduct = c.FirstProduct,
            };
        }).ToList();

        // ── Recent activity feed (mixed sources) ──────────────────────────
        var recentContracts = await _context.Contracts
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .Take(5)
            .Select(c => new RecentActivityDto
            {
                Kind = "contract",
                Title = $"Yangi shartnoma: {c.ContractNo}",
                Subtitle = c.ContractParty,
                ActorName = c.Creator != null ? (c.Creator.FirstName + " " + c.Creator.LastName).Trim() : null,
                At = c.CreatedAt,
                RefId = c.Id,
            })
            .ToListAsync();

        var recentLogs = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive)
            .OrderByDescending(l => l.CreatedAt)
            .Take(5)
            .Select(l => new RecentActivityDto
            {
                Kind = "task-log",
                Title = $"{l.Amount} {(l.Task != null ? l.Task.Name : "vazifa")}",
                Subtitle = l.Task != null && l.Task.Contract != null ? l.Task.Contract.ContractNo : null,
                ActorName = l.Creator != null ? (l.Creator.FirstName + " " + l.Creator.LastName).Trim() : null,
                At = l.CreatedAt,
                RefId = l.TaskId,
            })
            .ToListAsync();

        var recentShipments = await _context.ShipmentBatches
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .Take(5)
            .Select(s => new RecentActivityDto
            {
                Kind = "shipment",
                Title = $"Partiya #{s.BatchNo} — {s.Amount}",
                Subtitle = s.Contract != null ? s.Contract.ContractNo : null,
                ActorName = s.Creator != null ? (s.Creator.FirstName + " " + s.Creator.LastName).Trim() : null,
                At = s.CreatedAt,
                RefId = s.Id,
            })
            .ToListAsync();

        var recentManufactured = await _context.ManufacturedProducts
            .AsNoTracking()
            .OrderByDescending(m => m.CreatedAt)
            .Take(5)
            .Select(m => new RecentActivityDto
            {
                Kind = "manufactured",
                Title = $"Ishlab chiq.: {m.Name}",
                Subtitle = m.Department != null ? m.Department.Name : null,
                ActorName = m.Creator != null ? (m.Creator.FirstName + " " + m.Creator.LastName).Trim() : null,
                At = m.CreatedAt,
                RefId = m.Id,
            })
            .ToListAsync();

        var recentActivity = recentContracts
            .Concat(recentLogs)
            .Concat(recentShipments)
            .Concat(recentManufactured)
            .OrderByDescending(a => a.At)
            .Take(12)
            .ToList();

        // ── Top performers (last 30 days by daily-log count) ──────────────
        var perfStart = today.AddDays(-29);
        var topPerformers = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive && l.Date >= perfStart && l.Creator != null)
            .GroupBy(l => new
            {
                l.CreatedBy,
                FullName = l.Creator!.FirstName + " " + l.Creator.LastName,
                DepartmentName = l.Creator.Department != null ? l.Creator.Department.Name : null,
            })
            .Select(g => new TopPerformerDto
            {
                UserId = g.Key.CreatedBy,
                FullName = g.Key.FullName,
                DepartmentName = g.Key.DepartmentName,
                LogCount = g.Count(),
                TotalAmount = g.Sum(x => x.Amount),
            })
            .OrderByDescending(x => x.TotalAmount)
            .ThenByDescending(x => x.LogCount)
            .Take(5)
            .ToListAsync();

        // ── Activity heatmap (last 12 weeks, day-of-week × week) ──────────
        const int heatmapWeeks = 12;
        var heatStart = today.AddDays(-(heatmapWeeks * 7 - 1));

        var heatRaw = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive && l.Date >= heatStart && l.Date <= today)
            .GroupBy(l => l.Date)
            .Select(g => new { Date = g.Key, Sum = g.Sum(x => x.Amount), Count = g.Count() })
            .ToListAsync();
        var heatDict = heatRaw.ToDictionary(x => x.Date, x => new { x.Sum, x.Count });

        var heatmap = new List<HeatmapCellDto>();
        for (int i = 0; i < heatmapWeeks * 7; i++)
        {
            var d = heatStart.AddDays(i);
            heatDict.TryGetValue(d, out var v);
            heatmap.Add(new HeatmapCellDto
            {
                Date = d,
                DayOfWeek = ((int)d.DayOfWeek),
                WeekIndex = i / 7,
                Amount = v?.Sum ?? 0,
                LogCount = v?.Count ?? 0,
            });
        }

        // ── Compose ───────────────────────────────────────────────────────
        var summary = new DashboardSummaryDto
        {
            Kpis = new DashboardKpiDto
            {
                TotalContracts = totalContracts,
                ActiveContracts = activeContracts,
                CompletedContracts = completedContracts,
                CancelledContracts = cancelledContracts,
                CompletedThisMonth = completedThisMonth,
                CompletedPrevMonth = completedPrevMonth,
                CompletionRate = totalContracts > 0
                    ? Math.Round((double)completedContracts / totalContracts * 100.0, 1)
                    : 0,
                TotalProducts = totalProducts,
                InProductionProducts = inProductionProducts,
                ManufacturedTotal = mfgTotal,
                ManufacturedInProgress = mfgInProgress,
                ManufacturedCompleted = mfgCompleted,
                TotalShipments = totalShipments,
                ShipmentsThisWeek = shipmentsThisWeek,
                ShipmentsPrevWeek = shipmentsPrevWeek,
                TotalUsers = totalUsers,
                ActiveDepartments = activeDepartments,
                TotalEmployees = totalEmployees,
                LoggedAmountThisWeek = loggedThisWeek,
                LoggedAmountPrevWeek = loggedPrevWeek,
                OverdueContracts = overdueContracts,
                CriticalDeadlines = criticalDeadlines,
            },
            ContractStatus = statusBuckets,
            ProductionTrend = productionTrend,
            ShipmentTrend = shipmentTrend,
            DepartmentWorkload = departmentWorkload,
            ManufacturingProgress = manufacturingProgress,
            UpcomingDeadlines = upcomingDeadlines,
            RecentActivity = recentActivity,
            TopPerformers = topPerformers,
            PriorityDistribution = priorityBuckets,
            ActivityHeatmap = heatmap,
        };

        return ApiResult<DashboardSummaryDto>.Success(summary);
    }

    private static string StatusLabel(ContractStatus s) => s switch
    {
        ContractStatus.DrawingPending => "Chizma",
        ContractStatus.TechProcessing => "Tex. jarayon",
        ContractStatus.InProduction   => "Ishlab chiqarish",
        ContractStatus.Completed      => "Yakunlandi",
        ContractStatus.Cancelled      => "Bekor qilindi",
        _ => s.ToString(),
    };

    private static string PriorityLabel(Priority p) => p switch
    {
        Priority.Low    => "Past",
        Priority.Medium => "O'rta",
        Priority.High   => "Yuqori",
        Priority.Urgent => "Shoshilinch",
        _ => p.ToString(),
    };
}
