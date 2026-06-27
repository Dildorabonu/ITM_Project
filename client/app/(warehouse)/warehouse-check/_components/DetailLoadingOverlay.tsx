"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { statusKeyframes } from "../_types";
import { useT } from "@/lib/i18n";

// Talabnoma tafsilotiga o'tishdan oldin ko'rsatiladigan animatsiyali yuklash overlay'i.
// Ma'lumot tayyor bo'lsa va minimal davomiylik o'tsa — onComplete chaqiriladi.
export function DetailLoadingOverlay({ dataReady, onComplete }: { dataReady: boolean; onComplete: () => void }) {
  const t = useT();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);
  const minDuration = 1500;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      let pct: number;
      if (elapsed < minDuration) {
        pct = Math.min(85, (elapsed / minDuration) * 85);
      } else if (!dataReady) {
        pct = Math.min(95, 85 + ((elapsed - minDuration) / 5000) * 10);
      } else {
        pct = 100;
      }
      setProgress(pct);
      if (elapsed > 600) setPhase(1);
      if (elapsed > 1200) setPhase(2);

      if (elapsed >= minDuration && dataReady && !completedRef.current) {
        completedRef.current = true;
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(onComplete, 400);
        }, 200);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [dataReady, onComplete]);

  const phaseTexts = [
    t("Ma‘lumotlar yuklanmoqda..."),
    t("Materiallar tahlil qilinmoqda..."),
    t("Tayyorlanmoqda..."),
  ];

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      background: "rgba(15, 23, 42, 0.65)",
      animation: fadeOut ? "overlayFadeOut 0.4s ease-out forwards" : "overlayFadeIn 0.3s ease-out",
    }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
      <div style={{ position: "relative", width: 100, height: 100, marginBottom: 24 }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: "50%", background: "#60a5fa", animation: "orbitDot 2.5s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#3b82f6", borderRightColor: "#6366f1", animation: "spinRing 1.2s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 32, height: 32, marginLeft: -16, marginTop: -16, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)", animation: "pulseCore 2s ease-in-out infinite" }} />
      </div>
      <div key={phase} style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", animation: "textFadeUp 0.4s ease-out", marginBottom: 16 }}>{phaseTexts[phase]}</div>
      <div style={{ width: 220, height: 4, borderRadius: 2, background: "rgba(51, 65, 85, 0.6)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)", transition: "width 0.1s linear" }} />
      </div>
    </div>
  , document.body);
}
