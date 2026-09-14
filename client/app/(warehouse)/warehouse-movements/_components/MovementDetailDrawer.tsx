"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  stockMovementSign,
  STOCK_MOVEMENT_COLOR,
  STOCK_MOVEMENT_DIM,
  STOCK_MOVEMENT_LABEL,
  type StockMovement,
} from "@/lib/stockMovements";
import { RequisitionNo } from "@/app/_components/RequisitionNo";
import { STOCK_MOVEMENT_DESC } from "../_types";
import { useT } from "@/lib/i18n";

/**
 * Bitta harakat qatorining to'liq tafsiloti.
 *
 * Jadvalda mahsulot nomi, yo'nalish va izoh joyga sig'may kesiladi — bu panel
 * ularni to'liq ko'rsatadi. Shu sababli jadvaldan "Izoh" ustuni olib tashlangan.
 */
export function MovementDetailDrawer({ movement, onClose }: {
  movement: StockMovement;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const color = STOCK_MOVEMENT_COLOR[movement.type];
  const dim = STOCK_MOVEMENT_DIM[movement.type];
  const sign = stockMovementSign(movement.type);

  const direction =
    movement.sourceDepartmentName && movement.targetDepartmentName
      ? `${movement.sourceDepartmentName} → ${movement.targetDepartmentName}`
      : movement.targetDepartmentName
        ? `→ ${movement.targetDepartmentName}`
        : movement.sourceDepartmentName
          ? `${movement.sourceDepartmentName} →`
          : "—";

  const stamp = movement.createdAt
    ? `${movement.createdAt.slice(8, 10)}.${movement.createdAt.slice(5, 7)}.${movement.createdAt.slice(0, 4)} · ${movement.createdAt.slice(11, 16)}`
    : "—";

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        zIndex: 1000, display: "flex", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t("Harakat tafsiloti")}
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          padding: "24px 26px 28px", overflowY: "auto",
          animation: "panel-appear 0.28s ease",
        }}
      >
        {/* Sarlavha */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{t("Harakat tafsiloti")}</span>
          <button
            onClick={onClose}
            aria-label={t("Yopish")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Tur + izoh */}
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px", marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 11px", borderRadius: 999, background: dim, color,
            fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            {STOCK_MOVEMENT_LABEL[movement.type]}
          </span>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginTop: 10 }}>
            {t(STOCK_MOVEMENT_DESC[movement.type] ?? "")}
          </p>
        </div>

        {/* Mahsulot */}
        <Field label={t("Mahsulot")}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{movement.productName || "—"}</span>
          {movement.materialName && (
            <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
              {t("Katalog")}: {movement.materialName}
            </span>
          )}
        </Field>

        {/* Miqdor + qoldiq */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label={t("Miqdor")} flush>
            <span style={{ fontWeight: 700, fontSize: 18, fontFamily: "var(--font-mono)", color }}>
              {sign}{movement.quantity}
            </span>
          </Field>
          <Field label={t("Harakatdan keyingi qoldiq")} flush>
            <span style={{ fontWeight: 700, fontSize: 18, fontFamily: "var(--font-mono)", color: "var(--text1)" }}>
              {movement.quantityAfter}
            </span>
          </Field>
        </div>

        <Field label={t("Yo'nalish")}>
          <span style={{ fontSize: 14, color: "var(--text1)" }}>{direction}</span>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label={t("Talabnoma")} flush>
            {movement.requisitionNo
              ? <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
                  <RequisitionNo no={movement.requisitionNo} />
                </span>
              : <span style={{ color: "var(--text3)" }}>—</span>}
          </Field>
          <Field label={t("Sana va vaqt")} flush>
            <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--text1)" }}>{stamp}</span>
          </Field>
        </div>

        <Field label={t("Foydalanuvchi")}>
          <span style={{ fontSize: 14, color: "var(--text1)" }}>{movement.userFullName || "—"}</span>
        </Field>

        <Field label={t("Izoh")}>
          <span style={{ fontSize: 13.5, color: movement.notes ? "var(--text2)" : "var(--text3)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {movement.notes || t("Izoh yozilmagan")}
          </span>
        </Field>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children, flush }: { label: string; children: React.ReactNode; flush?: boolean }) {
  return (
    <div style={{
      border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
      padding: "13px 16px", marginBottom: flush ? 0 : 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text3)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
