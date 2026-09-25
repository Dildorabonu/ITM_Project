import { api } from "./api";
import { ProductUnit } from "./userService";
// Ombor skaneri (HID keyboard-wedge) — backenddagi `GET /api/warehouse-scan/lookup`
// va `POST /api/warehouse-scan/action` endpointlariga mos tiplar va service.
// Eslatma: `userService.ts` dagi `scanService` WIA hujjat skaneri uchun (boshqa oqim).

// Material/SKU zaxirasining bitta bo'lim bo'yicha bo'lagi.
export interface MaterialDepartmentBreakdown {
  departmentId: string;
  departmentName: string;
  quantity: number;
}

// Skanerlangan Product bog'langan Material/SKU bo'yicha umumiy zaxira.
export interface MaterialAggregate {
  code: string;
  name: string;
  totalQuantity: number;   // shu Materialga bog'langan barcha Product qatorlari yig'indisi
  catalogQuantity: number; // Material.Quantity (legacy hisob)
  minQuantity: number;
  location: string | null;
  departments: MaterialDepartmentBreakdown[];
}

// Lookup natijasi: Product kartasi + Material agregati + QR PNG.
export interface ScanLookupResult {
  id: string;
  name: string;
  qrCode: string | null;

  quantity: number;
  reserved: number;
  available: number; // Quantity - Reserved
  unit: ProductUnit;

  departmentId: string;
  departmentName: string;
  invoiceNumber: string;

  qrPngBase64: string | null;
  material: MaterialAggregate | null;
}

// Skaner amali turi. Backend `StockMovementType` enum qiymatlari (Out=1, Adjust=3).
// JSON body'da SON sifatida yuboriladi — backendda string-enum converter yo'q.
export const SCAN_ACTION_TYPE = {
  Out: 1,
  Adjust: 3,
} as const;
export type ScanActionType = keyof typeof SCAN_ACTION_TYPE;

export interface ScanActionPayload {
  productId: string;
  type: ScanActionType;
  quantity: number; // Out: maqsad bo'limga o'tkaziladigan miqdor; Adjust: yangi absolut miqdor
  targetDepartmentId?: string; // faqat Out uchun shart
  notes?: string;
}

export const warehouseScanService = {
  // QR kod bo'yicha Product kartasi + Material agregati.
  lookup: async (code: string): Promise<ScanLookupResult> => {
    const res = await api.get("/api/warehouse-scan/lookup", { params: { code } });
    return res.data?.result ?? res.data;
  },

  // Chiqim / Tuzatish amali → yangilangan lookup.
  action: async (dto: ScanActionPayload): Promise<ScanLookupResult> => {
    const body = {
      productId: dto.productId,
      type: SCAN_ACTION_TYPE[dto.type], // enum SON qiymati
      quantity: dto.quantity,
      targetDepartmentId: dto.targetDepartmentId ?? null,
      notes: dto.notes ?? null,
    };
    const res = await api.post("/api/warehouse-scan/action", body);
    return res.data?.result ?? res.data;
  },
};