import {
  RequisitionType,
  RequisitionStatus,
  RequisitionSource,
  REQUISITION_STATUS_LABELS,
  REQUISITION_SOURCE_LABELS,
  type RequisitionResponse,
  type RequisitionChildSummary,
  type RequisitionItemResponse,
} from "@/lib/userService";

export {
  RequisitionType,
  RequisitionStatus,
  RequisitionSource,
  REQUISITION_STATUS_LABELS,
  REQUISITION_SOURCE_LABELS,
};
export type { RequisitionResponse, RequisitionChildSummary, RequisitionItemResponse };

// ─── Status styles ─────────────────────────────────────────────────────────────

export const STATUS_STYLE: Partial<Record<RequisitionStatus, { bg: string; color: string; border: string }>> = {
  [RequisitionStatus.Draft]:                    { bg: "var(--bg3)",         color: "var(--text2)",   border: "var(--border)" },
  [RequisitionStatus.Rejected]:                 { bg: "var(--danger-dim)",  color: "var(--danger)",  border: "rgba(217,48,37,0.2)" },
  [RequisitionStatus.PendingWarehouseCheck]:    { bg: "var(--warn-dim)",    color: "var(--warn)",    border: "rgba(224,123,0,0.25)" },
  [RequisitionStatus.WarehouseChecked]:         { bg: "var(--teal-dim)",    color: "var(--teal)",    border: "rgba(8,145,178,0.25)" },
  [RequisitionStatus.PendingApproval]:          { bg: "var(--pink-dim)",    color: "var(--pink)",    border: "rgba(219,39,119,0.25)" },
  [RequisitionStatus.Split]:                    { bg: "var(--purple-dim)",  color: "var(--purple)",  border: "rgba(124,58,237,0.25)" },
  [RequisitionStatus.ReadyForWarehouseRelease]: { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  [RequisitionStatus.ReadyForPurchase]:         { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "rgba(26,110,235,0.25)" },
  [RequisitionStatus.Released]:                 { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.35)" },
};

export const SOURCE_STYLE: Record<RequisitionSource, { bg: string; color: string; border: string }> = {
  [RequisitionSource.Warehouse]: { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  [RequisitionSource.Purchase]:  { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "rgba(26,110,235,0.25)" },
};

// ─── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStepKey =
  | RequisitionStatus.Draft
  | RequisitionStatus.PendingWarehouseCheck
  | RequisitionStatus.WarehouseChecked
  | RequisitionStatus.PendingApproval
  | "final";

export const WORKFLOW_STEPS: { key: WorkflowStepKey; label: string; shortLabel: string }[] = [
  { key: RequisitionStatus.Draft,                 label: "Talabnoma yaratildi",         shortLabel: "Yaratildi" },
  { key: RequisitionStatus.PendingWarehouseCheck, label: "Ombor tekshiruvida",          shortLabel: "Tekshiruvda" },
  { key: RequisitionStatus.WarehouseChecked,      label: "Ombor tekshiruvi yakunlandi", shortLabel: "Tekshirildi" },
  { key: RequisitionStatus.PendingApproval,       label: "Tasdiqlash kutilmoqda",       shortLabel: "Tasdiqlash" },
  { key: "final",                                  label: "Yakunlandi",                  shortLabel: "Yakuniy" },
];

export const STEP_COLORS: Record<Exclude<WorkflowStepKey, "final">, { active: string; text: string }> = {
  [RequisitionStatus.Draft]:                 { active: "#6b7280", text: "#fff" },
  [RequisitionStatus.PendingWarehouseCheck]: { active: "#e07b00", text: "#fff" },
  [RequisitionStatus.WarehouseChecked]:      { active: "#0891b2", text: "#fff" },
  [RequisitionStatus.PendingApproval]:       { active: "#db2777", text: "#fff" },
};

export function getWorkflowIndex(status: RequisitionStatus): number {
  switch (status) {
    case RequisitionStatus.Draft:                    return 0;
    case RequisitionStatus.PendingWarehouseCheck:    return 1;
    case RequisitionStatus.WarehouseChecked:         return 2;
    case RequisitionStatus.PendingApproval:          return 3;
    case RequisitionStatus.ReadyForWarehouseRelease: return 4;
    case RequisitionStatus.ReadyForPurchase:         return 4;
    case RequisitionStatus.Released:                 return 4;
    default:                                         return -1;
  }
}

export function getFinalStepInfo(source?: RequisitionSource): { label: string; shortLabel: string; color: string } {
  if (source === RequisitionSource.Warehouse) {
    return { label: "Ombordan olishga tayyor", shortLabel: "Ombordan", color: "#0f7b45" };
  }
  if (source === RequisitionSource.Purchase) {
    return { label: "Sotib olishga tayyor", shortLabel: "Sotib olish", color: "#1a6eeb" };
  }
  return { label: "Yakunlandi", shortLabel: "Yakuniy", color: "#0f7b45" };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}.${m}.${y.slice(-2)}`;
}

export function fmtDateTime(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
