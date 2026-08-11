"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  meterDataService,
  type DeviceEnergyDetail,
  type EnergyPeriodKey,
  type EnergySummary,
  type MeterReading,
} from "@/lib/meterData";
import { buildDeviceColorMap } from "@/lib/energyFormat";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { PeriodBar } from "./_components/PeriodBar";
import { KpiRow } from "./_components/KpiRow";
import { ReadingsTable } from "./_components/ReadingsTable";
import { EnergyBarChart } from "./_components/EnergyBarChart";
import { DeviceDonut } from "./_components/DeviceDonut";
import { DeviceGrid } from "./_components/DeviceGrid";
import { DeviceDetail } from "./_components/DeviceDetail";
import { TariffModal } from "./_components/TariffModal";

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
  const [detail, setDetail] = useState<DeviceEnergyDetail | null>(null);

  // Rang qurilma nomi bo'yicha barqaror — tartib o'zgarganda sakramaydi.
  const deviceColors = useMemo(
    () => buildDeviceColorMap((summary?.devices ?? []).map(d => d.deviceName)),
    [summary],
  );

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [tariffOpen, setTariffOpen] = useState(false);

  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  // Ikki manba mustaqil so'raladi (readings va summary) — biri yiqilsa
  // ikkinchisining yaxshi natijasini yashirmasin. Hozircha faqat readings
  // uchun ko'rinadigan xato bor (ReadingsTable `error` qabul qiladi); summary
  // o'z xatosini ichida ushlaydi va keyingi muvaffaqiyatli urinishda o'zi
  // tuzatadi — KpiRow bu bosqichda xato holatini ko'rsatmaydi.
  const [readingsError, setReadingsError] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Interval callback ichida so'nggi qiymatlar kerak. Refga render paytida
  // emas, effectda yoziladi (React qoidasi) — lekin effectlar commit'dan
  // keyin, deklaratsiya tartibida darhol ishga tushgani uchun quyidagi
  // "davr/qurilma o'zgarsa qayta yuklash" effektidan oldin doim yangilangan
  // bo'ladi.
  const periodRef = useRef(period);
  const deviceRef = useRef(selectedDevice);
  useEffect(() => {
    periodRef.current = period;
    deviceRef.current = selectedDevice;
  }, [period, selectedDevice]);

  // So'rovlar tartibsiz qaytishi mumkin (masalan davr tez-tez almashtirilsa).
  // Har chaqiruvda hisoblagich oshiriladi — faqat eng so'nggi so'rovning
  // javobi holatga yoziladi, eskirgani e'tiborsiz qoldiriladi.
  const liveReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);
  const detailReqIdRef = useRef(0);

  const loadLive = useCallback(async () => {
    const reqId = ++liveReqIdRef.current;
    try {
      const items = await meterDataService.getLatest(deviceRef.current ?? undefined, 100);
      if (reqId !== liveReqIdRef.current) return; // eskirgan javob
      setReadings(items);
      setLastFetch(new Date());
      setReadingsError("");
    } catch {
      if (reqId !== liveReqIdRef.current) return;
      setReadingsError(t("Hisoblagich ma'lumotlarini yuklashda xatolik."));
    }
  }, [t]);

  const loadSummary = useCallback(async () => {
    const reqId = ++summaryReqIdRef.current;
    try {
      const data = await meterDataService.getSummary(periodRef.current);
      if (reqId !== summaryReqIdRef.current) return; // eskirgan javob
      setSummary(data);
    } catch {
      // Agregat (summary) xatosi readings jadvalini yashirmaydi — mustaqil
      // so'raladi va keyingi muvaffaqiyatli pollingda o'zi tuzatadi.
    }
  }, []);

  // Qurilma tanlanmagan bo'lsa detalni darhol tozalaydi — shu bilan ham
  // eski javob qaytib kelsa ham holatga yozilmasligini kafolatlaydi (reqId
  // shart-shartsiz oshiriladi).
  const loadDetail = useCallback(async () => {
    const reqId = ++detailReqIdRef.current;
    const device = deviceRef.current;
    if (!device) { setDetail(null); return; }
    try {
      const data = await meterDataService.getDeviceDetail(device, periodRef.current);
      if (reqId !== detailReqIdRef.current) return; // eskirgan javob
      setDetail(data);
    } catch {
      // Detal uchun alohida xato holati yo'q — readings xatosi (ReadingsTable
      // orqali) allaqachon ko'rinadi; keyingi muvaffaqiyatli pollingda tuzatiladi.
    }
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      await Promise.allSettled([loadLive(), loadSummary(), loadDetail()]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadLive, loadSummary, loadDetail]);

  // Davr yoki qurilma o'zgarsa — darhol qayta yuklash.
  useEffect(() => { loadAll(); }, [period, selectedDevice, loadAll]);

  // Jonli oqim: xom o'lchovlar tez, agregat sekin. Barchasi o'z xatosini
  // ichida ushlaydi (hech qachon reject qilmaydi) — polling to'xtamaydi.
  useEffect(() => {
    if (!live) return;

    const liveId = setInterval(() => { loadLive(); }, LIVE_POLL_MS);
    const summaryId = setInterval(() => {
      loadSummary();
      loadDetail();
    }, SUMMARY_POLL_MS);

    return () => { clearInterval(liveId); clearInterval(summaryId); };
  }, [live, loadLive, loadSummary, loadDetail]);

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

      {selectedDevice ? (
        <DeviceDetail
          detail={detail}
          readings={readings}
          loading={loading}
          error={readingsError}
          colors={deviceColors}
          onBack={() => setSelectedDevice(null)}
        />
      ) : (
        <>
          {summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <EnergyBarChart
                series={summary.series}
                byDevice={summary.byDevice}
                bucket={summary.bucket}
                currency={summary.currency}
                colors={deviceColors}
              />
              <DeviceDonut
                devices={summary.devices}
                colors={deviceColors}
                currency={summary.currency}
                onSelect={setSelectedDevice}
              />
            </div>
          )}

          {summary && (
            <DeviceGrid
              devices={summary.devices}
              colors={deviceColors}
              currency={summary.currency}
              onSelect={setSelectedDevice}
            />
          )}

          <ReadingsTable items={readings} loading={loading} error={readingsError} showDeviceColumn />
        </>
      )}

      {tariffOpen && (
        <TariffModal
          canEdit={canEditTariff}
          onClose={() => setTariffOpen(false)}
          onSaved={() => loadAll(true)}
        />
      )}
    </div>
  );
}
