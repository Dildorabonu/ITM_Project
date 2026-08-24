"use client";

import { useEffect, useRef, useState } from "react";
import { meterDataService, type MeterReading } from "@/lib/meterData";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useT } from "@/lib/i18n";

const POLL_MS = 5000;

// "DD-MM-YY · HH:mm:ss" — sekundgacha, jonli oqimda farqlash oson bo'lsin.
function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 19);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

// Necha soniya/daqiqa oldin kelgani — "jonli"likni ko'rsatadi.
function agoLabel(iso: string, t: (s: string) => string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff} ${t("soniya oldin")}`;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t("daqiqa oldin")}`;
  return `${Math.floor(diff / 3600)} ${t("soat oldin")}`;
}

// --- Yengil SVG line chart (kutubxonasiz) ---------------------------------
// Har bir o'lchov birligi alohida grafikda (bitta o'q qoidasi). Bitta seriya —
// legenda shart emas, sarlavha identifikatsiya qiladi. Rang: --accent token.

const CHART_H = 150;
const CHART_PAD_T = 12;
const CHART_PAD_B = 6;

function ChartCard({
  title,
  unit,
  points,
  decimals,
}: {
  title: string;
  unit: string;
  points: { t: string; v: number }[];
  decimals: number;
}) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 600; // ichki koordinata tizimi; SVG kengligi konteynerga cho'ziladi

  if (points.length < 2) {
    return (
      <div className="itm-card" style={{ padding: "12px 16px" }}>
        <ChartTitle title={title} unit={unit} />
        <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
          {t("Ma'lumot yetarli emas")}
        </div>
      </div>
    );
  }

  const vs = points.map(p => p.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) { min -= 1; max += 1; }
  const domPad = (max - min) * 0.12;
  min -= domPad;
  max += domPad;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) =>
    CHART_PAD_T + (1 - (v - min) / (max - min)) * (CHART_H - CHART_PAD_T - CHART_PAD_B);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${W},${CHART_H - CHART_PAD_B} L0,${CHART_H - CHART_PAD_B} Z`;

  const last = points[points.length - 1];
  const hoverIdx = hover !== null ? Math.min(Math.max(hover, 0), points.length - 1) : null;
  const hoverPt = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverLeftPct = hoverIdx !== null ? (hoverIdx / (points.length - 1)) * 100 : 0;

  const fmt = (v: number) => v.toFixed(decimals);
  const timeOf = (iso: string) => iso.slice(11, 19);

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.round(Math.min(Math.max(frac, 0), 1) * (points.length - 1)));
  };

  // Gridlar uchun 3 ta daraja (recessive)
  const gridFracs = [0.25, 0.5, 0.75];

  return (
    <div className="itm-card" style={{ padding: "12px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <ChartTitle title={title} unit={unit} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {fmt(last.v)}
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text3)", marginLeft: 3 }}>{unit}</span>
        </span>
      </div>

      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ position: "relative", height: CHART_H, cursor: "crosshair" }}
      >
        {/* Min/Max belgilari — burchaklarda, xira */}
        <span style={{ position: "absolute", top: -2, left: 0, fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text3)", zIndex: 1 }}>{fmt(max)}</span>
        <span style={{ position: "absolute", bottom: 0, left: 0, fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text3)", zIndex: 1 }}>{fmt(min)}</span>

        <svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 ${W} ${CHART_H}`}
          preserveAspectRatio="none"
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`mg-${unit}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridFracs.map(f => {
            const gy = CHART_PAD_T + f * (CHART_H - CHART_PAD_T - CHART_PAD_B);
            return <line key={f} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />;
          })}
          <path d={areaPath} fill={`url(#mg-${unit})`} />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        {/* Oxirgi nuqta — jonli puls */}
        <span style={{
          position: "absolute", right: -3, top: y(last.v) - 3,
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-dim)",
          animation: "dotPulse 1.6s infinite",
        }} />

        {/* Crosshair + tooltip */}
        {hoverPt && (
          <>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${hoverLeftPct}%`, width: 1, background: "var(--border2)", pointerEvents: "none" }} />
            <span style={{
              position: "absolute", left: `${hoverLeftPct}%`, top: y(hoverPt.v) - 4,
              width: 9, height: 9, borderRadius: "50%", transform: "translateX(-50%)",
              background: "var(--accent)", border: "2px solid var(--surface)", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute",
              left: `${Math.min(Math.max(hoverLeftPct, 12), 88)}%`,
              top: -4, transform: "translate(-50%, -100%)",
              background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
              padding: "4px 9px", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 3,
              boxShadow: "var(--shadow)",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                {fmt(hoverPt.v)} <span style={{ fontWeight: 400, color: "var(--text3)" }}>{unit}</span>
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text3)", marginLeft: 7 }}>
                {timeOf(hoverPt.t)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Vaqt o'qi — bosh/oxiri */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>{timeOf(points[0].t)}</span>
        <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>{timeOf(last.t)}</span>
      </div>
    </div>
  );
}

function ChartTitle({ title, unit }: { title: string; unit: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
      {title} <span style={{ color: "var(--text3)", opacity: 0.7 }}>· {unit}</span>
    </span>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="itm-card" style={{ padding: "12px 16px", flex: 1, minWidth: 150 }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: accent ?? "var(--text)", lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)", marginLeft: 4 }}>{unit}</span>}
      </p>
    </div>
  );
}

export default function MeterDataPage() {
  const t = useT();
  const [items, setItems] = useState<MeterReading[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [device, setDevice] = useState("");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // device qiymatining eng so'nggi holati interval callback ichida kerak
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      setItems(await meterDataService.getLatest(deviceRef.current || undefined, 100));
      setLastFetch(new Date());
    } catch {
      setError(t("Hisoblagich ma'lumotlarini yuklashda xatolik."));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Qurilmalar ro'yxati deyarli o'zgarmaydi — jonli pollingda emas, faqat
  // sahifa ochilganda va qo'lda yangilashda so'raladi (butun jadval bo'yicha
  // DISTINCT skani har 5 soniyada takrorlanmasin).
  const loadDevices = async () => {
    try {
      setDevices(await meterDataService.getDevices());
    } catch {
      /* qurilmalar ro'yxati kritik emas — filtr bo'sh qoladi */
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [device]);

  useEffect(() => { loadDevices(); }, []);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const latest = items[0];

  // Grafiklar — bitta qurilma bo'yicha xronologik tartibda (jadval DESC keladi).
  // Filtr tanlanmagan bo'lsa eng so'nggi yozuv kelgan qurilma ko'rsatiladi.
  const chartDevice = device || latest?.deviceName || "";
  const chron = [...items].filter(r => r.deviceName === chartDevice).reverse();
  const seriesOf = (pick: (r: MeterReading) => number) => chron.map(r => ({ t: r.createdAt, v: pick(r) }));

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Filtr + jonli holat paneli */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <CheckSelect
          value={device}
          onChange={v => setDevice(v)}
          options={devices.map(d => ({ id: d, name: d }))}
          placeholder={t("Barcha qurilmalar")}
          style={{ width: 230 }}
        />

        {/* Jonli yangilanish indikatori */}
        <button
          onClick={() => setLive(l => !l)}
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

        <button
          className="btn-icon"
          onClick={() => { load(); loadDevices(); }}
          title={t("Yangilash")}
          style={{ marginLeft: "auto", background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Stat kartalar — oxirgi o'lchov bo'yicha */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <StatCard label={t("Qurilmalar")} value={String(devices.length)} />
        <StatCard
          label={t("Oxirgi yozuv")}
          value={latest ? agoLabel(latest.createdAt, t) : "—"}
          accent={latest ? "var(--success)" : undefined}
        />
        <StatCard
          label={t("Aktiv quvvat")}
          value={latest ? String(latest.activePower) : "—"}
          unit="W"
          accent="var(--accent)"
        />
        <StatCard
          label={t("Chastota")}
          value={latest ? latest.frequency.toFixed(2) : "—"}
          unit="Hz"
        />
        <StatCard
          label={t("Kuchlanish (A faza)")}
          value={latest ? latest.voltagePhaseA.toFixed(1) : "—"}
          unit="V"
        />
      </div>

      {/* Grafiklar — har o'lchov o'z grafigida (birlik/o'q aralashmaydi) */}
      {chron.length >= 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginBottom: 8 }}>
          <ChartCard title={t("Kuchlanish")} unit="V" decimals={1} points={seriesOf(r => r.voltagePhaseA)} />
          <ChartCard title={t("Tok")} unit="A" decimals={2} points={seriesOf(r => r.currentPhaseA)} />
          <ChartCard title={t("Quvvat")} unit="W" decimals={0} points={seriesOf(r => r.activePower)} />
          <ChartCard title={t("Chastota")} unit="Hz" decimals={2} points={seriesOf(r => r.frequency)} />
        </div>
      )}

      {/* Jadval */}
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
                  <th style={{ textAlign: "center", background: "var(--bg2)" }}>{t("Qurilma")}</th>
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
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                      {t("Hali ma'lumot kelmagan — qurilma yuborishini kuting.")}
                    </td>
                  </tr>
                ) : items.map((r, i) => (
                  <tr key={`${r.deviceName}-${r.createdAt}`} className={i === 0 ? "nd-fadein-0" : undefined}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
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
    </div>
  );
}
