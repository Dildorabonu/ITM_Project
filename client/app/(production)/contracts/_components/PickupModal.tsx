"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ContractProductStatus,
  type ContractResponse,
} from "@/lib/userService";
import { shipmentBatchService, type ShipmentBatch } from "@/lib/shipments";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useT } from "@/lib/i18n";

// Mijozga topshirishni qayd etish modali — yakunlangan shartnoma mahsulotlarini
// mijoz qisman yoki to'liq olib ketganini ShipmentBatch partiyalari sifatida yozadi.
export function PickupModal({
  contract,
  onClose,
  onChanged,
}: {
  contract: ContractResponse;
  onClose: () => void;
  // Partiya qo'shilganda/o'chirilganda chaqiriladi — ro'yxatdagi badge yangilanishi uchun.
  onChanged: () => void;
}) {
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission("Shipments.Create");
  const canDelete = hasPermission("Shipments.Delete");
  const showToast = useToastStore((s) => s.show);

  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    shipmentBatchService
      .getByContract(contract.id)
      .then((list) => { if (!ignore) setBatches(list); })
      .catch(() => { if (!ignore) setBatches([]); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [contract.id]);

  const products = useMemo(
    () => contract.products.filter((p) => p.status !== ContractProductStatus.Cancelled),
    [contract.products],
  );

  const shippedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of batches) {
      if (!b.contractProductId) continue;
      map.set(b.contractProductId, (map.get(b.contractProductId) ?? 0) + b.amount);
    }
    return map;
  }, [batches]);

  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const shippedQty = batches.reduce((s, b) => s + b.amount, 0);
  const remainingQty = Math.max(0, totalQty - shippedQty);

  const selected = products.find((p) => p.id === productId) ?? null;
  const selectedShipped = selected ? shippedByProduct.get(selected.id) ?? 0 : 0;
  const selectedAvailable = selected ? Math.max(0, selected.quantity - selectedShipped) : 0;

  const parsed = parseFloat(amount);
  const amountValid = selected !== null && !isNaN(parsed) && parsed > 0 && parsed <= selectedAvailable;

  const productName = (pid: string | null) =>
    products.find((p) => p.id === pid)?.productType ?? "—";
  const productUnit = (pid: string | null) =>
    products.find((p) => p.id === pid)?.unit ?? "";

  const handleAdd = async () => {
    setSubmitted(true);
    if (!amountValid || !selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await shipmentBatchService.create({
        contractId: contract.id,
        contractProductId: selected.id,
        departmentId: selected.departments[0]?.id ?? null,
        amount: parsed,
      });
      setBatches((prev) => [...prev, created]);
      setAmount("");
      setSubmitted(false);
      showToast(t("Olib ketish qayd etildi!"));
      onChanged();
    } catch (e) {
      const err = e as { response?: { data?: { errors?: string[] } } };
      setError(err?.response?.data?.errors?.[0] ?? t("Saqlashda xatolik yuz berdi."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: ShipmentBatch) => {
    if (deletingId) return;
    setDeletingId(b.id);
    setError("");
    try {
      await shipmentBatchService.delete(b.id);
      setBatches((prev) => prev.filter((x) => x.id !== b.id));
      onChanged();
    } catch {
      setError(t("O'chirishda xatolik yuz berdi."));
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  };

  const sortedBatches = [...batches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 24, height: 24, borderRadius: 6,
              background: "var(--accent)", color: "#fff",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <path d="M16 8h4l3 5v3h-7z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </span>
            {t("Mijozga topshirish")}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text3)" }}>
              {contract.contractNo}
            </span>
          </span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 20px" }}>
          {/* Umumiy hisob */}
          <div style={{
            display: "flex", gap: 12, padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: "var(--accent-dim)", border: "1px solid var(--accent-mid)",
            fontSize: 13,
          }}>
            <div style={{ flex: 1, borderRight: "1px solid var(--accent-mid)", paddingRight: 12 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("Jami")}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                {totalQty.toLocaleString()}
              </div>
            </div>
            <div style={{ flex: 1, borderRight: "1px solid var(--accent-mid)", paddingRight: 12 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("Olib ketilgan")}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                {shippedQty.toLocaleString()}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("Qoldiq")}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: remainingQty > 0 ? "var(--warn)" : "var(--success)", fontFamily: "var(--font-mono)" }}>
                {remainingQty.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Mahsulotlar kesimi */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {products.map((p) => {
              const shipped = shippedByProduct.get(p.id) ?? 0;
              const pct = p.quantity > 0 ? Math.min(100, Math.round((shipped / p.quantity) * 100)) : 0;
              const done = shipped >= p.quantity;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: "var(--radius)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.productType}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                      {shipped.toLocaleString()} / {p.quantity.toLocaleString()} {p.unit}
                    </div>
                  </div>
                  <div style={{ width: 90, height: 5, borderRadius: 999, background: "var(--surface2)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: done ? "var(--success)" : "var(--accent)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: done ? "var(--success)" : "var(--accent)",
                    minWidth: 34, textAlign: "right", flexShrink: 0,
                  }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Yangi olib ketish */}
          {canCreate && (
            <div style={{
              padding: 14, borderRadius: "var(--radius)",
              background: "var(--bg2)", border: "1px solid var(--border)",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t("Olib ketishni qayd etish")}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 2, minWidth: 180, position: "relative" }}>
                  <CheckSelect
                    value={productId}
                    onChange={(v) => { setProductId(v); setSubmitted(false); setError(""); }}
                    options={products.map((p) => ({ id: p.id, name: p.productType }))}
                    placeholder={t("Mahsulotni tanlang")}
                    disablePortal
                    error={submitted && !selected}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    placeholder={t("Miqdor")}
                    style={{
                      width: "100%", background: "var(--surface)",
                      border: `1px solid ${submitted && !amountValid ? "var(--danger)" : "var(--border)"}`,
                      borderRadius: "var(--radius)", padding: "8px 12px",
                      fontSize: 13, color: "var(--text)", outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  {selected && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: parsed > selectedAvailable ? "var(--danger)" : "var(--text3)" }}>
                      {t("Qoldiq")}: {selectedAvailable.toLocaleString()} {selected.unit}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  style={{
                    padding: "8px 16px", background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--radius)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? t("Saqlanmoqda...") : t("Qayd etish")}
                </button>
              </div>
              {error && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{error}</p>
              )}
            </div>
          )}

          {/* Tarix */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {t("Olib ketishlar tarixi")}
            </div>
            {loading ? (
              <div style={{ padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>{t("Yuklanmoqda...")}</div>
            ) : sortedBatches.length === 0 ? (
              <div style={{
                padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 13,
                background: "var(--surface)", border: "1px dashed var(--border2)", borderRadius: "var(--radius)",
              }}>
                {t("Hali olib ketish qayd etilmagan")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sortedBatches.map((b) => (
                  <div key={b.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: "var(--radius)",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    fontSize: 13,
                  }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                      color: "var(--accent)", background: "var(--accent-dim)",
                      padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                    }}>
                      #{b.batchNo}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {productName(b.contractProductId)}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                      {b.amount.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{productUnit(b.contractProductId)}</span>
                    </span>
                    <span style={{ color: "var(--text3)", fontSize: 12, flexShrink: 0 }}>
                      {fmtDate(b.createdAt)}
                    </span>
                    {canDelete && (
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(b)}
                        disabled={deletingId === b.id}
                        title={t("O'chirish")}
                        style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)", width: 26, height: 26, flexShrink: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
