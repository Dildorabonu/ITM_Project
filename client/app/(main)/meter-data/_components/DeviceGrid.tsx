"use client";

import { useMemo, useState } from "react";
import type { DeviceEnergy } from "@/lib/meterData";
import { formatKwh, formatMoney, formatMoneyFull, formatPercent, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";
import { Sparkline } from "./Sparkline";

/** Necha soniya/daqiqa oldin kelgani — "jonli"likni ko'rsatadi. */
export function agoLabel(iso: string, t: (s: string) => string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff} ${t("soniya oldin")}`;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t("daqiqa oldin")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t("soat oldin")}`;
  return `${Math.floor(diff / 86400)} ${t("kun oldin")}`;
}

type SortKey = "kwh" | "power" | "name";

/** Onlayn/oflayn nuqtasi. */
function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: online ? "var(--success)" : "var(--text3)",
        animation: online ? "dotPulse 1.6s infinite" : "none",
      }}
    />
  );
}

export function DeviceGrid({
  devices,
  colors,
  currency,
  onSelect,
}: {
  devices: DeviceEnergy[];
  colors: Record<string, string>;
  currency: string;
  onSelect: (device: string) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("kwh");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? devices.filter(d => d.deviceName.toLowerCase().includes(query))
      : devices;

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.deviceName.localeCompare(b.deviceName);
      if (sort === "power") return (b.lastPowerW ?? -1) - (a.lastPowerW ?? -1);
      return b.kwh - a.kwh;
    });
  }, [devices, search, sort]);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Sarlavha + boshqaruv */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
          {t("Qurilmalar")} <span style={{ opacity: 0.7 }}>· {devices.length}</span>
        </span>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("Qidirish...")}
          style={{
            width: 180, background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12.5,
            color: "var(--text)", outline: "none",
          }}
        />

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "5px 8px", fontSize: 12.5,
            color: "var(--text2)", outline: "none", cursor: "pointer",
          }}
        >
          <option value="kwh">{t("Sarf bo'yicha")}</option>
          <option value="power">{t("Quvvat bo'yicha")}</option>
          <option value="name">{t("Nom bo'yicha")}</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="itm-card" style={{ padding: 28, textAlign: "center", color: "var(--text3)", fontSize: 12.5 }}>
          {t("Qurilma topilmadi.")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {visible.map((device, i) => {
            const color = colors[device.deviceName] ?? "var(--accent)";
            const [powerValue, powerUnit] = formatPower(device.lastPowerW);

            return (
              <button
                key={device.deviceName}
                onClick={() => onSelect(device.deviceName)}
                className={`itm-card nd-fadein-${Math.min(i, 4)}`}
                style={{
                  padding: "12px 14px", textAlign: "left", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 8,
                  borderLeft: `3px solid ${color}`,
                  transition: "transform 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Nom + holat */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <StatusDot online={device.isOnline} />
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {device.deviceName}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>
                    {formatPercent(device.sharePercent)}
                  </span>
                </div>

                {/* Hozirgi quvvat */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: device.isOnline ? "var(--text)" : "var(--text3)",
                  }}>
                    {device.isOnline ? powerValue : t("Oflayn")}
                  </span>
                  {device.isOnline && (
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{powerUnit}</span>
                  )}
                </div>

                <Sparkline values={device.sparkline} color={color} />

                {/* Energiya + xarajat */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                    {formatKwh(device.kwh)} <span style={{ fontSize: 9.5, color: "var(--text3)" }}>kWh</span>
                  </span>
                  <span
                    title={formatMoneyFull(device.cost, currency)}
                    style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--accent)" }}
                  >
                    {formatMoney(device.cost)} <span style={{ fontSize: 9.5, fontWeight: 400, color: "var(--text3)" }}>{currency}</span>
                  </span>
                </div>

                {/* Oxirgi ko'rilgan */}
                <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                  {device.lastSeen ? agoLabel(device.lastSeen, t) : t("Ma'lumot kelmagan")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
