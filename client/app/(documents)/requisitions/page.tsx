"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  requisitionService,
  RequisitionStatus,
  REQUISITION_TYPE_LABELS,
  type RequisitionListRow,
} from "@/lib/userService";
import {
  fmtDate,
  isRequisitionCompleted,
  isRequisitionRejected,
  REQUISITION_STATUS_LABELS,
} from "./_types";
import { RequisitionStatusBadge } from "./_components/StatusBadge";
import { RequisitionDrawer } from "./_components/RequisitionDrawer";
import { CheckSelect } from "./_components/CheckSelect";
import { RecentCompleted } from "./_components/RecentCompleted";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";

// ─── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTER = [
  { value: String(RequisitionStatus.PendingWarehouseCheck),    label: REQUISITION_STATUS_LABELS[RequisitionStatus.PendingWarehouseCheck] },
  { value: String(RequisitionStatus.PendingApproval),          label: REQUISITION_STATUS_LABELS[RequisitionStatus.PendingApproval] },
  { value: String(RequisitionStatus.Split),                    label: REQUISITION_STATUS_LABELS[RequisitionStatus.Split] },
  { value: String(RequisitionStatus.ReadyForWarehouseRelease), label: REQUISITION_STATUS_LABELS[RequisitionStatus.ReadyForWarehouseRelease] },
  { value: String(RequisitionStatus.ReadyForPurchase),         label: REQUISITION_STATUS_LABELS[RequisitionStatus.ReadyForPurchase] },
];

