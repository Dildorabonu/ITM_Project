"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  meterDataService,
  type EnergyPeriodKey,
  type EnergySummary,
  type MeterReading,
} from "@/lib/meterData";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { PeriodBar } from "./_components/PeriodBar";
import { KpiRow } from "./_components/KpiRow";
import { ReadingsTable } from "./_components/ReadingsTable";

/** Xom o'lchovlar va statuslar — tez-tez. */
const LIVE_POLL_MS = 5000;
/** Agregat panel — sekinroq, u soat aniqligida o'zgaradi. */
const SUMMARY_POLL_MS = 60000;

export default function MeterDataPage() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canEditTariff = hasPermission("Energy.Update");

  const [period, setPeriod] = useState<EnergyPeriodKey>("today");
  const [summary, setSummary] = useState<EnergySummary | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [tariffOpen, setTariffOpen] = useState(false);

  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Interval callback ichida so'nggi qiymatlar kerak.
  const periodRef = useRef(period);
  periodRef.current = period;
  const deviceRef = useRef(selectedDevice);
  deviceRef.current = selectedDevice;

  const loadLive = useCallback(async () => {
    const items = await meterDataService.getLatest(deviceRef.current ?? undefined, 100);
    setReadings(items);
    setLastFetch(new Date());
  }, []);

  const loadSummary = useCallback(async () => {
    const data = await meterDataService.getSummary(periodRef.current);
    setSummary(data);
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      await Promise.all([loadLive(), loadSummary()]);
    } catch {
      setError(t("Hisoblagich ma'lumotlarini yuklashda xatolik."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadLive, loadSummary, t]);

  // Davr yoki qurilma o'zgarsa — darhol qayta yuklash.
  useEffect(() => { loadAll(); }, [period, selectedDevice, loadAll]);

  // Jonli oqim: xom o'lchovlar tez, agregat sekin.
  useEffect(() => {
    if (!live) return;

    const liveId = setInterval(() => { loadLive().catch(() => {}); }, LIVE_POLL_MS);
    const summaryId = setInterval(() => { loadSummary().catch(() => {}); }, SUMMARY_POLL_MS);

    return () => { clearInterval(liveId); clearInterval(summaryId); };
  }, [live, loadLive, loadSummary]);

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PeriodBar
        period={period}
        onPeriodChange={setPeriod}
        live={live}
        onLiveToggle={() => setLive(l => !l)}
        lastFetch={lastFetch}
        pricePerKwh={summary?.pricePerKwh ?? null}
        currency={summary?.currency ?? "so'm"}
        canEditTariff={canEditTariff}
        onOpenTariff={() => setTariffOpen(true)}
        onRefresh={() => loadAll()}
      />

      <KpiRow total={summary?.total ?? null} currency={summary?.currency ?? "so'm"} loading={loading} />

      {/* Task 15: grafiklar (EnergyBarChart + DeviceDonut) shu yerga qo'shiladi */}
      {/* Task 16: DeviceGrid / DeviceDetail shu yerga qo'shiladi */}

      <ReadingsTable
        items={readings}
        loading={loading}
        error={error}
        showDeviceColumn={selectedDevice === null}
      />

      {/* Task 17: TariffModal shu yerga qo'shiladi */}
      {tariffOpen && null}
    </div>
  );
}
