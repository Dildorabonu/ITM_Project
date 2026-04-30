"use client";

import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  requisitionService,
  RequisitionStatus,
  type RequisitionResponse,
} from "@/lib/userService";
import {
  fmtDate,
  REQUISITION_STATUS_LABELS,
} from "./_types";
import { RequisitionStatusBadge } from "./_components/StatusBadge";
import { RequisitionDrawer } from "./_components/RequisitionDrawer";
import { CheckSelect } from "./_components/CheckSelect";
import { useAuthStore } from "@/lib/store/authStore";

// ─── Status filter options ─────────────────────────────────────────────────────

const COMPLETED_FILTER = "completed";

const TERMINAL_STATUSES = new Set<RequisitionStatus>([
  RequisitionStatus.ReadyForWarehouseRelease,
  RequisitionStatus.ReadyForPurchase,
  RequisitionStatus.Rejected,
]);

function isCompleted(r: RequisitionResponse): boolean {
  if (r.children && r.children.length > 0) {
    return r.children.every(c => TERMINAL_STATUSES.has(c.status));
  }
  return TERMINAL_STATUSES.has(r.status);
}

const STATUS_FILTER = [
  { value: "", label: "Barchasi" },
  { value: String(RequisitionStatus.PendingWarehouseCheck), label: REQUISITION_STATUS_LABELS[RequisitionStatus.PendingWarehouseCheck] },
  { value: String(RequisitionStatus.Split),                 label: REQUISITION_STATUS_LABELS[RequisitionStatus.Split] },
  { value: COMPLETED_FILTER,                                label: "Yakunlangan" },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

function RequisitionsContent() {
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canApprove = hasPermission("Requisitions.Approve");

  const [list, setList] = useState<RequisitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [drawerReq, setDrawerReq] = useState<RequisitionResponse | null>(null);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = filterStatus !== "" ? 1 : 0;

  const openFilterPanel = () => {
    setPendingStatus(filterStatus);
    setFilterPanelOpen(true);
  };

  const applyFilters = () => {
    setFilterStatus(pendingStatus);
    setFilterPanelOpen(false);
  };

  const clearFilters = () => {
    setPendingStatus("");
    setFilterStatus("");
  };

  const handleFilterBtnClick = () => {
    if (filterPanelOpen) setFilterPanelOpen(false);
    else openFilterPanel();
  };

  useEffect(() => {
    if (!filterPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node) &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)
      ) setFilterPanelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterPanelOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await requisitionService.getAll();
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingApprovalCount = useMemo(
    () => list.filter(r => r.status === RequisitionStatus.PendingApproval).length,
    [list]
  );

  const filtered = useMemo(() => {
    let res = list.filter(r => !r.parentRequisitionId);
    if (filterStatus === COMPLETED_FILTER) {
      res = res.filter(isCompleted);
    } else if (filterStatus !== "") {
      const target = Number(filterStatus);
      res = res.filter(r => r.status === target && !isCompleted(r));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        r.requisitionNo.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        (r.contractNo ?? "").toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.createdByName.toLowerCase().includes(q)
      );
    }
    return res;
  }, [list, search, filterStatus]);

  return (
    <div className="page-transition">
      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Qidirish"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Filter dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            ref={filterBtnRef}
            onClick={handleFilterBtnClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "var(--radius)",
              border: `1px solid ${activeFilterCount > 0 ? "var(--accent)" : "var(--border2)"}`,
              background: activeFilterCount > 0 ? "var(--accent-dim)" : "var(--surface)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text2)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!activeFilterCount) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { if (!activeFilterCount) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)"; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtrlar
            {activeFilterCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--accent)", color: "#fff",
                fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>
                {activeFilterCount}
              </span>
            )}
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transition: "transform 0.2s", transform: filterPanelOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {filterPanelOpen && (
            <div
              ref={filterPanelRef}
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                width: 240,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                animation: "panel-appear 0.18s ease",
              }}
            >
              {/* Panel header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px 10px",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  Filtrlar
                </div>
                {pendingStatus !== "" && (
                  <button
                    onClick={clearFilters}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text3)", fontSize: 12, padding: "2px 4px",
                      borderRadius: 4, transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                  >
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Tozalash
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div style={{ padding: "14px 14px 0" }}>
                <div style={{ marginBottom: 14, position: "relative" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Holat
                  </p>
                  <CheckSelect
                    value={pendingStatus}
                    onChange={setPendingStatus}
                    options={STATUS_FILTER.filter(o => o.value !== "").map(o => ({ id: o.value, name: o.label }))}
                    placeholder="Barcha holatlar"
                    disablePortal
                  />
                </div>
              </div>

              {/* Apply button */}
              <div style={{ padding: "10px 14px 14px" }}>
                <button
                  onClick={applyFilters}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--radius)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--accent2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Filtrlarni qo&apos;llash
                </button>
              </div>
            </div>
          )}
        </div>
        {canApprove && (
          <button
            onClick={() => router.push("/requisitions/approvals")}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--warn)"; e.currentTarget.style.color = "var(--warn)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = pendingApprovalCount > 0 ? "rgba(224,123,0,0.35)" : "var(--border)"; e.currentTarget.style.color = pendingApprovalCount > 0 ? "var(--warn)" : "var(--text2)"; }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--radius)",
              border: `1.5px solid ${pendingApprovalCount > 0 ? "rgba(224,123,0,0.35)" : "var(--border)"}`,
              background: pendingApprovalCount > 0 ? "var(--warn-dim)" : "var(--bg3)",
              color: pendingApprovalCount > 0 ? "var(--warn)" : "var(--text2)",
              cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="9,11 12,14 22,4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Tasdiqlash
            {pendingApprovalCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 20, height: 20, padding: "0 6px",
                background: "var(--warn)", color: "#fff",
                fontSize: 11, fontWeight: 700, borderRadius: 10,
                fontFamily: "var(--font-mono)",
              }}>
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => router.push("/requisitions/print")}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6,9 6,2 18,2 18,9" />
            <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Blank
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>Yuklanmoqda…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>Talabnomalar topilmadi</div>
      ) : (
        <div className="itm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
          <table className="itm-table" style={{ tableLayout: "auto" }}>
            <thead>
              <tr>
                {["Raqam", "Turi", "Shartnoma / Bo'lim", "Yaratuvchi", "Sana"].map(h => (
                  <th key={h} style={{ textAlign: "center", color: "var(--text1)" }}>{h}</th>
                ))}
                <th style={{ minWidth: 160, textAlign: "center", color: "var(--text1)" }}>Holat</th>
                <th style={{ borderLeft: "2px solid var(--border)", textAlign: "center", color: "var(--text1)" }}>Amal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setDrawerReq(r)} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "var(--font-inter)", textAlign: "center" }}>{r.requisitionNo}</td>
                  <td style={{ textAlign: "center" }}>{r.typeLabel}</td>
                  <td style={{ textAlign: "center" }}>{r.contractNo ?? r.departmentName ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{r.createdByName}</td>
                  <td style={{ textAlign: "center" }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ textAlign: "center" }}><RequisitionStatusBadge status={r.status} completed={isCompleted(r)} small /></td>
                  <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <button
                        className="btn-icon"
                        title="Ko'rish"
                        onClick={() => setDrawerReq(r)}
                        style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {drawerReq && (
        <RequisitionDrawer
          req={drawerReq}
          onClose={() => setDrawerReq(null)}
          onUpdate={updated => {
            setDrawerReq(updated);
            setList(prev => prev.map(r => r.id === updated.id ? updated : r));
          }}
        />
      )}
    </div>
  );
}

export default function RequisitionsPage() {
  return (
    <Suspense>
      <RequisitionsContent />
    </Suspense>
  );
}
