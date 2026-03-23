"use client";

import { useEffect, useState } from "react";
import {
  productService,
  departmentService,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type ProductResponse,
  type ProductCreatePayload,
  type ProductUpdatePayload,
  type DepartmentOption,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

interface ProductForm {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  departmentId: string;
}

const emptyForm: ProductForm = { name: "", description: "", quantity: "", unit: "", departmentId: "" };

export default function ProductsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Products.Create");
  const canUpdate = hasPermission("Products.Update");
  const canDelete = hasPermission("Products.Delete");

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [filtered, setFiltered] = useState<ProductResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Inline form
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await productService.getAll();
      setProducts(data);
      setFiltered(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      products.filter(p => {
        const matchSearch = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          p.departmentName.toLowerCase().includes(q);
        const matchDept = !filterDept || p.departmentId === filterDept;
        return matchSearch && matchDept;
      })
    );
  }, [search, filterDept, products]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormSubmitted(false);
    setShowForm(true);
  };

  const openEdit = (p: ProductResponse) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? "", quantity: String(p.quantity), unit: String(p.unit), departmentId: p.departmentId });
    setFormSubmitted(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormSubmitted(true);
    if (!form.name.trim() || !form.departmentId) return;
    setSaving(true);
    try {
      const dept = departments.find(d => d.id === form.departmentId);

      const qty = form.quantity !== "" ? Number(form.quantity) : 0;

      const unitValue = form.unit !== "" ? (Number(form.unit) as ProductUnit) : undefined;

      if (editTarget) {
        const payload: ProductUpdatePayload = {
          name: form.name || undefined,
          description: form.description || null,
          quantity: qty,
          unit: unitValue,
          departmentId: form.departmentId || undefined,
        };
        await productService.update(editTarget.id, payload);
        const updated: ProductResponse = {
          ...editTarget,
          name: form.name || editTarget.name,
          description: form.description || null,
          quantity: qty,
          unit: unitValue ?? editTarget.unit,
          departmentId: form.departmentId || editTarget.departmentId,
          departmentName: dept?.name ?? editTarget.departmentName,
        };
        setProducts(prev => prev.map(p => p.id === editTarget.id ? updated : p));
      } else {
        const payload: ProductCreatePayload = {
          name: form.name,
          description: form.description || null,
          quantity: qty,
          unit: unitValue ?? ProductUnit.Dona,
          departmentId: form.departmentId,
        };
        await productService.create(payload);
        const created: ProductResponse = {
          id: crypto.randomUUID(),
          name: form.name,
          description: form.description || null,
          quantity: qty,
          unit: unitValue ?? ProductUnit.Dona,
          departmentId: form.departmentId,
          departmentName: dept?.name ?? "",
          createdAt: new Date().toISOString(),
        };
        setProducts(prev => [...prev, created]);
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
      await productService.delete(deleteId);
      setProducts(prev => prev.filter(p => p.id !== deleteId));
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
            {editTarget ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
          </span>
        </div>

        {/* Form fields */}
        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Mahsulot nomi */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6,
                color: formSubmitted && !form.name.trim() ? "var(--danger)" : "var(--text2)",
              }}>
                Mahsulot nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mahsulot nomini kiriting"
                style={formSubmitted && !form.name.trim() ? {
                  borderColor: "var(--danger)", outline: "none",
                  boxShadow: "0 0 0 2px var(--danger)33",
                } : undefined}
              />
              {formSubmitted && !form.name.trim() && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                  Mahsulot nomini kiriting
                </div>
              )}
            </div>

            {/* Bo'lim */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6,
                color: formSubmitted && !form.departmentId ? "var(--danger)" : "var(--text2)",
              }}>
                Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="form-input"
                value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                style={{
                  width: "100%", cursor: "pointer",
                  ...(formSubmitted && !form.departmentId ? {
                    borderColor: "var(--danger)", outline: "none",
                    boxShadow: "0 0 0 2px var(--danger)33",
                  } : {}),
                }}
              >
                <option value="">— Bo&apos;lim tanlang —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {formSubmitted && !form.departmentId && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                  Bo&apos;limni tanlang
                </div>
              )}
            </div>

            {/* Soni */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                Soni
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>

            {/* O'lchov birligi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                O&apos;lchov birligi
              </label>
              <select
                className="form-input"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                style={{ width: "100%", cursor: "pointer" }}
              >
                <option value="">— Tanlang —</option>
                {(Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => (
                  <option key={key} value={key}>{PRODUCT_UNIT_LABELS[key]}</option>
                ))}
              </select>
            </div>

            {/* Tavsif */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                Tavsif
              </label>
              <textarea
                className="form-input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Mahsulot tavsifini kiriting (ixtiyoriy)"
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Preview */}
          {(form.name || form.departmentId) && (
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
                  <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>
                  {form.name || "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                  Bo&apos;lim: {departments.find(d => d.id === form.departmentId)?.name ?? "Belgilanmagan"}
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
            {saving ? "Saqlanmoqda..." : editTarget ? "O'zgarishlarni saqlash" : "Mahsulot yaratish"}
          </button>
        </div>
      </div>
    );
  }

  /* ===== List view ===== */
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
        <select
          className="form-input"
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ width: 200, cursor: "pointer", height: 36, padding: "0 10px" }}
        >
          <option value="">Barcha bo&apos;limlar</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
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
                  <th style={{ width: 40, color: "var(--text1)", paddingLeft: 8, borderRight: "2px solid var(--border)" }}>#</th>
                  <th style={{ width: 240, color: "var(--text1)" }}>Mahsulot nomi</th>
                  <th style={{ color: "var(--text1)" }}>
                    <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Bo&apos;lim</span>
                  </th>
                  <th style={{ color: "var(--text1)" }}>
                    <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Soni</span>
                  </th>
                  <th style={{ color: "var(--text1)" }}>
                    <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>O&apos;lchov</span>
                  </th>
                  <th style={{ color: "var(--text1)" }}>
                    <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Tavsif</span>
                  </th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 8, borderRight: "2px solid var(--border)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        background: "var(--accent-dim)", color: "var(--accent)",
                      }}>
                        {p.departmentName}
                      </span>
                    </td>
                    <td style={{ color: "var(--text1)", fontWeight: 600 }}>{p.quantity}</td>
                    <td style={{ color: "var(--text2)", fontSize: 13 }}>{PRODUCT_UNIT_LABELS[p.unit] ?? "—"}</td>
                    <td style={{ color: "var(--text2)", fontSize: 13 }}>{p.description ?? "—"}</td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      {(canUpdate || canDelete) && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {canUpdate && (
                            <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(p)}
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
                              onClick={() => setDeleteId(p.id)}>
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
            <div style={{ fontSize: 15, marginBottom: 8 }}>Mahsulotni o&apos;chirish</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              Ushbu mahsulot o&apos;chiriladi. Davom etasizmi?
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
