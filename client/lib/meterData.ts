import { api } from "./api";

// Elektr hisoblagich o'lchovlari va energiya paneli — backenddagi
// `GET /api/meter-data*` endpointlariga mos.

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

export type EnergyPeriodKey = "today" | "24h" | "7d" | "30d" | "month";
export type EnergyBucketKind = "hour" | "day";

/** Grafikning bitta ustuni. `cost` — tarif topilmasa null. */
export interface EnergyBucketPoint {
  bucket: string;
  kwh: number;
  cost: number | null;
}

export interface DeviceSeries {
  deviceName: string;
  points: EnergyBucketPoint[];
}

export interface DeviceEnergy {
  deviceName: string;
  kwh: number;
  cost: number | null;
  sharePercent: number;
  avgPowerW: number;
  peakPowerW: number;
  lastPowerW: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  sparkline: number[];
}

export interface EnergyTotals {
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
  /** Pik soati (UTC, ISO). Ko'rsatish uchun `peakBucket` ishlatiladi. */
  peakAt: string | null;
  /** Pik soatining mahalliy bucket kaliti — grafik ustunlari bilan bir xil format. */
  peakBucket: string | null;
  currentPowerW: number;
  deviceCount: number;
  onlineCount: number;
}

export interface EnergySummary {
  from: string;
  to: string;
  periodKey: EnergyPeriodKey;
  bucket: EnergyBucketKind;
  pricePerKwh: number | null;
  currency: string;
  total: EnergyTotals;
  devices: DeviceEnergy[];
  series: EnergyBucketPoint[];
  byDevice: DeviceSeries[];
}

export interface DeviceDetailPoint {
  bucket: string;
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
}

export interface DeviceEnergyDetail {
  deviceName: string;
  isOnline: boolean;
  lastSeen: string | null;
  from: string;
  to: string;
  periodKey: EnergyPeriodKey;
  bucket: EnergyBucketKind;
  pricePerKwh: number | null;
  currency: string;
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
  peakAt: string | null;
  uptimePercent: number;
  avgVoltage: number;
  minVoltage: number;
  maxVoltage: number;
  avgFrequency: number;
  series: DeviceDetailPoint[];
}

export interface MeterDeviceStatus {
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
  lastPowerW: number | null;
  isConfigured: boolean;
}

export const meterDataService = {
  async getLatest(device?: string, take = 100): Promise<MeterReading[]> {
    const res = await api.get("/api/meter-data", {
      params: { device: device || undefined, take },
    });
    return res.data.result ?? [];
  },

  async getDevices(): Promise<MeterDeviceStatus[]> {
    const res = await api.get("/api/meter-data/devices");
    return res.data.result ?? [];
  },

  async getSummary(period: EnergyPeriodKey): Promise<EnergySummary | null> {
    const res = await api.get("/api/meter-data/summary", { params: { period } });
    return res.data.result ?? null;
  },

  async getDeviceDetail(device: string, period: EnergyPeriodKey): Promise<DeviceEnergyDetail | null> {
    const res = await api.get(`/api/meter-data/summary/${encodeURIComponent(device)}`, {
      params: { period },
    });
    return res.data.result ?? null;
  },
};
