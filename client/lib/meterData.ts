import { api } from "./api";

// Elektr hisoblagich o'lchovlari — backenddagi `GET /api/meter-data` ga mos.
// Qurilma ma'lumotni Modbus orqali yuboradi, frontend faqat o'qiydi.
// Backend faqat UI ishlatadigan maydonlarni qaytaradi (B/C fazalar o'qilmaydi).

export interface MeterReading {
  deviceName: string;
  voltagePhaseA: number;
  currentPhaseA: number;
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
