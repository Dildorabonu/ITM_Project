"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  requisitionService,
  productService,
  DepartmentType,
  RequisitionStatus,
  REQUISITION_TYPE_LABELS,
  type RequisitionResponse,
  type ProductResponse,
} from "@/lib/userService";
import { normalize, fmt, daysSince, statusKeyframes, type ReqCheckRow } from "./_types";
import { DetailLoadingOverlay } from "./_components/DetailLoadingOverlay";
import { WarehouseCheckDetail } from "./_components/WarehouseCheckDetail";
import { useT } from "@/lib/i18n";

/** Kutish muddatiga qarab rang: 7+ kun — kritik, 3+ kun — ogohlantirish. */
function waitColor(days: number) {
  return days >= 7 ? "var(--danger)" : days >= 3 ? "var(--warn)" : "var(--text2)";
}

export default function WarehousePage() {
  const t = useT();
  const [requisitions, setRequisitions] = useState<RequisitionResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDataReady, setDetailDataReady] = useState(false);
  const pendingReqId = useRef<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, prods] = await Promise.all([
        requisitionService.getAll(RequisitionStatus.PendingWarehouseCheck),
        productService.getAll(1, 1000, undefined, undefined, DepartmentType.Omborxona),
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
    return requisitions.map(req => ({
      id: req.id,
      requisitionNo: req.requisitionNo,
      type: req.type,
      purpose: req.purpose,
      contractNo: req.contractNo,
      departmentName: req.departmentName,
      createdByName: req.createdByName,
      createdAt: req.createdAt,
      waitingDays: daysSince(req.createdAt),
      checked: !!req.warehouseCheckedAt,
    }));
  }, [requisitions]);

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

  // Tekshiruv navbatining hajmi va yoshi — tekshirilmagan talabnomalar uchun
  // mavjudlik hali noma'lum, shuning uchun ish hajmi va kutish muddati ko'rsatiladi.
  const stats = useMemo(() => {
    const delayed = reqRows.filter(r => r.waitingDays >= 3).length;
    const critical = reqRows.filter(r => r.waitingDays >= 7).length;
    const oldest = reqRows.reduce<ReqCheckRow | null>(
      (acc, r) => (!acc || r.waitingDays > acc.waitingDays ? r : acc),
      null
    );
    return { total: reqRows.length, delayed, critical, oldest };
  }, [reqRows]);

  // ── Selected requisition ────────────────────────────────────────────────

  const selectedReq = useMemo(() => {
    if (!selectedReqId) return null;
    return requisitions.find(r => r.id === selectedReqId) ?? null;
  }, [requisitions, selectedReqId]);

  // ── Browser back ─────────────────────────────────────────────────────────

  useEffect(() => {
    const h = () => { setSelectedReqId(null); };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  // ── Render: Detail view ──────────────────────────────────────────────────

  if (selectedReqId && selectedReq) {
    return (
      <WarehouseCheckDetail
        req={selectedReq}
        prodMap={prodMap}
        onClose={() => { setSelectedReqId(null); window.history.back(); }}
        onSubmitted={async () => { setSelectedReqId(null); window.history.back(); await load(); }}
      />
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
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>{t("Tekshiruv kutmoqda")}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stats.total}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>{t("Kechikkan (3+ kun)")}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: stats.delayed ? (stats.critical ? "var(--danger)" : "var(--warn)") : "var(--text3)" }}>
            {stats.delayed}
          </div>
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2, minHeight: 14 }}>
            {stats.critical ? `${stats.critical} ${t("ta kritik (7+ kun)")}` : ""}
          </div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>{t("Eng uzoq kutgan")}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: stats.oldest ? waitColor(stats.oldest.waitingDays) : "var(--text3)" }}>
            {stats.oldest ? (stats.oldest.waitingDays === 0 ? t("Bugun") : `${stats.oldest.waitingDays} ${t("kun")}`) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, minHeight: 14 }}>{stats.oldest?.requisitionNo ?? ""}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Qidirish: talabnoma raqami, maqsad, shartnoma...")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className="btn-icon"
          onClick={load}
          title={t("Yangilash")}
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
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <div>{search ? t("Natija topilmadi") : t("Tekshiruv kutayotgan talabnomalar yo'q")}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Raqam")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Turi")}</th>
                  <th style={{ width: 220, textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Maqsad")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Shartnoma / Bo'lim")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Kutish")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Sana")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>{t("Yaratuvchi")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (row.checked) {
                        window.history.pushState({ detail: row.id }, "");
                        setSelectedReqId(row.id);
                        return;
                      }
                      pendingReqId.current = row.id;
                      setDetailDataReady(false);
                      setDetailLoading(true);
                      Promise.all([
                        requisitionService.getAll(RequisitionStatus.PendingWarehouseCheck),
                        productService.getAll(1, 1000, undefined, undefined, DepartmentType.Omborxona),
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
                    <td style={{ textAlign: "center", color: waitColor(row.waitingDays), fontWeight: row.waitingDays >= 3 ? 600 : 400 }}>
                      {row.waitingDays === 0 ? t("Bugun") : `${row.waitingDays} ${t("kun")}`}
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
