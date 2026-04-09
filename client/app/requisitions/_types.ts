import {
  RequisitionType,
  RequisitionStatus,
  REQUISITION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
  type RequisitionResponse,
  type RequisitionItemCreate,
} from "@/lib/userService";

export {
  RequisitionType,
  RequisitionStatus,
  REQUISITION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
};
export type { RequisitionResponse, RequisitionItemCreate };

// ─── Status styles ─────────────────────────────────────────────────────────────

export const STATUS_STYLE: Record<RequisitionStatus, { bg: string; color: string; border: string }> = {
  [RequisitionStatus.Draft]:           { bg: "var(--bg3)",         color: "var(--text2)",   border: "var(--border)" },
  [RequisitionStatus.Pending]:         { bg: "var(--warn-dim)",    color: "var(--warn)",    border: "rgba(224,123,0,0.25)" },
  [RequisitionStatus.Approved]:        { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  [RequisitionStatus.Rejected]:        { bg: "var(--danger-dim)",  color: "var(--danger)",  border: "rgba(217,48,37,0.2)" },
  [RequisitionStatus.SentToWarehouse]: { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "rgba(26,110,235,0.25)" },
};

// ─── Form ──────────────────────────────────────────────────────────────────────

export interface RequisitionFormItem {
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  quantity: string;
  notes: string;
}

export interface RequisitionForm {
  type: RequisitionType | "";
  contractId: string;
  departmentId: string;
  purpose: string;
  notes: string;
  items: RequisitionFormItem[];
}

export const emptyForm: RequisitionForm = {
  type: "",
  contractId: "",
  departmentId: "",
  purpose: "",
  notes: "",
  items: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

export function fmtDateTime(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
