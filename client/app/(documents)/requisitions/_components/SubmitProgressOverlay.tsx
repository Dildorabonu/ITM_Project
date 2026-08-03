"use client";

import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

// Talabnomani tizimga yuborish jarayonini qoplaydigan bloklovchi overlay.
// Maqsad ikki xil: (1) foydalanuvchi 3-5 soniya nima bo'layotganini ko'radi,
// (2) jarayon davomida blankni o'zgartirib yoki boshqa sahifaga o'tib
// yuborishning oldi olinadi — aks holda PDF bazadagi ma'lumotga mos kelmay
// qolishi yoki fayl biriktirilmay qolishi mumkin (ikkalasi ham jimjitlik
// bilan, xato ko'rsatmasdan sodir bo'ladi).
//
// zIndex 100000 — sahifadagi eng baland element (tasdiqlash modali) 99999 da,
// layout dropdownlari 100 da; ya'ni sidebar navigatsiyasi ham bosilmaydi.

// Bosqichlar overlay va doSaveSystem o'rtasida umumiy: setSubmitStage(n).
export const SUBMIT_STAGES = 3;

export function SubmitProgressOverlay({ stage }: { stage: number }) {
  const t = useT();

  const steps = [
    t("Rasmlar va PDF tayyorlanmoqda"),
    t("Talabnoma saqlanmoqda"),
    t("Fayllar biriktirilmoqda"),
  ];

  // Bosqichlarga asoslangan haqiqiy progress (soxta timer emas). Oxirgi
  // bosqich tugagach stage === SUBMIT_STAGES bo'ladi — 100%.
  const pct = Math.round((Math.min(stage, SUBMIT_STAGES) / SUBMIT_STAGES) * 100);
  const done = stage >= SUBMIT_STAGES;

  return createPortal(
    <div
      // Barcha pointer hodisalarini o'zida ushlaydi — ostidagi forma, tugmalar
      // va sidebar bosilmaydi.
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 100000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(9, 12, 20, 0.62)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        animation: "reqSubmitFadeIn 0.2s ease-out",
        cursor: "wait",
      }}
    >
      <style>{`
        @keyframes reqSubmitFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes reqSubmitPanelIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98) }
          to   { opacity: 1; transform: none }
        }
        @keyframes reqSubmitSpin { to { transform: rotate(360deg) } }
        @keyframes reqSubmitBar {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(320%) }
        }
      `}</style>

      <div style={{
        width: 380, maxWidth: "calc(100vw - 32px)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius2)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.42)",
        padding: "22px 24px",
        animation: "reqSubmitPanelIn 0.28s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.14em", color: "var(--text3)", margin: 0,
        }}>
          {t("Talabnoma yuborilmoqda")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 16 }}>
          {steps.map((label, i) => {
            const isDone = stage > i;
            const isActive = stage === i;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0",
                opacity: isDone || isActive ? 1 : 0.45,
                transition: "opacity 0.25s",
              }}>
                <span style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: isDone ? "var(--success-dim)" : isActive ? "transparent" : "var(--surface2)",
                  border: isActive ? "2px solid var(--accent)" : "none",
                  borderTopColor: isActive ? "transparent" : undefined,
                  animation: isActive ? "reqSubmitSpin 0.7s linear infinite" : undefined,
                }}>
                  {isDone && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         stroke="var(--success)" strokeWidth="3.4"
                         strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{
                  fontSize: 13,
                  color: isDone ? "var(--text2)" : isActive ? "var(--text)" : "var(--text3)",
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar — bosqich soniga qarab to'ladi; faol bosqich ichida
            oxiri noaniq bo'lgani uchun ustidan shimmer yuguradi. */}
        <div style={{
          position: "relative", height: 4, marginTop: 16,
          borderRadius: 2, background: "var(--surface2)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 2,
            background: done ? "var(--success)" : "var(--accent)",
            transition: "width 0.45s cubic-bezier(0.22,1,0.36,1), background 0.25s",
          }} />
          {!done && (
            <div style={{
              position: "absolute", inset: 0, width: "30%",
              background: "linear-gradient(90deg, transparent, var(--accent-mid), transparent)",
              animation: "reqSubmitBar 1.5s ease-in-out infinite",
            }} />
          )}
        </div>

        <p style={{
          fontSize: 11, color: "var(--text3)", margin: "12px 0 0",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span>{t("Sahifani yopmang va o'zgartirish kiritmang")}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}
