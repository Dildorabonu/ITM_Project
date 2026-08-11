"use client";

import { useState } from "react";
import type { DeviceSeries, EnergyBucketPoint } from "@/lib/meterData";
import { formatBucketLabel, formatKwh, formatMoneyFull } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const CHART_H = 168;

/**
 * Vaqt bo'yicha sarf — qurilmalar bo'yicha bo'lingan (stacked) ustunlar.
 * Ustunlar div bilan chiziladi: responsiv, matn o'lchami bilan cho'zilmaydi
 * va hover holati SVG'ga qaraganda soddaroq.
 */
export function EnergyBarChart({
  series,
  byDevice,
  bucket,
  currency,
  colors,
}: {
  series: EnergyBucketPoint[];
  byDevice: DeviceSeries[];
  bucket: "hour" | "day";
  currency: string;
  colors: Record<string, string>;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...series.map(p => p.kwh), 0);

  // Ustunlar soni ko'p bo'lsa har yorliqni chizish o'qni to'ldirib yuboradi.
  const labelStep = Math.max(1, Math.ceil(series.length / 12));

  // Faqat davr ichida sarfi bo'lgan qurilmalar legendaga tushadi.
  const activeDevices = byDevice.filter(d => d.points.some(p => p.kwh > 0));

  const hovered = hover === null ? null : series[hover];
  const hoveredBreakdown = hover === null
    ? []
    : activeDevices
        .map(d => ({ name: d.deviceName, kwh: d.points[hover]?.kwh ?? 0 }))
        .filter(x => x.kwh > 0)
        .sort((a, b) => b.kwh - a.kwh);

  return (
    <div className="itm-card" style={{ padding: "12px 16px", minWidth: 0, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
          {t("Sarf dinamikasi")} <span style={{ opacity: 0.7 }}>· kWh</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>
          {t("Eng yuqori")}: {formatKwh(max)} kWh
        </span>
      </div>

      {series.length === 0 ? (
        <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
          {t("Ma'lumot yetarli emas")}
        </div>
      ) : (
        <>
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 2, height: CHART_H, position: "relative" }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Gorizontal gridlar */}
            {[0.25, 0.5, 0.75].map(f => (
              <div
                key={f}
                style={{
                  position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`,
                  height: 1, borderTop: "1px dashed var(--border)", pointerEvents: "none",
                }}
              />
            ))}

            {series.map((point, i) => {
              const totalH = max > 0 ? (point.kwh / max) * 100 : 0;
              const isHover = hover === i;

              return (
                <div
                  key={point.bucket}
                  onMouseEnter={() => setHover(i)}
                  style={{
                    flex: 1, minWidth: 0, height: "100%",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    cursor: "pointer",
                    background: isHover ? "var(--surface2)" : "transparent",
                    borderRadius: "var(--radius)",
                    transition: "background 0.12s",
                  }}
                >
                  <div
                    style={{
                      height: `${totalH}%`, minHeight: point.kwh > 0 ? 2 : 0,
                      display: "flex", flexDirection: "column-reverse",
                      borderRadius: "var(--radius) var(--radius) 0 0", overflow: "hidden",
                      opacity: hover === null || isHover ? 1 : 0.55,
                      transition: "opacity 0.12s",
                    }}
                  >
                    {activeDevices.map(device => {
                      const kwh = device.points[i]?.kwh ?? 0;
                      if (kwh <= 0) return null;

                      return (
                        <div
                          key={device.deviceName}
                          style={{
                            height: `${(kwh / point.kwh) * 100}%`,
                            background: colors[device.deviceName] ?? "var(--accent)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vaqt o'qi */}
          <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
            {series.map((point, i) => (
              <span
                key={point.bucket}
                style={{
                  flex: 1, minWidth: 0, textAlign: "center",
                  fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text3)",
                  whiteSpace: "nowrap", overflow: "hidden",
                }}
              >
                {i % labelStep === 0 ? formatBucketLabel(point.bucket, bucket) : ""}
              </span>
            ))}
          </div>

          {/* Legenda */}
          {activeDevices.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              {activeDevices.map(device => (
                <span key={device.deviceName} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors[device.deviceName] ?? "var(--accent)" }} />
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                    {device.deviceName}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Tooltip */}
          {hovered && (
            <div
              style={{
                position: "absolute", top: 8, right: 16, zIndex: 3,
                background: "var(--bg3)", border: "1px solid var(--border2)",
                borderRadius: "var(--radius)", padding: "8px 11px",
                boxShadow: "var(--shadow)", pointerEvents: "none", minWidth: 150,
              }}
            >
              <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>
                {formatBucketLabel(hovered.bucket, bucket)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                {formatKwh(hovered.kwh)} <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)" }}>kWh</span>
              </div>
              <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--accent)", marginTop: 2 }}>
                {formatMoneyFull(hovered.cost, currency)}
              </div>

              {hoveredBreakdown.length > 1 && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 3 }}>
                  {hoveredBreakdown.map(row => (
                    <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[row.name] ?? "var(--accent)" }} />
                        <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{row.name}</span>
                      </span>
                      <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                        {formatKwh(row.kwh)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
