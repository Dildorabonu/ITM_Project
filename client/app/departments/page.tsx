"use client";

import { useEffect, useState } from "react";
import {
  departmentService,
  userService,
  type DepartmentResponse,
  type DepartmentCreatePayload,
  type DepartmentUpdatePayload,
  type UserResponse,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

interface DeptForm {
  name: string;
  headUserId: string;
}

const emptyForm: DeptForm = { name: "", headUserId: "" };

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  form: DeptForm;
  setForm: React.Dispatch<React.SetStateAction<DeptForm>>;
  users: UserResponse[];
}

function DeptModal({ title, onClose, onSubmit, loading, form, setForm, users }: ModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
        padding: 28, width: 400, maxWidth: "95vw",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: "2px 10px" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Bo&apos;lim nomi</label>
            <input
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Bo'lim nomi"
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Bo&apos;lim boshlig&apos;i</label>
            <select
              style={{
                width: "100%", background: "var(--input)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13,
              }}
              value={form.headUserId}
              onChange={e => setForm(f => ({ ...f, headUserId: e.target.value }))}
            >
              <option value="">— Boshlig&apos; tanlang —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Bekor</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading || !form.name.trim()}>
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Departments.Create");
  const canUpdate = hasPermission("Departments.Update");
  const canDelete = hasPermission("Departments.Delete");

  const [depts, setDepts] = useState<DepartmentResponse[]>([]);
  const [filtered, setFiltered] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserResponse[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentResponse | null>(null);
  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await departmentService.getAllFull();
      setDepts(data);
      setFiltered(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    userService.getAll().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? depts.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.headUserFullName ?? "").toLowerCase().includes(q)
      ) : depts
    );
  }, [search, depts]);

  const openCreate = () => {
    setForm(emptyForm);
    setShowCreate(true);
  };

  const openEdit = (d: DepartmentResponse) => {
    setEditTarget(d);
    setForm({ name: d.name, headUserId: d.headUserId ?? "" });
    setShowEdit(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: DepartmentCreatePayload = {
        name: form.name,
        headUserId: form.headUserId || null,
      };
      await departmentService.create(payload);
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
      const payload: DepartmentUpdatePayload = {
        name: form.name || undefined,
        headUserId: form.headUserId || null,
      };
      await departmentService.update(editTarget.id, payload);
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
      await departmentService.delete(deleteId);
      setDeleteId(null);
      await load();
    } catch {
      // stay open on error
    } finally {
      setDeleting(false);
    }
  };

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
        <div className="itm-card-header">
          <div className="icon-bg ib-blue">
            <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          </div>
          <span className="itm-card-title">Bo&apos;limlar Ro&apos;yxati</span>
          <span className="itm-card-subtitle">{depts.length} ta bo&apos;lim</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr><th>#</th><th>Bo&apos;lim nomi</th><th>Bo&apos;lim boshlig&apos;i</th><th>Xodimlar</th><th>Holat</th><th>Amal</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((d, i) => (
                  <tr key={d.id}>
                    <td className="mono" style={{ color: "var(--text3)", fontSize: 11 }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td><strong>{d.name}</strong></td>
                    <td style={{ color: "var(--text2)" }}>{d.headUserFullName ?? "—"}</td>
                    <td className="mono" style={{ color: "var(--text3)", fontSize: 12 }}>{d.employeeCount}</td>
                    <td>
                      <span className={`status ${d.headUserId ? "s-ok" : "s-warn"}`}>
                        {d.headUserId ? "Aktiv" : "Boshligsiz"}
                      </span>
                    </td>
                    <td>
                      {(canUpdate || canDelete) && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && (
                            <button className="btn btn-sm btn-outline" onClick={() => openEdit(d)}>Tahrirlash</button>
                          )}
                          {canDelete && (
                            <button className="btn btn-sm" style={{ background: "rgba(220,50,50,0.12)", color: "#e05252", border: "1px solid rgba(220,50,50,0.25)" }}
                              onClick={() => setDeleteId(d.id)}>O&apos;chirish</button>
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

      {showCreate && (
        <DeptModal
          title="Yangi Bo'lim"
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          loading={saving}
          form={form}
          setForm={setForm}
          users={users}
        />
      )}

      {showEdit && (
        <DeptModal
          title="Bo'limni Tahrirlash"
          onClose={() => setShowEdit(false)}
          onSubmit={handleUpdate}
          loading={saving}
          form={form}
          setForm={setForm}
          users={users}
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
            <div style={{ fontSize: 15, marginBottom: 8 }}>Bo&apos;limni o&apos;chirish</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              Ushbu bo&apos;lim o&apos;chiriladi. Davom etasizmi?
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
