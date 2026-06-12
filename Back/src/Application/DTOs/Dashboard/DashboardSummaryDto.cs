using Core.Enums;

namespace Application.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public DashboardKpiDto Kpis { get; set; } = new();
    public DashboardKpiMonthlyDto MonthlyAdded { get; set; } = new();
    public IEnumerable<KpiSparklinePointDto> KpiSparkline { get; set; } = [];
    public IEnumerable<ContractStatusBucketDto> ContractStatus { get; set; } = [];
    public IEnumerable<ProductionTrendPointDto> ProductionTrend { get; set; } = [];
    public IEnumerable<ProductionTrendPointDto> ShipmentTrend { get; set; } = [];
    public IEnumerable<DepartmentWorkloadDto> DepartmentWorkload { get; set; } = [];
    public IEnumerable<ManufacturingProgressDto> ManufacturingProgress { get; set; } = [];
    public IEnumerable<UpcomingDeadlineDto> UpcomingDeadlines { get; set; } = [];
    public IEnumerable<RecentActivityDto> RecentActivity { get; set; } = [];
    public IEnumerable<TopPerformerDto> TopPerformers { get; set; } = [];
    public IEnumerable<HeatmapCellDto> ActivityHeatmap { get; set; } = [];
}

public class DashboardKpiDto
{
    public int TotalContracts { get; set; }
    public int ActiveContracts { get; set; }
    public int CompletedContracts { get; set; }
    public int CancelledContracts { get; set; }
    public double CompletionRate { get; set; }
    public int OverdueContracts { get; set; }
    public int TotalProducts { get; set; }
    public int InProductionProducts { get; set; }
    public int ManufacturedInProgress { get; set; }
    public int ManufacturedCompleted { get; set; }
    public int TotalShipments { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveDepartments { get; set; }
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

public class KpiSparklinePointDto
{
    public DateOnly Date { get; set; }
    public int ActiveContracts { get; set; }
    public int ManufacturedCompleted { get; set; }
    public int ManufacturedInProgress { get; set; }
    public int TotalEmployees { get; set; }
}

public class ContractStatusBucketDto
{
    public ContractStatus Status { get; set; }
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class ProductionTrendPointDto
{
    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public int LogCount { get; set; }
}

public class DepartmentWorkloadDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; }
    public int EmployeeCount { get; set; }
    public int ActiveContracts { get; set; }
    public int ActiveManufactured { get; set; }
    public decimal LoggedAmount { get; set; }
}

public class ManufacturingProgressDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public ProductUnit Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProducedQuantity { get; set; }
    public ManufacturingStatus Status { get; set; }
    public string? DepartmentName { get; set; }
    public string? ContractNo { get; set; }
    public DateTime? StartedAt { get; set; }
    public double ProgressPercent { get; set; }
}

public class UpcomingDeadlineDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractParty { get; set; } = string.Empty;
    public DateOnly EndDate { get; set; }
    public ContractStatus Status { get; set; }
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
    public Guid? RefId { get; set; }
}

public class TopPerformerDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
    public int LogCount { get; set; }
    public decimal TotalAmount { get; set; }
}

public class HeatmapCellDto
{
    public DateOnly Date { get; set; }
    public int DayOfWeek { get; set; }   // 0=Sun..6=Sat
    public int WeekIndex { get; set; }   // 0..N (oldest..newest)
    public decimal Amount { get; set; }
    public int LogCount { get; set; }
}
