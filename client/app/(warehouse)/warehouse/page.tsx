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
import { normalize, fmt, statusKeyframes, type ReqCheckRow } from "./_types";
import { DetailLoadingOverlay } from "./_components/DetailLoadingOverlay";
import { WarehouseCheckDetail } from "./_components/WarehouseCheckDetail";

export default function WarehousePage() {
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
    return requisitions.map(req => {
      const totalItems = req.items.length;
      const foundItems = req.items.filter(it => {
        const match = prodMap.get(normalize(it.materialName));
        return match && match.availableQuantity >= it.quantity;
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
        checked: !!req.warehouseCheckedAt,
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
    const checkedRows = reqRows.filter(r => r.checked);
    const fullyAvailable = checkedRows.filter(r => r.fullyAvailable).length;
    const partial = checkedRows.length - fullyAvailable;
    return { total, fullyAvailable, partial };
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
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{row.totalItems}</td>
                    <td style={{ textAlign: "center", color: row.checked ? "var(--success)" : "var(--text3)", fontWeight: row.checked ? 600 : 400 }}>
                      {row.checked ? row.foundItems : "—"}
                    </td>
                    <td style={{ textAlign: "center", color: row.checked && row.missingItems > 0 ? "var(--danger)" : "var(--text3)", fontWeight: row.checked && row.missingItems > 0 ? 600 : 400 }}>
                      {row.checked ? (row.missingItems > 0 ? row.missingItems : "—") : "—"}
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
