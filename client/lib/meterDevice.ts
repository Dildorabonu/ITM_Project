import { api } from "./api";

// Hisoblagich qurilmalari — `/api/meter-devices`. Backend har yoqilgan
// qurilmaga Modbus TCP orqali o'zi ulanadi; saqlangan o'zgarish restartsiz
// kuchga kiradi. Hammasi "Energy.Update" ruxsati bilan.

export interface MeterDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  slaveId: number;
  startAddress: number;
  registerCount: number;
  ptRatio: number;
  intervalSeconds: number | null;
  enabled: boolean;
  createdAt: string;
  /** O'lchov kelgan bo'lsa nom qulflanadi — tarix nomga bog'langan. */
  hasReadings: boolean;
}

export interface MeterDeviceSave {
  name: string;
  ip: string;
  port: number;
  slaveId: number;
  startAddress: number;
  registerCount: number;
  ptRatio: number;
  intervalSeconds: number | null;
  enabled: boolean;
}

export interface MeterDeviceTestResult {
  voltage: number;
  current: number;
  power: number;
  frequency: number;
}

export const meterDeviceService = {
  async getAll(): Promise<MeterDevice[]> {
    const res = await api.get("/api/meter-devices");
    return res.data.result ?? [];
  },

  async create(dto: MeterDeviceSave): Promise<string> {
    const res = await api.post("/api/meter-devices", dto);
    return res.data.result;
  },

  async update(id: string, dto: MeterDeviceSave): Promise<void> {
    await api.put(`/api/meter-devices/${id}`, dto);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/meter-devices/${id}`);
  },

  /** Kiritilgan sozlama bilan bir marta o'qiydi, hech narsa saqlamaydi. */
  async test(dto: MeterDeviceSave): Promise<MeterDeviceTestResult> {
    const res = await api.post("/api/meter-devices/test", dto);
    return res.data.result;
  },
};
