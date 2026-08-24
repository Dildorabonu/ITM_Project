import { api } from "./api";
import { ContractStatus, DepartmentType, ProductUnit } from "./userService";

// Faqat dashboardda chizilinadigan ko'rsatkichlar. Qolgan jamlanmalar
// (jami/yakunlangan/bekor qilingan shartnoma, mahsulot, foydalanuvchi sonlari)
// hech qayerda ishlatilmagani uchun backend javobidan olib tashlangan.
export interface DashboardKpis {
  activeContracts: number;
  manufacturedInProgress: number;
  manufacturedCompleted: number;
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

// Ishlab chiqarish va jo'natma bir xil sanalar bo'yicha tekislangan —
// bitta nuqtada ikkalasi ham keladi.
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  prod: number;
  ship: number;
}

export interface DepartmentWorkload {
  id: string;
  name: string;
  type: DepartmentType;
  employeeCount: number;
  activeContracts: number;
  activeManufactured: number;
}

export interface ManufacturingProgress {
  id: string;
  name: string;
  code: string | null;
  unit: ProductUnit;
  quantity: number;
  producedQuantity: number;
  departmentName: string | null;
  contractNo: string | null;
  progressPercent: number;
}

export interface UpcomingDeadline {
  id: string;
  contractNo: string;
  contractParty: string;
  endDate: string;
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
}

// Faollik xaritasi: `start` dan boshlab `days` ta kun. `cells` — faqat yozuvi
// bor kunlar (`day` = start'dan ofset); qolgan kataklar bo'sh deb chiziladi.
export interface HeatmapCell {
  day: number;
  amount: number;
  logCount: number;
}

export interface ActivityHeatmap {
  start: string; // YYYY-MM-DD
  days: number;
  cells: HeatmapCell[];
}

// Month-to-date increment for each KPI card (how many items were added this month).
export interface DashboardKpiMonthly {
  activeContracts: number;
  manufacturedCompleted: number;
  manufacturedInProgress: number;
  totalEmployees: number;
}

// KPI kartalaridagi sparkline — faqat qiymatlar ketma-ketligi (sana chizilmaydi).
export interface KpiSparkline {
  activeContracts: number[];
  manufacturedCompleted: number[];
  manufacturedInProgress: number[];
  totalEmployees: number[];
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  monthlyAdded: DashboardKpiMonthly;
  kpiSparkline: KpiSparkline;
  contractStatus: ContractStatusBucket[];
  trend: TrendPoint[];
  departmentWorkload: DepartmentWorkload[];
  manufacturingProgress: ManufacturingProgress[];
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: RecentActivity[];
  activityHeatmap: ActivityHeatmap;
}

export interface DashboardSummaryParams {
  trendFrom?: string; // YYYY-MM-DD — production/shipment dynamics window
  trendTo?: string;
}

// Backend "So'nggi faollik" bir sahifada nechtadan qaytaradi (cursor-based scroll).
// Qaytgan yozuvlar soni shundan kam bo'lsa — oxiriga yetildi.
export const ACTIVITY_PAGE_SIZE = 20;

export const dashboardService = {
  getSummary: async (params?: DashboardSummaryParams): Promise<DashboardSummary> => {
    const res = await api.get("/api/dashboard/summary", { params });
    return res.data?.result ?? res.data;
  },

  // `before` — oxirgi ko'rilgan yozuvning `at` (ISO sana) qiymati; bo'sh bo'lsa
  // eng yangi sahifa. Pastga scroll qilinganda keyingi sahifani yuklash uchun.
  getActivity: async (before?: string): Promise<RecentActivity[]> => {
    const res = await api.get("/api/dashboard/activity", {
      params: before ? { before } : undefined,
    });
    return res.data?.result ?? res.data ?? [];
  },
};
