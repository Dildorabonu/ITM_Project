"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  costNormService,
  productService,
  contractService,
  type CostNormResponse,
  type ContractResponse,
  type ProductResponse,
  PRODUCT_UNIT_LABELS,
} from "@/lib/userService";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y.slice(-2)}` : "—";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface NormCheckRow {
  id: string;
  title: string;
  contractNo: string;
  createdByFullName: string;
  createdAt: string;
  totalItems: number;
  foundItems: number;
  missingItems: number;
  checked: boolean;
}

type MaterialStatus = "topilmadi" | "yetishmadi" | "yetarli";

interface MaterialCheckItem {
  name: string;
  unit: string;
  totalQty: string;
  jamiMiqdori: number;
  status: MaterialStatus;
  productQty?: number;
  productUnit?: string;
  deficit: number;
}

// ─── Animated status components ────────────────────────────────────────────

const statusKeyframes = `
@keyframes drawCheck {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
@keyframes drawCircle {
  0% { stroke-dashoffset: 63; }
  100% { stroke-dashoffset: 0; }
}
@keyframes fadeSlideIn {
  0% { opacity: 0; transform: translateY(6px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes softPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ringPulse {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes dotBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes overlayFadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes overlayFadeOut {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes spinRing {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes orbitDot {
  0% { transform: rotate(0deg) translateX(52px) rotate(0deg); opacity: 0.9; }
  50% { opacity: 0.4; }
  100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); opacity: 0.9; }
}
@keyframes orbitDot2 {
  0% { transform: rotate(120deg) translateX(52px) rotate(-120deg); opacity: 0.7; }
  50% { opacity: 0.3; }
  100% { transform: rotate(480deg) translateX(52px) rotate(-480deg); opacity: 0.7; }
}
@keyframes orbitDot3 {
  0% { transform: rotate(240deg) translateX(52px) rotate(-240deg); opacity: 0.5; }
  50% { opacity: 0.2; }
  100% { transform: rotate(600deg) translateX(52px) rotate(-600deg); opacity: 0.5; }
}
@keyframes pulseCore {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
  50% { transform: scale(1.08); box-shadow: 0 0 30px 8px rgba(59, 130, 246, 0.15); }
}
@keyframes textFadeUp {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes progressGrow {
  0% { width: 0%; }
  15% { width: 12%; }
  40% { width: 35%; }
  65% { width: 60%; }
  80% { width: 78%; }
  95% { width: 92%; }
  100% { width: 100%; }
}
@keyframes dataStreamLine {
  0% { transform: translateX(-100%); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
}
`;

/** Animated icon-only indicator for main table rows */
function StatusIcon({ checked, size = 20 }: { checked: boolean; size?: number }) {
  if (checked) {
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5" fill="#dcfce7"
            strokeDasharray="63" strokeDashoffset="0"
            style={{ animation: "drawCircle 0.6s ease-out" }} />
          <path d="M7.5 12.5l3 3 6-6" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="24" strokeDashoffset="0"
            style={{ animation: "drawCheck 0.4s ease-out 0.3s both" }} />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Pulse ring behind */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%", border: "2px solid #ef4444",
        animation: "ringPulse 2s ease-out infinite",
      }} />
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" fill="#fef2f2"
          strokeDasharray="63" strokeDashoffset="0"
          style={{ animation: "drawCircle 0.6s ease-out" }} />
        <rect x="11" y="7" width="2" height="6.5" rx="1" fill="#ef4444"
          style={{ animation: "fadeSlideIn 0.3s ease-out 0.3s both" }} />
        <circle cx="12" cy="16.5" r="1.2" fill="#ef4444"
          style={{ animation: "dotBlink 2s ease-in-out infinite 1s" }} />
      </svg>
    </div>
  );
}

/** Animated badge for detail table Holati column */
function StatusBadge({ status, available, required }: { status: MaterialStatus; available: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((available / required) * 100)) : 0;
  if (status === "yetarli") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px",
          borderRadius: 24, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3,
          background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
          color: "#15803d", border: "1px solid #86efac",
          animation: "fadeSlideIn 0.4s ease-out",
          position: "relative" as const, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 24,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 4s ease-in-out infinite",
            pointerEvents: "none",
          }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5" fill="rgba(22,163,74,0.1)"
              strokeDasharray="63" style={{ animation: "drawCircle 0.5s ease-out" }} />
            <path d="M7.5 12.5l3 3 6-6" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="24" style={{ animation: "drawCheck 0.35s ease-out 0.25s both" }} />
          </svg>
          <span style={{ position: "relative", zIndex: 1 }}>Yetarli</span>
        </div>
      </div>
    );
  }
  if (status === "yetishmadi") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px",
          borderRadius: 24, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3,
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          color: "#b45309", border: "1px solid #fcd34d",
          animation: "fadeSlideIn 0.4s ease-out",
          position: "relative" as const,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.5" fill="rgba(217,119,6,0.08)"
              strokeDasharray="63" style={{ animation: "drawCircle 0.5s ease-out" }} />
            <rect x="11" y="7.5" width="2" height="5.5" rx="1" fill="#d97706"
              style={{ animation: "fadeSlideIn 0.3s ease-out 0.25s both" }} />
            <circle cx="12" cy="16" r="1.1" fill="#d97706"
              style={{ animation: "dotBlink 2s ease-in-out infinite 1s" }} />
          </svg>
          <span>Yetishmadi</span>
          {required > 0 && (
            <div style={{
              width: 28, height: 3.5, borderRadius: 2,
              background: "rgba(180, 83, 9, 0.12)", overflow: "hidden", marginLeft: 2,
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${pct}%`,
                background: "#d97706",
                transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px",
        borderRadius: 24, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3,
        background: "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
        color: "#b91c1c", border: "1px solid #fca5a5",
        animation: "fadeSlideIn 0.4s ease-out",
        position: "relative" as const,
      }}>
        <div style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
          <div style={{
            position: "absolute", inset: -2,
            borderRadius: "50%", border: "1.5px solid #ef4444",
            animation: "ringPulse 2.5s ease-out infinite",
            pointerEvents: "none",
          }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.08)"
              strokeDasharray="63" style={{ animation: "drawCircle 0.5s ease-out" }} />
            <rect x="11" y="7.5" width="2" height="5.5" rx="1" fill="#ef4444"
              style={{ animation: "fadeSlideIn 0.3s ease-out 0.25s both" }} />
            <circle cx="12" cy="16" r="1.1" fill="#ef4444"
              style={{ animation: "dotBlink 2s ease-in-out infinite 1s" }} />
          </svg>
        </div>
        <span>Topilmadi</span>
      </div>
    </div>
  );
}

/** Animated header badge for detail view */
function HeaderStatusBadge({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px",
        borderRadius: 24, fontSize: 12, fontWeight: 600,
        background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
        color: "#15803d", border: "1px solid #86efac",
        animation: "fadeSlideIn 0.4s ease-out",
        position: "relative" as const, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 24,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 4s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1 }}>
          <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5" fill="rgba(22,163,74,0.1)"
            strokeDasharray="63" style={{ animation: "drawCircle 0.6s ease-out" }} />
          <path d="M7.5 12.5l3 3 6-6" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="24" style={{ animation: "drawCheck 0.4s ease-out 0.35s both" }} />
        </svg>
        <span style={{ position: "relative", zIndex: 1 }}>To&apos;liq topildi</span>
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px",
      borderRadius: 24, fontSize: 12, fontWeight: 600,
      background: "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
      color: "#b91c1c", border: "1px solid #fca5a5",
      animation: "fadeSlideIn 0.4s ease-out",
    }}>
      <div style={{ position: "relative", width: 15, height: 15 }}>
        <div style={{
          position: "absolute", inset: -2,
          borderRadius: "50%", border: "1.5px solid #ef4444",
          animation: "ringPulse 2.5s ease-out infinite",
        }} />
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.08)"
            strokeDasharray="63" style={{ animation: "drawCircle 0.6s ease-out" }} />
          <rect x="11" y="7.5" width="2" height="5.5" rx="1" fill="#ef4444"
            style={{ animation: "fadeSlideIn 0.3s ease-out 0.3s both" }} />
          <circle cx="12" cy="16" r="1.1" fill="#ef4444"
            style={{ animation: "dotBlink 2s ease-in-out infinite 1s" }} />
        </svg>
      </div>
      <span>Kamchilik bor</span>
    </span>
  );
}

