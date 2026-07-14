"use client";

import { useEffect, useRef, useState } from "react";
import {
  employeeService,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type EmployeeResponse,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useT } from "@/lib/i18n";
import EmployeeContractsView from "./_components/EmployeeContractsView";

export default function EmployeesPage() {
  const t = useT();

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [filtered, setFiltered] = useState<EmployeeResponse[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DepartmentType | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerEmployee, setDrawerEmployee] = useState<EmployeeResponse | null>(null);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingTypeStr, setPendingTypeStr] = useState("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = typeFilter !== null ? 1 : 0;

  const load = async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const data = await employeeService.getAll(p);
      setEmployees(data.items);
      setFiltered(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const q = search.toLowerCase();
    let list = employees;
    if (typeFilter !== null) list = list.filter(e => e.departmentType === typeFilter);
    if (q) list = list.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.departmentName ?? "").toLowerCase().includes(q)
    );
    setFiltered(list);
  }, [search, typeFilter, employees]);

  // Close filter panel on outside click
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

  const openFilterPanel = () => {
    setPendingTypeStr(typeFilter !== null ? String(typeFilter) : "");
    setFilterPanelOpen(true);
  };

  if (drawerEmployee) {
    return (
      <div className="page-transition" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <EmployeeContractsView
          employee={drawerEmployee}
          onBack={() => setDrawerEmployee(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-transition" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
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
            onClick={() => (filterPanelOpen ? setFilterPanelOpen(false) : openFilterPanel())}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "var(--radius)",
              border: `1px solid ${activeFilterCount > 0 ? "var(--accent)" : "var(--border2)"}`,
              background: activeFilterCount > 0 ? "var(--accent-dim)" : "var(--surface)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text2)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
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
              <div style={{ padding: "14px 14px 0" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
              <div style={{ padding: "12px 14px 14px" }}>
                <button
                  onClick={() => {
                    setTypeFilter(pendingTypeStr !== "" ? (Number(pendingTypeStr) as DepartmentType) : null);
                    setFilterPanelOpen(false);
                  }}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--radius)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
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
          onClick={() => load()}
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

      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Ism")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Familiya")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", maxWidth: 180, background: "var(--bg2)" }}>{t("Tuzilma nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Shartnomalar")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>{t("Ma'lumot topilmadi")}</td></tr>
                ) : filtered.map((emp, i) => (
                  <tr key={emp.id} style={{ opacity: emp.isActive ? 1 : 0.55 }}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * 20 + i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center" }}>{emp.firstName}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{emp.lastName}</td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden" }}>
                      {emp.departmentName ? (
                        <span style={{
                          display: "block",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={emp.departmentName}>
                          {emp.departmentName}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => setDrawerEmployee(emp)}
                        title={t("Shartnomalarni ko'rish")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                          border: `1px solid ${emp.activeContractCount > 0 ? "var(--accent)" : "var(--border2)"}`,
                          background: emp.activeContractCount > 0 ? "var(--accent-dim)" : "transparent",
                          color: emp.activeContractCount > 0 ? "var(--accent)" : "var(--text3)",
                          fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                        onMouseLeave={e => {
                          const btn = e.currentTarget as HTMLButtonElement;
                          if (emp.activeContractCount === 0) { btn.style.borderColor = "var(--border2)"; btn.style.color = "var(--text3)"; }
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {emp.activeContractCount}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px",
          marginTop: 8,
        }}>
          <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
            {totalCount} {t("tadan")} {(page - 1) * 20 + 1}&nbsp;–&nbsp;{Math.min(page * 20, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
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
      )}

    </div>
  );
}
