"use client";

import { useEffect, useState } from "react";
import {
  departmentService,
  type DepartmentResponse,
  type DepartmentCreatePayload,
  type DepartmentUpdatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

interface DeptForm {
  name: string;
  employeeCount: string;
}

const emptyForm: DeptForm = { name: "", employeeCount: "" };

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

  // Inline form
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentResponse | null>(null);
  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirm
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
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? depts.filter(d => d.name.toLowerCase().includes(q)) : depts
    );
  }, [search, depts]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => setShowForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormSubmitted(false);
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const openEdit = (d: DepartmentResponse) => {
    setEditTarget(d);
    setForm({ name: d.name, employeeCount: String(d.employeeCount ?? "") });
    setFormSubmitted(false);
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormSubmitted(true);
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const count = form.employeeCount !== "" ? Number(form.employeeCount) : undefined;

      if (editTarget) {
        const payload: DepartmentUpdatePayload = {
          name: form.name || undefined,
          employeeCount: count ?? null,
        };
        await departmentService.update(editTarget.id, payload);
        const updated: DepartmentResponse = {
          ...editTarget,
          name: form.name || editTarget.name,
          employeeCount: count ?? editTarget.employeeCount,
        };
        setDepts(prev => prev.map(d => d.id === editTarget.id ? updated : d));
      } else {
        const payload: DepartmentCreatePayload = {
          name: form.name,
          employeeCount: count,
        };
        await departmentService.create(payload);
        const created: DepartmentResponse = {
          id: crypto.randomUUID(),
          name: form.name,
          employeeCount: count ?? 0,
          createdAt: new Date().toISOString(),
        };
        setDepts(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch {
      // stay on error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await departmentService.delete(deleteId);
      setDepts(prev => prev.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch {
      // stay open on error
    } finally {
      setDeleting(false);
    }
  };

  /* ===== Inline form view ===== */
  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
            {editTarget ? "Bo'limni tahrirlash" : "Yangi bo'lim"}
          </span>
        </div>

        {/* Form fields */}
        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Bo'lim nomi */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6,
                color: formSubmitted && !form.name.trim() ? "var(--danger)" : "var(--text2)",
              }}>
                Bo&apos;lim nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Bo'lim nomini kiriting"
                style={formSubmitted && !form.name.trim() ? {
                  borderColor: "var(--danger)", outline: "none",
                  boxShadow: "0 0 0 2px var(--danger)33",
                } : undefined}
              />
              {formSubmitted && !form.name.trim() && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                  Bo&apos;lim nomini kiriting
                </div>
              )}
            </div>

            {/* Xodimlar soni */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                Xodimlar soni
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={form.employeeCount}
                onChange={e => setForm(f => ({ ...f, employeeCount: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Preview card */}
          {form.name && (
            <div style={{
              marginTop: 24, padding: "16px 20px",
              border: "1.5px solid var(--accent)44",
              borderRadius: 10, background: "var(--accent-dim)",
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>
                  {form.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                  Xodimlar: {form.employeeCount || "0"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button
            onClick={() => setShowForm(false)}
            style={{
              background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
              cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500,
            }}
          >
            Bekor qilish
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Saqlanmoqda..." : editTarget ? "O'zgarishlarni saqlash" : "Bo'lim yaratish"}
          </button>
        </div>
      </div>
    );
  }

  /* ===== List view ===== */
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
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
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Bo&apos;lim nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Bo&apos;lim boshlig&apos;i</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Xodimlar</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ textAlign: "center" }}>{d.name}</td>
                    <td style={{ textAlign: "center", color: "var(--text2)" }}>{d.headUserName ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{d.employeeCount ?? "—"}</td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      {(canUpdate || canDelete) && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {canUpdate && (
                            <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(d)}
                              style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button className="btn-icon btn-icon-danger" title="O'chirish"
                              style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                              onClick={() => setDeleteId(d.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                            </button>
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

      {/* Delete confirm */}
      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
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
    </div>
  );
}
