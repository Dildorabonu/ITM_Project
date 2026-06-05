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
  foundItems: number;
  missingItems: number;
  fullyAvailable: boolean;
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
