import {
  ManufacturingStatus,
  MANUFACTURING_STATUS_LABELS,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type ManufacturedProductResponse,
} from "@/lib/userService";

// Tayyor mahsulotlar (ishlab chiqarish) sahifasiga tegishli umumiy tiplar va konstantalar.

export interface ProductForm {
  name: string;
  code: string;
  departmentId: string;
  quantity: string;
  producedQuantity: string;
  unit: string;
  status: string;
  startedAt: string;
  completedAt: string;
  description: string;
  notes: string;
}

export const emptyForm: ProductForm = {
  name: "", code: "", departmentId: "", quantity: "", producedQuantity: "0",
  unit: String(ProductUnit.Dona), status: String(ManufacturingStatus.InProgress),
  startedAt: "", completedAt: "", description: "", notes: "",
};

export const STATUS_FILTER_OPTIONS = [
  { id: "", name: "Barcha holatlar" },
  { id: String(ManufacturingStatus.InProgress), name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.InProgress] },
  { id: String(ManufacturingStatus.Completed),  name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.Completed] },
];

export const STATUS_OPTIONS = [
  { id: String(ManufacturingStatus.InProgress), name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.InProgress] },
  { id: String(ManufacturingStatus.Completed),  name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.Completed] },
];

export const UNIT_OPTIONS = (Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => ({
  id: String(key),
  name: PRODUCT_UNIT_LABELS[key],
}));

// Shartnomadan emas, qo'lda kiritilgan mahsulot (faqat shunday yozuvlarni tahrirlash/o'chirish mumkin).
export const isManualEntry = (p: ManufacturedProductResponse) => p.contractProductId === null;
