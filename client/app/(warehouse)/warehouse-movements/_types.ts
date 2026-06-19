import type { StockMovementType } from "@/lib/stockMovements";
import { STOCK_MOVEMENT_COLOR } from "@/lib/stockMovements";

// Jurnal filtridagi tur (type) dropdowni uchun variantlar — CheckSelect `color` bilan.
// Backend enum tartibiga (In..Release) mos, label backend TypeLabel bilan bir xil.
export const STOCK_MOVEMENT_TYPE_OPTIONS: { id: StockMovementType; name: string; color: string }[] = [
  { id: "In",       name: "Kirim",                color: STOCK_MOVEMENT_COLOR.In },
  { id: "Out",      name: "Chiqim",               color: STOCK_MOVEMENT_COLOR.Out },
  { id: "Transfer", name: "Ko'chirish",           color: STOCK_MOVEMENT_COLOR.Transfer },
  { id: "Reserve",  name: "Rezerv",               color: STOCK_MOVEMENT_COLOR.Reserve },
  { id: "Release",  name: "Rezervdan chiqarish",  color: STOCK_MOVEMENT_COLOR.Release },
  { id: "Adjust",   name: "Tuzatish",             color: STOCK_MOVEMENT_COLOR.Adjust },
];

export const PAGE_SIZE = 50;
