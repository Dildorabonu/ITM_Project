"use client";

import { useState } from "react";
import { PRODUCT_UNIT_LABELS, type ProductResponse } from "@/lib/userService";
import { warehouseScanService, type ScanLookupResult } from "@/lib/scan";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

interface Props {
  product: ProductResponse;
  onClose: () => void;
  onAdjusted: (result: ScanLookupResult) => void;
}

// Qoldiqni qo'lda tuzatish (inventarizatsiya, shikast). Mahsulot tahririda son
// maydoni yo'q — qoldiq faqat shu yerdan, sabab bilan jurnalga yozilib o'zgaradi.
export function StockAdjustModal({ product, onClose, onAdjusted }: Props) {
  const t = useT();
  const showToast = useToastStore(s => s.show);
  const [qty, setQty] = useState(String(product.quantity));
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unit = t(PRODUCT_UNIT_LABELS[product.unit] ?? "");
  const reserved = Math.max(0, product.quantity - product.availableQuantity);
  const parsed = qty.trim() === "" ? NaN : Number(qty);
  const qtyValid = Number.isFinite(parsed) && parsed >= 0;
  const belowReserved = qtyValid && parsed < reserved;
  const unchanged = qtyValid && parsed === product.quantity;
  const delta = qtyValid ? Math.round((parsed - product.quantity) * 10000) / 10000 : 0;
  const reasonMissing = !reason.trim();

  const handleSave = async () => {
    setSubmitted(true);
    setError("");
    if (!qtyValid || belowReserved || unchanged || reasonMissing) return;
    setSaving(true);
    try {
      const result = await warehouseScanService.action({
        productId: product.id,
        type: "Adjust",
        quantity: parsed,
        notes: reason.trim(),
      });
      onAdjusted(result);
      showToast(`"${product.name}" ${t("qoldig'i tuzatildi.")}`, t("Saqlandi"));
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setError(msg ?? t("Saqlashda xatolik yuz berdi."));
    } finally {
      setSaving(false);
    }
  };

  const qtyError = submitted && !qtyValid
    ? t("Yangi qoldiqni kiriting")
    : belowReserved
      ? t("Yangi qoldiq rezervdagi miqdordan kam bo'lmasligi kerak")
      : "";

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ width: 440, animation: "panel-appear 0.28s ease" }}>
        <div className="modal-header">
          <span>{t("Qoldiqni tuzatish")}</span>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={product.name}>
            {product.name}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stat label={t("Hozirgi qoldiq")} value={`${product.quantity} ${unit}`} />
            <Stat label={t("Rezervda")} value={`${reserved} ${unit}`} muted={reserved === 0} />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: qtyError ? "var(--danger)" : "var(--text2)" }}>
              {t("Yangi qoldiq")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input className="form-input" type="number" min="0" step="any" autoFocus
                value={qty}
                onChange={e => setQty(e.target.value)}
                onWheel={e => (e.target as HTMLInputElement).blur()}
                style={{ fontFamily: "var(--font-mono)", ...(qtyError ? { borderColor: "var(--danger)" } : {}) }}
              />
              {qtyValid && !unchanged && (
                <span style={{
                  flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                  color: delta < 0 ? "var(--danger)" : "var(--success)",
                }}>
                  {delta > 0 ? "+" : "−"}{Math.abs(delta)}
                </span>
              )}
            </div>
            {qtyError && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{qtyError}</div>}
            {submitted && unchanged && (
              <div style={{ color: "var(--warn)", fontSize: 12, marginTop: 4 }}>{t("Qoldiq o'zgarmadi")}</div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: submitted && reasonMissing ? "var(--danger)" : "var(--text2)" }}>
              {t("Tuzatish sababi")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea className="form-input" rows={3} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t("Masalan: inventarizatsiyada 3 ta kam chiqdi")}
              style={{ resize: "vertical", ...(submitted && reasonMissing ? { borderColor: "var(--danger)" } : {}) }}
            />
            {submitted && reasonMissing && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{t("Tuzatish sababini kiriting")}</div>
            )}
          </div>

          <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
            {t("Tuzatish harakatlar tarixiga sabab va sizning ismingiz bilan yoziladi.")}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--danger-dim)", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>
            {t("Bekor qilish")}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: muted ? "var(--text3)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
