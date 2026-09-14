import { api } from "./api";

// Partiya turi: vazifalardan yuborilgan ishlab chiqarish partiyasi yoki
// mijozning olib ketishi. Ikkalasi bitta jadvalda, lekin alohida hisoblanadi.
export enum ShipmentBatchKind {
  Production = 1,
  CustomerPickup = 2,
}

// Tur (kind) javobda qaytarilmaydi — ro'yxat har doim `kind` filtri bilan
// so'raladi, shuning uchun chaqiruvchi turni allaqachon biladi.
export interface ShipmentBatch {
  id: string;
  contractProductId: string | null;
  // Olib ketish (CustomerPickup) qaysi ishlab chiqarish partiyasidan bo'lgani.
  sourceBatchId: string | null;
  sourceBatchNo: number | null;
  departmentName: string | null;
  batchNo: number;
  amount: number;
  createdByFullName: string | null;
  createdAt: string;
}

// Mahsulot bo'yicha topshirishga tayyor (omborga kirim qilingan) miqdor.
export interface ShipmentReady {
  contractProductId: string;
  readyQuantity: number;
}

export interface ShipmentBatchCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  departmentId?: string | null;
  amount: number;
  kind: ShipmentBatchKind;
  sourceBatchId?: string | null;
}

export const shipmentBatchService = {
  getByContract: async (
    contractId: string,
    contractProductId?: string | null,
    kind?: ShipmentBatchKind,
  ): Promise<ShipmentBatch[]> => {
    const params: Record<string, string> = { contractId };
    if (contractProductId) params.contractProductId = contractProductId;
    if (kind !== undefined) params.kind = String(kind);
    const res = await api.get("/api/shipmentbatch", { params });
    return res.data?.result ?? [];
  },

  getReady: async (contractId: string): Promise<ShipmentReady[]> => {
    const res = await api.get("/api/shipmentbatch/ready", { params: { contractId } });
    return res.data?.result ?? [];
  },

  create: async (dto: ShipmentBatchCreatePayload): Promise<ShipmentBatch> => {
    const res = await api.post("/api/shipmentbatch", dto);
    return res.data?.result;
  },

  // Miqdorni eng eski partiyadan boshlab (FIFO) avtomatik taqsimlaydi —
  // har partiyadan olingan qismi alohida yozuv bo'lib qaytadi.
  createPickupAuto: async (dto: {
    contractId: string;
    contractProductId?: string | null;
    departmentId?: string | null;
    amount: number;
  }): Promise<ShipmentBatch[]> => {
    const res = await api.post("/api/shipmentbatch/pickup-auto", dto);
    return res.data?.result ?? [];
  },
};
