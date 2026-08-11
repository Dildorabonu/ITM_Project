"use client";

import type { EnergyTotals } from "@/lib/meterData";
import { formatBucketLabel, formatKwh, formatMoney, formatMoneyFull, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

/** Bitta KPI karta — hover'da nozik shimmer bilan. */
function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
  title,
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
  title?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="itm-card"
      title={title}
      style={{ padding: "12px 16px", flex: 1, minWidth: 160, position: "relative", overflow: "hidden" }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>
        {label}
      </p>

      {loading ? (
        <div style={{ height: 26, width: 90, background: "var(--surface2)", borderRadius: "var(--radius)" }} className="animate-pulse" />
      ) : (
        <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: accent ?? "var(--text)", lineHeight: 1.1 }}>
          {value}
          {unit && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)", marginLeft: 4 }}>{unit}</span>}
        </p>
      )}

      {hint && (
        <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function KpiRow({
  total,
  currency,
  loading,
}: {
  total: EnergyTotals | null;
  currency: string;
  loading: boolean;
}) {
  const t = useT();

  const [currentValue, currentUnit] = formatPower(total?.currentPowerW ?? null);
  const [peakValue, peakUnit] = formatPower(total?.peakPowerW ?? null);
  // Pik vaqti grafik ustunlari bilan bir xil mahalliy kalitdan formatlanadi —
  // aks holda KPI UTC'da, grafik esa Toshkent vaqtida ko'rsatilardi.
  const peakHint = total?.peakBucket
    ? `${t("Pik vaqti")}: ${formatBucketLabel(total.peakBucket, "hour")}`
    : undefined;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
      <StatCard
        loading={loading}
        label={t("Sarflangan energiya")}
        value={total ? formatKwh(total.kwh) : "—"}
        unit="kWh"
      />
      <StatCard
        loading={loading}
        label={t("Xarajat")}
        value={total ? formatMoney(total.cost) : "—"}
        unit={total && total.cost !== null ? currency : undefined}
        accent="var(--accent)"
        title={total ? formatMoneyFull(total.cost, currency) : undefined}
      />
      <StatCard
        loading={loading}
        label={t("Hozirgi quvvat")}
        value={currentValue}
        unit={currentUnit}
        accent={total && total.currentPowerW > 0 ? "var(--success)" : undefined}
      />
      <StatCard
        loading={loading}
        label={t("Eng yuqori quvvat")}
        value={peakValue}
        unit={peakUnit}
        hint={peakHint}
      />
      <StatCard
        loading={loading}
        label={t("Qurilmalar")}
        value={total ? `${total.onlineCount} / ${total.deviceCount}` : "—"}
        hint={t("onlayn")}
        accent={total && total.onlineCount > 0 ? "var(--success)" : "var(--text3)"}
      />
    </div>
  );
}
