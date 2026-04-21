"use client";

import { useRef } from "react";
import { type RoleResponse } from "@/lib/userService";

interface Props {
  loading: boolean;
  filtered: RoleResponse[];
  search: string;
  setSearch: (v: string) => void;
  fetchAll: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  openAddRole: () => void;
  openViewRole: (r: RoleResponse) => void;
  openEditRole: (r: RoleResponse) => void;
  setActivateConfirmId: (id: string) => void;
  setDeleteConfirmId: (id: string) => void;
  setDeleteError: (e: string | null) => void;
}

export default function RoleTable({
  loading, filtered, search, setSearch, fetchAll,
  canCreate, canUpdate, canDelete,
  openAddRole, openViewRole, openEditRole,
  setActivateConfirmId, setDeleteConfirmId, setDeleteError,
}: Props) {
  const animOffset = useRef(-(Date.now() % 1500) / 1000).current;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
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
      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
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
        <button
          className="btn-icon"
          onClick={fetchAll}
          title="Yangilash"
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
            onClick={openAddRole}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yaratish
          </button>
        )}
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr>
                <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                <th style={{ textAlign: "center", color: "var(--text1)" }}>Nomi</th>
                <th style={{ textAlign: "center", color: "var(--text1)" }}>Tavsif</th>
                <th style={{ textAlign: "center", color: "var(--text1)" }}>Holat</th>
                <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", width: 124 }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Rollar topilmadi</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                  <td style={{ textAlign: "center" }}>{r.name}</td>
                  <td style={{ textAlign: "center", color: "var(--text1)" }}>{r.description || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      className={`sdot ${r.isActive !== false ? "sdot-on" : "sdot-off"}`}
                      title={r.isActive !== false ? "Aktiv" : "Noaktiv"}
                    />
                  </td>
                  <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button className="btn-icon" title="Ko'rish" onClick={() => openViewRole(r)}
                        style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {r.id !== "00000000-0000-0000-0000-000000000001" && (
                        <>
                          {canUpdate && r.isActive !== false && (
                            <button className="btn-icon" title="Tahrirlash" onClick={() => openEditRole(r)}
                              style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {canUpdate && r.isActive === false && (
                            <button className="btn-icon" title="Aktivlashtirish" onClick={() => setActivateConfirmId(r.id)}
                              style={{ color: "#16a34a", borderColor: "#16a34a33", background: "#f0fdf4" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          )}
                          {canDelete && r.isActive !== false && (
                            <button className="btn-icon btn-icon-danger" title="Noaktiv qilish"
                              onClick={() => { setDeleteConfirmId(r.id); setDeleteError(null); }}
                              style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
