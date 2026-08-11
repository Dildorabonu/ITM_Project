"use client";

import type { MeterReading } from "@/lib/meterData";
import { useT } from "@/lib/i18n";

// "DD-MM-YY · HH:mm:ss" — sekundgacha, jonli oqimda farqlash oson bo'lsin.
function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 19);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

export function ReadingsTable({
  items,
  loading,
  error,
  showDeviceColumn = true,
}: {
  items: MeterReading[];
  loading: boolean;
  error: string;
  showDeviceColumn?: boolean;
}) {
  const t = useT();
  const colCount = showDeviceColumn ? 7 : 6;

  return (
    <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
      {loading ? (
        <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
      ) : error ? (
        <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <table className="itm-table">
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ width: 56, minWidth: 56, textAlign: "center", borderRight: "2px solid var(--border)", background: "var(--bg2)" }}>{t("T/r")}</th>
                {showDeviceColumn && <th style={{ textAlign: "center", background: "var(--bg2)" }}>{t("Qurilma")}</th>}
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>Uₐ (V)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>Iₐ (A)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>P (W)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>f (Hz)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>{t("Sana")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                    {t("Hali ma'lumot kelmagan — qurilma yuborishini kuting.")}
                  </td>
                </tr>
              ) : items.map((r, i) => (
                <tr key={r.id} className={i === 0 ? "nd-fadein-0" : undefined}>
                  <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  {showDeviceColumn && (
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "2px 10px", borderRadius: 999,
                        background: "var(--accent-dim)", color: "var(--accent)",
                        fontSize: 11.5, fontWeight: 600, fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                      }}>
                        {r.deviceName}
                      </span>
                    </td>
                  )}
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{r.voltagePhaseA.toFixed(1)}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{r.currentPhaseA.toFixed(2)}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>{r.activePower}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{r.frequency.toFixed(2)}</td>
                  <td style={{ textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
