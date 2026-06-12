using Application.DTOs;
using Application.DTOs.Dashboard;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class DashboardService : IDashboardService
{
    private readonly DatabaseContext _context;

    // Har bir mahsulot uchun avtomatik yaratiladigan ombor vazifasining nomi —
    // haqiqiy ishlab chiqarilgan miqdor shu vazifaning CompletedAmount'idan olinadi.
    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

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

        // ── KPI cards: the headline is the current grand total, the sparkline
        // shows how that total accumulated over the last 31 days, and the delta
        // is how many items were added this month. Window/anchors below. ──
        const int sparkWindow = 31;
        var sparkFrom = today.AddDays(-(sparkWindow - 1));
        var sparkFromUtc = AsUtc(sparkFrom, TimeOnly.MinValue);
        var firstOfMonth = new DateOnly(today.Year, today.Month, 1);
        var firstOfMonthUtc = AsUtc(firstOfMonth, TimeOnly.MinValue);

        // ── Contracts (state snapshot) ─────────────────────────────────────
        var contracts = await _context.Contracts
            .AsNoTracking()
            .Select(c => new { c.Id, c.Status, c.EndDate, c.IsActive, c.CreatedAt })
            .ToListAsync();

        var totalContracts = contracts.Count;
        // Currently active (all-time snapshot, not period-scoped)
        var activeContracts = contracts.Count(c =>
            c.Status != ContractStatus.Completed
            && c.Status != ContractStatus.Cancelled);
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

        // Current totals (all-time snapshot)
        var mfgInProgress = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.InProgress);
        var mfgCompleted = await _context.ManufacturedProducts
            .CountAsync(m => m.Status == ManufacturingStatus.Completed);

        // ── Shipments ─────────────────────────────────────────────────────
        var totalShipments = await _context.ShipmentBatches.CountAsync();

        // ── Completion aggregates (all-time, active products) ──────────────
        // Haqiqiy ishlab chiqarilgan miqdor — har mahsulot uchun avtomatik
        // yaratiladigan "Tayyor mahsulotni omborga topshirish" vazifasining
        // CompletedAmount'idan olinadi (boshqa bosqich-vazifalar hisobga olinmaydi).
        // Per-product capping: ortiqcha topshirilgan bitta mahsulot boshqa
        // mahsulotning kamomadini yashirmasligi uchun har birini o'z miqdorida
        // cheklab, keyin yig'amiz.
        var productCompletion = await _context.ContractProducts
            .Where(p => p.IsActive)
            .Select(p => new
            {
                Quantity = (decimal)p.Quantity,
                Produced = p.ContractTasks
                    .Where(t => t.IsActive && t.Name == WarehouseTaskName)
                    .Select(t => (decimal?)t.CompletedAmount)
                    .FirstOrDefault() ?? 0m,
            })
            .ToListAsync();
        var totalContractedAmount = productCompletion.Sum(x => x.Quantity);
        var totalProducedAmount = productCompletion.Sum(x => Math.Min(x.Quantity, x.Produced));
        var totalBatchedAmount = await _context.ShipmentBatches
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        // ── Users / Departments ────────────────────────────────────────────
        var totalUsers = await _context.Users.Where(u => u.IsActive).CountAsync();
        var departments = await _context.Departments.AsNoTracking().ToListAsync();
        var activeDepartments = departments.Count(d => d.IsActive);
        // Current total active employees (assigned to a department)
        var totalEmployees = await _context.Users
            .CountAsync(u => u.IsActive && u.DepartmentId != null);

        // ── Cumulative KPI sparkline (last 31 days) ───────────────────────
        // Each series rises to the current grand total: for every day D we plot
        // how many of today's counted items had been anchored (created/completed)
        // by D. The rightmost point therefore equals the headline KPI, and the
        // month-to-date increment is surfaced separately as the card delta.
        var activeAnchors = contracts
            .Where(c => c.Status != ContractStatus.Completed
                        && c.Status != ContractStatus.Cancelled
                        && c.CreatedAt >= sparkFromUtc)
            .Select(c => c.CreatedAt)
            .ToList();
        var completedAnchors = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.Completed
                        && m.CompletedAt != null && m.CompletedAt >= sparkFromUtc)
            .Select(m => m.CompletedAt!.Value)
            .ToListAsync();
        var inProgressAnchors = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.InProgress
                        && m.CreatedAt >= sparkFromUtc)
            .Select(m => m.CreatedAt)
            .ToListAsync();
        var employeeAnchors = await _context.Users
            .Where(u => u.IsActive && u.DepartmentId != null
                        && u.CreatedAt >= sparkFromUtc)
            .Select(u => u.CreatedAt)
            .ToListAsync();

        // Builds the cumulative series ending at `total`, plus this-month adds.
        (int[] Series, int MonthAdded) BuildCumulative(List<DateTime> anchors, int total)
        {
            var addsByDate = anchors
                .GroupBy(a => DateOnly.FromDateTime(a))
                .ToDictionary(g => g.Key, g => g.Count());
            var baseline = total - addsByDate.Values.Sum();   // counted items dated before the window
            var series = new int[sparkWindow];
            var run = baseline;
            for (int i = 0; i < sparkWindow; i++)
            {
                run += addsByDate.GetValueOrDefault(sparkFrom.AddDays(i));
                series[i] = run;
            }
            var monthAdded = anchors.Count(a => a >= firstOfMonthUtc);
            return (series, monthAdded);
        }

        var (activeSeries, activeMonthAdded)         = BuildCumulative(activeAnchors, activeContracts);
        var (completedSeries, completedMonthAdded)   = BuildCumulative(completedAnchors, mfgCompleted);
        var (inProgressSeries, inProgressMonthAdded) = BuildCumulative(inProgressAnchors, mfgInProgress);
        var (employeeSeries, employeeMonthAdded)     = BuildCumulative(employeeAnchors, totalEmployees);

        var kpiSparkline = new List<KpiSparklinePointDto>(sparkWindow);
        for (int i = 0; i < sparkWindow; i++)
        {
            kpiSparkline.Add(new KpiSparklinePointDto
            {
                Date = sparkFrom.AddDays(i),
                ActiveContracts        = activeSeries[i],
                ManufacturedCompleted  = completedSeries[i],
                ManufacturedInProgress = inProgressSeries[i],
                TotalEmployees         = employeeSeries[i],
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
            MonthlyAdded = new DashboardKpiMonthlyDto
            {
                ActiveContracts = activeMonthAdded,
                ManufacturedCompleted = completedMonthAdded,
                ManufacturedInProgress = inProgressMonthAdded,
                TotalEmployees = employeeMonthAdded,
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
