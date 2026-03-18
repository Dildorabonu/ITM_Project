"use client";

import { useEffect, useState } from "react";
import {
  roleService,
  permissionService,
  type RoleResponse,
  type PermissionResponse,
  type RoleCreatePayload,
  type PermissionCreatePayload,
} from "@/lib/userService";

const ROLE_COLORS = [
  "var(--purple)",
  "var(--accent)",
  "#1558c7",
  "var(--warn)",
  "var(--success)",
  "var(--danger)",
];

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleResponse | null>(null);
  const [roleForm, setRoleForm] = useState<RoleCreatePayload>({ name: "", description: "" });
  const [roleSaving, setRoleSaving] = useState(false);

  // Permission modal
  const [showPermModal, setShowPermModal] = useState(false);
  const [editPerm, setEditPerm] = useState<PermissionResponse | null>(null);
  const [permForm, setPermForm] = useState<PermissionCreatePayload>({ name: "", description: "" });
  const [permSaving, setPermSaving] = useState(false);

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

  // Role handlers
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

  // Permission handlers
  const openAddPerm = () => {
    setEditPerm(null);
    setPermForm({ name: "", description: "" });
    setShowPermModal(true);
  };
  const openEditPerm = (p: PermissionResponse) => {
    setEditPerm(p);
    setPermForm({ name: p.name, description: p.description ?? "" });
    setShowPermModal(true);
  };
  const savePerm = async () => {
    setPermSaving(true);
    try {
      if (editPerm) {
        await permissionService.update(editPerm.id, permForm);
      } else {
        await permissionService.create(permForm);
      }
      setShowPermModal(false);
      await fetchAll();
    } finally {
      setPermSaving(false);
    }
  };
  const deletePerm = async (id: string) => {
    if (!confirm("Bu ruxsatni o'chirishni tasdiqlaysizmi?")) return;
    await permissionService.delete(id);
    await fetchAll();
  };

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Rollar &amp; Ruxsatlar</div>
      </div>

      <div className="two-col">
        {/* Roles */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="itm-card-title">Rollar Ro&apos;yxati</span>
            <button className="btn-primary" style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 12 }} onClick={openAddRole}>
              + Qo&apos;shish
            </button>
          </div>
          <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 20 }}>Yuklanmoqda...</div>
            ) : roles.length === 0 ? (
              <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 20 }}>Rollar topilmadi</div>
            ) : roles.map((r, i) => (
              <div key={r.id} style={{
                background: "var(--bg3)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)", padding: 14,
                borderLeft: `3px solid ${ROLE_COLORS[i % ROLE_COLORS.length]}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="role-badge" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] + "22", color: ROLE_COLORS[i % ROLE_COLORS.length], border: `1px solid ${ROLE_COLORS[i % ROLE_COLORS.length]}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                    {r.name}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button className="btn-icon" onClick={() => openEditRole(r)} title="Tahrirlash">
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-icon btn-icon-danger" onClick={() => deleteRole(r.id)} title="O'chirish">
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>
                {r.description && (
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>{r.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span className="itm-card-title">Ruxsatlar</span>
            <button className="btn-primary" style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 12 }} onClick={openAddPerm}>
              + Qo&apos;shish
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            {loading ? (
              <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 20 }}>Yuklanmoqda...</div>
            ) : permissions.length === 0 ? (
              <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 20 }}>Ruxsatlar topilmadi</div>
            ) : (
              <table className="itm-table">
                <thead>
                  <tr>
                    <th>Nomi</th>
                    <th>Tavsif</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>{p.description ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button className="btn-icon" onClick={() => openEditPerm(p)} title="Tahrirlash">
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="btn-icon btn-icon-danger" onClick={() => deletePerm(p.id)} title="O'chirish">
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Role Modal */}
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

      {/* Permission Modal */}
      {showPermModal && (
        <div className="modal-overlay" onClick={() => setShowPermModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>{editPerm ? "Ruxsatni tahrirlash" : "Yangi ruxsat"}</span>
              <button className="modal-close" onClick={() => setShowPermModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Nomi *</label>
                <input className="form-input" value={permForm.name} onChange={e => setPermForm(f => ({ ...f, name: e.target.value }))} placeholder="Ruxsat nomi" />
              </div>
              <div>
                <label className="form-label">Tavsif</label>
                <input className="form-input" value={permForm.description ?? ""} onChange={e => setPermForm(f => ({ ...f, description: e.target.value }))} placeholder="Ixtiyoriy tavsif" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPermModal(false)}>Bekor</button>
              <button className="btn-primary" onClick={savePerm} disabled={permSaving || !permForm.name.trim()}>
                {permSaving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
