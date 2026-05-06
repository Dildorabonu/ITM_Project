import { api } from "./api";
import { ContractStatus, DepartmentType, Priority, ManufacturingStatus, ProductUnit } from "./userService";

export interface DashboardKpis {
  // ── Always-now (state) ──
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  cancelledContracts: number;
  completionRate: number;
  overdueContracts: number;
  criticalDeadlines: number;
  totalProducts: number;
  inProductionProducts: number;
  manufacturedInProgress: number;
  totalShipments: number;
  totalUsers: number;
  activeDepartments: number;
  totalEmployees: number;

  // ── Selected period ──
  rangeFrom: string;            // "YYYY-MM-DD"
  rangeTo: string;              // "YYYY-MM-DD"
  rangeDays: number;
  completedInRange: number;
  completedPrevRange: number;
  manufacturedCompletedInRange: number;
  shipmentsInRange: number;
  shipmentsPrevRange: number;
  loggedAmountInRange: number;
  loggedAmountPrevRange: number;
}

export interface ContractStatusBucket {
  status: ContractStatus;
  label: string;
  count: number;
}

export interface ProductionTrendPoint {
  date: string;
  amount: number;
  logCount: number;
}

export interface DepartmentWorkload {
  id: string;
  name: string;
  type: DepartmentType;
  employeeCount: number;
  activeContracts: number;
  activeManufactured: number;
  loggedAmount: number;
}

export interface ManufacturingProgress {
  id: string;
  name: string;
  code: string | null;
  unit: ProductUnit;
  quantity: number;
  producedQuantity: number;
  status: ManufacturingStatus;
  departmentName: string | null;
  contractNo: string | null;
  startedAt: string | null;
  progressPercent: number;
}

export interface UpcomingDeadline {
  id: string;
  contractNo: string;
  contractParty: string;
  endDate: string;
  status: ContractStatus;
  priority: Priority;
  daysRemaining: number;
  overallProgress: number;
  primaryProduct: string | null;
}

export interface RecentActivity {
  kind: "contract" | "task-log" | "shipment" | "manufactured" | string;
  title: string;
  subtitle: string | null;
  actorName: string | null;
  at: string;
  refId: string | null;
}

export interface TopPerformer {
  userId: string;
  fullName: string;
  departmentName: string | null;
  logCount: number;
  totalAmount: number;
}

export interface PriorityBucket {
  priority: Priority;
  label: string;
  count: number;
}

export interface HeatmapCell {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  amount: number;
  logCount: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  contractStatus: ContractStatusBucket[];
  productionTrend: ProductionTrendPoint[];
  shipmentTrend: ProductionTrendPoint[];
  departmentWorkload: DepartmentWorkload[];
  manufacturingProgress: ManufacturingProgress[];
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: RecentActivity[];
  topPerformers: TopPerformer[];
  priorityDistribution: PriorityBucket[];
  activityHeatmap: HeatmapCell[];
}

export interface DashboardRange {
  from?: string; // "YYYY-MM-DD"
  to?: string;   // "YYYY-MM-DD"
}

export const dashboardService = {
  getSummary: async (range: DashboardRange = {}): Promise<DashboardSummary> => {
    const params: Record<string, string> = {};
    if (range.from) params.from = range.from;
    if (range.to)   params.to   = range.to;
    const res = await api.get("/api/dashboard/summary", { params });
    return res.data?.result ?? res.data;
  },
};
