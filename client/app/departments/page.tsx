"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraft } from "@/lib/useDraft";
import {
  departmentService,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type DepartmentResponse,
  type DepartmentCreatePayload,
  type DepartmentUpdatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";

const TYPE_FILTER_OPTIONS: { value: DepartmentType | null; label: string; icon?: string }[] = [
  { value: null, label: "Barchasi" },
  { value: DepartmentType.IshlabChiqarish, label: DEPARTMENT_TYPE_LABELS[DepartmentType.IshlabChiqarish], icon: "🏭" },
  { value: DepartmentType.Bolim,           label: DEPARTMENT_TYPE_LABELS[DepartmentType.Bolim],           icon: "🏢" },
  { value: DepartmentType.Boshqaruv,       label: DEPARTMENT_TYPE_LABELS[DepartmentType.Boshqaruv],       icon: "👔" },
];

function TypeFilterDropdown({
  value,
  onChange,
  counts,
}: {
  value: DepartmentType | null;
  onChange: (v: DepartmentType | null) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = TYPE_FILTER_OPTIONS.find(o => o.value === value)!;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropW = Math.max(rect.width, 200);
    const leftPos = rect.left + dropW > window.innerWidth ? window.innerWidth - dropW - 4 : rect.left;
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: leftPos,
      width: dropW,
      zIndex: 9999,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const totalCount = counts["all"] ?? 0;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      onWheel={e => e.stopPropagation()}
      style={{
        ...dropdownStyle,
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
        maxHeight: 300,
        overflowY: "auto",
      }}
    >
      {TYPE_FILTER_OPTIONS.map(opt => {
        const checked = opt.value === value;
        const count = opt.value === null ? totalCount : (counts[String(opt.value)] ?? 0);
        return (
          <div
            key={String(opt.value)}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg3)"; }}
            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = checked ? "var(--accent-dim)" : ""; }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              cursor: "pointer",
              fontSize: 13,
              color: checked ? "var(--accent)" : "var(--text1)",
              fontWeight: checked ? 600 : 400,
              background: checked ? "var(--accent-dim)" : "transparent",
              borderBottom: "1px solid var(--border)",
              transition: "background 0.1s",
            }}
          >
            <span style={{
              width: 15, height: 15, flexShrink: 0,
              border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 3,
              background: checked ? "var(--accent)" : "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
            }}>
              {checked && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
            {opt.icon && <span style={{ fontSize: 15, lineHeight: 1 }}>{opt.icon}</span>}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {opt.label}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: checked ? "var(--accent)" : "var(--border)",
              color: checked ? "#fff" : "var(--text2)",
              borderRadius: 10, padding: "1px 7px", flexShrink: 0,
            }}>{count}</span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          border: `1.5px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: 13,
          fontWeight: 600,
          background: "var(--bg3)",
          color: "var(--text1)",
          cursor: "pointer",
          transition: "border-color 0.15s",
          whiteSpace: "nowrap",
          minWidth: 160,
          fontFamily: "var(--font-inter), Inter, sans-serif",
        }}
      >
        {selected.icon && <span style={{ fontSize: 15, lineHeight: 1 }}>{selected.icon}</span>}
        <span style={{ flex: 1, textAlign: "left" }}>{selected.label}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: "var(--accent)",
          color: "#fff",
          borderRadius: 10, padding: "1px 7px", flexShrink: 0,
        }}>
          {value === null ? totalCount : (counts[String(value)] ?? 0)}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, color: "var(--text3)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {typeof document !== "undefined" && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}

interface DeptForm {
  name: string;
  type: DepartmentType;
  employeeCount: string;
}

const emptyForm: DeptForm = { name: "", type: DepartmentType.Bolim, employeeCount: "" };

const TYPE_STYLE: Partial<Record<DepartmentType, { bg: string; color: string; border: string; icon: string }>> = {
  [DepartmentType.IshlabChiqarish]:     { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]: { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

export default function DepartmentsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Departments.Create");
  const canUpdate = hasPermission("Departments.Update");
  const canDelete = hasPermission("Departments.Delete");
  const showToast = useToastStore(s => s.show);

  const [depts, setDepts] = useState<DepartmentResponse[]>([]);
  const [filtered, setFiltered] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DepartmentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentResponse | null>(null);
  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toggleId, setToggleId] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<DepartmentResponse | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState("");


  useDraft(
    "draft_departments",
    showForm,
    { form, editTarget },
    (d) => { setForm(d.form); setEditTarget(d.editTarget); setShowForm(true); },
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await departmentService.getAllFull();
      setDepts(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    let list = depts;
    if (typeFilter !== null) list = list.filter(d => d.type === typeFilter);
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q));
    setFiltered(list);
  }, [search, typeFilter, depts]);

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
    setForm({ name: d.name, type: d.type, employeeCount: String(d.employeeCount ?? "") });
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
          type: form.type,
          employeeCount: count ?? null,
        };
        await departmentService.update(editTarget.id, payload);
        const updated: DepartmentResponse = {
          ...editTarget,
          name: form.name || editTarget.name,
          type: form.type,
          employeeCount: count ?? editTarget.employeeCount,
        };
        setDepts(prev => prev.map(d => d.id === editTarget.id ? updated : d));
        showToast("Bo'lim muvaffaqiyatli yangilandi!");
      } else {
        const payload: DepartmentCreatePayload = {
          name: form.name,
          type: form.type,
          employeeCount: count,
        };
        await departmentService.create(payload);
        const created: DepartmentResponse = {
          id: crypto.randomUUID(),
          name: form.name,
          type: form.type,
          employeeCount: count ?? 0,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        setDepts(prev => [...prev, created]);
        showToast("Bo'lim muvaffaqiyatli yaratildi!");
      }
      setShowForm(false);
    } catch {
      showToast("Saqlashda xatolik yuz berdi.", "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    setToggleError("");
    try {
      await departmentService.delete(toggleTarget.id);
      const wasActive = toggleTarget.isActive !== false;
      setDepts(prev => prev.map(d => d.id === toggleTarget.id ? { ...d, isActive: !toggleTarget.isActive } : d));
      showToast(wasActive ? "Bo'lim noaktiv qilindi!" : "Bo'lim muvaffaqiyatli faollashtirildi!");
      setToggleId(null);
      setToggleTarget(null);
    } catch {
      setToggleError("Amal bajarilmadi. Qayta urinib ko'ring.");
    } finally {
      setToggling(false);
    }
  };

  /* ===== Inline form view ===== */
  if (showForm) {
    const ts = TYPE_STYLE[form.type] ?? { bg: "var(--bg1)", color: "var(--text2)", border: "var(--border)", icon: "🏢" };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--bg3)", border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)", cursor: "pointer",
              padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Orqaga
          </button>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
            {editTarget ? "Bo'limni tahrirlash" : "Yangi bo'lim / ishlab chiqarish / boshliq"}
          </span>
        </div>

        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Nomi */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6,
                color: formSubmitted && !form.name.trim() ? "var(--danger)" : "var(--text2)",
              }}>
                Nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nomini kiriting"
                style={formSubmitted && !form.name.trim() ? {
                  borderColor: "var(--danger)", outline: "none",
                  boxShadow: "0 0 0 2px var(--danger)33",
                } : undefined}
              />
              {formSubmitted && !form.name.trim() && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Nomini kiriting</div>
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
                onWheel={e => (e.target as HTMLInputElement).blur()}
                placeholder="0"
              />
            </div>

            {/* Toifa */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 10, color: "var(--text2)" }}>
                Toifa <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {([DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const).map(t => {
                  const s = TYPE_STYLE[t]!;
                  const selected = form.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{
                        flex: 1, padding: "14px 12px", borderRadius: 10, cursor: "pointer",
                        border: selected ? `2px solid ${s.color}` : "2px solid var(--border)",
                        background: selected ? s.bg : "var(--bg1)",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{s.icon}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: selected ? s.color : "var(--text2)",
                      }}>
                        {DEPARTMENT_TYPE_LABELS[t]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview */}
          {form.name && (
            <div style={{
              marginTop: 24, padding: "16px 20px",
              border: `1.5px solid ${ts.border}`,
              borderRadius: 10, background: ts.bg,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: ts.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontSize: 20,
              }}>
                {ts.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2332" }}>{form.name}</div>
                <div style={{ fontSize: 12, color: ts.color, marginTop: 2, fontWeight: 600 }}>
                  {DEPARTMENT_TYPE_LABELS[form.type]} · Xodimlar: {form.employeeCount || "0"}
                </div>
              </div>
            </div>
          )}
        </div>

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
            {saving ? "Saqlanmoqda..." : editTarget ? "O'zgarishlarni saqlash" : "Yaratish"}
          </button>
        </div>
      </div>
    );
  }

  /* ===== List view ===== */
  const counts = {
    all: depts.length,
    [DepartmentType.IshlabChiqarish]: depts.filter(d => d.type === DepartmentType.IshlabChiqarish).length,
    [DepartmentType.Bolim]:           depts.filter(d => d.type === DepartmentType.Bolim).length,
    [DepartmentType.Boshqaruv]:       depts.filter(d => d.type === DepartmentType.Boshqaruv).length,
  };

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <TypeFilterDropdown value={typeFilter} onChange={setTypeFilter} counts={counts} />
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
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Toifa</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Bo&apos;lim boshlig&apos;i</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Xodimlar</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((d, i) => {
                  const inactive = d.isActive === false;
                  return (
                    <tr key={d.id} style={inactive ? { opacity: 0.55 } : undefined}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600, maxWidth: 260 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                          <span
                            title={d.name}
                            style={{
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              maxWidth: inactive ? "calc(100% - 80px)" : "100%",
                            }}
                          >
                            {d.name}
                          </span>
                          {inactive && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 10, flexShrink: 0,
                              background: "#f3f4f6", color: "#9ca3af", border: "1px solid #e5e7eb",
                            }}>Noaktiv</span>
                          )}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{DEPARTMENT_TYPE_LABELS[d.type]}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{d.headUserName ?? "—"}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{d.employeeCount ?? "—"}</td>
                      <td style={{ borderLeft: "2px solid var(--border)" }}>
                        {(canUpdate || canDelete) && (
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            {canUpdate && !inactive && (
                              <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(d)}
                                style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="btn-icon"
                                title={inactive ? "Faollashtirish" : "Noaktiv qilish"}
                                style={inactive
                                  ? { color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }
                                  : { color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }
                                }
                                onClick={() => { setToggleId(d.id); setToggleTarget(d); setToggleError(""); }}
                              >
                                {inactive ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4" />
                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="9" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          </div>
        )}
      </div>

      {/* Delete confirm */}
      {toggleId && toggleTarget && createPortal(
        <div className="modal-overlay" onClick={() => { setToggleId(null); setToggleTarget(null); setToggleError(""); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-header" style={{ color: toggleTarget.isActive === false ? "#22c55e" : "var(--danger)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {toggleTarget.isActive === false ? "Faollashtirishni tasdiqlang" : "Noaktiv qilishni tasdiqlang"}
              </span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                {toggleTarget.isActive === false
                  ? `"${toggleTarget.name}" bo'limi yana faol bo'ladi.`
                  : `"${toggleTarget.name}" bo'limi noaktiv qilinadi. Ma'lumotlar saqlanib qoladi.`}
              </p>
              {toggleError && (
                <div style={{
                  color: "#e05252", fontSize: 13,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  {toggleError}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline"
                  onClick={() => { setToggleId(null); setToggleTarget(null); setToggleError(""); }}
                  disabled={toggling}>Bekor qilish</button>
                <button className="btn"
                  style={{
                    background: toggleTarget.isActive === false ? "#22c55e" : "var(--danger)",
                    color: "#fff", border: "none"
                  }}
                  onClick={handleToggleActive} disabled={toggling}>
                  {toggling
                    ? "Bajarilmoqda..."
                    : toggleTarget.isActive === false ? "Faollashtirish" : "Noaktiv qilish"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
