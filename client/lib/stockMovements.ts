import { api } from "./api";

// Ombor harakatlari jurnali (StockMovement) — backenddagi `GET /api/stock-movements`
// endpointiga mos tiplar va service. Bu read-only "source of truth" jurnali:
// yozish logikasi backendda (RequisitionService) bo'ladi, frontend faqat o'qiydi.
//
// MUHIM: filtrlash BACKENDDA — query param yuboramiz, massivni frontendda filterlamaymiz.

// Backend StockMovementType enum bilan bir xil (Transfer=2 Out ga birlashtirilgan).
export type StockMovementType =
  | "In"
  | "Out"
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
  types?: StockMovementType[];
  from?: string; // ISO sana
  to?: string;   // ISO sana
  page?: number;
  pageSize?: number;
}

// Filtr chiplaridagi sonlar — `GET /api/stock-movements/summary`.
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
  Adjust: "Tuzatish",
  Reserve: "Rezerv",
  Release: "Rezervdan chiqarish",
};

// Type → semantik rang tokeni (CLAUDE.md status ranglariga mos).
// In=success (kirim), Out=danger (chiqim),
// Reserve=warn (rezerv), Release=purple (rezervdan chiqarish), Adjust=text2 (tuzatish).
export const STOCK_MOVEMENT_COLOR: Record<StockMovementType, string> = {
  In: "var(--success)",
  Out: "var(--danger)",
  Reserve: "var(--warn)",
  Release: "var(--purple)",
  Adjust: "var(--text2)",
};

export const STOCK_MOVEMENT_DIM: Record<StockMovementType, string> = {
  In: "var(--success-dim)",
  Out: "var(--danger-dim)",
  Reserve: "var(--warn-dim)",
  Release: "var(--purple-dim)",
  Adjust: "var(--surface2)",
};

// Miqdor ishorasi: Type bo'yicha qoldiqni oshiradimi (+) yoki kamaytiradimi (−).
// In/Release qoldiqni oshiradi; Out/Reserve kamaytiradi; Adjust neytral.
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

// Chiqim qatori maqsad bo'lim mahsulotiga yoziladi — uning quantityAfter'i ombor emas,
// qabul qilgan bo'lim qoldig'i. Uni ombor qoldig'i deb ko'rsatmaslik uchun null.
export function movementBalance(m: StockMovement): number | null {
  return m.type === "Out" && m.targetDepartmentName ? null : m.quantityAfter;
}

type QueryValue = string | number | string[];

// Bo'sh paramlarni tashlab, query obyektini yig'adi.
function toQuery(params: StockMovementParams): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    query[key] = value as QueryValue;
  }
  return query;
}

export const stockMovementService = {
  // Filtrlangan, sahifalangan jurnal (CreatedAt DESC). Bo'sh paramlar yuborilmaydi.
  get: async (params: StockMovementParams = {}): Promise<PagedResult<StockMovement>> => {
    const query = toQuery(params);
    // indexes: null → `types=Reserve&types=Release`. Axios default `types[]=` beradi,
    // ASP.NET Core esa uni List<> ga bog'lamaydi.
    const res = await api.get("/api/stock-movements", { params: query, paramsSerializer: { indexes: null } });
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

  // Chiplar uchun sonlar. `types` yuborilmaydi — backend uni baribir e'tiborsiz
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
