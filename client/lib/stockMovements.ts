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

  productName: string;

  materialName: string | null;

  sourceDepartmentName: string | null;
  targetDepartmentName: string | null;

  quantity: number;
  quantityAfter: number;

  requisitionNo: string | null;

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

// Filtr tugmachalaridagi sonlar — `GET /api/stock-movements/summary`.
// Faqat harakatlar SONI: miqdorlarni qo'shib bo'lmaydi, chunki bitta filtrga
// kg, dona va metrdagi qatorlar birga tushadi.
export interface StockMovementSummary {
  total: number;
  byType: Record<StockMovementType, number>;
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

// Type → o'zbekcha nom. Backend bu satrni jo'natmaydi (u `type` ning sof funksiyasi —
// har qatorga takrorlab yuborish ortiqcha trafik edi), badge'lar shu lug'atdan oladi.
// ATAYLAB tarjima qilinmaydi: jurnal turi — domen atamasi, `_types.ts` dagi legend
// nomlari ham shu manbadan oziqlanadi.
export const STOCK_MOVEMENT_LABEL: Record<StockMovementType, string> = {
  In: "Kirim",
  Out: "Chiqim",
  Transfer: "Ko'chirish",
  Adjust: "Tuzatish",
  Reserve: "Rezerv",
  Release: "Rezervdan chiqarish",
};

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

// Bo'sh paramlarni tashlab, query obyektini yig'adi.
function toQuery(params: StockMovementParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query[key] = value as string | number;
    }
  }
  return query;
}

export const stockMovementService = {
  // Filtrlangan, sahifalangan jurnal (CreatedAt DESC). Bo'sh paramlar yuborilmaydi.
  get: async (params: StockMovementParams = {}): Promise<PagedResult<StockMovement>> => {
    const query = toQuery(params);
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

  // Tugmachalar uchun sonlar. `type` yuborilmaydi — backend uni baribir e'tiborsiz
  // qoldiradi, lekin ortiqcha param jo'natmaslik uchun shu yerda ham tashlab ketamiz.
  getSummary: async (params: StockMovementParams = {}): Promise<StockMovementSummary> => {
    const { productId, materialId, departmentId, requisitionId, contractId, userId, from, to } = params;
    const res = await api.get("/api/stock-movements/summary", {
      params: toQuery({ productId, materialId, departmentId, requisitionId, contractId, userId, from, to }),
    });
    const result = res.data?.result;
    return result ?? { total: 0, byType: {} as Record<StockMovementType, number> };
  },
};
