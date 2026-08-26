import {
  RequisitionStatus,
  REQUISITION_STATUS_LABELS,
  RequisitionSource,
  type RequisitionResponse,
} from "@/lib/userService";

export { RequisitionStatus, REQUISITION_STATUS_LABELS };
export type { RequisitionResponse };

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
  [RequisitionStatus.Delivered]:                { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.35)" },
};

// ─── Bajarilganlik ─────────────────────────────────────────────────────────────

// Talabnoma REAL bajarilgan hisoblanadigan holatlar: material berildi, xarid
// yetkazildi yoki rad etildi. "Ombordan olishga" / "Sotib olishga" — tasdiqlangan,
// lekin hali bajarilmagan ish, shuning uchun bu ro'yxatda yo'q.
// Backenddagi RequisitionService.FulfilledStatuses bilan aynan bir xil bo'lishi shart.
export const FULFILLED_STATUSES = new Set<RequisitionStatus>([
  RequisitionStatus.Released,
  RequisitionStatus.Delivered,
  RequisitionStatus.Rejected,
]);

// Bo'lingan (Split) talabnoma barcha child'lari bajarilgandagina bajarilgan;
// bo'linmagani esa o'z holatiga qarab.
// Ro'yxat javobi childlarning faqat statuslarini yuboradi, detal esa to'liq
// child obyektlarini — shuning uchun ikkalasi ham statuslar massivini beradi.
export function isRequisitionCompleted(status: RequisitionStatus, childStatuses?: RequisitionStatus[]): boolean {
  if (childStatuses && childStatuses.length > 0) {
    return childStatuses.every(s => FULFILLED_STATUSES.has(s));
  }
  return FULFILLED_STATUSES.has(status);
}

// To'liq rad etilgan: bo'lingan bo'lsa barcha childlari rad etilgan, aks holda o'zi.
// Backenddagi `rejected` filtri bilan bir xil mantiq.
export function isRequisitionRejected(status: RequisitionStatus, childStatuses?: RequisitionStatus[]): boolean {
  if (childStatuses && childStatuses.length > 0) {
    return childStatuses.every(s => s === RequisitionStatus.Rejected);
  }
  return status === RequisitionStatus.Rejected;
}

/** Detal javobidagi child obyektlaridan status massivini oladi. */
export function childStatusesOf(r: Pick<RequisitionResponse, "children">): RequisitionStatus[] {
  return r.children?.map(c => c.status) ?? [];
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

// "Tekshirildi" alohida bosqich emas: omborchi tekshiruvni tugatgan zahoti
// talabnoma o'sha tranzaksiyada Split ga o'tadi (WarehouseChecked = 6 statusi
// hech qachon yozilmaydi), ya'ni tekshiruvning tugashi — ayrilish nuqtasining
// o'zi. Shu sababli sxemada faqat "Tekshiruvda" qoladi.
type WorkflowStepKey =
  | RequisitionStatus.Draft
  | RequisitionStatus.PendingWarehouseCheck
  | RequisitionStatus.PendingApproval
  | "final";

export const WORKFLOW_STEPS: { key: WorkflowStepKey; label: string; shortLabel: string }[] = [
  { key: RequisitionStatus.Draft,                 label: "Talabnoma yaratildi",         shortLabel: "Yaratildi" },
  { key: RequisitionStatus.PendingWarehouseCheck, label: "Ombor tekshiruvida",          shortLabel: "Tekshiruvda" },
  { key: RequisitionStatus.PendingApproval,       label: "Tasdiqlash kutilmoqda",       shortLabel: "Tasdiqlash" },
  { key: "final",                                  label: "Yakunlandi",                  shortLabel: "Yakuniy" },
];

// Sxemada rang bosqichni emas, HOLATNI bildiradi — shuning uchun har bosqichga
// alohida tus berilmaydi: yashil = bajarildi, to'q sariq = kutilmoqda,
// kulrang = hali boshlanmagan, qizil = rad etilgan.
export const WORKFLOW_COLORS = {
  done:     "#0f7b45",
  active:   "#e07b00",
  rejected: "#dc2626",
} as const;

export function getWorkflowIndex(status: RequisitionStatus): number {
  switch (status) {
    case RequisitionStatus.Draft:                    return 0;
    case RequisitionStatus.PendingWarehouseCheck:    return 1;
    case RequisitionStatus.PendingApproval:          return 2;
    case RequisitionStatus.ReadyForWarehouseRelease: return 3;
    case RequisitionStatus.ReadyForPurchase:         return 3;
    case RequisitionStatus.Released:                 return 3;
    case RequisitionStatus.Delivered:                return 3;
    default:                                         return -1;
  }
}

export function getFinalStepInfo(source?: RequisitionSource, status?: RequisitionStatus): { label: string; shortLabel: string } {
  if (status === RequisitionStatus.Delivered) {
    return { label: "Xarid yetkazildi", shortLabel: "Yetkazildi" };
  }
  if (status === RequisitionStatus.Released) {
    return { label: "Bo'lim omboriga berildi", shortLabel: "Berildi" };
  }
  if (source === RequisitionSource.Warehouse) {
    return { label: "Ombordan olishga tayyor", shortLabel: "Ombordan" };
  }
  if (source === RequisitionSource.Purchase) {
    // Qabul qilingach status 9 ga o'tadi — endi omborda, berishga tayyor
    if (status === RequisitionStatus.ReadyForWarehouseRelease) {
      return { label: "Omborda — berishga tayyor", shortLabel: "Omborda" };
    }
    return { label: "Sotib olishga tayyor", shortLabel: "Sotib olish" };
  }
  return { label: "Yakunlandi", shortLabel: "Yakuniy" };
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

// "Yaqinda yakunlangan" bloki uchun: 0 → "bugun", 1 → "1 kun oldin".
// Tarjima chaqiruvchi tomonda: t("kun oldin"), t("bugun").
export function fmtRelativeDays(d?: string | null): { days: number; today: boolean } {
  if (!d) return { days: 0, today: true };
  const diffMs = Date.now() - new Date(d).getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  return { days, today: days === 0 };
}
