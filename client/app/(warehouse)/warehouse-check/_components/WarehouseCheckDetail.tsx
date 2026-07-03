"use client";

import { useEffect, useMemo, useState } from "react";
import {
  requisitionService,
  REQUISITION_TYPE_LABELS,
  type RequisitionResponse,
  type ProductResponse,
  type RequisitionWarehouseCheckItem,
} from "@/lib/userService";
import { useToastStore } from "@/lib/store/toastStore";
import {
  normalize,
  fmt,
  statusKeyframes,
  type MaterialCheckItem,
  type MaterialStatus,
} from "../_types";
import { StatusBadgeBig } from "./StatusBadgeBig";
import { attachChildPdfs } from "../_utils/attachChildPdfs";
import { useT } from "@/lib/i18n";

interface Props {
  req: RequisitionResponse;
  prodMap: Map<string, ProductResponse>;
  onClose: () => void;
  // Tekshiruv yakunlangach asosiy ro'yxatni yangilash uchun chaqiriladi.
  onSubmitted: () => void | Promise<void>;
}

// Tanlangan talabnoma bo'yicha materiallar mavjudligini tekshirish va omborchi
// tomonidan tasdiqlangan miqdorlarni kiritish ko'rinishi.
export function WarehouseCheckDetail({ req, prodMap, onClose, onSubmitted }: Props) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [editItems, setEditItems] = useState<MaterialCheckItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilter, setDetailFilter] = useState<"all" | "yetarli" | "yetishmadi" | "topilmadi">("all");

  // req yoki ombor zaxirasi o'zgarganda kiritish qiymatlarini boshlang'ich holatga keltiramiz.
  useEffect(() => {
    setEditItems(req.items.map(it => {
      const match = prodMap.get(normalize(it.materialName));
      const productQty = match?.availableQuantity ?? 0;
      const suggested = Math.min(productQty, it.quantity);
      const status: MaterialStatus = !match ? "topilmadi" : productQty >= it.quantity ? "yetarli" : "yetishmadi";
      return {
        itemId: it.id,
        name: it.materialName,
        unit: it.unit,
        required: it.quantity,
        status,
        productQty,
        available: suggested,
        notes: "",
      };
    }));
  }, [req, prodMap]);

  const detailStats = {
    total: editItems.length,
    yetarli: editItems.filter(i => i.status === "yetarli").length,
    yetishmadi: editItems.filter(i => i.status === "yetishmadi").length,
    topilmadi: editItems.filter(i => i.status === "topilmadi").length,
  };
  const pct = detailStats.total > 0 ? Math.round((detailStats.yetarli / detailStats.total) * 100) : 0;

  const filteredItems = useMemo(() => {
    let items = editItems;
    if (detailFilter !== "all") items = items.filter(i => i.status === detailFilter);
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.unit ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [editItems, detailSearch, detailFilter]);

  const updateItem = (idx: number, patch: Partial<MaterialCheckItem>) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const handleSubmit = async () => {
    // Validatsiya
    for (const it of editItems) {
      if (it.available < 0) {
        showToast(t("Mavjud miqdor manfiy bo'lishi mumkin emas"), "error");
        return;
      }
      if (it.available > it.required) {
        showToast(`"${it.name}" — ${t("mavjud miqdor")} (${it.available}) ${t("so'ralgan miqdordan")} (${it.required}) ${t("ko'p")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload: RequisitionWarehouseCheckItem[] = editItems.map(it => ({
        itemId: it.itemId,
        availableQuantity: it.available,
        warehouseNotes: it.notes.trim() || undefined,
      }));
      const childIds = await requisitionService.warehouseCheck(req.id, payload);

      // Har bir bola talabnoma uchun PDF yaratib biriktiramiz
      const pdfFailures = await attachChildPdfs(childIds);

      if (pdfFailures > 0) {
        showToast(
          `${t("Tekshiruv yakunlandi,")} ${pdfFailures} ${t("ta PDF yaratilmadi")}`,
          t("Ogohlantirish"),
        );
      } else {
        showToast(t("Tekshiruv yakunlandi va talabnomalar tasdiqlashga jo'natildi"), "success");
      }
      await onSubmitted();
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
      {/* Header */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px" }}>
        <button onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
          ← {t("Orqaga")}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {req.requisitionNo} — {req.purpose}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            <span>{REQUISITION_TYPE_LABELS[req.type]}</span>
            {req.contractNo && <span style={{ marginLeft: 8 }}>{t("Shartnoma")}: {req.contractNo}</span>}
            {req.departmentName && <span style={{ marginLeft: 8 }}>{req.departmentName}</span>}
            {req.createdAt && <span style={{ marginLeft: 8 }}>{fmt(req.createdAt)}</span>}
            {req.createdByName && <span style={{ marginLeft: 8 }}>{req.createdByName}</span>}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "0 18px", height: 38, borderRadius: "var(--radius)",
            border: "1px solid var(--accent)",
            background: submitting ? "var(--accent-dim)" : "var(--accent)",
            color: submitting ? "var(--accent)" : "#fff",
            fontSize: 13, fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            transition: "all 0.15s",
          }}
        >
          {submitting ? t("Yuborilmoqda...") : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t("Tekshiruvni yakunlash")}
            </>
          )}
        </button>
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Jami materiallar")}</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>{detailStats.total}</div>
        </div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Yetarli")}</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--success)" }}>{detailStats.yetarli}</div>
        </div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Qisman bor")}</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--warn)" }}>{detailStats.yetishmadi}</div>
        </div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Yo'q")}</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--danger)" }}>{detailStats.topilmadi}</div>
        </div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>{t("Yetarlilik")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 22, color: pct === 100 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)" }}>{pct}%</span>
          </div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--bg3)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: pct === 100 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {/* Search + filter toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Material qidirish...")} value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
        </div>
        {(["all", "yetarli", "yetishmadi", "topilmadi"] as const).map(f => (
          <button key={f} onClick={() => setDetailFilter(f)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", height: 32, borderRadius: "var(--radius)",
              border: `1px solid ${detailFilter === f ? "var(--accent)" : "var(--border)"}`,
              background: detailFilter === f ? "var(--accent-dim)" : "var(--bg2)",
              color: detailFilter === f ? "var(--accent)" : "var(--text2)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>
            {f === "all" ? `${t("Barchasi")} (${detailStats.total})` : f === "yetarli" ? `${t("Yetarli")} (${detailStats.yetarli})` : f === "yetishmadi" ? `${t("Qisman")} (${detailStats.yetishmadi})` : `${t("Yo'q")} (${detailStats.topilmadi})`}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{filteredItems.length} {t("ta natija")}</span>
      </div>

      {/* Materials table */}
      <div className="itm-card" style={{ flex: 1 }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 360px)" }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
              {detailSearch || detailFilter !== "all" ? t("Natija topilmadi") : t("Materiallar yo'q")}
            </div>
          ) : (
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>{t("T/r")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Material nomi")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("O'lchov")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Kerakli miqdor")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Ombordagi miqdor")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none", minWidth: 160 }}>{t("Mavjud (tasdiqlangan)")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Holati")}</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none", minWidth: 200 }}>{t("Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const idx = editItems.findIndex(e => e.itemId === item.itemId);
                  const overLimit = item.available > item.required;
                  return (
                    <tr key={item.itemId}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "12px 14px" }}>{String(idx + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "12px 14px" }}>{item.name}</td>
                      <td style={{ textAlign: "center", padding: "12px 14px" }}>{item.unit || "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, padding: "12px 14px" }}>{item.required > 0 ? item.required : "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "12px 14px", color: item.productQty > 0 ? "var(--text1)" : "var(--text3)" }}>
                        {item.productQty > 0 ? item.productQty : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="number"
                          min={0}
                          max={item.required}
                          step="0.0001"
                          value={item.available}
                          onChange={e => updateItem(idx, { available: Math.max(0, Number(e.target.value) || 0) })}
                          style={{
                            width: 110, padding: "6px 10px",
                            borderRadius: "var(--radius)",
                            border: `1.5px solid ${overLimit ? "var(--danger)" : "var(--border)"}`,
                            background: "var(--surface)",
                            color: overLimit ? "var(--danger)" : "var(--text)",
                            fontSize: 13, fontWeight: 600, textAlign: "center",
                            outline: "none",
                          }}
                        />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <StatusBadgeBig
                          status={item.available <= 0 ? "topilmadi" : item.available >= item.required ? "yetarli" : "yetishmadi"}
                          available={item.available}
                          required={item.required}
                        />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <input
                          type="text"
                          placeholder={t("Izoh (ixtiyoriy)...")}
                          value={item.notes}
                          onChange={e => updateItem(idx, { notes: e.target.value })}
                          style={{
                            width: "100%", padding: "6px 10px",
                            borderRadius: "var(--radius)", border: "1.5px solid var(--border)",
                            background: "var(--surface)", color: "var(--text)",
                            fontSize: 12, outline: "none",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
