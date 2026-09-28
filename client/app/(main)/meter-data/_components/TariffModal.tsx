"use client";

import { useEffect, useState } from "react";
import { energyTariffService, type EnergyTariff } from "@/lib/energyTariff";
import { formatMoneyFull } from "@/lib/energyFormat";
import { apiErrorMessage } from "@/lib/api";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

/** Bo'sh forma — yangi tarif uchun bugungi sana bilan. */
function emptyForm() {
  return {
    id: null as string | null,
    pricePerKwh: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export function TariffModal({
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

  const [tariffs, setTariffs] = useState<EnergyTariff[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setTariffs(await energyTariffService.getAll());
    } catch {
      showToast(t("Tariflarni yuklashda xatolik."), "error");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    const price = Number(form.pricePerKwh);

    if (!Number.isFinite(price) || price <= 0) {
      showToast(t("Narx noldan katta bo'lishi kerak."), "error");
      return;
    }

    try {
      setSaving(true);
      const dto = {
        pricePerKwh: price,
        currency: "so'm",
        effectiveFrom: form.effectiveFrom,
        note: form.note.trim() || null,
      };

      if (form.id) await energyTariffService.update(form.id, dto);
      else await energyTariffService.create(dto);

      showToast(t("Tarif saqlandi."), "success");
      setForm(emptyForm());
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Tarifni saqlashda xatolik.")), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tariff: EnergyTariff) => {
    try {
      await energyTariffService.remove(tariff.id);
      showToast(t("Tarif o'chirildi."), "success");
      // O'chirilgan tarif hozir tahrirlanayotgan bo'lsa — forma qoladigan
      // ID stale qolmasin (masalan ikkinchi oynadan o'chirilgan bo'lsa).
      setForm(f => (f.id === tariff.id ? emptyForm() : f));
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Tarifni o'chirishda xatolik.")), "error");
    }
  };

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
        style={{
          width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
          padding: 20, animation: "panel-appear 0.28s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {t("Elektr tariflari")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
              {t("Har tarif o'z sanasidan keyingi tarif kelguncha amal qiladi.")}
            </p>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            title={t("Yopish")}
            style={{ width: 30, height: 30 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ro'yxat */}
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
            {t("Yuklanmoqda...")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 18 : 0 }}>
            {tariffs.map(tariff => (
              <div
                key={tariff.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  background: "var(--surface2)", borderRadius: "var(--radius)",
                }}
              >
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text3)", width: 92, flexShrink: 0 }}>
                  {tariff.effectiveFrom.slice(0, 10)}
                </span>

                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  {formatMoneyFull(tariff.pricePerKwh, tariff.currency)}
                  <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)", marginLeft: 4 }}>/ kWh</span>
                </span>

                {tariff.note && (
                  <span
                    title={tariff.note}
                    style={{ fontSize: 11, color: "var(--text3)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {tariff.note}
                  </span>
                )}

                {canEdit && (
                  <>
                    <button
                      onClick={() => setForm({
                        id: tariff.id,
                        pricePerKwh: String(tariff.pricePerKwh),
                        effectiveFrom: tariff.effectiveFrom.slice(0, 10),
                        note: tariff.note ?? "",
                      })}
                      className="btn-icon"
                      title={t("Tahrirlash")}
                      style={{ width: 26, height: 26 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => remove(tariff)}
                      className="btn-icon"
                      title={t("O'chirish")}
                      style={{ width: 26, height: 26, color: "var(--danger)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}

            {tariffs.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12.5 }}>
                {t("Tarif kiritilmagan.")}
              </div>
            )}
          </div>
        )}

        {/* Forma — faqat Energy.Update ruxsati bilan */}
        {canEdit && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {form.id ? t("Tarifni tahrirlash") : t("Yangi tarif")}
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input
                type="number"
                min={0}
                value={form.pricePerKwh}
                onChange={e => setForm(f => ({ ...f, pricePerKwh: e.target.value }))}
                placeholder={t("Narx (so'm / kWh)")}
                style={{
                  flex: 1, minWidth: 150, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                  fontFamily: "var(--font-mono)", color: "var(--text)", outline: "none",
                }}
              />

              <input
                type="date"
                value={form.effectiveFrom}
                onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                style={{
                  width: 160, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                  fontFamily: "var(--font-mono)", color: "var(--text)", outline: "none",
                }}
              />
            </div>

            <input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder={t("Izoh (ixtiyoriy)")}
              style={{
                width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                color: "var(--text)", outline: "none", marginBottom: 10,
              }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {form.id && (
                <button
                  onClick={() => setForm(emptyForm())}
                  style={{
                    padding: "7px 14px", background: "transparent", border: "1px solid var(--border2)",
                    borderRadius: "var(--radius)", color: "var(--text2)", fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  {t("Bekor qilish")}
                </button>
              )}

              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "7px 16px", background: "var(--accent)", border: "none",
                  borderRadius: "var(--radius)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
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
