"use client";

import { useRef, useState } from "react";
import type { MeterReading } from "@/lib/meterData";
import { useT } from "@/lib/i18n";

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

/**
 * Bitta qurilmaning jonli o'lchov grafiklari. Har birlik alohida grafikda —
 * bitta o'qda turli birliklarni aralashtirmaslik uchun.
 */
export function LiveCharts({ readings }: { readings: MeterReading[] }) {
  const t = useT();

  // Jadval DESC keladi — grafik uchun xronologik tartib kerak.
  const chron = [...readings].reverse();
  const seriesOf = (pick: (r: MeterReading) => number) =>
    chron.map(r => ({ t: r.createdAt, v: pick(r) }));

  if (chron.length < 2) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
      <ChartCard title={t("Kuchlanish")} unit="V" decimals={1} points={seriesOf(r => r.voltagePhaseA)} />
      <ChartCard title={t("Tok")} unit="A" decimals={2} points={seriesOf(r => r.currentPhaseA)} />
      <ChartCard title={t("Quvvat")} unit="W" decimals={0} points={seriesOf(r => r.activePower)} />
      <ChartCard title={t("Chastota")} unit="Hz" decimals={2} points={seriesOf(r => r.frequency)} />
    </div>
  );
}
