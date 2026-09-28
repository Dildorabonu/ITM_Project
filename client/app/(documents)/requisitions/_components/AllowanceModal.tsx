"use client";

import { useEffect, useState } from "react";
import { requisitionAllowanceService, type RequisitionAllowanceRate } from "@/lib/requisitionAllowance";
import { apiErrorMessage } from "@/lib/api";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

export function AllowanceModal({
  canEdit,
  onClose,
  onSaved,
}: {
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [rates, setRates] = useState<RequisitionAllowanceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setRates(await requisitionAllowanceService.getAll());
    } catch {
      showToast(t("Zaxira tarixini yuklashda xatolik."), t("Xatolik"));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    const value = Number(percent.replace(",", "."));
    if (!percent.trim() || !Number.isFinite(value) || value < 0 || value > 20) {
      showToast(t("Zaxira foizi 0 dan 20 gacha bo'lishi kerak."), t("Xatolik"));
      return;
    }

    try {
      setSaving(true);
      await requisitionAllowanceService.create({ percent: value, note: note.trim() || null });
      showToast(t("Zaxira foizi saqlandi."), "success");
      setPercent("");
      setNote("");
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Zaxira foizini saqlashda xatolik.")), t("Xatolik"));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "7px 10px", fontSize: 13, color: "var(--text)", outline: "none",
  } as const;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="itm-card"
        style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 20, animation: "panel-appear 0.28s ease" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <h2 className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {t("Talabnoma zaxirasi")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
              {t("Me'yoriy sarfdan to'ldirilgan talabnomaga foydalanuvchi ixtiyoriy qo'shadigan foiz.")}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" title={t("Yopish")} style={{ width: 30, height: 30, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>{t("Yuklanmoqda...")}</div>
        ) : (
          <>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>
              {t("Amaldagi foiz")}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)", marginBottom: 16 }}>
              {fmtDecimal(rates[0]?.percent ?? 0)}%
            </p>

            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {t("O'zgarishlar tarixi")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 18 : 0 }}>
              {rates.map((rate, i) => (
                <div
                  key={rate.id}
                  className={`nd-fadein-${Math.min(i, 4)}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", borderRadius: "var(--radius)" }}
                >
                  <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text3)", width: 82, flexShrink: 0 }}>
                    {rate.createdAt.slice(0, 10)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)", width: 52, flexShrink: 0 }}>
                    {fmtDecimal(rate.percent)}%
                  </span>
                  <span
                    title={rate.note ?? undefined}
                    style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {rate.note ?? ""}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>
                    {rate.createdByName ?? t("Tizim")}
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "var(--success-dim)", color: "var(--success)" }}>
                      {t("amaldagi")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {canEdit && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {t("Yangi foiz")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                type="number"
                min={0}
                max={20}
                step={0.01}
                value={percent}
                onChange={e => setPercent(e.target.value)}
                placeholder={t("Foiz (0–20)")}
                style={{ ...inputStyle, width: 130, fontFamily: "var(--font-mono)" }}
              />
              <input
                value={note}
                maxLength={500}
                onChange={e => setNote(e.target.value)}
                placeholder={t("Izoh (ixtiyoriy)")}
                style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "7px 16px", background: "var(--accent)", border: "none",
                  borderRadius: "var(--radius)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? t("Saqlanmoqda...") : t("Saqlash")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
