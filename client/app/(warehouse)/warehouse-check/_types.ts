import type { RequisitionType } from "@/lib/userService";

// Ombor tekshiruvi sahifasiga tegishli umumiy tiplar, yordamchilar va animatsiyalar.

export interface ReqCheckRow {
  id: string;
  requisitionNo: string;
  type: RequisitionType;
  purpose: string;
  contractNo?: string;
  departmentName?: string;
  createdByName: string;
  createdAt: string;
  totalItems: number;
  /** Yaratilganidan beri o'tgan to'liq kunlar — tekshiruv navbatidagi kutish muddati. */
  waitingDays: number;
  checked: boolean;
}

export type MaterialStatus = "topilmadi" | "yetishmadi" | "yetarli";

export interface MaterialCheckItem {
  itemId: string;
  name: string;
  unit: string;
  required: number;
  status: MaterialStatus;
  productQty: number;
  // Omborchi kirita oladigan qiymat (default: min(productQty, required))
  available: number;
  notes: string;
}

export function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ISO sanadan bugungi kungacha o'tgan to'liq kunlar soni (manfiy bo'lmaydi). */
export function daysSince(d: string) {
  if (!d) return 0;
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return 0;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - Date.UTC(y, m - 1, day)) / 86400000));
}

export function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y.slice(-2)}` : "—";
}

export const statusKeyframes = `
@keyframes fadeSlideIn { 0% { opacity: 0; transform: translateY(6px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes overlayFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes overlayFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes spinRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes orbitDot { 0% { transform: rotate(0deg) translateX(52px) rotate(0deg); opacity: 0.9; } 50% { opacity: 0.4; } 100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); opacity: 0.9; } }
@keyframes pulseCore { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); } 50% { transform: scale(1.08); box-shadow: 0 0 30px 8px rgba(59, 130, 246, 0.15); } }
@keyframes textFadeUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
`;
