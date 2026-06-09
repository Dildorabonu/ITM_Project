import { api } from "./api";

export interface ShipmentBatch {
  id: string;
  departmentName: string | null;
  batchNo: number;
  amount: number;
  createdByFullName: string | null;
  createdAt: string;
}

export interface ShipmentBatchCreatePayload {
  contractId: string;
  contractProductId?: string | null;
  departmentId?: string | null;
  amount: number;
}

export const shipmentBatchService = {
  getByContract: async (
    contractId: string,
    contractProductId?: string | null,
  ): Promise<ShipmentBatch[]> => {
    const params: Record<string, string> = { contractId };
    if (contractProductId) params.contractProductId = contractProductId;
    const res = await api.get("/api/shipmentbatch", { params });
    return res.data?.result ?? [];
  },

  create: async (dto: ShipmentBatchCreatePayload): Promise<ShipmentBatch> => {
    const res = await api.post("/api/shipmentbatch", dto);
    return res.data?.result;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/shipmentbatch/${id}`);
  },
};