const ARCHIVE_STATUS_FILTER = [
  { value: String(RequisitionStatus.Released),  label: REQUISITION_STATUS_LABELS[RequisitionStatus.Released] },
  { value: String(RequisitionStatus.Delivered), label: REQUISITION_STATUS_LABELS[RequisitionStatus.Delivered] },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

function RequisitionsContent() {
  const router = useRouter();
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canApprove = hasPermission("Requisitions.Approve");

  const [list, setList] = useState<RequisitionListRow[]>([]);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode]     = useState<"active" | "archive">("active");
  const [archiveTab, setArchiveTab] = useState<"completed" | "rejected">("completed");
  // Ro'yxat qatorida to'liq talabnoma yo'q — drawer detalni ID bo'yicha o'zi yuklaydi.
  const [drawerReqId, setDrawerReqId] = useState<string | null>(null);
  const [recentKey, setRecentKey] = useState(0);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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

  const load = useCallback(async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const opts: { search?: string; status?: RequisitionStatus; completed?: boolean; rejected?: boolean } =
        viewMode === "active"
          ? { completed: false }
          : archiveTab === "completed"
            ? { completed: true, rejected: false }
            // Arxiv saralashi CompletedAt bo'yicha ishlashi uchun completed:true
            // ham yuboriladi — aks holda backend faol ro'yxat tartibiga (CreatedAt) tushib qoladi.
            : { completed: true, rejected: true };
      if (search.trim()) opts.search = search.trim();
      if (filterStatus !== "") opts.status = Number(filterStatus) as RequisitionStatus;
      const data = await requisitionService.getPaged(p, PAGE_SIZE, opts);
      setList(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setList([]);
      setTotalPages(1);
      setTotalCount(0);
      setError(t("Talabnomalarni yuklashda xatolik yuz berdi"));
      console.error("Requisitions load error:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterStatus, viewMode, archiveTab]);

  // Ko'rinish yoki filtr o'zgarsa — birinchi sahifaga qaytish
  useEffect(() => { setPage(1); }, [search, filterStatus, viewMode, archiveTab]);

  // Reload when page or any filter changes (debounce search)
  useEffect(() => {
    const timer = setTimeout(() => { load(page); }, search ? 250 : 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterStatus, viewMode, archiveTab]);

  // Faol va arxiv status variantlari umumiy emas — ko'rinish almashganda tozalanadi
  useEffect(() => {
    setFilterStatus("");
    setPendingStatus("");
    // Rad etilgan sub-tabida filtr tugmasi butunlay yashiriladi — panel ochiq
    // qolib ketmasligi va orphan outside-click listener bo'lmasligi uchun yopamiz.
    setFilterPanelOpen(false);
  }, [viewMode, archiveTab]);

  // Pending-approval badge: joriy filtrga bog'liq bo'lmagan alohida COUNT so'rovi
  // (ilgari butun ro'yxat tortilib, faqat uzunligi olinardi).
  useEffect(() => {
    if (!canApprove) return;
    requisitionService.getPendingApprovalCount().then(setPendingApprovalCount);
  }, [canApprove]);

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        {/* Faol / Arxiv */}
        <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setViewMode("active")}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "active" ? "var(--accent)" : "transparent",
              color: viewMode === "active" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t("Faol")}
          </button>
          <button
            onClick={() => setViewMode("archive")}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "archive" ? "var(--text3)" : "transparent",
              color: viewMode === "archive" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            {t("Arxiv")}
          </button>
        </div>

        {/* Arxiv sub-tablari */}
        {viewMode === "archive" && (
          <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0, animation: "panel-appear 0.18s ease" }}>
            <button
              onClick={() => setArchiveTab("completed")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "completed" ? "var(--success)" : "transparent",
                color: archiveTab === "completed" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t("Yakunlangan")}
            </button>
            <button
              onClick={() => setArchiveTab("rejected")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "rejected" ? "var(--danger)" : "transparent",
                color: archiveTab === "rejected" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t("Rad etilgan")}
            </button>
          </div>
        )}

        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder={t("Qidirish")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Filter dropdown */}
        {!(viewMode === "archive" && archiveTab === "rejected") && (
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
            {t("Filtrlar")}
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
                  {t("Filtrlar")}
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
                    {t("Tozalash")}
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
                    {t("Holat")}
                  </p>
                  <CheckSelect
                    value={pendingStatus}
                    onChange={setPendingStatus}
                    options={(viewMode === "archive" ? ARCHIVE_STATUS_FILTER : STATUS_FILTER)
                      .map(o => ({ id: o.value, name: t(o.label) }))}
                    placeholder={t("Barcha holatlar")}
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
                  {t("Filtrlarni qo'llash")}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        <button className="btn-icon" onClick={() => { load(); setRecentKey(k => k + 1); }} title={t("Yangilash")}
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

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
            {t("Tasdiqlash")}
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
          {t("Blank")}
        </button>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Turi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Shartnoma / Bo'lim")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Yaratuvchi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Sana")}</th>
                  <th style={{ minWidth: 160, textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Holat")}</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)" }}>{t("Amal")}</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                    {viewMode === "active"
                      ? t("Talabnomalar topilmadi")
                      : archiveTab === "completed"
                        ? t("Yakunlangan talabnomalar yo'q")
                        : t("Rad etilgan talabnomalar yo'q")}
                  </td></tr>
                ) : list.map((r, i) => (
                  <tr key={r.id} onClick={() => setDrawerReqId(r.id)} style={{ cursor: "pointer" }}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-inter)" }}>{r.requisitionNo}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(REQUISITION_TYPE_LABELS[r.type])}</td>
                    <td style={{ textAlign: "center", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contractNo ?? r.departmentName ?? "—"}</td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.createdByName}</td>
                    <td style={{ textAlign: "center", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <div style={{ maxWidth: 180, overflow: "hidden", display: "inline-flex", justifyContent: "center" }}>
                        <RequisitionStatusBadge status={r.status} completed={isRequisitionCompleted(r.status, r.childStatuses)} rejected={isRequisitionRejected(r.status, r.childStatuses)} small />
                      </div>
                    </td>
                    <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <button
                          className="btn-icon"
                          title={t("Ko'rish")}
                          onClick={() => setDrawerReqId(r.id)}
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
        )}
      </div>

      {/* Pagination footer */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            ← {t("Oldingi")}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "var(--text3)", padding: "0 2px" }}>…</span>
              ) : (
                <button
                  key={p}
                  className="btn-secondary"
                  onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            {t("Keyingi")} →
          </button>
        </div>
      </div>

      {/* Qidiruv/filtr qo'llangan bo'lsa ko'rsatilmaydi — blok filtrlarga bo'ysunmaydi */}
      {viewMode === "active" && !search.trim() && filterStatus === "" && (
        <RecentCompleted reloadKey={recentKey} onOpen={setDrawerReqId} />
      )}

      {drawerReqId && (
        <RequisitionDrawer
          reqId={drawerReqId}
          onClose={() => setDrawerReqId(null)}
          onUpdate={() => {
            // Holat bajarilgan holatga o'tishi mumkin (masalan, rad etildi) — asosiy
            // ro'yxat endi faqat faol talabnomalarni ko'rsatadi, shuning uchun uni va
            // "Yaqinda yakunlangan" blokini qayta yuklab, ikkalasini sinxron ushlab turamiz.
            load();
            setRecentKey(k => k + 1);
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
