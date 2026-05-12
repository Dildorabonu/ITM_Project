"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  PieChart:   () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  Search:     () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  X:          () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
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
   COMPLETION PIE CHART (production vs shipment summary)
═══════════════════════════════════════════════════════════════════ */

function CompletionPieChart({
  contracted, produced, batched,
}: {
  contracted: number;
  produced: number;
  batched: number;
}) {
  const producedClamped = Math.min(Math.max(0, produced), Math.max(0, contracted));
  const batchedClamped  = Math.min(Math.max(0, batched), producedClamped);
  const notProduced     = Math.max(0, contracted - producedClamped);
  const notBatched      = Math.max(0, producedClamped - batchedClamped);

  const [animKey, setAnimKey] = useState(0);
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    setAnimKey(k => k + 1);
  }, [contracted, produced, batched]);

  const leaderTextRefs = useRef<(SVGTextElement | null)[]>([]);
  const [leaderTextWidths, setLeaderTextWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    setLeaderTextWidths(prev => {
      const next: number[] = [];
      let changed = false;
      leaderTextRefs.current.forEach((el, i) => {
        if (el) {
          const w = el.getComputedTextLength();
          next[i] = w;
          if (prev[i] !== w) changed = true;
        }
      });
      const prevLen = prev.filter(v => v !== undefined).length;
      const nextLen = next.filter(v => v !== undefined).length;
      if (!changed && prevLen === nextLen) return prev;
      return next;
    });
  });

  const slices = [
    { label: "Partiyalangan",       value: batchedClamped, solid: "#10b981" },
    { label: "Partiyalanmagan",     value: notBatched,     solid: "#1a6eeb" },
    { label: "Ishlab chiqarilmagan", value: notProduced,   solid: "#4b5563" },
  ];
  const sum = slices.reduce((s, x) => s + x.value, 0);

  const size = 200;
  const cx = size / 2, cy = size / 2;
  const r  = size / 2 - 6;

  type Seg = { d: string; hitD: string; mid: number; pct: number; label: string; solid: string; value: number };
  const segments: Seg[] = (() => {
    if (sum === 0) return [];
    const visibleCount = slices.filter(x => x.value > 0).length;
    let acc = 0;
    return slices.filter(s => s.value > 0).map((s) => {
      const start = (acc / sum) * Math.PI * 2 - Math.PI / 2;
      acc += s.value;
      const end   = (acc / sum) * Math.PI * 2 - Math.PI / 2;
      const mid   = (start + end) / 2;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(start) * r;
      const y1 = cy + Math.sin(start) * r;
      const x2 = cx + Math.cos(end)   * r;
      const y2 = cy + Math.sin(end)   * r;
      const isFull = visibleCount === 1;
      const d = isFull
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;

      const span    = end - start;
      const anglePad = Math.min(0.05, span * 0.2);
      const sHit    = start + anglePad;
      const eHit    = end   - anglePad;
      const rHit    = r * 0.96;
      const rInner  = r * 0.08;
      const largeHit = eHit - sHit > Math.PI ? 1 : 0;
      const xh1 = cx + Math.cos(sHit) * rHit;
      const yh1 = cy + Math.sin(sHit) * rHit;
      const xh2 = cx + Math.cos(eHit) * rHit;
      const yh2 = cy + Math.sin(eHit) * rHit;
      const xi1 = cx + Math.cos(sHit) * rInner;
      const yi1 = cy + Math.sin(sHit) * rInner;
      const xi2 = cx + Math.cos(eHit) * rInner;
      const yi2 = cy + Math.sin(eHit) * rInner;
      const hitD = isFull
        ? `M ${cx} ${cy - rHit} A ${rHit} ${rHit} 0 1 1 ${cx - 0.01} ${cy - rHit} Z`
        : `M ${xi1} ${yi1} L ${xh1} ${yh1} A ${rHit} ${rHit} 0 ${largeHit} 1 ${xh2} ${yh2} L ${xi2} ${yi2} A ${rInner} ${rInner} 0 ${largeHit} 0 ${xi1} ${yi1} Z`;

      return { d, hitD, mid, pct: Math.round((s.value / sum) * 100), label: s.label, solid: s.solid, value: s.value };
    });
  })();

  const LEADER_OUT = 64;

  return (
    <div className="dx-pie-wrap">
      <div className="dx-pie-svg-wrap">
        <svg viewBox={`-150 -80 ${size + 300} ${size + 160}`} className="dx-pie-svg" overflow="visible">
          {sum === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
          ) : (
            segments.map((seg, i) => {
              const dxN = Math.cos(seg.mid);
              const dyN = Math.sin(seg.mid);
              const startX = cx + dxN * (r - 1);
              const startY = cy + dyN * (r - 1);
              const elbowX = cx + dxN * (r + LEADER_OUT);
              const elbowY = cy + dyN * (r + LEADER_OUT);
              const isRight = dxN >= 0;
              const valueText = seg.value.toLocaleString("en-US").replace(/,/g, " ");
              const measuredWidth = leaderTextWidths[i];
              const fallbackWidth = valueText.split("").reduce((w, c) => w + (c === " " ? 5 : 11), 0);
              const textWidth = measuredWidth ?? fallbackWidth;
              const DOT_GAP = 3;
              const tail = textWidth + DOT_GAP ;
              const tipX = elbowX + (isRight ? tail : -tail);
              const tipY = elbowY;
              const textX = isRight ? tipX - DOT_GAP : tipX + DOT_GAP;
              const lineLen = Math.hypot(elbowX - startX, elbowY - startY) + Math.abs(tipX - elbowX);
              return (
                <g key={`${animKey}-${i}`} className="dx-pie-slice" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${cx}px ${cy}px` }}>
                  <g
                    className="dx-pie-slice-inner"
                    style={{
                      ["--slice-tx" as never]: `${dxN * 10}px`,
                      ["--slice-ty" as never]: `${dyN * 10}px`,
                    } as React.CSSProperties}
                  >
                    <path className="dx-pie-slice-visual" d={seg.d} fill={seg.solid} stroke="var(--surface)" strokeWidth="2" />
                    {seg.pct >= 8 && (
                      <text
                        className="dx-pie-slice-label"
                        x={cx + dxN * (r * 0.62)}
                        y={cy + dyN * (r * 0.62)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="16"
                        fontWeight="800"
                        style={{ fontFamily: "var(--font-mono)", pointerEvents: "none", userSelect: "none" }}
                      >
                        {seg.pct}%
                      </text>
                    )}
                    <g className="dx-pie-leader" pointerEvents="none">
                      <polyline
                        className="dx-pie-leader-line"
                        points={`${startX},${startY} ${elbowX},${elbowY} ${tipX},${tipY}`}
                        fill="none"
                        stroke={seg.solid}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ ["--line-len" as never]: lineLen } as React.CSSProperties}
                      />
                      <circle cx={tipX} cy={tipY} r="3.6" fill={seg.solid} />
                      <text
                        ref={(el) => { leaderTextRefs.current[i] = el; }}
                        x={textX}
                        y={tipY - 6}
                        textAnchor={isRight ? "end" : "start"}
                        dominantBaseline="alphabetic"
                        fill="var(--text)"
                        fontSize="18"
                        fontWeight="800"
                        style={{ fontFamily: "var(--font-mono)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
                      >
                        {valueText}
                      </text>
                    </g>
                    <path className="dx-pie-slice-hit" d={seg.hitD} fill="transparent" />
                  </g>
                </g>
              );
            })
          )}
        </svg>
      </div>

      <div className="dx-pie-legend">
        {slices.map((s) => {
          const pct = sum > 0 ? Math.round((s.value / sum) * 100) : 0;
          const valueText = s.value.toLocaleString("en-US").replace(/,/g, " ");
          return (
            <div
              key={s.label}
              className="dx-pie-legend-item"
              style={{ ["--legend-color" as never]: s.solid } as React.CSSProperties}
            >
              <div className="dx-pie-legend-top">
                <span className="dx-pie-legend-dot" />
                <span className="dx-pie-legend-label">{s.label}</span>
              </div>
              <div className="dx-pie-legend-bot">
                <span className="dx-pie-legend-value">{valueText}</span>
                <span className="dx-pie-legend-pct">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const realData = prod.map((p, i) => ({ date: p.date, prod: p.amount, ship: ship[i]?.amount ?? 0, future: false }));
  const FUTURE_DAYS = 3;
  const data = (() => {
    if (realData.length === 0) return realData;
    const last = new Date(realData[realData.length - 1].date);
    const tail = Array.from({ length: FUTURE_DAYS }, (_, k) => {
      const d = new Date(last);
      d.setDate(d.getDate() + k + 1);
      return { date: d.toISOString(), prod: 0, ship: 0, future: true };
    });
    return [...realData, ...tail];
  })();

  // Content-based change detector — array reference changes on every load
  // even when the underlying values (last 30 days) didn't change. Avoid
  // replaying the line/area animation unless the numbers themselves move.
  const dataKey = useMemo(() =>
    prod.map(p => `${p.date}:${p.amount}`).join("|") + "::" +
    ship.map(p => `${p.date}:${p.amount}`).join("|"),
    [prod, ship]
  );
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setAnimKey((k) => k + 1);
  }, [dataKey]);

  if (data.length === 0) return null;

  const W = 800;
  const H = height;
  const padL = 44, padR = 14, padT = 18, padB = 28;
  const cw = W - padL - padR;
  const ch = H - padT - padB;
  const maxVal = Math.max(1, ...realData.map(d => Math.max(d.prod, d.ship)));

  const xAt = (i: number) => padL + (i / Math.max(1, data.length - 1)) * cw;
  const yAt = (v: number) => padT + ch - (v / maxVal) * ch;

  const buildSmooth = (key: "prod" | "ship") => {
    const lineData = realData.length > 0 && data.length > realData.length
      ? [...realData, data[realData.length]]
      : realData;
    const pts = lineData.map((d, i) => ({ x: xAt(i), y: yAt(d[key]) }));
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
  const lastRealIdx = Math.max(0, realData.length - 1);
  const lineEndIdx = Math.min(data.length - 1, realData.length);
  const prodArea = `${prodLine} L${xAt(lineEndIdx)},${padT + ch} L${padL},${padT + ch} Z`;
  const shipArea = `${shipLine} L${xAt(lineEndIdx)},${padT + ch} L${padL},${padT + ch} Z`;

  const grid = 4;
  const xLabelCount = Math.min(realData.length, 10);
  const step = Math.max(1, Math.floor(realData.length / xLabelCount));

  // Guard against stale hover index after the trend range shrinks.
  const validHover =
    hover !== null && hover < data.length && !data[hover].future ? hover : null;

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
          if (d.future && i !== lineEndIdx) return null;
          if (!d.future && i % step !== 0) return null;
          const x = xAt(i);
          const date = new Date(d.date);
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fill="var(--text3)" fontSize="10">
              {`${date.getDate()}/${date.getMonth() + 1}`}
            </text>
          );
        })}

        {validHover !== null && (
          <g>
            <line x1={xAt(validHover)} y1={padT} x2={xAt(validHover)} y2={padT + ch}
              stroke="var(--text3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <circle cx={xAt(validHover)} cy={yAt(data[validHover].prod)} r="3.5"
              fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
            <circle cx={xAt(validHover)} cy={yAt(data[validHover].ship)} r="3.5"
              fill="var(--surface)" stroke="var(--success)" strokeWidth="2" />
          </g>
        )}

        {data.map((d, i) => {
          if (d.future) return null;
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

      {validHover !== null && (() => {
        const x = xAt(validHover);
        const date = new Date(data[validHover].date);
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
              <span className="dx-tooltip-val">{data[validHover].prod.toLocaleString()}</span>
            </div>
            <div className="dx-tooltip-row">
              <span className="dx-tooltip-dot" style={{ background: "var(--success)" }} />
              <span className="dx-tooltip-label">Jo&apos;natma</span>
              <span className="dx-tooltip-val">{data[validHover].ship.toLocaleString()}</span>
            </div>
          </div>
        );
      })()}

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

  // Content-based change detector — the data array reference changes on every
  // load even when the underlying status counts haven't moved. Avoid replaying
  // the bubble pop animation unless a count actually changes.
  const dataKey = useMemo(() =>
    data.map(d => `${d.status}:${d.count}`).join("|"),
    [data]
  );

  // Reset physics whenever data content actually changes
  useEffect(() => {
    physRef.current = initialPositions.map(p => ({ ...p }));
    dragRef.current = null;
    setPopKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

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
      </div>
      {data.slice(0, 8).map((d, i) => {
        const total = d.activeContracts + d.activeManufactured;
        const pct = (total / max) * 100;
        const contractPct = total > 0 ? (d.activeContracts / total) * 100 : 0;
        const typeChip = d.type === DepartmentType.IshlabChiqarish ? "production"
                       : d.type === DepartmentType.Boshqaruv      ? "admin" : "section";
        const typeLabel = DEPARTMENT_TYPE_LABELS[d.type];
        return (
          <div
            key={d.id}
            className={`dx-hbar-row dx-fadein-${Math.min(i, 5)}`}
          >
            <div className="dx-hbar-left">
              <span className={`dx-hbar-chip dxc-${typeChip}`} />
              <span className="dx-hbar-name">{d.name}</span>
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

            <div className="dx-hbar-tip" role="tooltip">
              <div className="dx-hbar-tip-head">
                <span className={`dx-hbar-chip dxc-${typeChip}`} />
                <span className="dx-hbar-tip-name">{d.name}</span>
                <span className="dx-hbar-tip-type">{typeLabel}</span>
              </div>
              <div className="dx-hbar-tip-grid">
                <div className="dx-hbar-tip-stat">
                  <span className="dx-hbar-tip-label">Xodimlar</span>
                  <span className="dx-hbar-tip-val">{d.employeeCount}</span>
                </div>
                <div className="dx-hbar-tip-stat">
                  <span className="dx-hbar-tip-label">Jami yuk</span>
                  <span className="dx-hbar-tip-val">{total}</span>
                </div>
                <div className="dx-hbar-tip-stat">
                  <span className="dx-hbar-tip-label">Shartnoma</span>
                  <span className="dx-hbar-tip-val dx-hbar-tip-val-c">{d.activeContracts}</span>
                </div>
                <div className="dx-hbar-tip-stat">
                  <span className="dx-hbar-tip-label">Mahsulot</span>
                  <span className="dx-hbar-tip-val dx-hbar-tip-val-m">{d.activeManufactured}</span>
                </div>
              </div>
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

  // Group consecutive weeks by month — each block renders independently with a gap between them
  type MonthBlock = { month: number; label: string; weekIndices: number[] };
  const blocks: MonthBlock[] = [];
  for (let w = 0; w < weeks; w++) {
    let sample: HeatmapCell | undefined;
    for (let d = 0; d < 7; d++) {
      if (grid[d][w]) { sample = grid[d][w]; break; }
    }
    if (!sample) continue;
    const m = new Date(sample.date).getMonth();
    const last = blocks[blocks.length - 1];
    if (last && last.month === m) {
      last.weekIndices.push(w);
    } else {
      blocks.push({ month: m, label: UZ_MONTHS_SHORT[m], weekIndices: [w] });
    }
  }

  const dayLabels = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

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
      <div className="dx-heat-body">
        <div className="dx-heat-days">
          <div className="dx-heat-day-spacer" />
          {dayLabels.map((l, i) => <div key={i} className="dx-heat-day-label">{l}</div>)}
        </div>
        <div className="dx-heat-months">
          {blocks.map((b, bi) => (
            <div key={bi} className="dx-heat-month-block">
              <div className="dx-heat-month-label">{b.label}</div>
              <div
                className="dx-heat-grid"
                style={{ gridTemplateColumns: `repeat(${b.weekIndices.length}, 12px)` }}
              >
                {b.weekIndices.flatMap((w) =>
                  Array.from({ length: 7 }).map((_, day) => {
                    const c = grid[day][w];
                    const lvl = c ? intensity(c.amount) : -1;
                    return (
                      <div
                        key={`${day}-${w}`}
                        className={`dx-heat-cell dx-heat-l${lvl >= 0 ? lvl : 0}`}
                        title={c ? `${c.date}: ${c.amount} (${c.logCount})` : ""}
                      />
                    );
                  })
                )}
              </div>
            </div>
          ))}
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

function DeadlineList({ items, onClick, variant = "list" }: { items: UpcomingDeadline[]; onClick?: () => void; variant?: "list" | "grid" }) {
  if (items.length === 0) {
    return <div className="dx-empty"><Ico.CheckCircle /><span>Yaqin deadline yo&apos;q</span></div>;
  }
  return (
    <div className={variant === "grid" ? "dx-dl-list dx-dl-list-grid" : "dx-dl-list"}>
      {items.map((c, i) => {
        const urg = deadlineUrgency(c.daysRemaining);
        const days = Math.abs(c.daysRemaining);
        const dayBig =
          urg === "passed" ? days :
          c.daysRemaining === 0 ? 0 :
          c.daysRemaining;
        const dayLabel =
          urg === "passed" ? "kun o'tdi" :
          c.daysRemaining === 0 ? "bugun" :
          c.daysRemaining === 1 ? "kun qoldi" : "kun qoldi";
        const progress = Math.max(0, Math.min(100, c.overallProgress));
        return (
          <div
            key={c.id}
            className={`dx-dl-item dx-fadein-${Math.min(i, 5)} dxd-${urg}`}
            onClick={onClick}
          >
            <div className={`dx-dl-bar dxd-${urg}`} />
            <div className={`dx-dl-glow dxd-${urg}`} aria-hidden />

            <div className="dx-dl-head">
              <div className="dx-dl-head-left">
                <span className="dx-dl-no">{c.contractNo}</span>
                <span className={`dx-dl-prio dxp-${priorityClass(c.priority)}`}>
                  {priorityLabel(c.priority)}
                </span>
              </div>
              <div className={`dx-dl-date-chip dxd-${urg}`}>
                <Ico.Calendar />
                <span>{formatUzDate(new Date(c.endDate), "short")}</span>
              </div>
            </div>

            <div className="dx-dl-body">
              <div className="dx-dl-info">
                <div className="dx-dl-party" title={c.contractParty}>{c.contractParty}</div>
                {c.primaryProduct && (
                  <div className="dx-dl-product" title={c.primaryProduct}>
                    <Ico.Box />
                    <span>{c.primaryProduct}</span>
                  </div>
                )}
              </div>

              <div className={`dx-dl-countdown dxd-${urg}`}>
                <div className="dx-dl-countdown-ring">
                  {urg === "critical" || urg === "passed" ? (
                    <span className="dx-dl-pulse" aria-hidden />
                  ) : null}
                  <span className="dx-dl-day-num">{dayBig}</span>
                </div>
                <span className="dx-dl-day-cap">{dayLabel}</span>
              </div>
            </div>

            <div className="dx-dl-prog">
              <div className="dx-dl-prog-head">
                <span className="dx-dl-prog-lbl">Bajarilgan</span>
                <span className={`dx-dl-prog-num dxd-${urg}`}>{Math.round(progress)}%</span>
              </div>
              <div className="dx-dl-prog-track">
                <div className={`dx-dl-prog-fill dxd-${urg}`} style={{ width: `${progress}%` }} />
              </div>
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
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("uz");
    if (!q) return items;
    return items.filter(a => {
      const hay = `${a.title} ${a.subtitle ?? ""} ${a.actorName ?? ""} ${a.kind}`.toLocaleLowerCase("uz");
      return hay.includes(q);
    });
  }, [items, query]);

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
    <div className="dx-feed-wrap">
      <div className="dx-feed-search">
        <span className="dx-feed-search-icon"><Ico.Search /></span>
        <input
          type="text"
          className="dx-feed-search-input"
          placeholder="Faollikni qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Faollikni qidirish"
        />
        {query && (
          <button
            type="button"
            className="dx-feed-search-clear"
            onClick={() => setQuery("")}
            aria-label="Tozalash"
          >
            <Ico.X />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="dx-empty"><Ico.CheckCircle /><span>Faollik yo&apos;q</span></div>
      ) : filtered.length === 0 ? (
        <div className="dx-empty"><Ico.Search /><span>Hech narsa topilmadi</span></div>
      ) : (
        <div className="dx-feed">
          {filtered.map((a, i) => (
            <div key={`${a.at}-${i}`} className={`dx-feed-item dx-fadein-${Math.min(i, 5)}`}>
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
      )}
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
   RANGE CALENDAR PICKER — affects all dashboard data
═══════════════════════════════════════════════════════════════════ */

type DateRange = { from: string; to: string };

const UZ_MONTHS_FULL = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const UZ_WEEKDAYS_SHORT = ["Du","Se","Cho","Pa","Ju","Sh","Ya"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function formatPeriodRange(fromIso: string, toIso: string): string {
  const months = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const f = parseIsoDate(fromIso);
  const t = parseIsoDate(toIso);
  if (fromIso === toIso) {
    return `${f.getDate()} ${months[f.getMonth()]} ${f.getFullYear()}`;
  }
  const sameYear = f.getFullYear() === t.getFullYear();
  const sameMonth = sameYear && f.getMonth() === t.getMonth();
  const left = sameMonth
    ? `${f.getDate()}`
    : `${f.getDate()} ${months[f.getMonth()]}${sameYear ? "" : " " + f.getFullYear()}`;
  const right = `${t.getDate()} ${months[t.getMonth()]} ${t.getFullYear()}`;
  return `${left} – ${right}`;
}

type PresetDef = { key: string; label: string; range: () => DateRange };

const RANGE_PRESETS: PresetDef[] = [
  { key: "today", label: "Bugun", range: () => {
    const t = toIsoDate(startOfDay(new Date()));
    return { from: t, to: t };
  }},
  { key: "yesterday", label: "Kecha", range: () => {
    const d = toIsoDate(addDays(startOfDay(new Date()), -1));
    return { from: d, to: d };
  }},
  { key: "last_7_days", label: "Oxirgi 7 kun", range: () => {
    const t = startOfDay(new Date());
    return { from: toIsoDate(addDays(t, -6)), to: toIsoDate(t) };
  }},
  { key: "last_30_days", label: "Oxirgi 30 kun", range: () => {
    const t = startOfDay(new Date());
    return { from: toIsoDate(addDays(t, -29)), to: toIsoDate(t) };
  }},
  { key: "this_week", label: "Shu hafta", range: () => {
    const t = startOfDay(new Date());
    const dow = (t.getDay() + 6) % 7;
    return { from: toIsoDate(addDays(t, -dow)), to: toIsoDate(t) };
  }},
  { key: "last_week", label: "O'tgan hafta", range: () => {
    const t = startOfDay(new Date());
    const dow = (t.getDay() + 6) % 7;
    const lastSun = addDays(t, -dow - 1);
    const lastMon = addDays(lastSun, -6);
    return { from: toIsoDate(lastMon), to: toIsoDate(lastSun) };
  }},
  { key: "this_month", label: "Shu oy", range: () => {
    const t = startOfDay(new Date());
    const first = new Date(t.getFullYear(), t.getMonth(), 1);
    return { from: toIsoDate(first), to: toIsoDate(t) };
  }},
  { key: "last_month", label: "O'tgan oy", range: () => {
    const t = startOfDay(new Date());
    const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const last  = new Date(t.getFullYear(), t.getMonth(), 0);
    return { from: toIsoDate(first), to: toIsoDate(last) };
  }},
];

function matchPreset(range: DateRange): string | null {
  for (const p of RANGE_PRESETS) {
    const r = p.range();
    if (r.from === range.from && r.to === range.to) return p.key;
  }
  return null;
}

function getDefaultRange(): DateRange {
  return RANGE_PRESETS.find(p => p.key === "last_30_days")!.range();
}

function RangeCalendarPicker({
  value,
  onChange,
  loading,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [pending, setPending] = useState<DateRange>(value);
  const [pickStep, setPickStep] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const d = parseIsoDate(value.from);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    setPending(value);
    setPickStep("start");
    setHoverDate(null);
    const d = parseIsoDate(value.to);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setPopupPos(null); return; }
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const goPrev = () => setViewMonth(v =>
    v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }
  );
  const goNext = () => setViewMonth(v =>
    v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }
  );

  const handleDayClick = (iso: string) => {
    if (pickStep === "start") {
      setPending({ from: iso, to: iso });
      setPickStep("end");
      setHoverDate(null);
    } else {
      if (iso < pending.from) {
        setPending({ from: iso, to: pending.from });
      } else {
        setPending({ from: pending.from, to: iso });
      }
      setPickStep("start");
      setHoverDate(null);
    }
  };

  const applyPreset = (p: PresetDef) => {
    const r = p.range();
    onChange(r);
    setOpen(false);
  };

  const commit = () => {
    onChange(pending);
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  // Effective range for highlight (uses hover preview during "end" step)
  let effFrom = pending.from;
  let effTo = pending.to;
  if (pickStep === "end" && hoverDate) {
    if (hoverDate < pending.from) {
      effFrom = hoverDate;
      effTo = pending.from;
    } else {
      effFrom = pending.from;
      effTo = hoverDate;
    }
  }

  const todayIso = toIsoDate(startOfDay(new Date()));
  const activePresetKey = matchPreset(pending);

  const renderMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const empties = Array.from({ length: startWeekday }, (_, i) => (
      <div key={`e${i}`} className="dx-cal-cell is-empty" />
    ));

    const days = Array.from({ length: daysInMonth }, (_, k) => {
      const d = k + 1;
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isStart = iso === effFrom;
      const isEnd = iso === effTo;
      const isSingle = isStart && isEnd;
      const inRange = !isSingle && iso > effFrom && iso < effTo;
      const isToday = iso === todayIso;

      let cls = "dx-cal-cell";
      if (inRange) cls += " is-range";
      if (isStart && !isSingle) cls += " is-start";
      if (isEnd && !isSingle) cls += " is-end";
      if (isSingle) cls += " is-single";
      if (isToday) cls += " is-today";

      return (
        <button
          key={iso}
          type="button"
          className={cls}
          onClick={() => handleDayClick(iso)}
          onMouseEnter={() => { if (pickStep === "end") setHoverDate(iso); }}
        >
          <span className="dx-cal-day-num">{d}</span>
        </button>
      );
    });

    return (
      <div className="dx-cal-month">
        <div className="dx-cal-month-head">
          {UZ_MONTHS_FULL[month]} {year}
        </div>
        <div className="dx-cal-weekdays">
          {UZ_WEEKDAYS_SHORT.map(w => <span key={w}>{w}</span>)}
        </div>
        <div
          className="dx-cal-grid"
          onMouseLeave={() => { if (pickStep === "end") setHoverDate(null); }}
        >
          {empties}{days}
        </div>
      </div>
    );
  };

  const triggerLabel = formatPeriodRange(value.from, value.to);

  return (
    <div ref={ref} className={`dx-period dx-cal ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="dx-period-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={loading}
      >
        <span className="dx-period-icon"><Ico.Calendar /></span>
        <span className="dx-period-label">{triggerLabel}</span>
        <svg
          className="dx-period-chev"
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <div
          ref={popupRef}
          className="dx-cal-pop"
          role="dialog"
          aria-label="Davrni tanlang"
          style={popupPos ? { top: popupPos.top, right: popupPos.right } : { visibility: "hidden" }}
        >
          <div className="dx-cal-side">
            <div className="dx-cal-side-title">Tezkor</div>
            {RANGE_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`dx-cal-preset ${activePresetKey === p.key ? "is-active" : ""}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="dx-cal-main">
            <div className="dx-cal-nav">
              <button type="button" className="dx-cal-nav-btn" onClick={goPrev} aria-label="Oldingi oy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
              <div className="dx-cal-nav-spacer" />
              <button type="button" className="dx-cal-nav-btn" onClick={goNext} aria-label="Keyingi oy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
            <div className="dx-cal-months">
              {renderMonth(viewMonth.year, viewMonth.month)}
            </div>

            <div className="dx-cal-foot">
              <div className="dx-cal-foot-range">
                <span className="dx-cal-foot-tag">Boshlanish</span>
                <span className="dx-cal-foot-val">{formatPeriodRange(pending.from, pending.from)}</span>
                <svg className="dx-cal-foot-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="dx-cal-foot-tag">Tugash</span>
                <span className="dx-cal-foot-val">{formatPeriodRange(pending.to, pending.to)}</span>
              </div>
              <div className="dx-cal-foot-actions">
                <button type="button" className="dx-cal-btn-ghost" onClick={cancel}>Bekor qilish</button>
                <button type="button" className="dx-cal-btn-primary" onClick={commit}>Tasdiqlash</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
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
  // Two nonces:
  //   kpiNonce    — bumps on every load; drives count-up + activity feed re-animation
  //   staticNonce — bumps only on the first successful load; static sections animate once
  const [kpiNonce, setKpiNonce] = useState(0);
  const [staticNonce, setStaticNonce] = useState(0);
  const firstLoadRef = useRef(true);
  const [range, setRange] = useState<DateRange>(() => getDefaultRange());
  const [trendRange, setTrendRange] = useState<DateRange>(() => getDefaultRange());

  const loadSummary = useCallback(async () => {
    if (!accessToken) return;
    try {
      setErr(null);
      setRefreshing(true);
      const summary = await dashboardService.getSummary({
        from: range.from,
        to: range.to,
        trendFrom: trendRange.from,
        trendTo: trendRange.to,
      });
      setData(summary);
      setKpiNonce((n) => n + 1);
      if (firstLoadRef.current) {
        setStaticNonce((n) => n + 1);
        firstLoadRef.current = false;
      }
    } catch {
      setErr("Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, range, trendRange]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Animated KPI counters (called unconditionally)
  const k = data?.kpis;
  // State (always-now)
  const animActive     = useCountUp(k?.activeContracts ?? 0,        1400, 0,   kpiNonce);
  const animMfgDone    = useCountUp(k?.manufacturedCompleted ?? 0,  1400, 120, kpiNonce);
  const animMfgIp      = useCountUp(k?.manufacturedInProgress ?? 0, 1400, 240, kpiNonce);
  const animEmployees  = useCountUp(k?.totalEmployees ?? 0,         1400, 360, kpiNonce);

  const greeting = getGreeting();
  const today = new Date();
  const firstName = user?.firstName || user?.login || "";
  const trendDayCount = Math.max(
    1,
    Math.round(
      (parseIsoDate(trendRange.to).getTime() - parseIsoDate(trendRange.from).getTime()) / 86400000
    ) + 1
  );

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
            <div className="dx-hero-period">
              <RangeCalendarPicker value={range} onChange={setRange} loading={refreshing} />
            </div>
          </div>
        </div>
      </section>

      <section className="dx-row dx-row-strip-feed">
        <div className="dx-strip-left">
          <div className="dx-state-strip-tiles dx-tiles-2x2">
            <button
              className="dx-mini-tile dxm-accent"
              onClick={() => router.push("/contracts")}
              aria-label="Faol shartnomalar"
            >
              <div className="dx-mini-top">
                <span className="dx-mini-title">Faol shartnoma</span>
                <span className="dx-mini-icon"><Ico.Zap /></span>
              </div>
              <div className="dx-mini-inner">
                <div className="dx-mini-val">{animActive}</div>
              </div>
            </button>
            <button
              className="dx-mini-tile dxm-success"
              onClick={() => router.push("/manufactured")}
              aria-label="Tayyor mahsulotlar"
            >
              <div className="dx-mini-top">
                <span className="dx-mini-title">Tayyor mahsulot</span>
                <span className="dx-mini-icon"><Ico.CheckCircle /></span>
              </div>
              <div className="dx-mini-inner">
                <div className="dx-mini-val">{animMfgDone}</div>
              </div>
            </button>
            <button
              className="dx-mini-tile dxm-purple"
              onClick={() => router.push("/manufactured")}
              aria-label="Ishlab chiqarishda"
            >
              <div className="dx-mini-top">
                <span className="dx-mini-title">Ishlab chiqarishda</span>
                <span className="dx-mini-icon"><Ico.Factory /></span>
              </div>
              <div className="dx-mini-inner">
                <div className="dx-mini-val">{animMfgIp}</div>
              </div>
            </button>
            <button
              className="dx-mini-tile dxm-cyan"
              onClick={() => router.push("/users")}
              aria-label="Xodimlar"
            >
              <div className="dx-mini-top">
                <span className="dx-mini-title">Xodimlar</span>
                <span className="dx-mini-icon"><Ico.Users /></span>
              </div>
              <div className="dx-mini-inner">
                <div className="dx-mini-val">{animEmployees}</div>
                <div className="dx-mini-foot">{k?.activeDepartments ?? 0} bo&apos;lim</div>
              </div>
            </button>
          </div>

          <RevealSection key={`trend-${staticNonce}`} className="dx-section dx-section-framed dx-strip-trend">
            <div className="dx-section-header">
              <Ico.Activity />
              <h3 className="dx-section-title">Ishlab chiqarish va jo&apos;natma dinamikasi</h3>
              <span className="dx-section-meta">{trendDayCount} kun</span>
              <div className="dx-section-legend">
                <span className="dx-legend-dot" style={{ background: "var(--accent)" }} /> Ishlab chiqarish
                <span className="dx-legend-dot" style={{ background: "var(--success)", marginLeft: 12 }} /> Jo&apos;natmalar
              </div>
              <div className="dx-section-period">
                <RangeCalendarPicker value={trendRange} onChange={setTrendRange} loading={refreshing} />
              </div>
            </div>
            <div className="dx-section-body dx-trend-body-wide">
              <DualAreaChart prod={data.productionTrend} ship={data.shipmentTrend} />
            </div>
          </RevealSection>
        </div>

        <RevealSection key={`activity-${kpiNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.Activity />
            <h3 className="dx-section-title">So&apos;nggi faollik</h3>
          </div>
          <div className="dx-section-body">
            <ActivityFeed items={data.recentActivity} />
          </div>
        </RevealSection>
      </section>

      {/* ─── 3-COLUMN: PIE + MFG + CONTRACT STATUS ─── */}
      <section className="dx-row dx-row-3">
        <RevealSection key={`pie-${staticNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.PieChart />
            <h3 className="dx-section-title">Bajarish ulushi</h3>
          </div>
          <div className="dx-section-body">
            <CompletionPieChart
              contracted={data.kpis.totalContractedAmount}
              produced={data.kpis.totalProducedAmount}
              batched={data.kpis.totalBatchedAmount}
            />
          </div>
        </RevealSection>

        <RevealSection key={`mfg-${staticNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.Factory />
            <h3 className="dx-section-title">Mahsulot ishlab chiqarish progressi</h3>
          </div>
          <div className="dx-section-body">
            <MfgProgressList items={data.manufacturingProgress} />
          </div>
        </RevealSection>

        <RevealSection key={`bubble-${staticNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.Box />
            <h3 className="dx-section-title">Shartnomalar holati</h3>
          </div>
          <div className="dx-section-body">
            <BubbleChart data={data.contractStatus} />
          </div>
        </RevealSection>
      </section>

      {/* ─── 2-COLUMN: DEPT WORKLOAD + TOP PERFORMERS ─── */}
      <section className="dx-row dx-row-2-1">
        <RevealSection key={`hbar-${staticNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.Building />
            <h3 className="dx-section-title">Bo&apos;limlar yuklamasi</h3>
            <div className="dx-section-legend">
              <span className="dx-legend-dot" style={{ background: "var(--accent)" }} /> Shartnoma
              <span className="dx-legend-dot" style={{ background: "var(--purple)", marginLeft: 12 }} /> Mahsulot
            </div>
          </div>
          <div className="dx-section-body">
            <HBarList data={data.departmentWorkload} />
          </div>
        </RevealSection>

        <RevealSection key={`deadlines-${staticNonce}`} className="dx-section dx-section-framed">
          <div className="dx-section-header">
            <Ico.Clock />
            <h3 className="dx-section-title">Yaqinlashayotgan deadlinelar</h3>
            <button type="button" className="dx-section-link" onClick={() => router.push("/contracts")}>
              Hammasi <Ico.ArrowRight />
            </button>
          </div>
          <div className="dx-section-body">
            <DeadlineList items={data.upcomingDeadlines} onClick={() => router.push("/contracts")} variant="list" />
          </div>
        </RevealSection>
      </section>

      {/* ─── HEATMAP (full row) ─── */}
      <RevealSection key={`heatmap-${staticNonce}`} as="section" className="dx-section">
        <div className="dx-section-header">
          <Ico.Activity />
          <h3 className="dx-section-title">Faollik xaritasi</h3>
          <span className="dx-section-meta">1 yil · kunlik yozuvlar</span>
        </div>
        <Heatmap cells={data.activityHeatmap} />
      </RevealSection>
    </div>
  );
}
