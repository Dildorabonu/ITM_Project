"use client";

import { useEffect, useMemo, useState } from "react";
import {
  requisitionService,
  REQUISITION_TYPE_LABELS,
  type RequisitionQueueRow,
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
import { SubmitProgressOverlay } from "@/app/(documents)/requisitions/_components/SubmitProgressOverlay";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

// Status ranglari panel bo'ylab bitta joydan boshqariladi — bar segmenti,
// filtr nuqtasi va aktiv filtr foni bir xil rangda bo'lishi uchun.
const SEGMENTS = [
  { key: "yetarli", label: "Yetarli", color: "var(--success)" },
  { key: "yetishmadi", label: "Qisman", color: "var(--warn)" },
  { key: "topilmadi", label: "Yo'q", color: "var(--danger)" },
] as const;

// Yakunlash jarayonining bosqichlari — overlay ham, kod ham shu ro'yxatga tayanadi.
const SUBMIT_STEPS = [
  "Tekshiruv saqlanmoqda",
  "Talabnomalar PDF'ga tayyorlanmoqda",
  "Ro'yxat yangilanmoqda",
];

const FILTERS = [
  { key: "all", label: "Barchasi", color: "var(--accent)", dim: "var(--accent-dim)" },
  { key: "yetarli", label: "Yetarli", color: "var(--success)", dim: "var(--success-dim)" },
  { key: "yetishmadi", label: "Qisman", color: "var(--warn)", dim: "var(--warn-dim)" },
  { key: "topilmadi", label: "Yo'q", color: "var(--danger)", dim: "var(--danger-dim)" },
] as const;

interface Props {
  req: RequisitionQueueRow;
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
  // null — yuborilmayapti, 0..2 — faol bosqich, 3 — hammasi tugadi.
  const [submitStage, setSubmitStage] = useState<number | null>(null);
  const submitting = submitStage !== null;
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
      };
    }));
  }, [req, prodMap]);

  // html2pdf chunk'ini fon rejimida oldindan yuklaymiz — "Tekshiruvni yakunlash"
  // bosilganda modulni yuklab, parse qilish (1-2s) kutish vaqtidan tushib qoladi.
  useEffect(() => {
    import("@/app/(documents)/requisitions/_utils/generateRequisitionPdf")
      .then(m => m.preloadPdfEngine())
      .catch(() => { /* generatsiya vaqtida qayta urinadi */ });
  }, []);

  // Jarayon o'rtasida tab yopilsa yoki reload qilinsa, bola talabnomalar
  // PDF'siz qolib ketadi — ogohlantiramiz.
  useEffect(() => {
    if (submitStage === null) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [submitStage]);

  const detailStats = {
    total: editItems.length,
    yetarli: editItems.filter(i => i.status === "yetarli").length,
    yetishmadi: editItems.filter(i => i.status === "yetishmadi").length,
    topilmadi: editItems.filter(i => i.status === "topilmadi").length,
  };
  const pct = detailStats.total > 0 ? Math.round((detailStats.yetarli / detailStats.total) * 100) : 0;
  const pctColor = pct === 100 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";

  const filteredItems = useMemo(() => {
    let items = editItems;
    if (detailFilter !== "all") items = items.filter(i => i.status === detailFilter);
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.unit ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [editItems, detailSearch, detailFilter]);

  const handleSubmit = async () => {
    if (submitting) return;
    // Overlay ostida fokus qolib ketmasligi uchun.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSubmitStage(0);
    try {
      // Mavjud miqdor ombor zaxirasidan avtomatik hisoblanadi — qo'lda kiritilmaydi.
      const payload: RequisitionWarehouseCheckItem[] = editItems.map(it => ({
        itemId: it.itemId,
        availableQuantity: it.available,
      }));
      const childIds = await requisitionService.warehouseCheck(req.id, payload);

      // Har bir bola talabnoma uchun PDF yaratib biriktiramiz
      setSubmitStage(1);
      const pdfFailures = await attachChildPdfs(childIds);

      if (pdfFailures > 0) {
        showToast(
          `${t("Tekshiruv yakunlandi,")} ${pdfFailures} ${t("ta PDF yaratilmadi")}`,
          t("Ogohlantirish"),
        );
      } else {
        showToast(t("Tekshiruv yakunlandi va talabnomalar tasdiqlashga jo'natildi"), "success");
      }
      // Sidebar badge darhol yangilanishi uchun
      window.dispatchEvent(new Event("warehouse-check-updated"));
      setSubmitStage(2);
      await onSubmitted();
      // Overlay 100% da qoladi va komponent unmount bo'lganda yo'qoladi.
      setSubmitStage(SUBMIT_STEPS.length);
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
      setSubmitStage(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
      {submitStage !== null && (
        <SubmitProgressOverlay
          stage={submitStage}
          title="Tekshiruv yakunlanmoqda"
          steps={SUBMIT_STEPS}
        />
      )}
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

      {/* Yetarlilik paneli: foiz + zaxira tarkibi bari + filtr/qidiruv bir kartada */}
      <div className="itm-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 18px", flexWrap: "wrap" }}>
          {/* Yetarlilik foizi */}
          <div style={{ minWidth: 96 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--text3)" }}>
              {t("Yetarlilik")}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: 4 }}>
              <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, letterSpacing: -1.2, color: pctColor, fontVariantNumeric: "tabular-nums" }}>{pct}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: pctColor }}>%</span>
            </div>
          </div>

          {/* Zaxira tarkibi — segmentlar kengligi materiallar soniga proporsional */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 6, overflow: "hidden", background: "var(--bg3)" }}>
              {SEGMENTS.map(s => {
                const count = detailStats[s.key];
                if (count === 0) return null;
                return (
                  <button
                    key={s.key}
                    onClick={() => setDetailFilter(s.key)}
                    title={`${t(s.label)} — ${count}`}
                    aria-label={`${t(s.label)} — ${count}`}
                    style={{
                      flex: count, border: "none", padding: 0, cursor: "pointer",
                      background: s.color,
                      opacity: detailFilter === "all" || detailFilter === s.key ? 1 : 0.28,
                      transition: "flex 0.4s ease, opacity 0.15s",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ marginTop: 7, fontSize: 12, color: "var(--text3)" }}>
              <span style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {detailStats.yetarli} / {detailStats.total}
              </span>{" "}
              {t("ta material to'liq yetarli")}
            </div>
          </div>
        </div>

        {/* Qidiruv + status filtrlari */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "10px 18px", borderTop: "1.5px solid var(--border)", background: "var(--bg3)",
        }}>
          <div className="search-wrap" style={{ maxWidth: 320, flex: 1, minWidth: 180 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="search-input" style={{ background: "var(--surface)" }} placeholder={t("Material qidirish...")} value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
          </div>

          <div style={{ display: "flex", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--surface)" }}>
            {FILTERS.map((f, i) => {
              const active = detailFilter === f.key;
              const count = f.key === "all" ? detailStats.total : detailStats[f.key];
              return (
                <button key={f.key} onClick={() => setDetailFilter(f.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 32,
                    border: "none", borderLeft: i === 0 ? "none" : "1.5px solid var(--border)",
                    background: active ? f.dim : "transparent",
                    color: active ? f.color : count === 0 ? "var(--text3)" : "var(--text2)",
                    fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                    background: count === 0 && !active ? "var(--border2)" : f.color,
                  }} />
                  {t(f.label)}
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", opacity: active ? 1 : 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>

          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {filteredItems.length} {t("ta natija")}
          </span>
        </div>
      </div>

      {/* Materials table */}
      <div className="itm-card" style={{ flex: 1 }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 336px)" }}>
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
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const idx = editItems.findIndex(e => e.itemId === item.itemId);
                  return (
                    <tr key={item.itemId}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "12px 14px" }}>{String(idx + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "12px 14px" }}>{item.name}</td>
                      <td style={{ textAlign: "center", padding: "12px 14px" }}>{item.unit || "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, padding: "12px 14px" }}>{item.required > 0 ? fmtDecimal(item.required) : "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "12px 14px", color: item.productQty > 0 ? "var(--text1)" : "var(--text3)" }}>
                        {item.productQty > 0 ? fmtDecimal(item.productQty) : "—"}
                      </td>
                      {/* Avtomatik hisoblanadi — omborchi qo'lda o'zgartira olmaydi. */}
                      <td style={{
                        textAlign: "center", padding: "12px 14px",
                        fontFamily: "Inter, sans-serif", fontWeight: 600,
                        color: item.available > 0 ? "var(--text1)" : "var(--text3)",
                      }}>
                        {item.available > 0 ? fmtDecimal(item.available) : "0"}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <StatusBadgeBig
                          status={item.available <= 0 ? "topilmadi" : item.available >= item.required ? "yetarli" : "yetishmadi"}
                          available={item.available}
                          required={item.required}
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
