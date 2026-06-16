import {
  DepartmentType,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type ProductSimilar,
} from "@/lib/userService";

// Korxona omborxonasi (warehouse) sahifasiga tegishli umumiy tiplar va konstantalar.
// Mahsulotlar faqat Omborxona tipidagi bo'limlar bilan ishlaydi — barcha dropdown,
// Excel shablon va import validatsiyasi shu cheklovga amal qiladi.

// Import preview qatoridagi xato qaysi ustunga tegishli ekanini belgilaydi.
// Rang berish shu maydon (field) bo'yicha aniqlanadi — xato matnidan so'z
// qidirish (fragile) o'rniga. `null` — umumiy / ustunga bog'lanmagan xato.
export type RowErrorField = "name" | "invoice" | "department" | "quantity";

export interface RowError {
  field: RowErrorField | null;
  message: string;
}

export interface ParsedImportRow {
  rowNum: number;
  name: string;
  invoiceNumber: string;
  departmentName: string;
  departmentId?: string;
  quantity: number;
  unit: ProductUnit;
  description: string;
  errors: RowError[];
  similar?: ProductSimilar[];
}

export interface ProductForm {
  name: string;
  invoiceNumber: string;
  description: string;
  quantity: string;
  unit: string;
  departmentId: string;
}

export const emptyForm: ProductForm = {
  name: "",
  invoiceNumber: "",
  description: "",
  quantity: "",
  unit: "",
  departmentId: "",
};

export const UNIT_OPTIONS = (Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => ({
  id: String(key),
  name: PRODUCT_UNIT_LABELS[key],
}));

// Bu sahifa faqat ombor strukturasiga tegishli.
export const WAREHOUSE_DEPARTMENT_TYPE = DepartmentType.Omborxona;

// Bir vaqtda qo'shish/import qilish mumkin bo'lgan maksimal mahsulotlar soni.
export const BULK_LIMIT = 200;
