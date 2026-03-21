"use client";

import { useEffect, useState } from "react";
import {
  roleService,
  permissionService,
  type RoleResponse,
  type PermissionModuleResponse,
  type RoleCreatePayload,
} from "@/lib/userService";

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionModuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // View drawer
  const [viewRole, setViewRole] = useState<RoleResponse | null>(null);
  const [expandedViewModules, setExpandedViewModules] = useState<Set<string>>(new Set());

  // Edit / Create modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleResponse | null>(null);
  const [roleForm, setRoleForm] = useState<RoleCreatePayload>({ name: "", description: "" });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [expandedEditModules, setExpandedEditModules] = useState<Set<string>>(new Set());
  const [roleSaving, setRoleSaving] = useState(false);
  const [permsLoading, setPermsLoading] = useState(false);

  const totalPermissions = permissions.reduce((sum, m) => sum + m.actions.length, 0);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([roleService.getAllFull(), permissionService.getAll()]);
      setRoles(r);
      setPermissions(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  /* ---------- View ---------- */
  const toggleViewModule = (mod: string) => {
    setExpandedViewModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  /* ---------- Edit ---------- */
  const openAddRole = () => {
    setEditRole(null);
    setRoleForm({ name: "", description: "" });
    setSelectedPerms(new Set());
    setExpandedEditModules(new Set());
    setShowRoleModal(true);
  };

  const openEditRole = async (r: RoleResponse) => {
    setEditRole(r);
    setRoleForm({ name: r.name, description: r.description ?? "" });
    setSelectedPerms(new Set());
    setExpandedEditModules(new Set());
    setShowRoleModal(true);
    setPermsLoading(true);
    try {
      const ids = await roleService.getPermissions(r.id);
      setSelectedPerms(new Set(ids));
    } finally {
      setPermsLoading(false);
    }
  };

  const togglePerm = (actionId: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId); else next.add(actionId);
      return next;
    });
  };

  const toggleAllModule = (mod: PermissionModuleResponse) => {
    const allSelected = mod.actions.every(a => selectedPerms.has(a.id));
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (allSelected) {
        mod.actions.forEach(a => next.delete(a.id));
      } else {
        mod.actions.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  const toggleEditModule = (mod: string) => {
    setExpandedEditModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const saveRole = async () => {
    setRoleSaving(true);
    try {
      let roleId = editRole?.id;
      if (editRole) {
        await roleService.update(editRole.id, roleForm);
      } else {
        // create returns void; re-fetch to get new id — for now just save form
        await roleService.create(roleForm);
      }
      if (roleId) {
        await roleService.setPermissions(roleId, Array.from(selectedPerms));
      }
      setShowRoleModal(false);
      await fetchAll();
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (id: string) => {
    if (!confirm("Bu rolni o'chirishni tasdiqlaysizmi?")) return;
    await roleService.delete(id);
    await fetchAll();
  };

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  /* ===== Edit / Create inline view ===== */
  if (showRoleModal) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowRoleModal(false)}
              style={{
                background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 8,
                cursor: "pointer", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
                color: "var(--text2)", fontSize: 13, fontWeight: 500,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Orqaga
            </button>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
              {editRole ? "Rolni tahrirlash" : "Yangi rol"}
            </span>
          </div>
          <span style={{
            background: "var(--accent)", color: "#fff", borderRadius: 999,
            fontSize: 12, fontWeight: 700, padding: "6px 16px", letterSpacing: 0.3,
          }}>
            {totalPermissions} TA RUXSATDAN {selectedPerms.size} TASI TANLANGAN
          </span>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Rol nomi <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="form-input"
              value={roleForm.name}
              onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Rol nomi"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Tavsif <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              className="form-input"
              value={roleForm.description ?? ""}
              onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Tavsif kiriting"
              rows={1}
              style={{ resize: "none" }}
            />
          </div>
        </div>

        {/* Overview grid */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "var(--text3)", fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            Ruxsatlar umumiy ko&apos;rinishi
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          {permsLoading ? (
            <div style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>Yuklanmoqda...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {permissions.map(mod => {
                const selected = mod.actions.filter(a => selectedPerms.has(a.id)).length;
                const total = mod.actions.length;
                const allSelected = selected === total;
                return (
                  <div key={mod.module} style={{
                    border: `1.5px solid ${allSelected ? "#22c55e55" : "var(--border)"}`,
                    borderRadius: 10, padding: "12px 14px",
                    background: allSelected ? "#f0fdf4" : "var(--bg2)", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{mod.moduleName}</span>
                      <span style={{
                        background: allSelected ? "#22c55e" : "var(--bg3)",
                        color: allSelected ? "#fff" : "var(--text3)",
                        borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 8px",
                      }}>{selected}/{total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: allSelected ? "#22c55e" : selected > 0 ? "#86efac" : "transparent",
                        width: `${total > 0 ? (selected / total) * 100 : 0}%`,
                        transition: "width 0.2s",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed accordion */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "var(--text3)", fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            Ruxsatlar
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {permissions.map(mod => {
              const selected = mod.actions.filter(a => selectedPerms.has(a.id)).length;
              const total = mod.actions.length;
              const allSelected = selected === total;
              const expanded = expandedEditModules.has(mod.module);
              return (
                <div key={mod.module} style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--bg2)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24"
                      fill={allSelected ? "#22c55e22" : "none"}
                      stroke={allSelected ? "#22c55e" : "var(--text3)"}
                      strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      {allSelected && <polyline points="9 12 11 14 15 10" />}
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{mod.moduleName}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>{total} ta ruxsatdan {selected} tasi tanlangan</div>
                    </div>
                    <button onClick={() => toggleAllModule(mod)} title="Hammasini tanlash" style={{
                      background: allSelected ? "#22c55e18" : "none", border: "none", cursor: "pointer",
                      padding: 6, borderRadius: 6, color: allSelected ? "#22c55e" : "var(--text3)",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button onClick={() => toggleEditModule(mod.module)} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text3)",
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "block" }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                  {expanded && (
                    <div style={{
                      padding: "14px 16px 16px", background: "var(--bg3)",
                      borderTop: "1px solid var(--border)",
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                    }}>
                      {mod.actions.map(a => {
                        const on = selectedPerms.has(a.id);
                        return (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button onClick={() => togglePerm(a.id)} style={{
                              width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                              background: on ? "#22c55e" : "#d1d5db",
                              position: "relative", flexShrink: 0, transition: "background 0.2s",
                            }}>
                              <span style={{
                                position: "absolute", top: 3, left: on ? 21 : 3,
                                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                                transition: "left 0.2s", display: "block",
                              }} />
                            </button>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{a.actionName}</div>
                              <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.action}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button className="btn-secondary" onClick={() => setShowRoleModal(false)}>Bekor qilish</button>
          <button className="btn-primary" onClick={saveRole} disabled={roleSaving || !roleForm.name.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {roleSaving ? "Saqlanmoqda..." : "Rolni saqlash"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
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
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table className="itm-table">
          <thead>
            <tr>
              <th style={{ width: 220 }}>Nomi</th>
              <th>Tavsif</th>
              <th style={{ textAlign: "right" }}>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>Yuklanmoqda...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>Rollar topilmadi</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600, color: "var(--accent)" }}>{r.name}</td>
                <td style={{ color: "var(--text2)" }}>{r.description ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn-icon" title="Ko'rish" onClick={() => setViewRole(r)}
                      style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {r.id !== "00000000-0000-0000-0000-000000000001" && (
                      <>
                        <button className="btn-icon" title="Tahrirlash" onClick={() => openEditRole(r)}
                          style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn-icon btn-icon-danger" title="O'chirish" onClick={() => deleteRole(r.id)}
                          style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== View Drawer ===== */}
      {viewRole && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setViewRole(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 720, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
              padding: "28px 28px 32px", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Rol tafsilotlari</span>
              <button onClick={() => setViewRole(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Rol nomi</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewRole.name}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Ruxsatlar</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{totalPermissions}</div>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Tavsif</div>
              <div style={{ fontSize: 14, color: "var(--text1)" }}>{viewRole.description ?? "—"}</div>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Ruxsatlar</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {permissions.map(mod => {
                const expanded = expandedViewModules.has(mod.module);
                return (
                  <div key={mod.module} style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                    <button onClick={() => toggleViewModule(mod.module)} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 16px", background: "var(--bg2)", border: "none", cursor: "pointer",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#22c55e22" stroke="#22c55e" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{mod.moduleName}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>{mod.actions.length} ta ruxsat</div>
                      </div>
                      <span style={{
                        background: "#22c55e", color: "#fff", borderRadius: 999,
                        fontSize: 12, fontWeight: 700, minWidth: 24, height: 24,
                        display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px",
                      }}>{mod.actions.length}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"
                        style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {expanded && (
                      <div style={{ padding: "12px 16px 16px", background: "#f0fdf4", borderTop: "1px solid #bbf7d0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {mod.actions.map(a => (
                          <div key={a.id} style={{
                            background: "#fff", border: "1.5px solid #bbf7d0", borderRadius: 10,
                            padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ flexShrink: 0 }}>
                              <circle cx="7.5" cy="15.5" r="4.5" />
                              <path d="M21 2l-9.6 9.6M15.5 7.5L19 11l2-2M12 10l2 2" />
                            </svg>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>{a.actionName}</div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>{a.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
