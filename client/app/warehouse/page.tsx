"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  requisitionService,
  productService,
  RequisitionStatus,
  RequisitionType,
  REQUISITION_TYPE_LABELS,
  type RequisitionResponse,
  type ProductResponse,
  type RequisitionWarehouseCheckItem,
} from "@/lib/userService";
import { useToastStore } from "@/lib/store/toastStore";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y.slice(-2)}` : "—";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReqCheckRow {
  id: string;
  requisitionNo: string;
  type: RequisitionType;
  purpose: string;
  contractNo?: string;
  departmentName?: string;
  createdByName: string;
  createdAt: string;
  totalItems: number;
  foundItems: number;
  missingItems: number;
  fullyAvailable: boolean;
}

type MaterialStatus = "topilmadi" | "yetishmadi" | "yetarli";

interface MaterialCheckItem {
  itemId: string;
  name: string;
  unit: string;
  required: number;
  status: MaterialStatus;
  productQty: number;
  // Omborchi kirita oladigan qiymat (default: min(productQty, required))
  available: number;
  notes: string;
}

// ─── Animations ────────────────────────────────────────────────────────────

const statusKeyframes = `
@keyframes drawCheck { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
@keyframes drawCircle { 0% { stroke-dashoffset: 63; } 100% { stroke-dashoffset: 0; } }
@keyframes fadeSlideIn { 0% { opacity: 0; transform: translateY(6px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes ringPulse { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes dotBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes overlayFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes overlayFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes spinRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes orbitDot { 0% { transform: rotate(0deg) translateX(52px) rotate(0deg); opacity: 0.9; } 50% { opacity: 0.4; } 100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); opacity: 0.9; } }
@keyframes pulseCore { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); } 50% { transform: scale(1.08); box-shadow: 0 0 30px 8px rgba(59, 130, 246, 0.15); } }
@keyframes textFadeUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes dataStreamLine { 0% { transform: translateX(-100%); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateX(100%); opacity: 0; } }
`;

function StatusBadgeBig({ status, available, required }: { status: MaterialStatus; available: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((available / required) * 100)) : 0;
  if (status === "yetarli") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
        borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: "var(--success-dim)", color: "var(--success)", border: "1px solid rgba(15,123,69,0.25)",
        animation: "fadeSlideIn 0.3s ease-out",
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Yetarli
      </span>
    );
  }
  if (status === "yetishmadi") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
        borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: "var(--warn-dim)", color: "var(--warn)", border: "1px solid rgba(224,123,0,0.25)",
        animation: "fadeSlideIn 0.3s ease-out",
      }}>
        Qisman ({pct}%)
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(217,48,37,0.25)",
      animation: "fadeSlideIn 0.3s ease-out",
    }}>
      Yo&apos;q
    </span>
  );
}

function DetailLoadingOverlay({ dataReady, onComplete }: { dataReady: boolean; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);
  const minDuration = 1500;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      let pct: number;
      if (elapsed < minDuration) {
        pct = Math.min(85, (elapsed / minDuration) * 85);
      } else if (!dataReady) {
        pct = Math.min(95, 85 + ((elapsed - minDuration) / 5000) * 10);
      } else {
        pct = 100;
      }
      setProgress(pct);
      if (elapsed > 600) setPhase(1);
      if (elapsed > 1200) setPhase(2);

      if (elapsed >= minDuration && dataReady && !completedRef.current) {
        completedRef.current = true;
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(onComplete, 400);
        }, 200);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [dataReady, onComplete]);

  const phaseTexts = [
    "Ma‘lumotlar yuklanmoqda...",
    "Materiallar tahlil qilinmoqda...",
    "Tayyorlanmoqda...",
  ];

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      background: "rgba(15, 23, 42, 0.65)",
      animation: fadeOut ? "overlayFadeOut 0.4s ease-out forwards" : "overlayFadeIn 0.3s ease-out",
    }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
      <div style={{ position: "relative", width: 100, height: 100, marginBottom: 24 }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: "50%", background: "#60a5fa", animation: "orbitDot 2.5s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#3b82f6", borderRightColor: "#6366f1", animation: "spinRing 1.2s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 32, height: 32, marginLeft: -16, marginTop: -16, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)", animation: "pulseCore 2s ease-in-out infinite" }} />
      </div>
      <div key={phase} style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", animation: "textFadeUp 0.4s ease-out", marginBottom: 16 }}>{phaseTexts[phase]}</div>
      <div style={{ width: 220, height: 4, borderRadius: 2, background: "rgba(51, 65, 85, 0.6)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)", transition: "width 0.1s linear" }} />
      </div>
    </div>
  , document.body);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const showToast = useToastStore((s) => s.show);

  const [requisitions, setRequisitions] = useState<RequisitionResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDataReady, setDetailDataReady] = useState(false);
  const pendingReqId = useRef<string | null>(null);

  // Detail view: omborchi kiritgan qiymatlar
  const [editItems, setEditItems] = useState<MaterialCheckItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, prods] = await Promise.all([
        requisitionService.getAll(RequisitionStatus.PendingWarehouseCheck),
        productService.getAll(1, 1000),
      ]);
      setRequisitions(reqs);
      setProducts(prods.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Product lookup ───────────────────────────────────────────────────────

  const prodMap = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    for (const p of products) map.set(normalize(p.name), p);
    return map;
  }, [products]);

  // ── Build rows ───────────────────────────────────────────────────────────

  const reqRows = useMemo<ReqCheckRow[]>(() => {
    return requisitions.map(req => {
      const totalItems = req.items.length;
      const foundItems = req.items.filter(it => {
        const match = prodMap.get(normalize(it.materialName));
        return match && match.quantity >= it.quantity;
      }).length;
      const missingItems = totalItems - foundItems;
      return {
        id: req.id,
        requisitionNo: req.requisitionNo,
        type: req.type,
        purpose: req.purpose,
        contractNo: req.contractNo,
        departmentName: req.departmentName,
        createdByName: req.createdByName,
        createdAt: req.createdAt,
        totalItems,
        foundItems,
        missingItems,
        fullyAvailable: totalItems > 0 && missingItems === 0,
      };
    });
  }, [requisitions, prodMap]);

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return reqRows;
    const q = search.toLowerCase();
    return reqRows.filter(r =>
      r.requisitionNo.toLowerCase().includes(q) ||
      r.purpose.toLowerCase().includes(q) ||
      (r.contractNo ?? "").toLowerCase().includes(q) ||
      (r.departmentName ?? "").toLowerCase().includes(q) ||
      r.createdByName.toLowerCase().includes(q)
    );
  }, [reqRows, search]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = reqRows.length;
    const fullyAvailable = reqRows.filter(r => r.fullyAvailable).length;
    const partial = total - fullyAvailable;
    return { total, fullyAvailable, partial };
  }, [reqRows]);

  // ── Selected requisition ────────────────────────────────────────────────

  const selectedReq = useMemo(() => {
    if (!selectedReqId) return null;
    return requisitions.find(r => r.id === selectedReqId) ?? null;
  }, [requisitions, selectedReqId]);

  // selectedReq o'zgarganda editItems'ni boshlash
  useEffect(() => {
    if (!selectedReq) { setEditItems([]); return; }
    setEditItems(selectedReq.items.map(it => {
      const match = prodMap.get(normalize(it.materialName));
      const productQty = match?.quantity ?? 0;
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
  }, [selectedReq, prodMap]);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedReq) return;
    // Validatsiya
    for (const it of editItems) {
      if (it.available < 0) {
        showToast("Mavjud miqdor manfiy bo'lishi mumkin emas", "error");
        return;
      }
      if (it.available > it.required) {
        showToast(`"${it.name}" — mavjud miqdor (${it.available}) so'ralgan miqdordan (${it.required}) ko'p`, "error");
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
      await requisitionService.warehouseCheck(selectedReq.id, payload);
      showToast("Tekshiruv yakunlandi", "success");
      setSelectedReqId(null);
      window.history.back();
      await load();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Browser back ─────────────────────────────────────────────────────────

  useEffect(() => {
    const h = () => { setSelectedReqId(null); };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  // ── Detail: search & filter ──────────────────────────────────────────────

  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilter, setDetailFilter] = useState<"all" | "yetarli" | "yetishmadi" | "topilmadi">("all");

  const filteredItems = useMemo(() => {
    let items = editItems;
    if (detailFilter !== "all") items = items.filter(i => i.status === detailFilter);
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.unit ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [editItems, detailSearch, detailFilter]);

  // ── Render: Detail view ──────────────────────────────────────────────────

  if (selectedReqId && selectedReq) {
    const detailStats = {
      total: editItems.length,
      yetarli: editItems.filter(i => i.status === "yetarli").length,
      yetishmadi: editItems.filter(i => i.status === "yetishmadi").length,
      topilmadi: editItems.filter(i => i.status === "topilmadi").length,
    };
    const pct = detailStats.total > 0 ? Math.round((detailStats.yetarli / detailStats.total) * 100) : 0;

    const updateItem = (idx: number, patch: Partial<MaterialCheckItem>) => {
      setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />
        {/* Header */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px" }}>
          <button onClick={() => { setSelectedReqId(null); setDetailSearch(""); setDetailFilter("all"); window.history.back(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            ← Orqaga
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedReq.requisitionNo} — {selectedReq.purpose}
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              <span>{REQUISITION_TYPE_LABELS[selectedReq.type]}</span>
              {selectedReq.contractNo && <span style={{ marginLeft: 8 }}>Shartnoma: {selectedReq.contractNo}</span>}
              {selectedReq.departmentName && <span style={{ marginLeft: 8 }}>{selectedReq.departmentName}</span>}
              {selectedReq.createdAt && <span style={{ marginLeft: 8 }}>{fmt(selectedReq.createdAt)}</span>}
              {selectedReq.createdByName && <span style={{ marginLeft: 8 }}>{selectedReq.createdByName}</span>}
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
            {submitting ? "Yuborilmoqda..." : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Tekshiruvni yakunlash
              </>
            )}
          </button>
        </div>

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Jami materiallar</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>{detailStats.total}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yetarli</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--success)" }}>{detailStats.yetarli}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Qisman bor</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--warn)" }}>{detailStats.yetishmadi}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yo&apos;q</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--danger)" }}>{detailStats.topilmadi}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yetarlilik</div>
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
            <input className="search-input" placeholder="Material qidirish..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
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
              {f === "all" ? `Barchasi (${detailStats.total})` : f === "yetarli" ? `Yetarli (${detailStats.yetarli})` : f === "yetishmadi" ? `Qisman (${detailStats.yetishmadi})` : `Yo'q (${detailStats.topilmadi})`}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{filteredItems.length} ta natija</span>
        </div>

        {/* Materials table */}
        <div className="itm-card" style={{ flex: 1 }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 360px)" }}>
            {filteredItems.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                {detailSearch || detailFilter !== "all" ? "Natija topilmadi" : "Materiallar yo'q"}
              </div>
            ) : (
              <table className="itm-table">
                <thead>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Material nomi</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>O&apos;lchov</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Kerakli miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Ombordagi miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none", minWidth: 160 }}>Mavjud (tasdiqlangan)</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Holati</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center", color: "var(--text1)", textTransform: "none", minWidth: 200 }}>Izoh</th>
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
                            placeholder="Izoh (ixtiyoriy)..."
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

  // ── Render: Main list ────────────────────────────────────────────────────

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <style dangerouslySetInnerHTML={{ __html: statusKeyframes }} />

      {detailLoading && (
        <DetailLoadingOverlay dataReady={detailDataReady} onComplete={() => {
          setDetailLoading(false);
          if (pendingReqId.current) {
            window.history.pushState({ detail: pendingReqId.current }, "");
            setSelectedReqId(pendingReqId.current);
            pendingReqId.current = null;
          }
        }} />
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Tekshiruv kutmoqda</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stats.total}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>To&apos;liq mavjud</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)" }}>{stats.fullyAvailable}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Qisman / Yo&apos;q</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>{stats.partial}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: talabnoma raqami, maqsad, shartnoma..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className="btn-icon"
          onClick={load}
          title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <div>{search ? "Natija topilmadi" : "Tekshiruv kutayotgan talabnomalar yo'q"}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Raqam</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Turi</th>
                  <th style={{ width: 220, textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Maqsad</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Shartnoma / Bo&apos;lim</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Jami</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Mavjud</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Yetishmovchi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Sana</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Yaratuvchi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      pendingReqId.current = row.id;
                      setDetailDataReady(false);
                      setDetailLoading(true);
                      Promise.all([
                        requisitionService.getAll(RequisitionStatus.PendingWarehouseCheck),
                        productService.getAll(1, 1000),
                      ]).then(([reqs, prods]) => {
                        setRequisitions(reqs);
                        setProducts(prods.items);
                        setDetailDataReady(true);
                      }).catch(() => {
                        setDetailDataReady(true);
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64 }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{row.requisitionNo}</td>
                    <td style={{ textAlign: "center" }}>{REQUISITION_TYPE_LABELS[row.type]}</td>
                    <td title={row.purpose} style={{ textAlign: "center", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.purpose}</td>
                    <td style={{ textAlign: "center" }}>{row.contractNo || row.departmentName || "—"}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{row.totalItems}</td>
                    <td style={{ textAlign: "center", color: "var(--success)", fontWeight: 600 }}>{row.foundItems}</td>
                    <td style={{ textAlign: "center", color: row.missingItems > 0 ? "var(--danger)" : "var(--text3)", fontWeight: row.missingItems > 0 ? 600 : 400 }}>
                      {row.missingItems > 0 ? row.missingItems : "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>{fmt(row.createdAt)}</td>
                    <td style={{ textAlign: "center" }}>{row.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
