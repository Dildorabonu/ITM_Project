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

  // Role modal (create/edit)
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleResponse | null>(null);
  const [roleForm, setRoleForm] = useState<RoleCreatePayload>({ name: "", description: "" });
  const [roleSaving, setRoleSaving] = useState(false);

  // View modal
  const [viewRole, setViewRole] = useState<RoleResponse | null>(null);

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

  const openAddRole = () => {
    setEditRole(null);
    setRoleForm({ name: "", description: "" });
    setShowRoleModal(true);
  };
  const openEditRole = (r: RoleResponse) => {
    setEditRole(r);
    setRoleForm({ name: r.name, description: r.description ?? "" });
    setShowRoleModal(true);
  };
  const saveRole = async () => {
    setRoleSaving(true);
    try {
      if (editRole) {
        await roleService.update(editRole.id, roleForm);
      } else {
        await roleService.create(roleForm);
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
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
                  Yuklanmoqda...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
                  Rollar topilmadi
                </td>
              </tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600, color: "var(--accent)" }}>{r.name}</td>
                <td style={{ color: "var(--text2)" }}>{r.description ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {/* View */}
                    <button
                      className="btn-icon"
                      title="Ko'rish"
                      onClick={() => setViewRole(r)}
                      style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {/* Edit */}
                    <button
                      className="btn-icon"
                      title="Tahrirlash"
                      onClick={() => openEditRole(r)}
                      style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      className="btn-icon btn-icon-danger"
                      title="O'chirish"
                      onClick={() => deleteRole(r.id)}
                      style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewRole && (
        <div className="modal-overlay" onClick={() => setViewRole(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>Rol ma&apos;lumotlari</span>
              <button className="modal-close" onClick={() => setViewRole(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Nomi</div>
                <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 15 }}>{viewRole.name}</div>
              </div>
              {viewRole.description && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Tavsif</div>
                  <div style={{ color: "var(--text2)", fontSize: 13 }}>{viewRole.description}</div>
                </div>
              )}
              {permissions.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Ruxsatlar</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {permissions.map(mod => (
                      <div key={mod.module} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg3)", borderRadius: "var(--radius)", padding: "8px 12px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)", minWidth: 130 }}>{mod.moduleName}</span>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {mod.actions.map(a => (
                            <span key={a.id} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--accent)18", color: "var(--accent)", border: "1px solid var(--accent)33" }}>
                              {a.actionName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setViewRole(null)}>Yopish</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>{editRole ? "Rolni tahrirlash" : "Yangi rol"}</span>
              <button className="modal-close" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Nomi *</label>
                <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="Rol nomi" />
              </div>
              <div>
                <label className="form-label">Tavsif</label>
                <input className="form-input" value={roleForm.description ?? ""} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} placeholder="Ixtiyoriy tavsif" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRoleModal(false)}>Bekor</button>
              <button className="btn-primary" onClick={saveRole} disabled={roleSaving || !roleForm.name.trim()}>
                {roleSaving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
