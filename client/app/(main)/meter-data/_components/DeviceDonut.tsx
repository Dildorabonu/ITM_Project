"use client";

import { useState } from "react";
import type { DeviceEnergy } from "@/lib/meterData";
import { formatKwh, formatMoneyFull, formatPercent } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const SIZE = 148;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Qurilmalarning umumiy sarfdagi ulushi. Segment bosilsa detalga o'tadi. */
export function DeviceDonut({
  devices,
  colors,
  currency,
  onSelect,
}: {
  devices: DeviceEnergy[];
  colors: Record<string, string>;
  currency: string;
  onSelect?: (device: string) => void;
}) {
  const t = useT();
  const [hover, setHover] = useState<string | null>(null);

  const active = devices.filter(d => d.kwh > 0);
  const total = active.reduce((sum, d) => sum + d.kwh, 0);
  const hovered = active.find(d => d.deviceName === hover) ?? null;

  // Har segmentning arc uzunligi va boshlanish nuqtasi — mutatsiyasiz,
  // oldindan hisoblanadi (React Compiler render davomida qayta
  // tayinlashni yoqtirmaydi).
  const segments = active.reduce<{ device: DeviceEnergy; dash: number; offset: number }[]>(
    (acc, device) => {
      const prev = acc[acc.length - 1];
      const offset = prev ? prev.offset + prev.dash : 0;
      const dash = (device.kwh / total) * CIRCUMFERENCE;
      return [...acc, { device, dash, offset }];
    },
    [],
  );

  return (
    <div className="itm-card" style={{ padding: "12px 16px", minWidth: 0, display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>
        {t("Qurilmalar ulushi")}
      </span>

      {total <= 0 ? (
        <div style={{ flex: 1, minHeight: SIZE, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
          {t("Ma'lumot yetarli emas")}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                fill="none" stroke="var(--surface2)" strokeWidth={STROKE}
              />
              {segments.map(({ device, dash, offset }) => (
                <circle
                  key={device.deviceName}
                  cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                  fill="none"
                  stroke={colors[device.deviceName] ?? "var(--accent)"}
                  strokeWidth={hover === device.deviceName ? STROKE + 4 : STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  opacity={hover === null || hover === device.deviceName ? 1 : 0.45}
                  style={{ cursor: onSelect ? "pointer" : "default", transition: "opacity 0.15s, stroke-width 0.15s" }}
                  onMouseEnter={() => setHover(device.deviceName)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(device.deviceName)}
                />
              ))}
            </svg>

            {/* Markazdagi qiymat */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                {formatKwh(hovered ? hovered.kwh : total)}
              </span>
              <span style={{ fontSize: 9.5, color: "var(--text3)", letterSpacing: "0.06em" }}>
                {hovered ? hovered.deviceName : t("jami kWh")}
              </span>
            </div>
          </div>

          {/* Ro'yxat */}
          <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 5 }}>
            {active.slice(0, 6).map(device => (
              <button
                key={device.deviceName}
                onMouseEnter={() => setHover(device.deviceName)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(device.deviceName)}
                title={formatMoneyFull(device.cost, currency)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, width: "100%",
                  background: hover === device.deviceName ? "var(--surface2)" : "transparent",
                  border: "none", borderRadius: "var(--radius)", padding: "3px 6px",
                  cursor: onSelect ? "pointer" : "default", textAlign: "left",
                  transition: "background 0.12s",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors[device.deviceName] ?? "var(--accent)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {device.deviceName}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  {formatPercent(device.sharePercent)}
                </span>
              </button>
            ))}

            {active.length > 6 && (
              <span style={{ fontSize: 10.5, color: "var(--text3)", paddingLeft: 6 }}>
                +{active.length - 6} {t("qurilma")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
