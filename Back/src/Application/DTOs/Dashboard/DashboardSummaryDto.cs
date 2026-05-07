using Core.Enums;

namespace Application.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public DashboardKpiDto Kpis { get; set; } = new();
    public IEnumerable<ContractStatusBucketDto> ContractStatus { get; set; } = [];
    public IEnumerable<ProductionTrendPointDto> ProductionTrend { get; set; } = [];
    public IEnumerable<ProductionTrendPointDto> ShipmentTrend { get; set; } = [];
    public IEnumerable<DepartmentWorkloadDto> DepartmentWorkload { get; set; } = [];
    public IEnumerable<ManufacturingProgressDto> ManufacturingProgress { get; set; } = [];
    public IEnumerable<UpcomingDeadlineDto> UpcomingDeadlines { get; set; } = [];
    public IEnumerable<RecentActivityDto> RecentActivity { get; set; } = [];
    public IEnumerable<TopPerformerDto> TopPerformers { get; set; } = [];
    public IEnumerable<PriorityBucketDto> PriorityDistribution { get; set; } = [];
    public IEnumerable<HeatmapCellDto> ActivityHeatmap { get; set; } = [];
}

public class DashboardKpiDto
{
    // ── Always-now (state, period-independent) ──
    public int TotalContracts { get; set; }
    public int ActiveContracts { get; set; }
    public int CompletedContracts { get; set; }
    public int CancelledContracts { get; set; }
    public double CompletionRate { get; set; }
    public int OverdueContracts { get; set; }
    public int CriticalDeadlines { get; set; }
    public int TotalProducts { get; set; }
    public int InProductionProducts { get; set; }
    public int ManufacturedInProgress { get; set; }
    public int ManufacturedCompleted { get; set; }
    public int TotalShipments { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveDepartments { get; set; }
    public int TotalEmployees { get; set; }

    // ── Selected period (from / to inclusive) ──
    public DateOnly RangeFrom { get; set; }
    public DateOnly RangeTo { get; set; }
    public int RangeDays { get; set; }
    public int CompletedInRange { get; set; }
    public int CompletedPrevRange { get; set; }
    public int ManufacturedCompletedInRange { get; set; }
    public int ShipmentsInRange { get; set; }
    public int ShipmentsPrevRange { get; set; }
    public decimal LoggedAmountInRange { get; set; }
    public decimal LoggedAmountPrevRange { get; set; }
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
    public Priority Priority { get; set; }
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

public class PriorityBucketDto
{
    public Priority Priority { get; set; }
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class HeatmapCellDto
{
    public DateOnly Date { get; set; }
    public int DayOfWeek { get; set; }   // 0=Sun..6=Sat
    public int WeekIndex { get; set; }   // 0..N (oldest..newest)
    public decimal Amount { get; set; }
    public int LogCount { get; set; }
}
