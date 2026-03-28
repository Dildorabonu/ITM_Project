"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDraft } from "@/lib/useDraft";
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


const emptyForm = { firstName: "", lastName: "", login: "", password: "", roleId: "", departmentId: "", isActive: true };

function UsersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const editId = searchParams.get("id");

  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Users.Create");
  const canUpdate = hasPermission("Users.Update");
  const canDelete = hasPermission("Users.Delete");

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [filtered, setFiltered] = useState<UserResponse[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showCreate = view === "create";
  const showEdit = view === "edit" && !!editId;
  const editTarget = users.find(u => u.id === editId) ?? null;

  useDraft(
    "draft_users",
    showCreate || showEdit,
    { form, editId: editId ?? null },
    (d) => {
      setForm(d.form);
      if (d.editId) {
        router.replace(`${pathname}?view=edit&id=${d.editId}`);
      } else {
        router.replace(`${pathname}?view=create`);
      }
    },
  );

  const load = async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const data = await userService.getAll(p);
      setUsers(data.items);
      setFiltered(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    roleService.getAll().then(setRoles).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [page]);

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

  // Initialize form when entering edit mode or when editTarget becomes available
  const initializedEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (showEdit && editTarget && initializedEditIdRef.current !== editId) {
      initializedEditIdRef.current = editId;
      setForm({
        firstName: editTarget.firstName,
        lastName: editTarget.lastName,
        login: editTarget.login,
        password: "",
        roleId: editTarget.roleId ?? "",
        departmentId: editTarget.departmentId ?? "",
        isActive: editTarget.isActive,
      });
    }
    if (!showEdit) {
      initializedEditIdRef.current = null;
    }
  }, [showEdit, editTarget, editId]);

  // Reset form when entering create mode
  useEffect(() => {
    if (showCreate) {
      setForm(emptyForm);
      setFormSubmitted(false);
    }
  }, [showCreate]);

  const openCreate = () => {
    router.push(`${pathname}?view=create`);
  };

  const openEdit = (u: UserResponse) => {
    router.push(`${pathname}?view=edit&id=${u.id}`);
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
      router.back();
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
      router.back();
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

  /* ===== Edit inline view ===== */
  if (showEdit) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Foydalanuvchini tahrirlash</span>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Ism
            </label>
            <input
              className="form-input"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              placeholder="Ism"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Familiya
            </label>
            <input
              className="form-input"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              placeholder="Familiya"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Login
            </label>
            <input
              className="form-input"
              value={form.login}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              placeholder="Login"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
              Yangi parol (o&apos;zgartirmaslik uchun bo&apos;sh qoldiring)
            </label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Aktiv
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button className="btn-secondary" onClick={() => router.back()}>Bekor qilish</button>
          <button className="btn-primary" onClick={handleUpdate} disabled={saving}
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

  /* ===== Create inline view ===== */
  if (showCreate) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <button className="btn-secondary" onClick={() => router.back()}>Bekor qilish</button>
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
        .sdot-on  { background: #22c55e; animation: sdot-ping 1.5s ease-out infinite; }
        .sdot-off { background: #94a3b8; }
      `}</style>
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
          onClick={() => load()}
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
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Holat</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * 20 + i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center" }}>{u.firstName}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{u.lastName}</td>
                    <td style={{ textAlign: "center" }}>{u.login}</td>
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
                              <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(u)}
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
                ))}
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

      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
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
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageInner />
    </Suspense>
  );
}
