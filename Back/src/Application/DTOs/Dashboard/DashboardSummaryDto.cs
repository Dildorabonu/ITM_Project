using Core.Enums;

namespace Application.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public DashboardKpiDto Kpis { get; set; } = new();
    public DashboardKpiMonthlyDto MonthlyAdded { get; set; } = new();
    public KpiSparklineDto KpiSparkline { get; set; } = new();
    public IEnumerable<ContractStatusBucketDto> ContractStatus { get; set; } = [];
    public IEnumerable<TrendPointDto> Trend { get; set; } = [];
    public IEnumerable<DepartmentWorkloadDto> DepartmentWorkload { get; set; } = [];
    public IEnumerable<ManufacturingProgressDto> ManufacturingProgress { get; set; } = [];
    public IEnumerable<UpcomingDeadlineDto> UpcomingDeadlines { get; set; } = [];
    public IEnumerable<RecentActivityDto> RecentActivity { get; set; } = [];
    public ActivityHeatmapDto ActivityHeatmap { get; set; } = new();
}

// Faqat dashboardda ko'rsatiladigan ko'rsatkichlar. Boshqa har qanday
// jamlanma (jami/yakunlangan/bekor qilingan shartnoma, mahsulot va
// foydalanuvchi sonlari) hech qayerda chizilmagani uchun olib tashlandi —
// har biri ortiqcha COUNT so'rovi edi.
public class DashboardKpiDto
{
    public int ActiveContracts { get; set; }
    public int ManufacturedInProgress { get; set; }
    public int ManufacturedCompleted { get; set; }
    public int TotalEmployees { get; set; }
    public decimal TotalContractedAmount { get; set; }
    public decimal TotalProducedAmount { get; set; }
    public decimal TotalBatchedAmount { get; set; }
}

// Month-to-date increment for each KPI card (how many items were added this month).
public class DashboardKpiMonthlyDto
{
    public int ActiveContracts { get; set; }
    public int ManufacturedCompleted { get; set; }
    public int ManufacturedInProgress { get; set; }
    public int TotalEmployees { get; set; }
}

// KPI kartalaridagi sparkline — faqat qiymatlar ketma-ketligi kerak, sana
// chizilmaydi. Shu sabab 31 ta ob'ekt o'rniga 4 ta oddiy son massivi.
public class KpiSparklineDto
{
    public IEnumerable<int> ActiveContracts { get; set; } = [];
    public IEnumerable<int> ManufacturedCompleted { get; set; } = [];
    public IEnumerable<int> ManufacturedInProgress { get; set; } = [];
    public IEnumerable<int> TotalEmployees { get; set; } = [];
}

public class ContractStatusBucketDto
{
    public ContractStatus Status { get; set; }
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

// Ishlab chiqarish va jo'natma dinamikasi bitta qatorda — ikkala qator ham
// bir xil sanalar bo'yicha tekislangan, sanani ikki marta yuborish shart emas.
public class TrendPointDto
{
    public DateOnly Date { get; set; }
    public decimal Prod { get; set; }
    public decimal Ship { get; set; }
}

public class DepartmentWorkloadDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; }
    public int EmployeeCount { get; set; }
    public int ActiveContracts { get; set; }
    public int ActiveManufactured { get; set; }
}

public class ManufacturingProgressDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public ProductUnit Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProducedQuantity { get; set; }
    public string? DepartmentName { get; set; }
    public string? ContractNo { get; set; }
    public double ProgressPercent { get; set; }
}

public class UpcomingDeadlineDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractParty { get; set; } = string.Empty;
    public DateOnly EndDate { get; set; }
    public int DaysRemaining { get; set; }
    public double OverallProgress { get; set; }
    public string? PrimaryProduct { get; set; }
}

public class RecentActivityDto
{
    public string Kind { get; set; } = string.Empty;     // "contract" | "task-log" | "shipment" | "manufactured"
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ActorName { get; set; }
    public DateTime At { get; set; }
}

// Faollik xaritasi ~1 yillik oyna. Ilgari har bir kun (371 ta) yuborilar edi,
// shu jumladan bo'sh kunlar ham. Endi faqat oyna boshi + kunlar soni va
// yozuvi bor kunlar yuboriladi — qolgan kataklarni frontend o'zi to'ldiradi.
public class ActivityHeatmapDto
{
    public DateOnly Start { get; set; }
    public int Days { get; set; }
    public IEnumerable<HeatmapCellDto> Cells { get; set; } = [];
}

public class HeatmapCellDto
{
    public int Day { get; set; }         // Start'dan boshlab kun ofseti
    public decimal Amount { get; set; }
    public int LogCount { get; set; }
}
