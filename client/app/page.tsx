"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import {
  dashboardService,
  type DashboardSummary,
  type ProductionTrendPoint,
  type DepartmentWorkload,
  type HeatmapCell,
  type ContractStatusBucket,
  type ManufacturingProgress,
  type UpcomingDeadline,
  type TopPerformer,
  type RecentActivity,
} from "@/lib/dashboardService";
import {
  ContractStatus,
  Priority,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  ManufacturingStatus,
  ProductUnit,
} from "@/lib/userService";

/* ═══════════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════════ */

const Ico = {
  Sun:    () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.9" /><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></g></svg>,
  Moon:   () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.85" /></svg>,
  Sunset: () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M17 18a5 5 0 1 0-10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="currentColor" opacity="0.15" /><line x1="12" y1="9" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" /><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="1.5" /><line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="1.5" /><line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="1.5" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="1.5" /><line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" strokeWidth="1.5" /></svg>,
  Sunrise:() => <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M17 18a5 5 0 1 0-10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="currentColor" opacity="0.15" /><line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" /><polyline points="8 6 12 2 16 6" stroke="currentColor" strokeWidth="1.5" fill="none" /><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="1.5" /><line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="1.5" /><line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="1.5" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="1.5" /><line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" strokeWidth="1.5" /></svg>,
  ArrowRight: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>,
  Calendar:   () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Clock:      () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Activity:   () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Factory:    () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M2 20V8l5 4V8l5 4V8l5 4V4h3v16z" /><line x1="9" y1="20" x2="9" y2="16" /><line x1="14" y1="20" x2="14" y2="16" /></svg>,
  Truck:      () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  Users:      () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  File:       () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  CheckCircle:() => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  Alert:      () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Box:        () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  Building:   () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>,
  Zap:        () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  Trophy:     () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22a7 7 0 1 0 4 0" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>,
};

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED BG (canvas orbs)
═══════════════════════════════════════════════════════════════════ */

function AnimatedBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0, h = 0;

    const orbs = Array.from({ length: 7 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 100 + Math.random() * 140,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      hue: [210, 230, 250, 190, 270, 220, 200][i],
      alpha: 0.04 + Math.random() * 0.04,
    }));

    function resize() {
      w = canvas!.offsetWidth; h = canvas!.offsetHeight;
      canvas!.width = w * 0.5; canvas!.height = h * 0.5;
      ctx!.scale(0.5, 0.5);
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const o of orbs) {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -0.1 || o.x > 1.1) o.vx *= -1;
        if (o.y < -0.1 || o.y > 1.1) o.vy *= -1;
        const grd = ctx!.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r);
        grd.addColorStop(0, `hsla(${o.hue}, 80%, 60%, ${o.alpha})`);
        grd.addColorStop(1, `hsla(${o.hue}, 80%, 60%, 0)`);
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(o.x * w, o.y * h, o.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    resize(); draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="dx-animated-bg" />;
}

/* ═══════════════════════════════════════════════════════════════════
   COUNT-UP HOOK
═══════════════════════════════════════════════════════════════════ */

function useCountUp(target: number, duration = 1400, delay = 0, trigger: unknown = 0): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    setVal(0);
    if (target === 0) return;

    timeoutRef.current = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setVal(Math.round(target * ease));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [target, duration, delay, trigger]);

  return val;
}

/* ═══════════════════════════════════════════════════════════════════
   REVEAL-ON-SCROLL SECTION
   Pauses inner animations until the section enters the viewport.
═══════════════════════════════════════════════════════════════════ */

function RevealSection({
  className = "",
  as: Tag = "div",
  children,
}: {
  className?: string;
  as?: "div" | "section";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  // Sync check before paint so already-visible sections don't flash hidden.
  useLayoutEffect(() => {
    if (on) return;
    const el = ref.current;
    if (!el) return;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const rect = el.getBoundingClientRect();
    if (rect.top < vh && rect.bottom > 0) setOn(true);
  }, [on]);

  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          obs.disconnect();
        }
      },
      // Fire BEFORE the section reaches the viewport so the animation
      // completes by the time the user scrolls to it — avoids the
      // "reset and re-open" feel when content is already visible.
      { rootMargin: "0px 0px 30% 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [on]);

  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement & HTMLElement>} className={`${className}${on ? " dx-anim-on" : ""}`}>
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */

const UZ_MONTHS_SHORT = ["yan","fev","mar","apr","may","iyn","iyl","avg","sen","okt","noy","dek"];
const UZ_MONTHS = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentyabr","oktyabr","noyabr","dekabr"];
const UZ_WEEKDAYS = ["yakshanba","dushanba","seshanba","chorshanba","payshanba","juma","shanba"];

function getGreeting(): { text: string; icon: "sunrise" | "sun" | "sunset" | "moon" } {
  const h = new Date().getHours();
  if (h < 6)  return { text: "Xayrli tun",  icon: "moon" };
  if (h < 12) return { text: "Xayrli tong", icon: "sunrise" };
  if (h < 18) return { text: "Xayrli kun",  icon: "sun" };
  return { text: "Xayrli kech", icon: "sunset" };
}

function getGreetingIcon(icon: string) {
  switch (icon) {
    case "sunrise": return <Ico.Sunrise />;
    case "sun":     return <Ico.Sun />;
    case "sunset":  return <Ico.Sunset />;
    case "moon":    return <Ico.Moon />;
    default:        return <Ico.Sun />;
  }
}

function formatUzDate(d: Date, format: "full" | "short" = "full") {
  const day = d.getDate();
  if (format === "short") return `${String(day).padStart(2, "0")}-${UZ_MONTHS_SHORT[d.getMonth()]}`;
  return `${day}-${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}-yil, ${UZ_WEEKDAYS[d.getDay()]}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1000)}k`;
  if (n >= 1_000)     return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

/* ─── Period helpers ─── */

type PeriodPreset = "today" | "week" | "month" | "30d" | "90d" | "custom";

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today:  "Bugun",
  week:   "Bu hafta",
  month:  "Bu oy",
  "30d":  "30 kun",
  "90d":  "90 kun",
  custom: "Maxsus",
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function rangeFromPreset(preset: Exclude<PeriodPreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const todayStr = toIsoDate(today);
  switch (preset) {
    case "today": return { from: todayStr, to: todayStr };
    case "week": {
      const day = today.getDay();
      const offset = day === 0 ? 6 : day - 1; // Monday-based
      const monday = new Date(today);
      monday.setDate(today.getDate() - offset);
      return { from: toIsoDate(monday), to: todayStr };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toIsoDate(first), to: todayStr };
    }
    case "30d": {
      const d = new Date(today); d.setDate(today.getDate() - 29);
      return { from: toIsoDate(d), to: todayStr };
    }
    case "90d": {
      const d = new Date(today); d.setDate(today.getDate() - 89);
      return { from: toIsoDate(d), to: todayStr };
    }
  }
}

