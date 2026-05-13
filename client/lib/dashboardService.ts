import { api } from "./api";
import { ContractStatus, DepartmentType, ManufacturingStatus, ProductUnit } from "./userService";

export interface DashboardKpis {
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  cancelledContracts: number;
  completionRate: number;
  overdueContracts: number;
  totalProducts: number;
  inProductionProducts: number;
  manufacturedInProgress: number;
  manufacturedCompleted: number;
  totalShipments: number;
  totalUsers: number;
  activeDepartments: number;
  totalEmployees: number;
  totalContractedAmount: number;
  totalProducedAmount: number;
  totalBatchedAmount: number;
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

export interface HeatmapCell {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  amount: number;
  logCount: number;
}

export interface DashboardKpiDelta {
  activeContracts: number;
  manufacturedCompleted: number;
  manufacturedInProgress: number;
  totalEmployees: number;
}

export interface KpiSparklinePoint {
  date: string; // YYYY-MM-DD
  activeContracts: number;
  manufacturedCompleted: number;
  manufacturedInProgress: number;
  totalEmployees: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  previousKpis: DashboardKpiDelta;
  kpiSparkline: KpiSparklinePoint[];
  contractStatus: ContractStatusBucket[];
  productionTrend: ProductionTrendPoint[];
  shipmentTrend: ProductionTrendPoint[];
  departmentWorkload: DepartmentWorkload[];
  manufacturingProgress: ManufacturingProgress[];
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: RecentActivity[];
  topPerformers: TopPerformer[];
  activityHeatmap: HeatmapCell[];
}

export interface DashboardSummaryParams {
  trendFrom?: string; // YYYY-MM-DD — production/shipment dynamics window
  trendTo?: string;
}

export const dashboardService = {
  getSummary: async (params?: DashboardSummaryParams): Promise<DashboardSummary> => {
    const res = await api.get("/api/dashboard/summary", { params });
    return res.data?.result ?? res.data;
  },
};
