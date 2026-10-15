"use client";

import type { EnergyPeriodKey } from "@/lib/meterData";
import { formatMoneyFull } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const PERIODS: { key: EnergyPeriodKey; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "24h", label: "24 soat" },
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "month", label: "Oy" },
];

export function PeriodBar({
  period,
  onPeriodChange,
  live,
  onLiveToggle,
  lastFetch,
  pricePerKwh,
  currency,
  canEditTariff,
  onOpenTariff,
  canManageDevices,
  onOpenDevices,
  onRefresh,
}: {
  period: EnergyPeriodKey;
  onPeriodChange: (p: EnergyPeriodKey) => void;
  live: boolean;
  onLiveToggle: () => void;
  lastFetch: Date | null;
  pricePerKwh: number | null;
  currency: string;
  canEditTariff: boolean;
  onOpenTariff: () => void;
  canManageDevices: boolean;
  onOpenDevices: () => void;
  onRefresh: () => void;
}) {
  const t = useT();

  return (
    <div
      className="itm-card"
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}
    >
      {/* Davr tanlash — segmentli tugmalar */}
      <div style={{ display: "inline-flex", background: "var(--surface2)", borderRadius: 999, padding: 3, gap: 2 }}>
        {PERIODS.map(p => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              onClick={() => onPeriodChange(p.key)}
              style={{
                padding: "5px 13px", fontSize: 12, fontWeight: 600,
                borderRadius: 999, border: "none", cursor: "pointer",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {t(p.label)}
            </button>
          );
        })}
      </div>

      {/* Jonli yangilanish indikatori */}
      <button
        onClick={onLiveToggle}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px",
          fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
          borderRadius: 999, cursor: "pointer",
          background: live ? "var(--success-dim)" : "var(--surface2)",
          border: `1.5px solid ${live ? "var(--success)" : "var(--border)"}`,
          color: live ? "var(--success)" : "var(--text3)",
          transition: "all 0.15s",
        }}
        title={live ? t("Jonli yangilanishni to'xtatish") : t("Jonli yangilanishni yoqish")}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: live ? "var(--success)" : "var(--text3)",
          animation: live ? "dotPulse 1.6s infinite" : "none",
        }} />
        {live ? t("Jonli") : t("To'xtatilgan")}
      </button>

      {lastFetch && (
        <span style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          {t("Yangilandi")}: {lastFetch.toTimeString().slice(0, 8)}
        </span>
      )}

      {/* Tarif chipi — hammaga ochiq (ro'yxatni ko'rish), tahrirlash faqat ruxsat bilan */}
      <button
        onClick={onOpenTariff}
        title={canEditTariff ? t("Tarifni o'zgartirish") : t("Tarif tarixini ko'rish")}
        style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px",
          fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
          borderRadius: 999,
          background: "var(--accent-dim)", border: "1px solid var(--accent-mid)",
          color: "var(--accent)",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {pricePerKwh === null ? t("Tarif belgilanmagan") : `1 kWh = ${formatMoneyFull(pricePerKwh, currency)}`}
        {canEditTariff && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
      </button>

      {canManageDevices && (
        <button
          onClick={onOpenDevices}
          title={t("Qurilma sozlamalari (IP, port)")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px",
            fontSize: 12, fontWeight: 600,
            borderRadius: 999,
            background: "var(--surface2)", border: "1px solid var(--border)",
            color: "var(--text2)",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
            <path d="M6 10h.01M10 10h8" />
          </svg>
          {t("Qurilmalar")}
        </button>
      )}

      <button
        className="btn-icon"
        onClick={onRefresh}
        title={t("Yangilash")}
        style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  );
}