function formatRangeShort(from: string, to: string): string {
  const f = fromIsoDate(from);
  const t = fromIsoDate(to);
  if (from === to) return formatUzDate(f, "short");
  return `${formatUzDate(f, "short")} → ${formatUzDate(t, "short")}`;
}

function priorityLabel(p: Priority): string {
  switch (p) {
    case Priority.Low:    return "Past";
    case Priority.Medium: return "O'rta";
    case Priority.High:   return "Yuqori";
    case Priority.Urgent: return "Shoshilinch";
    default: return "—";
  }
}

function priorityClass(p: Priority): string {
  switch (p) {
    case Priority.Urgent: return "danger";
    case Priority.High:   return "warn";
    case Priority.Medium: return "accent";
    default:              return "neutral";
  }
}

function unitLabel(u: ProductUnit): string {
  return ["dona","kg","g","l","m","m²","m³","quti","paket","to'plam"][u] || "";
}

function deadlineUrgency(days: number): "passed" | "critical" | "warn" | "normal" {
  if (days < 0) return "passed";
  if (days <= 3) return "critical";
  if (days <= 10) return "warn";
  return "normal";
}

/* ═══════════════════════════════════════════════════════════════════
   DUAL AREA CHART (production + shipment)
═══════════════════════════════════════════════════════════════════ */

