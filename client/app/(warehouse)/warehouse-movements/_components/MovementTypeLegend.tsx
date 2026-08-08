"use client";

import { useEffect, useRef, useState } from "react";
import { stockMovementSign, STOCK_MOVEMENT_COLOR, STOCK_MOVEMENT_DIM } from "@/lib/stockMovements";
import { STOCK_MOVEMENT_TYPE_OPTIONS, STOCK_MOVEMENT_PAIRS } from "../_types";
import { useT } from "@/lib/i18n";

/**
 * "Harakat turlari" yordam paneli — jurnal ustidagi ℹ️ tugma bosilganda ochiladi.
 * Oddiy foydalanuvchiga har bir tur nimani anglatishini va nega bitta amaldan
 * ikkita qator paydo bo'lishini tushuntiradi.
 *
 * Ma'lumot manbasi — `_types.ts` dagi STOCK_MOVEMENT_TYPE_OPTIONS: filtr dropdowni
 * va jadvaldagi badge tooltipi ham aynan shundan oladi.
 */
export function MovementTypeLegend() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tashqariga bosish va Esc bilan yopish.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const byId = (id: string) => STOCK_MOVEMENT_TYPE_OPTIONS.find(o => o.id === id);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        className="btn-icon"
        onClick={() => setOpen(o => !o)}
        title={t("Harakat turlari nimani anglatadi?")}
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          background: open ? "var(--accent-dim)" : "var(--surface2)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          color: open ? "var(--accent)" : "var(--text2)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("Harakat turlari")}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 460,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 60,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius2)",
            boxShadow: "var(--shadow2)",
            overflow: "hidden",
            animation: "panel-appear 0.28s ease",
          }}
        >
          {/* Sarlavha */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 14px",
              background: "var(--bg2)",
              borderBottom: "1.5px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)" }}>
              {t("Harakat turlari")}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label={t("Yopish")}
              style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 2 }}
            >
              ✕
            </button>
          </div>

          {/* Turlar ro'yxati */}
          <div style={{ padding: "4px 0" }}>
            {STOCK_MOVEMENT_TYPE_OPTIONS.map(o => {
              const sign = stockMovementSign(o.id);
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 14px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      flexShrink: 0,
                      minWidth: 150,
                      padding: "2px 9px",
                      borderRadius: 999,
                      background: STOCK_MOVEMENT_DIM[o.id],
                      color: STOCK_MOVEMENT_COLOR[o.id],
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: STOCK_MOVEMENT_COLOR[o.id], flexShrink: 0 }} />
                    {o.name}
                    {sign && <span style={{ marginLeft: "auto", fontWeight: 700 }}>{sign}</span>}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.45 }}>{t(o.desc)}</span>
                </div>
              );
            })}
          </div>

          {/* Nega 2 qator chiqadi? */}
          <div style={{ padding: "10px 14px 12px", borderTop: "1.5px solid var(--border)", background: "var(--bg2)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 6 }}>
              {t("Nega 2 qator chiqadi?")}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8 }}>
              {t("Bitta amal ombor holatini ikki tomondan o'zgartiradi — shuning uchun jurnalga ikkita qator yoziladi:")}
            </p>
            {STOCK_MOVEMENT_PAIRS.map(pair => (
              <div key={pair.action} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 5 }}>
                <span style={{ fontSize: 12.5, color: "var(--text1)", minWidth: 150 }}>{t(pair.action)}</span>
                <span style={{ color: "var(--text3)" }}>→</span>
                {pair.types.map((id, i) => (
                  <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span style={{ fontSize: 12, color: "var(--text3)" }}>+</span>}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "2px 9px",
                        borderRadius: 999,
                        background: STOCK_MOVEMENT_DIM[id],
                        color: STOCK_MOVEMENT_COLOR[id],
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: STOCK_MOVEMENT_COLOR[id], flexShrink: 0 }} />
                      {byId(id)?.name}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
