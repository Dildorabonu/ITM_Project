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

    public async Task<ApiResult<DashboardSummaryDto>> GetSummaryAsync(
        DateOnly? from = null,
        DateOnly? to = null,
        DateOnly? trendFrom = null,
        DateOnly? trendTo = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Workload / top-performers window: fixed last 30 days inclusive
        const int workloadDays = 30;
        var rangeTo = today;
        var rangeFrom = today.AddDays(-(workloadDays - 1));
        var rangeFromUtc = AsUtc(rangeFrom, TimeOnly.MinValue);
        var rangeToUtc   = AsUtc(rangeTo,   TimeOnly.MaxValue);

        // Production / shipment dynamics window — user-selectable; default = last 30 days
        DateOnly trendRangeFrom, trendRangeTo;
        if (trendFrom.HasValue && trendTo.HasValue && trendFrom.Value <= trendTo.Value)
        {
            trendRangeFrom = trendFrom.Value;
            trendRangeTo   = trendTo.Value;
        }
        else
        {
            trendRangeTo   = rangeTo;
            trendRangeFrom = rangeFrom;
        }
        var trendDays = trendRangeTo.DayNumber - trendRangeFrom.DayNumber + 1;
        var trendFromUtc = AsUtc(trendRangeFrom, TimeOnly.MinValue);
        var trendToUtc   = AsUtc(trendRangeTo,   TimeOnly.MaxValue);

        // ── KPI period (user-selectable; default = previous calendar week Mon-Sun) ──
        DateOnly kpiFrom, kpiTo;
        if (from.HasValue && to.HasValue && from.Value <= to.Value)
        {
            kpiFrom = from.Value;
            kpiTo   = to.Value;
        }
        else
        {
            var dow = ((int)today.DayOfWeek + 6) % 7;     // Mon=0 .. Sun=6
            var thisMonday = today.AddDays(-dow);
            kpiTo   = thisMonday.AddDays(-1);             // last Sunday
            kpiFrom = kpiTo.AddDays(-6);                  // last Monday
        }
        var kpiFromUtc = AsUtc(kpiFrom, TimeOnly.MinValue);
        var kpiToUtc   = AsUtc(kpiTo,   TimeOnly.MaxValue);

        // ── Contracts (state snapshot + period totals) ─────────────────────
        var contracts = await _context.Contracts
            .AsNoTracking()
            .Select(c => new { c.Id, c.Status, c.Priority, c.EndDate, c.IsActive, c.CreatedAt })
            .ToListAsync();

        var totalContracts = contracts.Count;
        // Period-scoped: contracts created in selected range and still active
        var activeContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed
            && c.Status != ContractStatus.Cancelled
            && c.CreatedAt >= kpiFromUtc && c.CreatedAt <= kpiToUtc);
        var completedContracts = contracts.Count(c => c.Status == ContractStatus.Completed);
        var cancelledContracts = contracts.Count(c => c.Status == ContractStatus.Cancelled);

        var overdueContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed &&
            c.Status != ContractStatus.Cancelled &&
            c.EndDate < today);

        var criticalDeadlines = contracts.Count(c =>
            c.Status != ContractStatus.Completed &&
            c.Status != ContractStatus.Cancelled &&
            c.EndDate >= today &&
            c.EndDate <= today.AddDays(7));

        // Status distribution — counted at the product level. Contract.Status
        // collapses to the earliest stage of its products, which hides advanced
        // products behind any laggard. The dashboard widget reflects actual
        // per-product progress instead.
        var productStatusCounts = await _context.ContractProducts
            .Where(p => p.IsActive)
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        var productStatusDict = productStatusCounts.ToDictionary(x => x.Status, x => x.Count);

        var statusBuckets = Enum.GetValues<ContractStatus>()
            .Select(s => new ContractStatusBucketDto
            {
                Status = s,
                Label = StatusLabel(s),
                Count = productStatusDict.GetValueOrDefault((ContractProductStatus)(int)s),
            })
            .ToList();

        // ── Products & Manufacturing ───────────────────────────────────────
        var totalProducts = await _context.ContractProducts
            .Where(p => p.IsActive).CountAsync();
        var inProductionProducts = await _context.ContractProducts
            .Where(p => p.IsActive && p.Status == ContractProductStatus.InProduction)
            .CountAsync();

        // Period-scoped: in-progress products created during the range
        var mfgInProgress = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.InProgress
                          && m.CreatedAt >= kpiFromUtc && m.CreatedAt <= kpiToUtc);
        // Period-scoped: products completed during the range
        var mfgCompleted = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.Completed
                          && m.CompletedAt != null
                          && m.CompletedAt >= kpiFromUtc && m.CompletedAt <= kpiToUtc);

        // ── Shipments ─────────────────────────────────────────────────────
        var totalShipments = await _context.ShipmentBatches.CountAsync();

        // ── Completion aggregates (all-time, active products) ──────────────
        var totalContractedAmount = await _context.ContractProducts
            .Where(p => p.IsActive)
            .SumAsync(p => (decimal?)p.Quantity) ?? 0m;
        var totalProducedAmount = await _context.ContractTaskDailyLogs
            .Where(l => l.IsActive)
            .SumAsync(l => (decimal?)l.Amount) ?? 0m;
        var totalBatchedAmount = await _context.ShipmentBatches
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        // ── Users / Departments ────────────────────────────────────────────
        var totalUsers = await _context.Users.Where(u => u.IsActive).CountAsync();
        var departments = await _context.Departments.AsNoTracking().ToListAsync();
        var activeDepartments = departments.Count(d => d.IsActive);
        // Period-scoped: employees onboarded (created) in selected range
        var totalEmployees = await _context.Users
            .CountAsync(u => u.IsActive && u.DepartmentId != null
                          && u.CreatedAt >= kpiFromUtc && u.CreatedAt <= kpiToUtc);

        // ── Production trend (daily logs) — over trend range ──────────────
        var dailyLogsRange = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive && l.Date >= trendRangeFrom && l.Date <= trendRangeTo)
            .Select(l => new { l.Date, l.Amount })
            .ToListAsync();

        var productionByDate = dailyLogsRange
            .GroupBy(l => l.Date)
            .ToDictionary(g => g.Key, g => new { Sum = g.Sum(x => x.Amount), Count = g.Count() });

        var productionTrend = new List<ProductionTrendPointDto>();
        for (int i = 0; i < trendDays; i++)
        {
            var d = trendRangeFrom.AddDays(i);
            productionByDate.TryGetValue(d, out var v);
            productionTrend.Add(new ProductionTrendPointDto
            {
                Date = d,
                Amount = v?.Sum ?? 0,
                LogCount = v?.Count ?? 0,
            });
        }

        // ── Shipment trend — over trend range ─────────────────────────────
        var shipmentRaw = await _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.CreatedAt >= trendFromUtc && s.CreatedAt <= trendToUtc)
            .Select(s => new { s.CreatedAt, s.Amount })
            .ToListAsync();

        var shipByDate = shipmentRaw
            .GroupBy(s => DateOnly.FromDateTime(s.CreatedAt))
            .ToDictionary(g => g.Key, g => new { Sum = g.Sum(x => x.Amount), Count = g.Count() });

        var shipmentTrend = new List<ProductionTrendPointDto>();
        for (int i = 0; i < trendDays; i++)
        {
            var d = trendRangeFrom.AddDays(i);
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
            .Where(l => l.IsActive && l.Date >= rangeFrom && l.Date <= rangeTo
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

        // ── Manufacturing progress (in-progress, top 8) — snapshot ────────
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

        // ── Upcoming deadlines (active contracts, sorted by endDate) — snapshot
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

        // ── Recent activity feed (ActivityLog) — scoped to KPI period ─────
        var recentActivity = await _context.ActivityLogs
            .AsNoTracking()
            .Where(a => a.CreatedAt >= kpiFromUtc && a.CreatedAt <= kpiToUtc)
            .OrderByDescending(a => a.CreatedAt)
            .Take(12)
            .Select(a => new RecentActivityDto
            {
                Kind = a.Kind,
                Title = a.Title,
                Subtitle = a.Subtitle,
                ActorName = a.ActorName,
                At = a.CreatedAt,
                RefId = a.RefId,
            })
            .ToListAsync();

        // ── Top performers — within selected range ────────────────────────
        var topPerformers = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.IsActive && l.Date >= rangeFrom && l.Date <= rangeTo && l.Creator != null)
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

        // ── Activity heatmap — fixed last 12 weeks (long-term pattern view)
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
                CompletionRate = totalContracts > 0
                    ? Math.Round((double)completedContracts / totalContracts * 100.0, 1)
                    : 0,
                OverdueContracts = overdueContracts,
                CriticalDeadlines = criticalDeadlines,
                TotalProducts = totalProducts,
                InProductionProducts = inProductionProducts,
                ManufacturedInProgress = mfgInProgress,
                ManufacturedCompleted = mfgCompleted,
                TotalShipments = totalShipments,
                TotalUsers = totalUsers,
                ActiveDepartments = activeDepartments,
                TotalEmployees = totalEmployees,
                TotalContractedAmount = totalContractedAmount,
                TotalProducedAmount = totalProducedAmount,
                TotalBatchedAmount = totalBatchedAmount,
            },
            KpiPeriod = new KpiPeriodDto { From = kpiFrom, To = kpiTo },
            ContractStatus = statusBuckets,
            ProductionTrend = productionTrend,
            ShipmentTrend = shipmentTrend,
            DepartmentWorkload = departmentWorkload,
            ManufacturingProgress = manufacturingProgress,
            UpcomingDeadlines = upcomingDeadlines,
            RecentActivity = recentActivity,
            TopPerformers = topPerformers,
            ActivityHeatmap = heatmap,
        };

        return ApiResult<DashboardSummaryDto>.Success(summary);
    }

    // DateOnly.ToDateTime returns Kind=Unspecified; Npgsql requires Kind=Utc for timestamptz.
    private static DateTime AsUtc(DateOnly d, TimeOnly t) =>
        DateTime.SpecifyKind(d.ToDateTime(t), DateTimeKind.Utc);

    private static string StatusLabel(ContractStatus s) => s switch
    {
        ContractStatus.DrawingPending => "Chizma",
        ContractStatus.TechProcessing => "Tex. jarayon",
        ContractStatus.InProduction   => "Ishlab chiqarish",
        ContractStatus.Completed      => "Yakunlandi",
        ContractStatus.Cancelled      => "Bekor qilindi",
        _ => s.ToString(),
    };

}
