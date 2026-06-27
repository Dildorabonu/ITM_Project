"use client";

import { createPortal } from "react-dom";
import { PRODUCT_UNIT_LABELS, type ProductResponse } from "@/lib/userService";
import { useT } from "@/lib/i18n";

interface Props {
  product: ProductResponse;
  onClose: () => void;
}

// Mahsulot tafsilotlarini o'ng tomonda ochiladigan drawer ko'rinishida ko'rsatadi.
export function ProductViewDrawer({ product, onClose }: Props) {
  const t = useT();
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          padding: "28px 28px 32px", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>{t("Mahsulot tafsilotlari")}</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>{t("Umumiy")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ gridColumn: "1 / -1", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Mahsulot nomi")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{product.name}</div>
          </div>
          <div style={{ gridColumn: "1 / -1", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Invoice raqami")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{product.invoiceNumber || "—"}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Bo'lim")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{product.departmentName}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Soni")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{product.quantity}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("O'lchov birligi")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{PRODUCT_UNIT_LABELS[product.unit] ?? "—"}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Yaratilgan sana")}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>
              {(() => { const d = product.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—"; })()}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>{t("Tavsif")}</div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
          <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{product.description || "—"}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
