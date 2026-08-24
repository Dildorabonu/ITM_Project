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

    // "So'nggi faollik" feedi bir sahifada nechtadan yuklanadi (cursor-based scroll).
    private const int ActivityPageSize = 20;

    public DashboardService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<DashboardSummaryDto>> GetSummaryAsync(
        DateOnly? trendFrom = null,
        DateOnly? trendTo = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Default dynamics window: last 30 days inclusive
        const int defaultTrendDays = 30;
        var rangeTo = today;
        var rangeFrom = today.AddDays(-(defaultTrendDays - 1));

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

        // ── Contracts ──────────────────────────────────────────────────────
        // Currently active (all-time snapshot, not period-scoped). SQL COUNT —
        // butun jadvalni xotiraga yuklash shart emas.
        var activeContracts = await _context.Contracts
            .CountAsync(c => c.Status != ContractStatus.Completed
                             && c.Status != ContractStatus.Cancelled);

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

        // ── Manufacturing totals (all-time snapshot) ───────────────────────
        // Ikki alohida COUNT o'rniga bitta GROUP BY.
        var mfgStatusCounts = await _context.ManufacturedProducts
            .Where(m => m.Status == ManufacturingStatus.InProgress
                        || m.Status == ManufacturingStatus.Completed)
            .GroupBy(m => m.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        var mfgInProgress = mfgStatusCounts
            .Where(x => x.Status == ManufacturingStatus.InProgress)
            .Select(x => x.Count).FirstOrDefault();
        var mfgCompleted = mfgStatusCounts
            .Where(x => x.Status == ManufacturingStatus.Completed)
            .Select(x => x.Count).FirstOrDefault();

        // ── Completion aggregates (all-time, active products) ──────────────
        // Haqiqiy ishlab chiqarilgan miqdor — har mahsulot uchun avtomatik
        // yaratiladigan "Tayyor mahsulotni omborga topshirish" vazifasining
        // CompletedAmount'idan olinadi (boshqa bosqich-vazifalar hisobga olinmaydi).
        // Per-product capping: ortiqcha topshirilgan bitta mahsulot boshqa
        // mahsulotning kamomadini yashirmasligi uchun har birini o'z miqdorida
        // cheklab, keyin yig'amiz — yig'indi bazada (LEAST + SUM) hisoblanadi,
        // barcha mahsulot qatorlari xotiraga olinmaydi.
        var completion = await _context.ContractProducts
            .Where(p => p.IsActive)
            .Select(p => new
            {
                Quantity = (decimal)p.Quantity,
                Produced = p.ContractTasks
                    .Where(t => t.IsActive && t.Name == WarehouseTaskName)
                    .Select(t => (decimal?)t.CompletedAmount)
                    .FirstOrDefault() ?? 0m,
            })
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Contracted = g.Sum(x => x.Quantity),
                Produced = g.Sum(x => Math.Min(x.Quantity, x.Produced)),
            })
            .FirstOrDefaultAsync();
        var totalContractedAmount = completion?.Contracted ?? 0m;
        var totalProducedAmount = completion?.Produced ?? 0m;

        // Faqat ishlab chiqarish partiyalari — mijoz olib ketishlari alohida hodisa.
        var totalBatchedAmount = await _context.ShipmentBatches
            .Where(s => s.Kind == ShipmentBatchKind.Production)
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        // ── Departments / employees ────────────────────────────────────────
        // Faqat kerakli ustunlar — Department entity'sining qolgan maydonlari
        // (CreatedAt, navigatsiyalar) dashboardda ishlatilmaydi.
        var departments = await _context.Departments
            .AsNoTracking()
            .Where(d => d.IsActive)
            .Select(d => new { d.Id, d.Name, d.Type, d.EmployeeCount })
            .ToListAsync();

        // Current total active employees (assigned to a department)
        var totalEmployees = await _context.Users
            .CountAsync(u => u.IsActive && u.DepartmentId != null);

        // ── Cumulative KPI sparkline (last 31 days) ───────────────────────
        // Each series rises to the current grand total: for every day D we plot
        // how many of today's counted items had been anchored (created/completed)
        // by D. The rightmost point therefore equals the headline KPI, and the
        // month-to-date increment is surfaced separately as the card delta.
        var activeAnchors = await _context.Contracts
            .Where(c => c.Status != ContractStatus.Completed
                        && c.Status != ContractStatus.Cancelled
                        && c.CreatedAt >= sparkFromUtc)
            .Select(c => c.CreatedAt)
            .ToListAsync();
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

        // ── Trend (production + shipment) over the selected range ─────────
        // Kunlik yig'indi bazada hisoblanadi — barcha log qatorlari emas,
        // faqat kuniga bitta qator qaytadi.
        var productionByDate = (await _context.ContractTaskDailyLogs
                .AsNoTracking()
                .Where(l => l.IsActive && l.Date >= trendRangeFrom && l.Date <= trendRangeTo)
                .GroupBy(l => l.Date)
                .Select(g => new { Date = g.Key, Sum = g.Sum(x => x.Amount) })
                .ToListAsync())
            .ToDictionary(x => x.Date, x => x.Sum);

        // ShipmentBatch.CreatedAt — timestamptz; SQL'da kunga guruhlash sessiya
        // vaqt mintaqasiga bog'liq bo'lgani uchun UTC sana bo'yicha xotirada
        // guruhlanadi (oyna qisqa, qatorlar soni kichik).
        var shipmentRaw = await _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.Kind == ShipmentBatchKind.Production
                        && s.CreatedAt >= trendFromUtc && s.CreatedAt <= trendToUtc)
            .Select(s => new { s.CreatedAt, s.Amount })
            .ToListAsync();
        var shipByDate = shipmentRaw
            .GroupBy(s => DateOnly.FromDateTime(s.CreatedAt))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var trend = new List<TrendPointDto>(trendDays);
        for (int i = 0; i < trendDays; i++)
        {
            var d = trendRangeFrom.AddDays(i);
            trend.Add(new TrendPointDto
            {
                Date = d,
                Prod = productionByDate.GetValueOrDefault(d),
                Ship = shipByDate.GetValueOrDefault(d),
            });
        }

        // ── Department workload ───────────────────────────────────────────
        var deptContractDict = (await _context.ContractDepartments
                .Where(cd => cd.IsActive
                             && cd.Contract.Status != ContractStatus.Completed
                             && cd.Contract.Status != ContractStatus.Cancelled)
                .GroupBy(cd => cd.DepartmentId)
                .Select(g => new { DepartmentId = g.Key, Count = g.Count() })
                .ToListAsync())
            .ToDictionary(x => x.DepartmentId, x => x.Count);

        var deptManufacturedDict = (await _context.ManufacturedProducts
                .Where(m => m.Status == ManufacturingStatus.InProgress)
                .GroupBy(m => m.DepartmentId)
                .Select(g => new { DepartmentId = g.Key, Count = g.Count() })
                .ToListAsync())
            .ToDictionary(x => x.DepartmentId, x => x.Count);

        var departmentWorkload = departments
            .Select(d => new DepartmentWorkloadDto
            {
                Id = d.Id,
                Name = d.Name,
                Type = d.Type,
                EmployeeCount = d.EmployeeCount,
                ActiveContracts = deptContractDict.GetValueOrDefault(d.Id),
                ActiveManufactured = deptManufacturedDict.GetValueOrDefault(d.Id),
            })
            .OrderByDescending(d => d.ActiveContracts + d.ActiveManufactured)
            .ThenBy(d => d.Name)
            .ToList();

        // ── Manufacturing progress (in-progress, top 8) — snapshot ────────
        // Status filtr tufayli har doim InProgress, shu sabab javobda
        // uzatilmaydi. Include'lar ham olib tashlandi — proyeksiya bilan
        // birga ular baribir e'tiborga olinmaydi.
        var manufacturingProgress = await _context.ManufacturedProducts
            .AsNoTracking()
            .Where(m => m.Status == ManufacturingStatus.InProgress)
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
                DepartmentName = m.Department != null ? m.Department.Name : null,
                ContractNo = m.Contract != null ? m.Contract.ContractNo : null,
                ProgressPercent = m.Quantity > 0
                    ? (double)(m.ProducedQuantity / m.Quantity) * 100.0
                    : 0,
            })
            .ToListAsync();

        // ── Upcoming deadlines (active contracts, sorted by endDate) ──────
        // Vazifalarning og'irlangan progressi bazada yig'iladi — kontraktning
        // barcha vazifa qatorlarini tortib olish shart emas.
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
                FirstProduct = c.Products
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => p.ProductType)
                    .FirstOrDefault(),
                TotalImportance = c.ContractTasks
                    .Where(t => t.IsActive)
                    .Sum(t => (decimal?)t.Importance) ?? 0m,
                Weighted = c.ContractTasks
                    .Where(t => t.IsActive && t.TotalAmount > 0)
                    .Sum(t => (decimal?)(t.CompletedAmount / t.TotalAmount * t.Importance)) ?? 0m,
            })
            .ToListAsync();

        var upcomingDeadlines = upcomingRaw.Select(c => new UpcomingDeadlineDto
        {
            Id = c.Id,
            ContractNo = c.ContractNo,
            ContractParty = c.ContractParty,
            EndDate = c.EndDate,
            DaysRemaining = c.EndDate.DayNumber - today.DayNumber,
            OverallProgress = c.TotalImportance > 0
                ? Math.Round((double)(c.Weighted / c.TotalImportance) * 100.0, 1)
                : 0,
            PrimaryProduct = c.FirstProduct,
        }).ToList();

        // ── Recent activity feed (ActivityLog) — always the latest entries ─
        // Not scoped to the KPI period: a "recent activity" feed must show the
        // most recent events regardless of the selected calendar window, else
        // it reads empty whenever nothing happened in (e.g.) last week.
        var recentActivity = await ActivityPageAsync(null);

        // ── Activity heatmap — fixed last 53 weeks (~1 year, GitHub-style) ─
        // Faqat yozuvi bor kunlar uzatiladi; qolgan bo'sh kataklarni frontend
        // Start + Days'dan tiklaydi (ilgari har safar 371 ta katak ketardi).
        const int heatmapWeeks = 53;
        var heatmapDays = heatmapWeeks * 7;
        var heatStart = today.AddDays(-(heatmapDays - 1));

        // Kun ofsetini bazada hisoblab bo'lmaydi (DateOnly.DayNumber tarjima
        // qilinmaydi), shu sabab guruhlangan natija ustida — kuniga bitta qator.
        var heatCells = (await _context.ContractTaskDailyLogs
                .AsNoTracking()
                .Where(l => l.IsActive && l.Date >= heatStart && l.Date <= today)
                .GroupBy(l => l.Date)
                .Select(g => new { Date = g.Key, Sum = g.Sum(x => x.Amount), Count = g.Count() })
                .ToListAsync())
            .OrderBy(x => x.Date)
            .Select(x => new HeatmapCellDto
            {
                Day = x.Date.DayNumber - heatStart.DayNumber,
                Amount = x.Sum,
                LogCount = x.Count,
            })
            .ToList();

        // ── Compose ───────────────────────────────────────────────────────
        var summary = new DashboardSummaryDto
        {
            Kpis = new DashboardKpiDto
            {
                ActiveContracts = activeContracts,
                ManufacturedInProgress = mfgInProgress,
                ManufacturedCompleted = mfgCompleted,
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
            KpiSparkline = new KpiSparklineDto
            {
                ActiveContracts        = activeSeries,
                ManufacturedCompleted  = completedSeries,
                ManufacturedInProgress = inProgressSeries,
                TotalEmployees         = employeeSeries,
            },
            ContractStatus = statusBuckets,
            Trend = trend,
            DepartmentWorkload = departmentWorkload,
            ManufacturingProgress = manufacturingProgress,
            UpcomingDeadlines = upcomingDeadlines,
            RecentActivity = recentActivity,
            ActivityHeatmap = new ActivityHeatmapDto
            {
                Start = heatStart,
                Days = heatmapDays,
                Cells = heatCells,
            },
        };

        return ApiResult<DashboardSummaryDto>.Success(summary);
    }

    // Cursor-based "So'nggi faollik" sahifalash. `before` — oxirgi ko'rilgan yozuv
    // sanasi; null bo'lsa eng yangi sahifa qaytadi. CreatedAt bo'yicha kamayuvchi
    // index tufayli har bir so'rov index seek (OFFSET skaner yo'q).
    public async Task<ApiResult<IEnumerable<RecentActivityDto>>> GetRecentActivityAsync(
        DateTime? before = null)
    {
        var items = await ActivityPageAsync(before);
        return ApiResult<IEnumerable<RecentActivityDto>>.Success(items);
    }

    private async Task<List<RecentActivityDto>> ActivityPageAsync(DateTime? before)
    {
        var query = _context.ActivityLogs.AsNoTracking();

        if (before.HasValue)
        {
            // Npgsql timestamptz uchun Kind=Utc shart.
            var cursor = before.Value.ToUniversalTime();
            query = query.Where(a => a.CreatedAt < cursor);
        }

        return await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(ActivityPageSize)
            .Select(a => new RecentActivityDto
            {
                Kind = a.Kind,
                Title = a.Title,
                Subtitle = a.Subtitle,
                ActorName = a.ActorName,
                At = a.CreatedAt,
            })
            .ToListAsync();
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
