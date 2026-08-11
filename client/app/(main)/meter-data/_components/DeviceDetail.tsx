"use client";

import type { DeviceEnergyDetail, MeterReading } from "@/lib/meterData";
import { formatKwh, formatMoney, formatMoneyFull, formatPercent, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";
import { EnergyBarChart } from "./EnergyBarChart";
import { LiveCharts } from "./LiveCharts";
import { ReadingsTable } from "./ReadingsTable";
import { agoLabel } from "./DeviceGrid";

/** Detaldagi kichik ko'rsatkich. */
function Metric({ label, value, unit, accent, title }: {
  label: string; value: string; unit?: string; accent?: string; title?: string;
}) {
  return (
    <div className="itm-card" title={title} style={{ padding: "10px 14px", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: accent ?? "var(--text)", lineHeight: 1.15 }}>
        {value}
        {unit && <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text3)", marginLeft: 3 }}>{unit}</span>}
      </p>
    </div>
  );
}

export function DeviceDetail({
  detail,
  readings,
  loading,
  error,
  colors,
  onBack,
}: {
  detail: DeviceEnergyDetail | null;
  readings: MeterReading[];
  loading: boolean;
  error: string;
  colors: Record<string, string>;
  onBack: () => void;
}) {
  const t = useT();

  if (!detail) {
    return (
      <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
        {loading ? t("Yuklanmoqda...") : error || t("Qurilma topilmadi.")}
      </div>
    );
  }

  const color = colors[detail.deviceName] ?? "var(--accent)";
  const [avgValue, avgUnit] = formatPower(detail.avgPowerW);
  const [peakValue, peakUnit] = formatPower(detail.peakPowerW);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8, animation: "panel-appear 0.28s ease" }}>
      {/* Sarlavha */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
            background: "transparent", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
            color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t("Orqaga")}
        </button>

        <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />

        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
          {detail.deviceName}
        </span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999,
          background: detail.isOnline ? "var(--success-dim)" : "var(--surface2)",
          color: detail.isOnline ? "var(--success)" : "var(--text3)",
          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: detail.isOnline ? "var(--success)" : "var(--text3)",
            animation: detail.isOnline ? "dotPulse 1.6s infinite" : "none",
          }} />
          {detail.isOnline ? t("Onlayn") : t("Oflayn")}
        </span>

        {detail.lastSeen && (
          <span style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {t("Oxirgi yozuv")}: {agoLabel(detail.lastSeen, t)}
          </span>
        )}
      </div>

      {/* Ko'rsatkichlar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Metric label={t("Sarflangan energiya")} value={formatKwh(detail.kwh)} unit="kWh" />
        <Metric
          label={t("Xarajat")}
          value={formatMoney(detail.cost)}
          unit={detail.currency}
          accent="var(--accent)"
          title={formatMoneyFull(detail.cost, detail.currency)}
        />
        <Metric label={t("O'rtacha quvvat")} value={avgValue} unit={avgUnit} />
        <Metric label={t("Eng yuqori quvvat")} value={peakValue} unit={peakUnit} />
        <Metric
          label={t("Ish vaqti")}
          value={formatPercent(detail.uptimePercent, 1)}
          accent={detail.uptimePercent >= 95 ? "var(--success)" : detail.uptimePercent >= 60 ? "var(--warn)" : "var(--danger)"}
        />
        <Metric
          label={t("O'rtacha kuchlanish")}
          value={detail.avgVoltage.toFixed(1)}
          unit="V"
          title={`${t("Eng past")}: ${detail.minVoltage.toFixed(1)} V · ${t("Eng yuqori")}: ${detail.maxVoltage.toFixed(1)} V`}
        />
      </div>

      {/* Davr bo'yicha energiya */}
      <EnergyBarChart
        series={detail.series.map(p => ({ bucket: p.bucket, kwh: p.kwh, cost: p.cost }))}
        byDevice={[{
          deviceName: detail.deviceName,
          points: detail.series.map(p => ({ bucket: p.bucket, kwh: p.kwh, cost: p.cost })),
        }]}
        bucket={detail.bucket}
        currency={detail.currency}
        colors={colors}
      />

      {/* Jonli grafiklar */}
      <LiveCharts readings={readings} />

      {/* Xom o'lchovlar */}
      <ReadingsTable items={readings} loading={loading} error={error} showDeviceColumn={false} />
    </div>
  );
}
