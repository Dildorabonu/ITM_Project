import { api } from "./api";

// Elektr hisoblagich o'lchovlari — backenddagi `GET /api/meter-data` ga mos.
// Qurilmalar ma'lumotni POST /api/meter-data ga o'zi yuboradi, frontend faqat o'qiydi.

export interface MeterReading {
  id: string;
  deviceName: string;
  voltagePhaseA: number;
  voltagePhaseB: number;
  voltagePhaseC: number;
  currentPhaseA: number;
  currentPhaseB: number;
  currentPhaseC: number;
  activePower: number;
  frequency: number;
  createdAt: string;
}

export const meterDataService = {
  async getLatest(device?: string, take = 100): Promise<MeterReading[]> {
    const res = await api.get("/api/meter-data", {
      params: { device: device || undefined, take },
    });
    return res.data.result ?? [];
  },

  async getDevices(): Promise<string[]> {
    const res = await api.get("/api/meter-data/devices");
    return res.data.result ?? [];
  },
};
