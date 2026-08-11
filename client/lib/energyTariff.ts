import { api } from "./api";

// Elektr tariflari — `/api/energy-tariffs`. O'qish hammaga, yozish
// "Energy.Update" ruxsati bilan.

export interface EnergyTariff {
  id: string;
  pricePerKwh: number;
  currency: string;
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
}

export interface EnergyTariffSave {
  pricePerKwh: number;
  currency: string;
  /** ISO sana — "2026-06-01" yetarli, backend kun boshiga keltiradi. */
  effectiveFrom: string;
  note?: string | null;
}

export const energyTariffService = {
  async getAll(): Promise<EnergyTariff[]> {
    const res = await api.get("/api/energy-tariffs");
    return res.data.result ?? [];
  },

  async create(dto: EnergyTariffSave): Promise<string> {
    const res = await api.post("/api/energy-tariffs", dto);
    return res.data.result;
  },

  async update(id: string, dto: EnergyTariffSave): Promise<void> {
    await api.put(`/api/energy-tariffs/${id}`, dto);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/energy-tariffs/${id}`);
  },
};