/** Loading overlay for detail transition — waits for real data + minimum 5s */
function DetailLoadingOverlay({ dataReady, onComplete }: { dataReady: boolean; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);
  const minDuration = 5000;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      // Progress goes to 85% over 5s, then stalls until data is ready
      let pct: number;
      if (elapsed < minDuration) {
        pct = Math.min(85, (elapsed / minDuration) * 85);
      } else if (!dataReady) {
        // Data still loading — crawl slowly from 85 to 95
        pct = Math.min(95, 85 + ((elapsed - minDuration) / 5000) * 10);
      } else {
        pct = 100;
      }
      setProgress(pct);
      if (elapsed > 1500) setPhase(1);
      if (elapsed > 3500) setPhase(2);

      // Complete when both min time passed AND data ready
      if (elapsed >= minDuration && dataReady && !completedRef.current) {
        completedRef.current = true;
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(onComplete, 400);
        }, 300);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [dataReady, onComplete]);

  const phaseTexts = [
    "Ma\u2018lumotlar bazadan yuklanmoqda...",
    "Materiallar tahlil qilinmoqda...",
    "Natijalar tayyorlanmoqda...",
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      background: "rgba(15, 23, 42, 0.65)",
      animation: fadeOut ? "overlayFadeOut 0.4s ease-out forwards" : "overlayFadeIn 0.3s ease-out",
    }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />

      {/* Outer orbiting dots */}
      <div style={{ position: "relative", width: 130, height: 130, marginBottom: 32 }}>
        <div style={{
          position: "absolute", inset: 12, borderRadius: "50%",
          border: "1px solid rgba(99, 152, 255, 0.15)",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5,
          borderRadius: "50%", background: "#60a5fa",
          animation: "orbitDot 2.5s linear infinite",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5,
          borderRadius: "50%", background: "#818cf8",
          animation: "orbitDot2 3s linear infinite",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
          borderRadius: "50%", background: "#a78bfa",
          animation: "orbitDot3 3.5s linear infinite",
        }} />

        {/* Center spinning ring */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 60, height: 60,
          marginLeft: -30, marginTop: -30, borderRadius: "50%",
          border: "3px solid transparent", borderTopColor: "#3b82f6", borderRightColor: "#6366f1",
          animation: "spinRing 1.2s linear infinite",
        }} />

        {/* Core pulsing circle with database icon */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 40, height: 40,
          marginLeft: -20, marginTop: -20, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
          animation: "pulseCore 2s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>
      </div>

      {/* Data stream lines */}
      <div style={{
        width: 200, height: 3, marginBottom: 20, position: "relative", overflow: "hidden",
        borderRadius: 2, background: "rgba(99, 152, 255, 0.1)",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
          background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
          animation: "dataStreamLine 1.5s ease-in-out infinite",
        }} />
      </div>

      {/* Phase text */}
      <div key={phase} style={{
        fontSize: 15, fontWeight: 500, color: "#e2e8f0", letterSpacing: 0.3,
        animation: "textFadeUp 0.4s ease-out",
        marginBottom: 8,
      }}>
        {phaseTexts[phase]}
      </div>

      <div style={{
        fontSize: 12, color: "rgba(148, 163, 184, 0.8)", marginBottom: 24,
        animation: "textFadeUp 0.4s ease-out 0.15s both",
      }}>
        Ma&apos;lumotlar yuklanmoqda, biroz kutib turing
      </div>

      {/* Progress bar */}
      <div style={{
        width: 260, height: 4, borderRadius: 2,
        background: "rgba(51, 65, 85, 0.6)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${progress}%`,
          background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)",
          transition: "width 0.1s linear",
          boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)",
        }} />
      </div>

      {/* Percentage */}
      <div style={{
        fontSize: 11, color: "rgba(148, 163, 184, 0.6)", marginTop: 10,
        fontFamily: "Inter, monospace", letterSpacing: 1,
      }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [costNorms, setCostNorms] = useState<CostNormResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNormId, setSelectedNormId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDataReady, setDetailDataReady] = useState(false);
  const pendingNormId = useRef<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [norms, prods, ctrs] = await Promise.all([
        costNormService.getAll(),
        productService.getAll(1, 1000),
        contractService.getAll(),
      ]);
      setCostNorms(norms);
      setProducts(prods.items);
      setContracts(ctrs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Product lookup map ───────────────────────────────────────────────────

  const prodMap = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    for (const p of products) map.set(normalize(p.name), p);
    return map;
  }, [products]);

  // ── Contract lookup map (by id → quantity) ──────────────────────────────

  const contractQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) map.set(c.id, c.quantity);
    return map;
  }, [contracts]);

  // ── Build norm rows ──────────────────────────────────────────────────────

  const normRows = useMemo<NormCheckRow[]>(() => {
    return costNorms.map(norm => {
      const contractQty = contractQtyMap.get(norm.contractId) ?? 1;
      const materialItems = (norm.items ?? []).filter(it => !it.isSection && it.name);
      const totalItems = materialItems.length;
      const foundItems = materialItems.filter(it => {
        const match = prodMap.get(normalize(it.name!));
        if (!match) return false;
        const perUnit = parseFloat((it.totalQty ?? "0").replace(",", ".")) || 0;
        const jamiMiqdori = contractQty * perUnit;
        return match.quantity >= jamiMiqdori;
      }).length;
      const missingItems = totalItems - foundItems;
      return {
        id: norm.id,
        title: norm.title,
        contractNo: norm.contractNo ?? "",
        createdByFullName: norm.createdByFullName ?? "",
        createdAt: norm.createdAt ?? "",
        totalItems,
        foundItems,
        missingItems,
        checked: totalItems > 0 && missingItems === 0,
      };
    });
  }, [costNorms, prodMap, contractQtyMap]);

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return normRows;
    const q = search.toLowerCase();
    return normRows.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.contractNo.toLowerCase().includes(q) ||
      r.createdByFullName.toLowerCase().includes(q)
    );
  }, [normRows, search]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = normRows.length;
    const checked = normRows.filter(r => r.checked).length;
    const unchecked = total - checked;
    return { total, checked, unchecked };
  }, [normRows]);

  // ── Selected norm detail ─────────────────────────────────────────────────

  const selectedNorm = useMemo(() => {
    if (!selectedNormId) return null;
    return costNorms.find(n => n.id === selectedNormId) ?? null;
  }, [costNorms, selectedNormId]);

  const selectedRow = useMemo(() => {
    if (!selectedNormId) return null;
    return normRows.find(r => r.id === selectedNormId) ?? null;
  }, [normRows, selectedNormId]);

  const materialCheckItems = useMemo<MaterialCheckItem[]>(() => {
    if (!selectedNorm) return [];
    const contractQty = contractQtyMap.get(selectedNorm.contractId) ?? 1;
    return (selectedNorm.items ?? [])
      .filter(it => !it.isSection && it.name)
      .map(it => {
        const match = prodMap.get(normalize(it.name!));
        const perUnit = parseFloat((it.totalQty ?? "0").replace(",", ".")) || 0;
        const jamiMiqdori = contractQty * perUnit;
        const available = match?.quantity ?? 0;
        const deficit = Math.max(0, jamiMiqdori - available);
        return {
          name: it.name!,
          unit: it.unit ?? "",
          totalQty: it.totalQty ?? "",
          jamiMiqdori,
          status: !match ? "topilmadi" as MaterialStatus : available >= jamiMiqdori ? "yetarli" as MaterialStatus : "yetishmadi" as MaterialStatus,
          productQty: match?.quantity,
          productUnit: match ? PRODUCT_UNIT_LABELS[match.unit] ?? "" : undefined,
          deficit,
        };
      });
  }, [selectedNorm, prodMap, contractQtyMap]);

  // ── Browser back ─────────────────────────────────────────────────────────

  useEffect(() => {
    const h = () => { setSelectedNormId(null); };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  // ── Detail: search & filter ──────────────────────────────────────────────

  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilter, setDetailFilter] = useState<"all" | "yetarli" | "yetishmadi" | "topilmadi">("all");

  const filteredMaterials = useMemo(() => {
    let items = materialCheckItems;
    if (detailFilter !== "all") items = items.filter(i => i.status === detailFilter);
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.unit ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [materialCheckItems, detailSearch, detailFilter]);

  // ── Render: Detail view ──────────────────────────────────────────────────

  if (selectedNormId && selectedNorm && selectedRow) {
    const detailStats = {
      total: materialCheckItems.length,
      yetarli: materialCheckItems.filter(i => i.status === "yetarli").length,
      yetishmadi: materialCheckItems.filter(i => i.status === "yetishmadi").length,
      topilmadi: materialCheckItems.filter(i => i.status === "topilmadi").length,
    };
    const pct = detailStats.total > 0 ? Math.round((detailStats.yetarli / detailStats.total) * 100) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
        {/* Header */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px" }}>
          <button onClick={() => { setSelectedNormId(null); setDetailSearch(""); setDetailFilter("all"); window.history.back(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            ← Orqaga
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedNorm.title}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              {selectedRow.contractNo && <span>Shartnoma: {selectedRow.contractNo}</span>}
              {selectedRow.createdAt && <span style={{ marginLeft: 8 }}>{fmt(selectedRow.createdAt)}</span>}
              {selectedRow.createdByFullName && <span style={{ marginLeft: 8 }}>{selectedRow.createdByFullName}</span>}
            </div>
          </div>
          <HeaderStatusBadge checked={selectedRow.checked} />
        </div>

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Jami materiallar</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>{detailStats.total}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yetarli</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "#1e7e34" }}>{detailStats.yetarli}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yetishmadi</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "#b45309" }}>{detailStats.yetishmadi}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Topilmadi</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--danger)" }}>{detailStats.topilmadi}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yetarlilik darajasi</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 22, color: pct === 100 ? "#1e7e34" : pct >= 50 ? "var(--warn, #d97706)" : "var(--danger)" }}>{pct}%</span>
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--bg3)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: pct === 100 ? "#1e7e34" : pct >= 50 ? "var(--warn, #d97706)" : "var(--danger)", transition: "width 0.3s" }} />
            </div>
          </div>
        </div>

        {/* Search + filter toolbar */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 14px", flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="search-input" placeholder="Material qidirish..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
          </div>
          {(["all", "yetarli", "yetishmadi", "topilmadi"] as const).map(f => (
            <button key={f} onClick={() => setDetailFilter(f)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", height: 32, borderRadius: "var(--radius)",
                border: `1px solid ${detailFilter === f ? "var(--accent)" : "var(--border)"}`,
                background: detailFilter === f ? "var(--accent-dim, #e8f0fe)" : "var(--bg2)",
                color: detailFilter === f ? "var(--accent)" : "var(--text2)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>
              {f === "all" ? `Barchasi (${detailStats.total})` : f === "yetarli" ? `Yetarli (${detailStats.yetarli})` : f === "yetishmadi" ? `Yetishmadi (${detailStats.yetishmadi})` : `Topilmadi (${detailStats.topilmadi})`}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{filteredMaterials.length} ta natija</span>
        </div>

        {/* Materials table */}
        <div className="itm-card" style={{ flex: 1 }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
            {filteredMaterials.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                {detailSearch || detailFilter !== "all" ? "Natija topilmadi" : "Materiallar yo'q"}
              </div>
            ) : (
              <table className="itm-table">
                <thead>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)" }}>T/r</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Material nomi</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>O&apos;lchov</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Kerakli miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Ombordagi miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Yetishmayotgan miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Holati</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((item, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "14px 14px" }}>{String(i + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "14px 14px" }}>{item.name}</td>
                      <td style={{ textAlign: "center", padding: "14px 14px" }}>{item.unit || "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, padding: "14px 14px" }}>{item.jamiMiqdori > 0 ? item.jamiMiqdori : "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "14px 14px", color: item.productQty != null ? "var(--text1)" : "var(--text3)" }}>{item.productQty != null ? item.productQty : "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: item.deficit > 0 ? 600 : 400, color: item.deficit > 0 ? "var(--danger)" : "var(--text3)", padding: "14px 14px" }}>
                        {item.deficit > 0 ? item.deficit : "—"}
                      </td>
                      <td style={{ padding: "14px 14px" }}>
                        <StatusBadge status={item.status} available={item.productQty ?? 0} required={item.jamiMiqdori} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main list ────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />

      {detailLoading && (
        <DetailLoadingOverlay dataReady={detailDataReady} onComplete={() => {
          setDetailLoading(false);
          if (pendingNormId.current) {
            window.history.pushState({ detail: pendingNormId.current }, "");
            setSelectedNormId(pendingNormId.current);
            pendingNormId.current = null;
          }
        }} />
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Jami norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stats.total}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Tekshirilgan norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e7e34" }}>{stats.checked}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Tekshirilmagan norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>{stats.unchecked}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: norma-rasxod nomi, shartnoma..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button
          onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Yangilash
        </button>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <div>{search ? "Natija topilmadi" : "Norma-rasxodlar kiritilmagan"}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)" }}>T/r</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Norma-rasxod nomi</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Shartnoma</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Jami materiallar</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Topilgan</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Topilmagan</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Sana</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Holati</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      pendingNormId.current = row.id;
                      setDetailDataReady(false);
                      setDetailLoading(true);
                      // Re-fetch real data from backend
                      Promise.all([
                        costNormService.getAll(),
                        productService.getAll(),
                        contractService.getAll(),
                      ]).then(([norms, prods, ctrs]) => {
                        setCostNorms(norms);
                        setProducts(prods.items);
                        setContracts(ctrs);
                        setDetailDataReady(true);
                      }).catch(() => {
                        setDetailDataReady(true);
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "14px 14px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "14px 14px" }}>{row.title}</td>
                    <td style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", padding: "14px 14px" }}>{row.contractNo || "—"}</td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "14px 14px" }}>{row.totalItems}</td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", color: "#1e7e34", fontWeight: 600, padding: "14px 14px" }}>
                      {row.checked ? row.foundItems : "—"}
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", color: row.missingItems > 0 ? "var(--danger)" : "var(--text3)", fontWeight: row.checked ? 600 : 400, padding: "14px 14px" }}>
                      {row.checked ? row.missingItems : "—"}
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", padding: "14px 14px" }}>{fmt(row.createdAt)}</td>
                    <td style={{ padding: "14px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <StatusIcon checked={row.checked} size={22} />
                      </div>
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
