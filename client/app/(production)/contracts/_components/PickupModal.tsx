"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ContractProductStatus,
  type ContractResponse,
} from "@/lib/userService";
import { shipmentBatchService, ShipmentBatchKind, type ShipmentBatch, type ShipmentReady } from "@/lib/shipments";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useT } from "@/lib/i18n";

// Mijozga topshirishni qayd etish modali — shartnoma (yakunlangan yoki hali
// ishlab chiqarishda bo'lgan) mahsulotlarini mijoz qisman yoki to'liq olib
// ketganini ShipmentBatch partiyalari sifatida yozadi. Tugallanmagan mahsulot
// uchun faqat omborga kirim qilingan (tayyor) miqdorgacha topshirish mumkin.
export function PickupModal({
  contract,
  onClose,
  onChanged,
}: {
  contract: ContractResponse;
  onClose: () => void;
  // Partiya qo'shilganda chaqiriladi — ro'yxatdagi badge yangilanishi uchun.
  onChanged: () => void;
}) {
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission("Shipments.Create");
  const showToast = useToastStore((s) => s.show);

  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  // Ishlab chiqarish partiyalari — olib ketish qaysi partiyadan ekanini tanlash uchun.
  const [prodBatches, setProdBatches] = useState<ShipmentBatch[]>([]);
  const [readyList, setReadyList] = useState<ShipmentReady[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  // "auto" — miqdor eng eski partiyadan boshlab avtomatik taqsimlanadi.
  const [sourceBatchId, setSourceBatchId] = useState("auto");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    Promise.all([
      // Faqat mijoz olib ketishlari — vazifalardan yuborilgan ishlab chiqarish
      // partiyalari bu tarixga kirmaydi.
      shipmentBatchService
        .getByContract(contract.id, undefined, ShipmentBatchKind.CustomerPickup)
        .catch(() => [] as ShipmentBatch[]),
      // Ishlab chiqarish partiyalari — olib ketish manbasini tanlash uchun.
      shipmentBatchService
        .getByContract(contract.id, undefined, ShipmentBatchKind.Production)
        .catch(() => [] as ShipmentBatch[]),
      // Tayyor miqdor yuklanmasa (null) — eski xatti-harakat: to'liq miqdor limit.
      shipmentBatchService.getReady(contract.id).catch(() => null),
    ])
      .then(([list, prod, ready]) => {
        if (ignore) return;
        setBatches(list);
        setProdBatches(prod);
        setReadyList(ready);
      })
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

  // Mahsulot bo'yicha topshirishga tayyor (omborga kirim qilingan) miqdor.
  // Ma'lumot kelmagan bo'lsa (null) — eski xatti-harakat: to'liq miqdor limit.
  const readyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of readyList ?? []) map.set(r.contractProductId, r.readyQuantity);
    return map;
  }, [readyList]);
  const readyFor = (p: { id: string; quantity: number }) =>
    readyList === null ? p.quantity : Math.min(readyByProduct.get(p.id) ?? 0, p.quantity);

  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const shippedQty = batches.reduce((s, b) => s + b.amount, 0);
  const remainingQty = Math.max(0, totalQty - shippedQty);

  const selected = products.find((p) => p.id === productId) ?? null;
  const selectedShipped = selected ? shippedByProduct.get(selected.id) ?? 0 : 0;
  const selectedAvailable = selected ? Math.max(0, readyFor(selected) - selectedShipped) : 0;

  // Har bir ishlab chiqarish partiyasidan qancha olib ketilgani — partiya
  // qoldig'i shundan hisoblanadi (bitta partiyadan bo'lib-bo'lib olish mumkin).
  const takenBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of batches) {
      if (!b.sourceBatchId) continue;
      map.set(b.sourceBatchId, (map.get(b.sourceBatchId) ?? 0) + b.amount);
    }
    return map;
  }, [batches]);
  const batchRemaining = (pb: ShipmentBatch) =>
    Math.max(0, pb.amount - (takenBySource.get(pb.id) ?? 0));

  // Mahsulot bo'yicha ishlab chiqarish partiyalari.
  const prodBatchesByProduct = useMemo(() => {
    const map = new Map<string, ShipmentBatch[]>();
    for (const pb of prodBatches) {
      if (!pb.contractProductId) continue;
      const arr = map.get(pb.contractProductId) ?? [];
      arr.push(pb);
      map.set(pb.contractProductId, arr);
    }
    return map;
  }, [prodBatches]);

  // "Omborda tayyor" — faqat jo'natma (partiya) holiga keltirilgan va hali olib
  // ketilmagan miqdor. Omborga topshirilgan lekin partiya qilinmagan qismi
  // kirmaydi. Partiyasi yo'q mahsulotda (eski oqim/qo'lda Completed) —
  // ombordagi tayyor miqdor bo'yicha.
  const pickupReadyFor = (p: { id: string; quantity: number }) => {
    const pbs = prodBatchesByProduct.get(p.id) ?? [];
    if (pbs.length === 0) return readyFor(p);
    return pbs.reduce((s, pb) => s + batchRemaining(pb), 0);
  };

  // Tanlangan mahsulotning partiyalari; partiya bo'lsa — tanlash majburiy,
  // bo'lmasa (eski oqim/qo'lda Completed) umumiy tayyor miqdor bo'yicha ishlaydi.
  const productBatches = selected
    ? prodBatches.filter((pb) => pb.contractProductId === selected.id)
    : [];
  const requireSource = productBatches.length > 0;
  const isAuto = sourceBatchId === "auto";
  const sourceBatch = productBatches.find((pb) => pb.id === sourceBatchId) ?? null;
  const totalBatchRemaining = productBatches.reduce((s, pb) => s + batchRemaining(pb), 0);
  const effectiveAvailable = !requireSource
    ? selectedAvailable
    : sourceBatch
      ? Math.min(batchRemaining(sourceBatch), selectedAvailable)
      : Math.min(totalBatchRemaining, selectedAvailable);

  const parsed = parseFloat(amount);
  const amountValid =
    selected !== null &&
    (!requireSource || sourceBatch !== null || isAuto) &&
    !isNaN(parsed) && parsed > 0 && parsed <= effectiveAvailable;

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
      if (requireSource && isAuto) {
        // Avtomatik: server miqdorni eng eski partiyadan boshlab taqsimlaydi,
        // har partiyadan olingan qismi alohida yozuv bo'lib qaytadi.
        const createdList = await shipmentBatchService.createPickupAuto({
          contractId: contract.id,
          contractProductId: selected.id,
          departmentId: selected.departments[0]?.id ?? null,
          amount: parsed,
        });
        setBatches((prev) => [...prev, ...createdList]);
      } else {
        const created = await shipmentBatchService.create({
          contractId: contract.id,
          contractProductId: selected.id,
          departmentId: selected.departments[0]?.id ?? null,
          amount: parsed,
          kind: ShipmentBatchKind.CustomerPickup,
          sourceBatchId: sourceBatch?.id ?? null,
        });
        setBatches((prev) => [...prev, created]);
      }
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
              const ready = pickupReadyFor(p);
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
                      {/* Tugallanmagan mahsulot — hozircha omborda qancha tayyor ekani */}
                      {ready < p.quantity && (
                        <span style={{ color: "var(--warn)" }}>
                          {" "}· {t("omborda tayyor")}: {ready.toLocaleString()}
                        </span>
                      )}
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
                    onChange={(v) => { setProductId(v); setSourceBatchId("auto"); setSubmitted(false); setError(""); }}
                    options={products.map((p) => ({ id: p.id, name: p.productType }))}
                    placeholder={t("Mahsulotni tanlang")}
                    disablePortal
                    error={submitted && !selected}
                  />
                </div>
                {/* Qaysi partiyadan olib ketilayotgani — partiya qoldig'i bilan */}
                {requireSource && (
                  <div style={{ flex: 2, minWidth: 170, position: "relative" }}>
                    <CheckSelect
                      value={sourceBatchId}
                      onChange={(v) => { setSourceBatchId(v); setSubmitted(false); setError(""); }}
                      options={[
                        { id: "auto", name: t("Avtomatik (eski partiyadan boshlab)") },
                        ...productBatches
                          .filter((pb) => batchRemaining(pb) > 0)
                          .map((pb) => ({
                            id: pb.id,
                            name: `#${pb.batchNo} — ${t("qoldiq")} ${batchRemaining(pb).toLocaleString()} ${selected?.unit ?? ""}`,
                          })),
                      ]}
                      placeholder={t("Partiyani tanlang")}
                      disablePortal
                      error={submitted && !sourceBatch && !isAuto}
                    />
                  </div>
                )}
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
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: parsed > effectiveAvailable ? "var(--danger)" : "var(--text3)" }}>
                      {t("Olib ketish mumkin")}: {effectiveAvailable.toLocaleString()} {selected.unit}
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
                      {/* Qaysi ishlab chiqarish partiyasidan olingani */}
                      {b.sourceBatchNo != null && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 600,
                          fontFamily: "var(--font-mono)", color: "var(--text3)",
                          background: "var(--surface2)", padding: "1px 7px",
                          borderRadius: 999,
                        }}>
                          {t("Partiya")} #{b.sourceBatchNo}
                        </span>
                      )}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                      {b.amount.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{productUnit(b.contractProductId)}</span>
                    </span>
                    <span style={{ color: "var(--text3)", fontSize: 12, flexShrink: 0 }}>
                      {fmtDate(b.createdAt)}
                    </span>
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
