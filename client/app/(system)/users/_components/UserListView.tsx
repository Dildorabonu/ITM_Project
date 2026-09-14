"use client";

import { useEffect, useRef, useState } from "react";
import { DepartmentType, DEPARTMENT_TYPE_LABELS, type UserResponse } from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useT } from "@/lib/i18n";

interface UserListViewProps {
  filtered: UserResponse[];
  page: number;
  totalPages: number;
  totalCount: number;
  loading: boolean;
  error: string;
  search: string;
  setSearch: (v: string) => void;
  typeFilter: DepartmentType | null;
  setTypeFilter: (v: DepartmentType | null) => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  setDeactivateId: (v: string | null) => void;
  setActivateConfirmId: (v: string | null) => void;
  onOpenCreate: () => void;
  onOpenEdit: (u: UserResponse) => void;
  onRefresh: () => void;
  animOffset: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function UserListView({
  filtered,
  page, totalPages, totalCount,
  loading, error,
  search, setSearch,
  typeFilter, setTypeFilter,
  canCreate, canUpdate, canDelete,
  setDeactivateId, setActivateConfirmId,
  onOpenCreate, onOpenEdit, onRefresh,
  animOffset, setPage,
}: UserListViewProps) {
  const t = useT();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingTypeStr, setPendingTypeStr] = useState("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = typeFilter !== null ? 1 : 0;

  const openFilterPanel = () => {
    setPendingTypeStr(typeFilter !== null ? String(typeFilter) : "");
    setFilterPanelOpen(true);
  };

  const applyFilters = () => {
    setTypeFilter(pendingTypeStr !== "" ? (Number(pendingTypeStr) as DepartmentType) : null);
    setFilterPanelOpen(false);
  };

  const clearFilters = () => {
    setPendingTypeStr("");
    setTypeFilter(null);
  };

  const handleFilterBtnClick = () => {
    if (filterPanelOpen) setFilterPanelOpen(false);
    else openFilterPanel();
  };

  // Close panel on outside click
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

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes sdot-ping {
          0%   { box-shadow: 0 0 0 0px rgba(34,197,94,0.55); }
          100% { box-shadow: 0 0 0 6px rgba(34,197,94,0);    }
        }
        .sdot {
          display: inline-block;
          width: 9px; height: 9px;
          border-radius: 50%;
          vertical-align: middle;
        }
        .sdot-on  { background: #22c55e; animation: sdot-ping 1.5s ease-out ${animOffset}s infinite; }
        .sdot-off { background: #94a3b8; }
      `}</style>

      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Qidirish")}
            value={search} onChange={e => setSearch(e.target.value)} />
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
                {pendingTypeStr !== "" && (
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

              {/* Type filter */}
              <div style={{ padding: "14px 14px 0" }}>
                <div style={{ marginBottom: 14, position: "relative" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    {t("Tuzilma turi")}
                  </p>
                  <CheckSelect
                    value={pendingTypeStr}
                    onChange={setPendingTypeStr}
                    options={[
                      DepartmentType.IshlabChiqarish,
                      DepartmentType.Bolim,
                      DepartmentType.Boshqaruv,
                    ].map(dt => ({ id: String(dt), name: t(DEPARTMENT_TYPE_LABELS[dt]) }))}
                    placeholder={t("Barcha tuzilma")}
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

        <button
          className="btn-icon"
          onClick={onRefresh}
          title={t("Yangilash")}
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        {canCreate && (
          <button
            className="btn-primary"
            onClick={onOpenCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("Yaratish")}
          </button>
        )}
      </div>

      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table" style={{ height: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Ism")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Familiya")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Login")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", maxWidth: 180, background: "var(--bg2)" }}>{t("Tuzilma nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Holat")}</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)", width: 124 }}>{t("Amallar")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>{t("Ma'lumot topilmadi")}</td></tr>
                ) : filtered.map((u, i) => {
                  return (
                    <tr key={u.id}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * 20 + i + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center" }}>{u.firstName}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{u.lastName}</td>
                      <td style={{ textAlign: "center" }}>{u.login}</td>
                      <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden" }}>
                        {u.departmentName ? (
                          <span style={{
                            display: "block",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }} title={u.departmentName}>
                            {u.departmentName}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`sdot ${u.isActive ? "sdot-on" : "sdot-off"}`}
                          title={u.isActive ? t("Aktiv") : t("Nofaol")}
                        />
                      </td>
                      <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {u.id !== "00000000-0000-0000-0000-000000000001" && (
                            <>
                              {canUpdate && (
                                <button className="btn-icon" title={t("Tahrirlash")} onClick={() => onOpenEdit(u)}
                                  style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              )}
                              {canDelete && u.isActive && (
                                <button className="btn-icon btn-icon-danger" title={t("Noaktiv qilish")} onClick={() => setDeactivateId(u.id)}
                                  style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                  </svg>
                                </button>
                              )}
                              {canDelete && !u.isActive && (
                                <button className="btn-icon" title={t("Aktivlashtirish")} onClick={() => setActivateConfirmId(u.id)}
                                  style={{ color: "#16a34a", borderColor: "#16a34a33", background: "#f0fdf4" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length > 0 && (
                  <tr className="itm-filler" aria-hidden style={{ height: "100%" }}>
                    <td style={{ padding: 0, borderBottom: "none", borderRight: "2px solid var(--border)" }} />
                    <td colSpan={5} style={{ padding: 0, borderBottom: "none" }} />
                    <td style={{ padding: 0, borderBottom: "none", borderLeft: "2px solid var(--border)" }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * 20 + 1}&nbsp;–&nbsp;{Math.min(page * 20, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
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
    </div>
  );
}
