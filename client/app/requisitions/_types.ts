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

export const STATUS_STYLE: Record<RequisitionStatus, { bg: string; color: string; border: string }> = {
  [RequisitionStatus.Draft]:                    { bg: "var(--bg3)",         color: "var(--text2)",   border: "var(--border)" },
  [RequisitionStatus.Rejected]:                 { bg: "var(--danger-dim)",  color: "var(--danger)",  border: "rgba(217,48,37,0.2)" },
  [RequisitionStatus.PendingWarehouseCheck]:    { bg: "var(--warn-dim)",    color: "var(--warn)",    border: "rgba(224,123,0,0.25)" },
  [RequisitionStatus.WarehouseChecked]:         { bg: "var(--teal-dim)",    color: "var(--teal)",    border: "rgba(8,145,178,0.25)" },
  [RequisitionStatus.Split]:                    { bg: "var(--purple-dim)",  color: "var(--purple)",  border: "rgba(109,74,173,0.25)" },
  [RequisitionStatus.PendingApproval]:          { bg: "var(--pink-dim)",    color: "var(--pink)",    border: "rgba(219,39,119,0.25)" },
  [RequisitionStatus.ReadyForWarehouseRelease]: { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  [RequisitionStatus.ReadyForPurchase]:         { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "rgba(26,110,235,0.25)" },
};

export const SOURCE_STYLE: Record<RequisitionSource, { bg: string; color: string; border: string }> = {
  [RequisitionSource.Warehouse]: { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  [RequisitionSource.Purchase]:  { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "rgba(26,110,235,0.25)" },
};

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