function DualAreaChart({
  prod, ship, height = 240,
}: {
  prod: ProductionTrendPoint[];
  ship: ProductionTrendPoint[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const firstRunRef = useRef(true);
  const data = prod.map((p, i) => ({ date: p.date, prod: p.amount, ship: ship[i]?.amount ?? 0 }));

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setAnimKey((k) => k + 1);
  }, [prod, ship]);

  const totalProdRaw  = data.reduce((s, d) => s + d.prod, 0);
  const totalShipRaw  = data.reduce((s, d) => s + d.ship, 0);
  const peakIdx       = data.length > 0
    ? data.reduce((idx, d, i) => (d.prod > data[idx].prod ? i : idx), 0)
    : 0;
  const peakProdRaw   = data[peakIdx]?.prod ?? 0;
  const rateRaw       = totalProdRaw > 0 ? Math.round((totalShipRaw / totalProdRaw) * 100) : 0;

  const animTotalProd = useCountUp(totalProdRaw, 1400, 0,   animKey);
  const animTotalShip = useCountUp(totalShipRaw, 1400, 120, animKey);
  const animRate      = useCountUp(rateRaw,      1400, 240, animKey);
  const animPeakProd  = useCountUp(peakProdRaw,  1400, 360, animKey);

  if (data.length === 0) return null;

  const W = 800;
  const H = height;
  const padL = 44, padR = 14, padT = 18, padB = 28;
  const cw = W - padL - padR;
  const ch = H - padT - padB;
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.prod, d.ship)));

  const xAt = (i: number) => padL + (i / Math.max(1, data.length - 1)) * cw;
  const yAt = (v: number) => padT + ch - (v / maxVal) * ch;

  const buildSmooth = (key: "prod" | "ship") => {
    const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d[key]) }));
    const n = pts.length;
    if (n < 2) return `M${pts[0]?.x ?? 0},${pts[0]?.y ?? 0}`;

    // Monotone cubic Hermite interpolation (Fritsch-Carlson) — no overshoot
    const dx: number[] = [], dy: number[] = [], m: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x;
      dy[i] = pts[i + 1].y - pts[i].y;
      m[i] = dy[i] / dx[i];
    }

    const t: number[] = new Array(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) {
        t[i] = 0;
      } else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
      }
    }

    let p = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const c1x = pts[i].x + dx[i] / 3;
      const c1y = pts[i].y + (t[i] * dx[i]) / 3;
      const c2x = pts[i + 1].x - dx[i] / 3;
      const c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3;
      p += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return p;
  };

  const prodLine = buildSmooth("prod");
  const shipLine = buildSmooth("ship");
  const prodArea = `${prodLine} L${xAt(data.length - 1)},${padT + ch} L${padL},${padT + ch} Z`;
  const shipArea = `${shipLine} L${xAt(data.length - 1)},${padT + ch} L${padL},${padT + ch} Z`;

  const grid = 4;
  const xLabelCount = Math.min(data.length, 10);
  const step = Math.max(1, Math.floor(data.length / xLabelCount));

  const peak = data[peakIdx];
  const peakDate = new Date(peak.date);

  return (
    <div className="dx-chart-wrap" style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dx-chart-svg">
        <defs>
          <linearGradient id="dxGradProd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dxGradShip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="var(--success)" stopOpacity="0.40" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: grid + 1 }).map((_, i) => {
          const v = (maxVal / grid) * i;
          const y = padT + ch - (v / maxVal) * ch;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y}
                stroke="var(--border)" strokeWidth="1" strokeDasharray="3,4" opacity="0.55" />
              <text x={padL - 8} y={y + 3.5} textAnchor="end"
                fill="var(--text3)" fontSize="10">{formatNum(v)}</text>
            </g>
          );
        })}

        <path key={`area-prod-${animKey}`} className="dx-chart-area" d={prodArea} fill="url(#dxGradProd)" />
        <path key={`area-ship-${animKey}`} className="dx-chart-area dx-chart-area-ship" d={shipArea} fill="url(#dxGradShip)" />
        <path key={`line-prod-${animKey}`} className="dx-chart-line" pathLength={1} d={prodLine} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path key={`line-ship-${animKey}`} className="dx-chart-line dx-chart-line-ship" pathLength={1} d={shipLine} fill="none" stroke="var(--success)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => {
          if (i % step !== 0 && i !== data.length - 1) return null;
          const x = xAt(i);
          const date = new Date(d.date);
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fill="var(--text3)" fontSize="10">
              {`${date.getDate()}/${date.getMonth() + 1}`}
            </text>
          );
        })}

        {hover !== null && (
          <g>
            <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + ch}
              stroke="var(--text3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <circle cx={xAt(hover)} cy={yAt(data[hover].prod)} r="3.5"
              fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
            <circle cx={xAt(hover)} cy={yAt(data[hover].ship)} r="3.5"
              fill="var(--surface)" stroke="var(--success)" strokeWidth="2" />
          </g>
        )}

        {data.map((_, i) => {
          const x = xAt(i);
          const w = cw / Math.max(1, data.length - 1);
          return (
            <rect key={i} x={x - w / 2} y={padT} width={w} height={ch}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover !== null && (() => {
        const x = xAt(hover);
        const date = new Date(data[hover].date);
        const left = (x / W) * 100;
        const transform =
          left > 75 ? "translateX(-100%) translateX(-8px)"
          : left < 25 ? "translateX(0) translateX(8px)"
          : "translateX(-50%)";
        return (
          <div className="dx-tooltip" style={{ left: `${left}%`, transform }}>
            <div className="dx-tooltip-date">{date.getDate()}-{UZ_MONTHS_SHORT[date.getMonth()]}</div>
            <div className="dx-tooltip-row">
              <span className="dx-tooltip-dot" style={{ background: "var(--accent)" }} />
              <span className="dx-tooltip-label">Ishlab chiq.</span>
              <span className="dx-tooltip-val">{data[hover].prod.toLocaleString()}</span>
            </div>
            <div className="dx-tooltip-row">
              <span className="dx-tooltip-dot" style={{ background: "var(--success)" }} />
              <span className="dx-tooltip-label">Jo&apos;natma</span>
              <span className="dx-tooltip-val">{data[hover].ship.toLocaleString()}</span>
            </div>
          </div>
        );
      })()}

      <div className="dx-chart-stats">
        <div className="dx-chart-stat">
          <span className="dx-chart-stat-dot" style={{ background: "var(--accent)" }} />
          <span className="dx-chart-stat-label">Jami ishlab chiqarilgan</span>
          <span className="dx-chart-stat-val">{animTotalProd.toLocaleString()}</span>
        </div>
        <div className="dx-chart-stat">
          <span className="dx-chart-stat-dot" style={{ background: "var(--success)" }} />
          <span className="dx-chart-stat-label">Jami jo&apos;natilgan</span>
          <span className="dx-chart-stat-val">{animTotalShip.toLocaleString()}</span>
        </div>
        <div className="dx-chart-stat">
          <span className="dx-chart-stat-label">Bajarish darajasi</span>
          <span className="dx-chart-stat-val">{animRate}%</span>
        </div>
        <div className="dx-chart-stat dx-chart-stat-peak">
          <span className="dx-chart-stat-label">Eng yuqori kun</span>
          <span className="dx-chart-stat-val">
            {peakDate.getDate()}-{UZ_MONTHS_SHORT[peakDate.getMonth()]}
            <span className="dx-chart-stat-sub"> ({animPeakProd.toLocaleString()})</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BUBBLE CHART (contract status — bubbles inside a sphere)
═══════════════════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<number, string> = {
  [ContractStatus.DrawingPending]: "#6366f1",
  [ContractStatus.TechProcessing]: "#a855f7",
  [ContractStatus.InProduction]:   "#10b981",
  [ContractStatus.Completed]:      "#22c55e",
  [ContractStatus.Cancelled]:      "#ef4444",
};

function BubbleChart({ data }: { data: ContractStatusBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 240;
  const cx = size / 2, cy = size / 2;
  const containerR = size / 2 - 6;

  // Only show bubbles for non-zero counts
  const visible = useMemo(
    () => data.filter(d => d.count > 0),
    [data]
  );

  // Bubble metadata (radius ∝ √count). Initial settled positions via force-packing.
  type BubbleMeta = { r: number; status: number; count: number; label: string };
  type BubblePhys = { x: number; y: number; vx: number; vy: number };

  const meta: BubbleMeta[] = useMemo(() => {
    if (visible.length === 0) return [];
    const maxCount = Math.max(1, ...visible.map(d => d.count));
    const minR = Math.min(20, containerR * 0.18);
    const maxR = containerR * (visible.length === 1 ? 0.78 : 0.55);
    return visible.map(d => ({
      r: Math.max(minR, Math.sqrt(d.count / maxCount) * maxR),
      status: d.status,
      count: d.count,
      label: d.label,
    }));
  }, [visible, containerR]);

  const initialPositions = useMemo<BubblePhys[]>(() => {
    if (meta.length === 0) return [];
    const bs = meta.map((_, i) => {
      const a = (i / meta.length) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(a) * containerR * 0.3,
        y: cy + Math.sin(a) * containerR * 0.3,
        vx: 0, vy: 0,
      };
    });
    for (let iter = 0; iter < 260; iter++) {
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const dx = bs[j].x - bs[i].x;
          const dy = bs[j].y - bs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const minDist = meta[i].r + meta[j].r + 3;
          if (dist < minDist) {
            const ov = (minDist - dist) * 0.5;
            const nx = dx / dist, ny = dy / dist;
            bs[i].x -= nx * ov; bs[i].y -= ny * ov;
            bs[j].x += nx * ov; bs[j].y += ny * ov;
          }
        }
      }
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        b.x += (cx - b.x) * 0.012;
        b.y += (cy - b.y) * 0.012;
        const dx = b.x - cx, dy = b.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const max = containerR - meta[i].r - 2;
        if (dist > max) {
          b.x = cx + (dx / dist) * max;
          b.y = cy + (dy / dist) * max;
        }
      }
    }
    return bs;
  }, [meta, containerR, cx, cy]);

  // Live physics state — driven via raf, mutated in place; render via tick counter
  const physRef = useRef<BubblePhys[]>([]);
  const dragRef = useRef<{ idx: number; offsetX: number; offsetY: number; lastX: number; lastY: number; lastT: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);
  const [popKey, setPopKey] = useState(0);

  // Reset physics whenever data changes
  useEffect(() => {
    physRef.current = initialPositions.map(p => ({ ...p }));
    dragRef.current = null;
    setPopKey(k => k + 1);
  }, [initialPositions]);

  // Animation loop
  useEffect(() => {
    if (meta.length === 0) return;
    let raf = 0;
    const step = () => {
      const bs = physRef.current;
      const drag = dragRef.current;

      // Forces & integration (per-frame, tuned for 60fps feel)
      for (let i = 0; i < bs.length; i++) {
        if (drag && drag.idx === i) continue;
        const b = bs[i];
        b.vx *= 0.965;
        b.vy *= 0.965;
        b.vx += (cx - b.x) * 0.0018;
        b.vy += (cy - b.y) * 0.0018;
        b.vx += (Math.random() - 0.5) * 0.06;
        b.vy += (Math.random() - 0.5) * 0.06;
        b.x += b.vx;
        b.y += b.vy;
      }

      // Pairwise elastic collision (mass ∝ r²)
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], c = bs[j];
          const dx = c.x - a.x, dy = c.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const minDist = meta[i].r + meta[j].r;
          if (dist < minDist) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            c.x += nx * overlap * 0.5;
            c.y += ny * overlap * 0.5;
            const ma = meta[i].r * meta[i].r, mc = meta[j].r * meta[j].r;
            const va = a.vx * nx + a.vy * ny;
            const vc = c.vx * nx + c.vy * ny;
            if (vc - va < 0) {
              const e = 0.82;
              const newVa = (va * (ma - mc) + (1 + e) * mc * vc) / (ma + mc);
              const newVc = (vc * (mc - ma) + (1 + e) * ma * va) / (ma + mc);
              a.vx += (newVa - va) * nx;
              a.vy += (newVa - va) * ny;
              c.vx += (newVc - vc) * nx;
              c.vy += (newVc - vc) * ny;
            }
          }
        }
      }

      // Sphere boundary — reflect with energy loss
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        const dx = b.x - cx, dy = b.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const max = containerR - meta[i].r - 2;
        if (dist > max) {
          const nx = dx / dist, ny = dy / dist;
          b.x = cx + nx * max;
          b.y = cy + ny * max;
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) {
            b.vx -= 1.7 * dot * nx;
            b.vy -= 1.7 * dot * ny;
          }
        }
      }

      setTick(t => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [meta, cx, cy, containerR]);

  // Pointer → SVG-local coordinates
  const toLocal = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = toLocal(e.clientX, e.clientY);
    const bs = physRef.current;
    let hit = -1;
    for (let i = bs.length - 1; i >= 0; i--) {
      const dx = x - bs[i].x, dy = y - bs[i].y;
      if (dx * dx + dy * dy <= meta[i].r * meta[i].r) { hit = i; break; }
    }
    if (hit >= 0) {
      const b = bs[hit];
      dragRef.current = {
        idx: hit,
        offsetX: x - b.x,
        offsetY: y - b.y,
        lastX: x, lastY: y,
        lastT: performance.now(),
      };
      b.vx = 0; b.vy = 0;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    } else {
      // Clicked empty space inside sphere → "poke" nearby bubbles outward
      for (let i = 0; i < bs.length; i++) {
        const dx = bs[i].x - x, dy = bs[i].y - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist < containerR) {
          const force = Math.max(0, 60 - dist) * 0.18;
          bs[i].vx += (dx / dist) * force;
          bs[i].vy += (dy / dist) * force;
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const bs = physRef.current;
    const b = bs[drag.idx];
    const newX = x - drag.offsetX;
    const newY = y - drag.offsetY;
    const now = performance.now();
    const dt = Math.max(0.008, (now - drag.lastT) / 1000);
    b.vx = (newX - b.x) / dt / 60;
    b.vy = (newY - b.y) / dt / 60;
    b.x = newX;
    b.y = newY;
    drag.lastT = now;
    drag.lastX = x;
    drag.lastY = y;
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      dragRef.current = null;
    }
  };

  const phys = physRef.current;
  const isDragging = dragRef.current !== null;

  return (
    <div className="dx-bub-wrap">
      <div className="dx-bub-svg-wrap" style={{ width: size, height: size }}>
        <svg
          ref={svgRef}
          width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
        >
          <defs>
            {visible.map((d) => (
              <radialGradient key={d.status} id={`bubGrad-${d.status}`} cx="32%" cy="28%" r="85%">
                <stop offset="0%"   stopColor={STATUS_COLORS[d.status]} stopOpacity="1" />
                <stop offset="55%"  stopColor={STATUS_COLORS[d.status]} stopOpacity="0.85" />
                <stop offset="100%" stopColor={STATUS_COLORS[d.status]} stopOpacity="0.5" />
              </radialGradient>
            ))}
            <radialGradient id="bubSphere" cx="50%" cy="38%" r="65%">
              <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sphere container */}
          <circle cx={cx} cy={cy} r={containerR}
            fill="url(#bubSphere)"
            stroke="var(--border)"
            strokeWidth="1.2"
            strokeDasharray="2,5"
            opacity="0.85"
          />

          {/* Bubbles */}
          {meta.map((m, i) => {
            const p = phys[i];
            if (!p) return null;
            const fontSize = Math.min(Math.max(m.r * 0.55, 10), 26);
            const labelSize = Math.min(Math.max(m.r * 0.2, 7), 9.5);
            return (
              <g
                key={`${m.status}-${i}-${popKey}`}
                className="dx-bub-pop"
                style={{
                  transformOrigin: `${p.x}px ${p.y}px`,
                  transformBox: "view-box" as React.CSSProperties["transformBox"],
                  animationDelay: `${i * 0.07}s`,
                }}
              >
                <circle cx={p.x} cy={p.y} r={m.r}
                  fill={`url(#bubGrad-${m.status})`}
                  stroke={STATUS_COLORS[m.status]}
                  strokeWidth="1.3"
                  strokeOpacity="0.7"
                />
                <ellipse
                  cx={p.x - m.r * 0.3}
                  cy={p.y - m.r * 0.42}
                  rx={m.r * 0.32}
                  ry={m.r * 0.18}
                  fill="white"
                  opacity="0.35"
                  style={{ pointerEvents: "none" }}
                />
                <text x={p.x} y={p.y + (m.r > 28 ? -fontSize * 0.05 : fontSize * 0.1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={fontSize}
                  fontWeight="800"
                  style={{ fontFamily: "var(--font-mono)", pointerEvents: "none", userSelect: "none" }}
                >
                  {m.count}
                </text>
                <text x={p.x} y={p.y + (m.r > 28 ? m.r * 0.55 : m.r + labelSize + 3)}
                  textAnchor="middle"
                  fill={m.r > 28 ? "white" : STATUS_COLORS[m.status]}
                  fontSize={labelSize}
                  fontWeight="700"
                  opacity={m.r > 28 ? 0.92 : 0.95}
                  style={{ fontFamily: "var(--font-inter)", pointerEvents: "none", letterSpacing: "0.05em", userSelect: "none" }}
                >
                  {m.label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>

        {visible.length === 0 && (
          <div className="dx-bub-empty">
            <div className="dx-donut-num">{total}</div>
            <div className="dx-donut-cap">Jami shartnoma</div>
          </div>
        )}
      </div>

      <div className="dx-donut-legend">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={i} className="dx-legend-item">
              <span className="dx-legend-dot" style={{ background: STATUS_COLORS[d.status] }} />
              <span className="dx-legend-label">{d.label}</span>
              <span className="dx-legend-pct">{pct}%</span>
              <span className="dx-legend-num">{d.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HORIZONTAL BARS (department workload)
═══════════════════════════════════════════════════════════════════ */

function HBarList({ data }: { data: DepartmentWorkload[] }) {
  const max = Math.max(1, ...data.map(d => d.activeContracts + d.activeManufactured));

  if (data.length === 0) {
    return <div className="dx-empty"><Ico.CheckCircle /><span>Faol yuk yo&apos;q</span></div>;
  }

  return (
    <div className="dx-hbar-list">
      <div className="dx-hbar-hint">
        <span className="dx-hbar-hint-label">Bo&apos;lim turi</span>
        <span className="dx-hbar-hint-item">
          <span className="dx-hbar-chip dxc-production" /> Ishlab chiqarish
        </span>
        <span className="dx-hbar-hint-item">
          <span className="dx-hbar-chip dxc-admin" /> Boshqaruv
        </span>
        <span className="dx-hbar-hint-item">
          <span className="dx-hbar-chip dxc-section" /> Bo&apos;lim
        </span>
        <span className="dx-hbar-hint-tip">
          Chiziq uzunligi — umumiy yuk · ranglar — shartnoma/mahsulot nisbati
        </span>
      </div>
      {data.slice(0, 8).map((d, i) => {
        const total = d.activeContracts + d.activeManufactured;
        const pct = (total / max) * 100;
        const contractPct = total > 0 ? (d.activeContracts / total) * 100 : 0;
        const typeChip = d.type === DepartmentType.IshlabChiqarish ? "production"
                       : d.type === DepartmentType.Boshqaruv      ? "admin" : "section";
        const typeLabel = DEPARTMENT_TYPE_LABELS[d.type];
        const rowTitle =
          `${d.name} · ${typeLabel}\n` +
          `${d.employeeCount} xodim\n` +
          `${d.activeContracts} faol shartnoma · ${d.activeManufactured} ishlab chiqarish\n` +
          `Jami yuk: ${total}`;
        return (
          <div
            key={d.id}
            className={`dx-hbar-row dx-fadein-${Math.min(i, 5)}`}
            title={rowTitle}
          >
            <div className="dx-hbar-left">
              <span className={`dx-hbar-chip dxc-${typeChip}`} />
              <span className="dx-hbar-name">{d.name}</span>
              <span className="dx-hbar-emp">{d.employeeCount} xodim</span>
            </div>
            <div className="dx-hbar-track">
              <div className="dx-hbar-fill" style={{ width: `${pct}%` }}>
                <div className="dx-hbar-seg dx-hbar-seg-c" style={{ width: `${contractPct}%` }} />
                <div className="dx-hbar-seg dx-hbar-seg-m" style={{ width: `${100 - contractPct}%` }} />
              </div>
            </div>
            <div className="dx-hbar-right">
              <span className="dx-hbar-num">{total}</span>
              <span className="dx-hbar-meta">{d.activeContracts}c · {d.activeManufactured}p</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HEATMAP (production activity, 12 weeks × 7 days)
═══════════════════════════════════════════════════════════════════ */

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const weeks = Math.max(0, ...cells.map(c => c.weekIndex)) + 1;
  const max = Math.max(1, ...cells.map(c => c.amount));

  const grid: (HeatmapCell | undefined)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: weeks }, () => undefined)
  );
  for (const c of cells) {
    if (c.dayOfWeek >= 0 && c.dayOfWeek < 7 && c.weekIndex < weeks) {
      grid[c.dayOfWeek][c.weekIndex] = c;
    }
  }

  // Month labels at top of weeks
  const monthLabels: { idx: number; label: string }[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const sample = grid[0][w] || grid[1][w] || grid[2][w];
    if (!sample) continue;
    const m = new Date(sample.date).getMonth();
    if (m !== prevMonth) {
      monthLabels.push({ idx: w, label: UZ_MONTHS_SHORT[m] });
      prevMonth = m;
    }
  }

  const dayLabels = ["", "Du", "", "Ch", "", "Ju", ""];

  function intensity(v: number): number {
    if (v <= 0) return 0;
    const r = v / max;
    if (r < 0.15) return 1;
    if (r < 0.35) return 2;
    if (r < 0.65) return 3;
    return 4;
  }

  return (
    <div className="dx-heat">
      <div className="dx-heat-months">
        <div className="dx-heat-spacer" />
        <div className="dx-heat-months-row">
          {monthLabels.map((m, i) => (
            <span key={i} className="dx-heat-month" style={{ left: `${m.idx * 16}px` }}>{m.label}</span>
          ))}
        </div>
      </div>
      <div className="dx-heat-body">
        <div className="dx-heat-days">
          {dayLabels.map((l, i) => <div key={i} className="dx-heat-day-label">{l}</div>)}
        </div>
        <div className="dx-heat-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>
          {Array.from({ length: 7 }).flatMap((_, day) =>
            Array.from({ length: weeks }).map((_, w) => {
              const c = grid[day][w];
              const lvl = c ? intensity(c.amount) : -1;
              return (
                <div key={`${day}-${w}`}
                  className={`dx-heat-cell dx-heat-l${lvl >= 0 ? lvl : 0}`}
                  title={c ? `${c.date}: ${c.amount} (${c.logCount})` : ""}
                />
              );
            })
          )}
        </div>
      </div>
      <div className="dx-heat-legend">
        <span className="dx-heat-legend-label">Kam</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className={`dx-heat-cell dx-heat-l${l}`} />)}
        <span className="dx-heat-legend-label">Ko&apos;p</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRIORITY MINI BARS
═══════════════════════════════════════════════════════════════════ */

function PriorityBars({ data }: { data: { priority: Priority; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="dx-pri-list">
      {data.map((d, i) => (
        <div key={i} className="dx-pri-row">
          <span className={`dx-pri-dot dxp-${priorityClass(d.priority)}`} />
          <span className="dx-pri-label">{d.label}</span>
          <div className="dx-pri-track">
            <div className={`dx-pri-fill dxp-${priorityClass(d.priority)}`}
              style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="dx-pri-num">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MANUFACTURING PROGRESS (cards with progress)
═══════════════════════════════════════════════════════════════════ */

function MfgProgressList({ items }: { items: ManufacturingProgress[] }) {
  if (items.length === 0) {
    return <div className="dx-empty"><Ico.CheckCircle /><span>Hozircha ishlab chiqarishda mahsulot yo&apos;q</span></div>;
  }
  return (
    <div className="dx-mfg-list">
      {items.map((m, i) => {
        const pct = Math.min(100, Math.max(0, m.progressPercent));
        const cls = pct >= 80 ? "success" : pct >= 40 ? "accent" : "warn";
        return (
          <div key={m.id} className={`dx-mfg-item dx-fadein-${Math.min(i, 5)}`}>
            <div className="dx-mfg-top">
              <div className="dx-mfg-info">
                <div className="dx-mfg-name">{m.name}</div>
                <div className="dx-mfg-meta">
                  {m.code && <span className="dx-mfg-code">{m.code}</span>}
                  {m.contractNo && <span className="dx-mfg-contract">{m.contractNo}</span>}
                  {m.departmentName && <span className="dx-mfg-dept">{m.departmentName}</span>}
                </div>
              </div>
              <div className={`dx-mfg-pct dxc-${cls}`}>{Math.round(pct)}%</div>
            </div>
            <div className="dx-mfg-track">
              <div className={`dx-mfg-fill dxc-${cls}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="dx-mfg-foot">
              <span className="dx-mfg-qty">{m.producedQuantity.toLocaleString()} / {m.quantity.toLocaleString()} {unitLabel(m.unit)}</span>
              <span className="dx-mfg-status">
                {m.status === ManufacturingStatus.Completed ? "Yakunlandi" : "Jarayonda"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DEADLINE LIST
═══════════════════════════════════════════════════════════════════ */

function DeadlineList({ items, onClick }: { items: UpcomingDeadline[]; onClick?: () => void }) {
  if (items.length === 0) {
    return <div className="dx-empty"><Ico.CheckCircle /><span>Yaqin deadline yo&apos;q</span></div>;
  }
  return (
    <div className="dx-dl-list">
      {items.map((c, i) => {
        const urg = deadlineUrgency(c.daysRemaining);
        return (
          <div key={c.id} className={`dx-dl-item dx-fadein-${Math.min(i, 5)} dxd-${urg}`} onClick={onClick}>
            <div className={`dx-dl-bar dxd-${urg}`} />
            <div className="dx-dl-left">
              <div className="dx-dl-top">
                <span className="dx-dl-no">{c.contractNo}</span>
                <span className={`dx-dl-prio dxp-${priorityClass(c.priority)}`}>{priorityLabel(c.priority)}</span>
              </div>
              <div className="dx-dl-party">{c.contractParty}</div>
              {c.primaryProduct && <div className="dx-dl-product">{c.primaryProduct}</div>}
              <div className="dx-dl-prog">
                <div className="dx-dl-prog-track">
                  <div className="dx-dl-prog-fill" style={{ width: `${c.overallProgress}%` }} />
                </div>
                <span className="dx-dl-prog-num">{Math.round(c.overallProgress)}%</span>
              </div>
            </div>
            <div className="dx-dl-right">
              <div className={`dx-dl-days dxd-${urg}`}>
                {urg === "passed" ? `${Math.abs(c.daysRemaining)} kun o'tdi` :
                 c.daysRemaining === 0 ? "Bugun" :
                 `${c.daysRemaining} kun`}
              </div>
              <div className="dx-dl-date">{formatUzDate(new Date(c.endDate), "short")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY FEED
═══════════════════════════════════════════════════════════════════ */

function ActivityFeed({ items }: { items: RecentActivity[] }) {
  // Live "X minutes ago" — refreshes once per minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) {
    return <div className="dx-empty"><Ico.CheckCircle /><span>Faollik yo&apos;q</span></div>;
  }

  function relTime(at: string): string {
    const diff = (now - new Date(at).getTime()) / 1000;
    if (diff < 60) return "hozir";
    if (diff < 3600) return `${Math.floor(diff / 60)} daq`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} kun`;
    const d = new Date(at);
    return `${d.getDate()}-${UZ_MONTHS_SHORT[d.getMonth()]}`;
  }

  function kindIcon(k: string) {
    switch (k) {
      case "contract":     return <Ico.File />;
      case "task-log":     return <Ico.Activity />;
      case "shipment":     return <Ico.Truck />;
      case "manufactured": return <Ico.Factory />;
      default:             return <Ico.Box />;
    }
  }
  function kindClass(k: string) {
    switch (k) {
      case "contract":     return "indigo";
      case "task-log":     return "accent";
      case "shipment":     return "success";
      case "manufactured": return "purple";
      default:             return "neutral";
    }
  }

  return (
    <div className="dx-feed">
      {items.map((a, i) => (
        <div key={i} className={`dx-feed-item dx-fadein-${Math.min(i, 5)}`}>
          <div className={`dx-feed-icon dxc-${kindClass(a.kind)}`}>{kindIcon(a.kind)}</div>
          <div className="dx-feed-body">
            <div className="dx-feed-title">{a.title}</div>
            <div className="dx-feed-meta">
              {a.subtitle && <span className="dx-feed-sub">{a.subtitle}</span>}
              {a.actorName && <span className="dx-feed-actor">· {a.actorName}</span>}
            </div>
          </div>
          <div className="dx-feed-time">{relTime(a.at)}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TOP PERFORMERS
═══════════════════════════════════════════════════════════════════ */

function TopPerformers({ items }: { items: TopPerformer[] }) {
  if (items.length === 0) return <div className="dx-empty"><Ico.Trophy /><span>Ma&apos;lumot yo&apos;q</span></div>;
  const max = Math.max(1, ...items.map(p => Number(p.totalAmount)));
  return (
    <div className="dx-perf-list">
      {items.map((p, i) => (
        <div key={p.userId} className={`dx-perf-item dx-fadein-${Math.min(i, 4)}`}>
          <div className={`dx-perf-rank dxr-${i}`}>{i + 1}</div>
          <div className="dx-perf-info">
            <div className="dx-perf-name">{p.fullName.trim() || "—"}</div>
            <div className="dx-perf-dept">{p.departmentName || "Bo'limsiz"}</div>
            <div className="dx-perf-track">
              <div className="dx-perf-fill" style={{ width: `${(Number(p.totalAmount) / max) * 100}%` }} />
            </div>
          </div>
          <div className="dx-perf-stats">
            <div className="dx-perf-num">{formatNum(Number(p.totalAmount))}</div>
            <div className="dx-perf-cap">{p.logCount} yozuv</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PERIOD BAR
═══════════════════════════════════════════════════════════════════ */

function PeriodBar({
  preset, setPreset, customRange, setCustomRange,
  presetOpen, setPresetOpen, range, rangeDays, refreshing,
}: {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customRange: { from: string; to: string };
  setCustomRange: (r: { from: string; to: string }) => void;
  presetOpen: boolean;
  setPresetOpen: (b: boolean) => void;
  range: { from: string; to: string };
  rangeDays: number;
  refreshing: boolean;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!presetOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [presetOpen, setPresetOpen]);

  const presets: PeriodPreset[] = ["today", "week", "month", "30d", "90d", "custom"];

  return (
    <section className="dx-period-bar">
      <div className="dx-period-cap">
        <Ico.Calendar />
        <span className="dx-period-cap-label">Davr ko&apos;rsatkichlari</span>
      </div>

      <div className="dx-period-controls">
        <div className="dx-period-dd" ref={dropdownRef}>
          <button
            className="dx-period-btn"
            onClick={() => setPresetOpen(!presetOpen)}
            aria-expanded={presetOpen}
          >
            <span className="dx-period-btn-label">{PERIOD_LABELS[preset]}</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"
                 viewBox="0 0 24 24"
                 style={{ transform: presetOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {presetOpen && (
            <div className="dx-period-menu">
              {presets.map(p => (
                <button
                  key={p}
                  className={`dx-period-menu-item ${preset === p ? "dx-active" : ""}`}
                  onClick={() => { setPreset(p); if (p !== "custom") setPresetOpen(false); }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
              {preset === "custom" && (
                <div className="dx-period-custom">
                  <label>
                    <span>Boshlanish</span>
                    <input
                      type="date"
                      value={customRange.from}
                      max={customRange.to || undefined}
                      onChange={e => setCustomRange({ ...customRange, from: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Tugash</span>
                    <input
                      type="date"
                      value={customRange.to}
                      min={customRange.from || undefined}
                      onChange={e => setCustomRange({ ...customRange, to: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dx-period-range">
          <span className="dx-period-range-text">
            {range.from && range.to ? formatRangeShort(range.from, range.to) : "—"}
          </span>
          <span className="dx-period-range-days">{rangeDays || 0} kun</span>
        </div>

        {refreshing && (
          <div className="dx-period-refresh">
            <div className="nd-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
            <span>Yangilanmoqda...</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [presetOpen, setPresetOpen] = useState(false);

  const range = useMemo<{ from: string; to: string }>(() => {
    if (preset === "custom" && customRange.from && customRange.to) return customRange;
    return rangeFromPreset(preset === "custom" ? "month" : preset);
  }, [preset, customRange]);

  const loadSummary = useCallback(async () => {
    if (!accessToken) return;
    try {
      setErr(null);
      setRefreshing(true);
      const summary = await dashboardService.getSummary({ from: range.from, to: range.to });
      setData(summary);
      setRefreshNonce((n) => n + 1);
    } catch {
      setErr("Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, range.from, range.to]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Animated KPI counters (called unconditionally)
  const k = data?.kpis;
  // State (always-now)
  const animActive     = useCountUp(k?.activeContracts ?? 0,        1400, 0,   refreshNonce);
  const animMfgDone    = useCountUp(k?.manufacturedCompleted ?? 0,  1400, 120, refreshNonce);
  const animMfgIp      = useCountUp(k?.manufacturedInProgress ?? 0, 1400, 240, refreshNonce);
  const animEmployees  = useCountUp(k?.totalEmployees ?? 0,         1400, 360, refreshNonce);

  const greeting = getGreeting();
  const today = new Date();
  const firstName = user?.firstName || user?.login || "";

  if (loading) {
    return (
      <div className="dx-loading">
        <div className="dx-loading-inner">
          <div className="nd-spinner" />
          Ma&apos;lumotlar tayyorlanmoqda...
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="dx-loading">
        <div className="dx-loading-inner">
          <Ico.Alert />
          {err || "Xato"}
        </div>
      </div>
    );
  }

  return (
    <div className="dx-wrap page-transition">
      <AnimatedBg />

      {/* ─── HERO ─── */}
      <section className="dx-hero">
        <div className="dx-hero-aurora" />
        <div className="dx-hero-grid" />

        <div className="dx-hero-top">
          <div className="dx-hero-greet-block">
            <div className="dx-hero-greeting">
              <span className="dx-hero-icon">{getGreetingIcon(greeting.icon)}</span>
              <span>{greeting.text},</span>
            </div>
            <h1 className="dx-hero-name">{firstName}</h1>
            <p className="dx-hero-sub">Bugungi tashkilot holati va ishlab chiqarish ko&apos;rsatkichlari</p>
          </div>
          <div className="dx-hero-meta">
            <div className="dx-hero-meta-row">
              <button
                className="btn-icon"
                onClick={() => { void loadSummary(); }}
                disabled={refreshing}
                title="Yangilash"
                aria-label="Yangilash"
                style={{
                  background: "var(--accent-dim)",
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  width: 36,
                  height: 36,
                }}
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={refreshing ? "dx-hero-refresh-spin" : ""}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <div className="dx-hero-date">
                <Ico.Calendar />
                <span>{formatUzDate(today)}</span>
              </div>
            </div>
            {user?.role && <div className="dx-hero-role">{user.role}</div>}
          </div>
        </div>

        {/* ALWAYS-NOW state strip — period-independent metrics */}
        <div className="dx-state-strip">
          <div className="dx-state-strip-cap">
            <span className="dx-hero-block-dot dxc-warn" />
            Hozirgi holat <span className="dx-state-strip-note">davrga bog&apos;liq emas</span>
          </div>
          <div className="dx-state-strip-tiles">
            <button
              className="dx-mini-tile dxm-accent"
              onClick={() => router.push("/contracts")}
              aria-label="Faol shartnomalar"
            >
              <div className="dx-mini-icon"><Ico.Zap /></div>
              <div className="dx-mini-val">{animActive}</div>
              <div className="dx-mini-lbl">Faol shartnoma</div>
            </button>
            <button
              className="dx-mini-tile dxm-success"
              onClick={() => router.push("/manufactured")}
              aria-label="Tayyor mahsulotlar"
            >
              <div className="dx-mini-icon"><Ico.CheckCircle /></div>
              <div className="dx-mini-val">{animMfgDone}</div>
              <div className="dx-mini-lbl">Tayyor mahsulot</div>
            </button>
            <button
              className="dx-mini-tile dxm-purple"
              onClick={() => router.push("/manufactured")}
              aria-label="Ishlab chiqarishda"
            >
              <div className="dx-mini-icon"><Ico.Factory /></div>
              <div className="dx-mini-val">{animMfgIp}</div>
              <div className="dx-mini-lbl">Ishlab chiqarishda</div>
            </button>
            <button
              className="dx-mini-tile dxm-cyan"
              onClick={() => router.push("/users")}
              aria-label="Xodimlar"
            >
              <div className="dx-mini-icon"><Ico.Users /></div>
              <div className="dx-mini-val">{animEmployees}</div>
              <div className="dx-mini-lbl">Xodimlar <span className="dx-mini-sub">{k?.activeDepartments ?? 0} bo&apos;lim</span></div>
            </button>
          </div>
        </div>
      </section>

      {/* ─── PERIOD BAR ─── */}
      <PeriodBar
        preset={preset}
        setPreset={setPreset}
        customRange={customRange}
        setCustomRange={setCustomRange}
        presetOpen={presetOpen}
        setPresetOpen={setPresetOpen}
        range={range}
        rangeDays={k?.rangeDays ?? 0}
        refreshing={refreshing}
      />

      {/* ─── 2-COLUMN: TREND CHART + DONUT ─── */}
      <section className="dx-row dx-row-2-1">
        <RevealSection key={`trend-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Activity />
            <h3 className="dx-section-title">Ishlab chiqarish va jo&apos;natma dinamikasi</h3>
            <span className="dx-section-meta">oxirgi 30 kun</span>
            <div className="dx-section-legend">
              <span className="dx-legend-dot" style={{ background: "var(--accent)" }} /> Ishlab chiqarish
              <span className="dx-legend-dot" style={{ background: "var(--success)", marginLeft: 12 }} /> Jo&apos;natmalar
            </div>
          </div>
          <DualAreaChart prod={data.productionTrend} ship={data.shipmentTrend} />
        </RevealSection>

        <RevealSection key={`bubble-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Box />
            <h3 className="dx-section-title">Shartnomalar holati</h3>
          </div>
          <BubbleChart data={data.contractStatus} />
        </RevealSection>
      </section>

      {/* ─── 2-COLUMN: DEPT WORKLOAD + PRIORITY ─── */}
      <section className="dx-row dx-row-2-1">
        <RevealSection key={`hbar-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Building />
            <h3 className="dx-section-title">Bo&apos;limlar yuklamasi</h3>
            <span className="dx-section-meta">faol shartnoma + ishlab chiqarish</span>
            <div className="dx-section-legend">
              <span className="dx-legend-dot" style={{ background: "var(--accent)" }} /> Shartnoma
              <span className="dx-legend-dot" style={{ background: "var(--purple)", marginLeft: 12 }} /> Mahsulot
            </div>
          </div>
          <HBarList data={data.departmentWorkload} />
        </RevealSection>

        <RevealSection key={`priority-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Zap />
            <h3 className="dx-section-title">Muhimlik darajasi</h3>
            <span className="dx-section-meta">faol shartnomalar</span>
          </div>
          <PriorityBars data={data.priorityDistribution} />
          <div className="dx-section-divider" />
          <div className="dx-section-header" style={{ marginTop: 16 }}>
            <Ico.Trophy />
            <h3 className="dx-section-title">Top ishchilar</h3>
            <span className="dx-section-meta">30 kun</span>
          </div>
          <TopPerformers items={data.topPerformers} />
        </RevealSection>
      </section>

      {/* ─── HEATMAP (full row) ─── */}
      <RevealSection key={`heatmap-${refreshNonce}`} as="section" className="dx-section">
        <div className="dx-section-header">
          <Ico.Activity />
          <h3 className="dx-section-title">Faollik xaritasi</h3>
          <span className="dx-section-meta">12 hafta · kunlik yozuvlar</span>
        </div>
        <Heatmap cells={data.activityHeatmap} />
      </RevealSection>

      {/* ─── 3-COLUMN: DEADLINES + MFG + ACTIVITY ─── */}
      <section className="dx-row dx-row-3">
        <RevealSection key={`deadlines-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Clock />
            <h3 className="dx-section-title">Yaqinlashayotgan deadlinelar</h3>
            <button type="button" className="dx-section-link" onClick={() => router.push("/contracts")}>
              Hammasi <Ico.ArrowRight />
            </button>
          </div>
          <DeadlineList items={data.upcomingDeadlines} onClick={() => router.push("/contracts")} />
        </RevealSection>

        <RevealSection key={`mfg-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Factory />
            <h3 className="dx-section-title">Mahsulot ishlab chiqarish progressi</h3>
          </div>
          <MfgProgressList items={data.manufacturingProgress} />
        </RevealSection>

        <RevealSection key={`activity-${refreshNonce}`} className="dx-section">
          <div className="dx-section-header">
            <Ico.Activity />
            <h3 className="dx-section-title">So&apos;nggi faollik</h3>
          </div>
          <ActivityFeed items={data.recentActivity} />
        </RevealSection>
      </section>
    </div>
  );
}
