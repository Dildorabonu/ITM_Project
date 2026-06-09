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

        // ── KPI period = current week to date (Mon..today) ──
        // Newly created contracts/products must show up immediately, so the KPI
        // window is the *current* week — not the previous completed week — and is
        // compared against the equal-length window immediately before it (see
        // prevKpi* below).
        var dow = ((int)today.DayOfWeek + 6) % 7;     // Mon=0 .. Sun=6
        var kpiFrom = today.AddDays(-dow);            // this Monday
        var kpiTo   = today;                          // today
        var kpiFromUtc = AsUtc(kpiFrom, TimeOnly.MinValue);
        var kpiToUtc   = AsUtc(kpiTo,   TimeOnly.MaxValue);

        // Previous KPI window — equal length, immediately before current
        var kpiDays = kpiTo.DayNumber - kpiFrom.DayNumber + 1;
        var prevKpiTo   = kpiFrom.AddDays(-1);
        var prevKpiFrom = prevKpiTo.AddDays(-(kpiDays - 1));
        var prevKpiFromUtc = AsUtc(prevKpiFrom, TimeOnly.MinValue);
        var prevKpiToUtc   = AsUtc(prevKpiTo,   TimeOnly.MaxValue);

        // ── Contracts (state snapshot + period totals) ─────────────────────
        var contracts = await _context.Contracts
            .AsNoTracking()
            .Select(c => new { c.Id, c.Status, c.EndDate, c.IsActive, c.CreatedAt })
            .ToListAsync();

        var totalContracts = contracts.Count;
        // Period-scoped: contracts created in selected range and still active
        var activeContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed
            && c.Status != ContractStatus.Cancelled
            && c.CreatedAt >= kpiFromUtc && c.CreatedAt <= kpiToUtc);
        var prevActiveContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed
            && c.Status != ContractStatus.Cancelled
            && c.CreatedAt >= prevKpiFromUtc && c.CreatedAt <= prevKpiToUtc);
        var completedContracts = contracts.Count(c => c.Status == ContractStatus.Completed);
        var cancelledContracts = contracts.Count(c => c.Status == ContractStatus.Cancelled);

        var overdueContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed &&
            c.Status != ContractStatus.Cancelled &&
            c.EndDate < today);

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
        var prevMfgInProgress = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.InProgress
                          && m.CreatedAt >= prevKpiFromUtc && m.CreatedAt <= prevKpiToUtc);
        // Period-scoped: products completed during the range
        var mfgCompleted = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.Completed
                          && m.CompletedAt != null
                          && m.CompletedAt >= kpiFromUtc && m.CompletedAt <= kpiToUtc);
        var prevMfgCompleted = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.Completed
                          && m.CompletedAt != null
                          && m.CompletedAt >= prevKpiFromUtc && m.CompletedAt <= prevKpiToUtc);

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
        var prevTotalEmployees = await _context.Users
            .CountAsync(u => u.IsActive && u.DepartmentId != null
                          && u.CreatedAt >= prevKpiFromUtc && u.CreatedAt <= prevKpiToUtc);

        // ── Sparkline window — current + previous KPI period (default = 14 days).
        // For each day D in the window we report a rolling 7-day count
        // (items dated within [D-6, D]). The rightmost point matches the KPI value.
        var sparkFrom = prevKpiFrom;
        var sparkTo   = kpiTo;
        var sparkDays = sparkTo.DayNumber - sparkFrom.DayNumber + 1;
        const int rollWindow = 7;
        var rawFrom = sparkFrom.AddDays(-(rollWindow - 1));
        var rawTo   = sparkTo;
        var rawFromUtc = AsUtc(rawFrom, TimeOnly.MinValue);
        var rawToUtc   = AsUtc(rawTo,   TimeOnly.MaxValue);

        var rawActiveByDate = contracts
            .Where(c => c.Status != ContractStatus.Completed
                        && c.Status != ContractStatus.Cancelled
                        && c.CreatedAt >= rawFromUtc && c.CreatedAt <= rawToUtc)
            .GroupBy(c => DateOnly.FromDateTime(c.CreatedAt))
            .ToDictionary(g => g.Key, g => g.Count());

        var rawMfgCompletedDates = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.Completed
                        && m.CompletedAt != null
                        && m.CompletedAt >= rawFromUtc && m.CompletedAt <= rawToUtc)
            .Select(m => m.CompletedAt!.Value)
            .ToListAsync();
        var rawMfgCompletedByDate = rawMfgCompletedDates
            .GroupBy(d => DateOnly.FromDateTime(d))
            .ToDictionary(g => g.Key, g => g.Count());

        var rawMfgInProgressDates = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.InProgress
                        && m.CreatedAt >= rawFromUtc && m.CreatedAt <= rawToUtc)
            .Select(m => m.CreatedAt)
            .ToListAsync();
        var rawMfgInProgressByDate = rawMfgInProgressDates
            .GroupBy(d => DateOnly.FromDateTime(d))
            .ToDictionary(g => g.Key, g => g.Count());

        var rawEmployeesDates = await _context.Users
            .Where(u => u.IsActive && u.DepartmentId != null
                        && u.CreatedAt >= rawFromUtc && u.CreatedAt <= rawToUtc)
            .Select(u => u.CreatedAt)
            .ToListAsync();
        var rawEmployeesByDate = rawEmployeesDates
            .GroupBy(d => DateOnly.FromDateTime(d))
            .ToDictionary(g => g.Key, g => g.Count());

        var kpiSparkline = new List<KpiSparklinePointDto>(sparkDays);
        for (int i = 0; i < sparkDays; i++)
        {
            var d = sparkFrom.AddDays(i);
            int active = 0, completed = 0, inProgress = 0, employees = 0;
            for (int j = 0; j < rollWindow; j++)
            {
                var dd = d.AddDays(-j);
                active     += rawActiveByDate.GetValueOrDefault(dd);
                completed  += rawMfgCompletedByDate.GetValueOrDefault(dd);
                inProgress += rawMfgInProgressByDate.GetValueOrDefault(dd);
                employees  += rawEmployeesByDate.GetValueOrDefault(dd);
            }
            kpiSparkline.Add(new KpiSparklinePointDto
            {
                Date = d,
                ActiveContracts        = active,
                ManufacturedCompleted  = completed,
                ManufacturedInProgress = inProgress,
                TotalEmployees         = employees,
            });
        }

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
                DaysRemaining = c.EndDate.DayNumber - today.DayNumber,
                OverallProgress = Math.Round(progress, 1),
                PrimaryProduct = c.FirstProduct,
            };
        }).ToList();

        // ── Recent activity feed (ActivityLog) — always the latest entries ─
        // Not scoped to the KPI period: a "recent activity" feed must show the
        // most recent events regardless of the selected calendar window, else
        // it reads empty whenever nothing happened in (e.g.) last week.
        var recentActivity = await _context.ActivityLogs
            .AsNoTracking()
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

        // ── Activity heatmap — fixed last 53 weeks (~1 year, GitHub-style)
        const int heatmapWeeks = 53;
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
            PreviousKpis = new DashboardKpiDeltaDto
            {
                ActiveContracts = prevActiveContracts,
                ManufacturedCompleted = prevMfgCompleted,
                ManufacturedInProgress = prevMfgInProgress,
                TotalEmployees = prevTotalEmployees,
            },
            KpiSparkline = kpiSparkline,
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
