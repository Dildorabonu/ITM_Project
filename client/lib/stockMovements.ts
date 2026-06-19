import { api } from "./api";

// Ombor harakatlari jurnali (StockMovement) — backenddagi `GET /api/stock-movements`
// endpointiga mos tiplar va service. Bu read-only "source of truth" jurnali:
// yozish logikasi backendda (RequisitionService) bo'ladi, frontend faqat o'qiydi.
//
// MUHIM: filtrlash BACKENDDA — query param yuboramiz, massivni frontendda filterlamaymiz.

// Backend StockMovementType enum bilan bir xil tartibda (0..5).
export type StockMovementType =
  | "In"
  | "Out"
  | "Transfer"
  | "Adjust"
  | "Reserve"
  | "Release";

export interface StockMovement {
  id: string;
  type: StockMovementType;
  typeLabel: string;

  productId: string;
  productName: string;

  materialId: string | null;
  materialName: string | null;

  sourceDepartmentId: string | null;
  sourceDepartmentName: string | null;
  targetDepartmentId: string | null;
  targetDepartmentName: string | null;

  quantity: number;
  quantityAfter: number;

  requisitionId: string | null;
  requisitionNo: string | null;
  contractId: string | null;

  userId: string;
  userFullName: string;

  createdAt: string;
  notes: string | null;
}

export interface StockMovementParams {
  productId?: string;
  materialId?: string;
  departmentId?: string;
  requisitionId?: string;
  contractId?: string;
  userId?: string;
  type?: StockMovementType;
  from?: string; // ISO sana
  to?: string;   // ISO sana
  page?: number;
  pageSize?: number;
}

// Backend `PagedResult<T>` shape.
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// Type → semantik rang tokeni (CLAUDE.md status ranglariga mos).
// In=success (kirim), Out=danger (chiqim), Transfer=accent (ko'chirish),
// Reserve=warn (rezerv), Release=purple (rezervdan chiqarish), Adjust=text2 (tuzatish).
export const STOCK_MOVEMENT_COLOR: Record<StockMovementType, string> = {
  In: "var(--success)",
  Out: "var(--danger)",
  Transfer: "var(--accent)",
  Reserve: "var(--warn)",
  Release: "var(--purple)",
  Adjust: "var(--text2)",
};

export const STOCK_MOVEMENT_DIM: Record<StockMovementType, string> = {
  In: "var(--success-dim)",
  Out: "var(--danger-dim)",
  Transfer: "var(--accent-dim)",
  Reserve: "var(--warn-dim)",
  Release: "var(--purple-dim)",
  Adjust: "var(--surface2)",
};

// Miqdor ishorasi: Type bo'yicha qoldiqni oshiradimi (+) yoki kamaytiradimi (−).
// In/Release qoldiqni oshiradi; Out/Reserve kamaytiradi; Transfer/Adjust neytral.
export function stockMovementSign(type: StockMovementType): "+" | "-" | "" {
  switch (type) {
    case "In":
    case "Release":
      return "+";
    case "Out":
    case "Reserve":
      return "-";
    default:
      return "";
  }
}

export const stockMovementService = {
  // Filtrlangan, sahifalangan jurnal (CreatedAt DESC). Bo'sh paramlar yuborilmaydi.
  get: async (params: StockMovementParams = {}): Promise<PagedResult<StockMovement>> => {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query[key] = value as string | number;
      }
    }
    const res = await api.get("/api/stock-movements", { params: query });
    const result = res.data?.result;
    return (
      result ?? {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      }
    );
  },
};
