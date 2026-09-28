import { api } from "./api";
import { addPercentStr, ceilDecimalStr } from "./num";

// Talabnoma zaxira foizi — `/api/requisition-allowance`. O'qish hammaga, yozish
// "RequisitionAllowance.Update" ruxsati bilan. Ro'yxat yangidan eskiga — [0] amaldagi.

export interface RequisitionAllowanceRate {
  id: string;
  percent: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
}

export const requisitionAllowanceService = {
  async getAll(): Promise<RequisitionAllowanceRate[]> {
    const res = await api.get("/api/requisition-allowance");
    return res.data.result ?? [];
  },

  async create(dto: { percent: number; note?: string | null }): Promise<string> {
    const res = await api.post("/api/requisition-allowance", dto);
    return res.data.result;
  },
};

// Backend Application/Helpers/NormAllowance.cs bilan bir xil qoida — farq qilsa
// backend talabnomani "me'yoriy sarfiga mos emas" deb rad etadi.
const PIECE_UNITS = new Set(["шт", "дона", "dona"]);

export function isPieceUnit(unit: string | null | undefined): boolean {
  return PIECE_UNITS.has((unit ?? "").trim().toLowerCase().replace(/\.+$/, ""));
}

export function applyAllowance(baseQty: string, unit: string, percent: number): string {
  if (!percent || !baseQty) return baseQty;
  const raised = addPercentStr(baseQty, percent);
  if (raised === null) {
    const n = Number(baseQty) * (1 + percent / 100);
    if (!Number.isFinite(n)) return baseQty;
    return String(isPieceUnit(unit) ? Math.ceil(n) : n);
  }
  return isPieceUnit(unit) ? (ceilDecimalStr(raised) ?? raised) : raised;
}
