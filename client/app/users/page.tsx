"use client";

import { useEffect, useState } from "react";
import {
  userService,
  roleService,
  departmentService,
  type UserResponse,
  type RoleOption,
  type DepartmentOption,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#6d4aad,#4a2e8a)",
  "linear-gradient(135deg,#1a6eeb,#0d3e9e)",
  "linear-gradient(135deg,#1558c7,#0a2d7a)",
  "linear-gradient(135deg,#e07b00,#b35e00)",
  "linear-gradient(135deg,#0a8a5a,#065c3c)",
  "linear-gradient(135deg,#c7155a,#8a0d3e)",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  form: {
    firstName: string; lastName: string; login: string; password: string;
    roleId: string; departmentId: string; isActive: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<ModalProps["form"]>>;
  roles: RoleOption[];
  departments: DepartmentOption[];
  isEdit: boolean;
}

function UserModal({ title, onClose, onSubmit, loading, form, setForm, roles, departments, isEdit }: ModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
        padding: 28, width: 420, maxWidth: "95vw",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: "2px 10px" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Ism</label>
              <input className="search-input" style={{ width: "100%", boxSizing: "border-box" }}
                value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ism" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Familiya</label>
              <input className="search-input" style={{ width: "100%", boxSizing: "border-box" }}
                value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Familiya" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Login</label>
            <input className="search-input" style={{ width: "100%", boxSizing: "border-box" }}
              value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} placeholder="Login" />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>
              {isEdit ? "Yangi parol (o'zgartirmaslik uchun bo'sh qoldiring)" : "Parol"}
            </label>
            <input className="search-input" style={{ width: "100%", boxSizing: "border-box" }}
              type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? "••••••••" : "Parol"} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Rol</label>
            <select style={{
              width: "100%", background: "var(--input)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13,
            }}
              value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
              <option value="">— Rol tanlang —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Bo&apos;lim</label>
            <select style={{
              width: "100%", background: "var(--input)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13,
            }}
              value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">— Bo&apos;lim tanlang —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Aktiv
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Bekor</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

const emptyForm = { firstName: "", lastName: "", login: "", password: "", roleId: "", departmentId: "", isActive: true };

export default function UsersPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Users.Create");
  const canUpdate = hasPermission("Users.Update");
  const canDelete = hasPermission("Users.Delete");

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [filtered, setFiltered] = useState<UserResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<UserResponse | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await userService.getAll();
      setUsers(data);
      setFiltered(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    roleService.getAll().then(setRoles).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? users.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        (u.roleName ?? "").toLowerCase().includes(q) ||
        (u.departmentName ?? "").toLowerCase().includes(q)
      ) : users
    );
  }, [search, users]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormSubmitted(false);
    setShowCreate(true);
  };

  const openEdit = (u: UserResponse) => {
    setEditTarget(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      login: u.login,
      password: "",
      roleId: u.roleId ?? "",
      departmentId: u.departmentId ?? "",
      isActive: u.isActive,
    });
    setShowEdit(true);
  };

  const handleCreate = async () => {
    setFormSubmitted(true);
    if (!form.firstName || !form.lastName || !form.login || !form.password) return;
    setSaving(true);
    try {
      const payload: UserCreatePayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        login: form.login,
        password: form.password,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
      };
      await userService.create(payload);
      setShowCreate(false);
      await load();
    } catch {
      // stay open on error
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const payload: UserUpdatePayload = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        login: form.login || undefined,
        password: form.password || undefined,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        isActive: form.isActive,
      };
      await userService.update(editTarget.id, payload);
      setShowEdit(false);
      await load();
    } catch {
      // stay open on error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await userService.delete(deleteId);
      setDeleteId(null);
      await load();
    } catch {
      // stay open on error
    } finally {
      setDeleting(false);
    }
  };

  /* ===== Create inline view ===== */
  if (showCreate) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowCreate(false)}
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
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi foydalanuvchi</span>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.firstName.trim() ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Ism <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="form-input"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              placeholder="Ism"
              style={formSubmitted && !form.firstName.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
            />
            {formSubmitted && !form.firstName.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Ismni kiriting</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.lastName.trim() ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Familiya <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="form-input"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              placeholder="Familiya"
              style={formSubmitted && !form.lastName.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
            />
            {formSubmitted && !form.lastName.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Familiyani kiriting</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.login.trim() ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Login <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="form-input"
              value={form.login}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              placeholder="Login"
              style={formSubmitted && !form.login.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
            />
            {formSubmitted && !form.login.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Loginni kiriting</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.password.trim() ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Parol <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Parol"
              style={formSubmitted && !form.password.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
            />
            {formSubmitted && !form.password.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Parolni kiriting</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>Rol</label>
            <select className="form-input" value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
              <option value="">— Rol tanlang —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>Bo&apos;lim</label>
            <select className="form-input" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">— Bo&apos;lim tanlang —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button className="btn-secondary" onClick={() => setShowCreate(false)}>Bekor qilish</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish"
            value={search} onChange={e => setSearch(e.target.value)} />
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
        {canCreate && (
          <button
            className="btn-primary"
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yaratish
          </button>
        )}
      </div>

      <div className="itm-card">

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr><th>F.I.Sh.</th><th>Login</th><th>Rol</th><th>Bo&apos;lim</th><th>Holat</th><th>Amal</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: avatarColor(u.id),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                          fontFamily: "var(--font-head)",
                        }}>
                          {getInitials(u.firstName, u.lastName)}
                        </div>
                        {u.firstName} {u.lastName}
                      </div>
                    </td>
                    <td className="mono" style={{ color: "var(--text2)", fontSize: 12 }}>{u.login}</td>
                    <td>{u.roleName ? <span className="role-badge rb-worker">{u.roleName}</span> : <span style={{ color: "var(--text3)" }}>—</span>}</td>
                    <td style={{ color: "var(--text2)" }}>{u.departmentName ?? "—"}</td>
                    <td>
                      <span className={`status ${u.isActive ? "s-ok" : "s-warn"}`}>
                        {u.isActive ? "Aktiv" : "Nofaol"}
                      </span>
                    </td>
                    <td>
                      {u.id !== "00000000-0000-0000-0000-000000000001" && (canUpdate || canDelete) && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && (
                            <button className="btn btn-sm btn-outline" onClick={() => openEdit(u)}>Tahrirlash</button>
                          )}
                          {canDelete && (
                            <button className="btn btn-sm" style={{ background: "rgba(220,50,50,0.12)", color: "#e05252", border: "1px solid rgba(220,50,50,0.25)" }}
                              onClick={() => setDeleteId(u.id)}>O&apos;chirish</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEdit && (
        <UserModal
          title="Foydalanuvchini Tahrirlash"
          onClose={() => setShowEdit(false)}
          onSubmit={handleUpdate}
          loading={saving}
          form={form}
          setForm={setForm}
          roles={roles}
          departments={departments}
          isEdit={true}
        />
      )}

      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 28, width: 340, maxWidth: "95vw", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, marginBottom: 8 }}>Foydalanuvchini o&apos;chirish</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              Ushbu foydalanuvchi o&apos;chiriladi. Davom etasizmi?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-outline" onClick={() => setDeleteId(null)} disabled={deleting}>Bekor</button>
              <button className="btn" style={{ background: "#e05252", color: "#fff", border: "none" }}
                onClick={handleDelete} disabled={deleting}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
