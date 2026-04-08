"use client";

import { DepartmentType, DEPARTMENT_TYPE_LABELS, type UserResponse, type DepartmentOption } from "@/lib/userService";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { TYPE_STYLE } from "./constants";

interface UserListViewProps {
  filtered: UserResponse[];
  users: UserResponse[];
  departments: DepartmentOption[];
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
  deleteId: string | null;
  setDeleteId: (v: string | null) => void;
  deleting: boolean;
  handleDelete: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (u: UserResponse) => void;
  onRefresh: () => void;
  animOffset: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function UserListView({
  filtered, users, departments,
  page, totalPages, totalCount,
  loading, error,
  search, setSearch,
  typeFilter, setTypeFilter,
  canCreate, canUpdate, canDelete,
  deleteId, setDeleteId, deleting, handleDelete,
  onOpenCreate, onOpenEdit, onRefresh,
  animOffset, setPage,
}: UserListViewProps) {
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

      {/* Toifa filter chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {([null, DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const).map(t => {
          const active = typeFilter === t;
          const label = t === null ? "Barchasi" : DEPARTMENT_TYPE_LABELS[t];
          const deptIds = t === null ? null : new Set(departments.filter(d => d.type === t).map(d => d.id));
          const count = t === null ? users.length : users.filter(u => u.departmentId && deptIds!.has(u.departmentId)).length;
          const s = t !== null ? TYPE_STYLE[t] : null;
          return (
            <button
              key={String(t)}
              type="button"
              onClick={() => setTypeFilter(t)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600,
                border: active ? `1.5px solid ${s ? s.color : "var(--accent)"}` : "1.5px solid var(--border)",
                background: active ? (s ? s.bg : "var(--accent-dim)") : "var(--bg1)",
                color: active ? (s ? s.color : "var(--accent)") : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {t !== null && <span>{s!.icon}</span>}
              {label}
              <span style={{
                background: active ? (s ? s.color : "var(--accent)") : "var(--border)",
                color: active ? "#fff" : "var(--text2)",
                borderRadius: 10, padding: "1px 7px", fontSize: 11,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className="btn-icon"
          onClick={onRefresh}
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
            onClick={onOpenCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yaratish
          </button>
        )}
      </div>

      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Ism</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Familiya</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Login</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", maxWidth: 180 }}>Tuzilma nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Holat</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((u, i) => {
                  const dept = u.departmentId ? departments.find(d => d.id === u.departmentId) : null;
                  const ts = dept?.type !== undefined ? TYPE_STYLE[dept.type] : null;
                  return (
                    <tr key={u.id}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * 20 + i + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center" }}>{u.firstName}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{u.lastName}</td>
                      <td style={{ textAlign: "center" }}>{u.login}</td>
                      <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden" }}>
                        {u.departmentName && ts ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                            background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                            maxWidth: "100%", overflow: "hidden",
                          }} title={u.departmentName}>
                            <span style={{ flexShrink: 0 }}>{ts.icon}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{u.departmentName}</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`sdot ${u.isActive ? "sdot-on" : "sdot-off"}`}
                          title={u.isActive ? "Aktiv" : "Nofaol"}
                        />
                      </td>
                      <td style={{ borderLeft: "2px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {u.id !== "00000000-0000-0000-0000-000000000001" && (
                            <>
                              {canUpdate && (
                                <button className="btn-icon" title="Tahrirlash" onClick={() => onOpenEdit(u)}
                                  style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              )}
                              {canDelete && (
                                <button className="btn-icon btn-icon-danger" title="O'chirish" onClick={() => setDeleteId(u.id)}
                                  style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4h6v2" />
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "0 4px" }}>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>
            Jami: {totalCount} ta
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              ← Oldingi
            </button>
            <span style={{ fontSize: 13, color: "var(--text1)", fontWeight: 600 }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              Keyingi →
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Foydalanuvchini o'chirish"
        message="Ushbu foydalanuvchi o'chiriladi. Davom etasizmi?"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
