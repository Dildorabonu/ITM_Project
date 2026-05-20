"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import { CheckSelect } from "@/app/_components/CheckSelect";

const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: String(DepartmentType.IshlabChiqarish), label: DEPARTMENT_TYPE_LABELS[DepartmentType.IshlabChiqarish] },
  { value: String(DepartmentType.Bolim),           label: DEPARTMENT_TYPE_LABELS[DepartmentType.Bolim] },
  { value: String(DepartmentType.Boshqaruv),       label: DEPARTMENT_TYPE_LABELS[DepartmentType.Boshqaruv] },
];

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
  [DepartmentType.Omborxona]: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", icon: "📦" },
};

export default function DepartmentsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Departments.Create");
  const canUpdate = hasPermission("Departments.Update");
  const canDelete = hasPermission("Departments.Delete");
  const showToast = useToastStore(s => s.show);

  const [list, setList] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter panel
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingType, setPendingType] = useState("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentResponse | null>(null);
  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<DepartmentResponse | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const activeFilterCount = filterType !== "" ? 1 : 0;

  const openFilterPanel = () => {
    setPendingType(filterType);
    setFilterPanelOpen(true);
  };

  const applyFilters = () => {
    setFilterType(pendingType);
    setFilterPanelOpen(false);
  };

  const clearFilters = () => {
    setPendingType("");
    setFilterType("");
  };

  useDraft(
    "draft_departments",
    showForm,
    { form, editTarget },
    (d) => { setForm(d.form); setEditTarget(d.editTarget); setShowForm(true); },
  );

  const load = useCallback(async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const opts: { search?: string; type?: DepartmentType } = {};
      if (search.trim()) opts.search = search.trim();
      if (filterType !== "") opts.type = Number(filterType) as DepartmentType;
      const data = await departmentService.getPaged(p, PAGE_SIZE, opts);
      setList(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setList([]);
      setTotalPages(1);
      setTotalCount(0);
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterType]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterType]);

  // Reload when page or any filter changes (debounce search)
  useEffect(() => {
    const t = setTimeout(() => { load(page); }, search ? 250 : 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterType]);

  useEffect(() => {
    if (!filterPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node) &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)
      ) setFilterPanelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterPanelOpen]);

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
        showToast("Bo'lim muvaffaqiyatli yangilandi!");
      } else {
        const payload: DepartmentCreatePayload = {
          name: form.name,
          type: form.type,
          employeeCount: count,
        };
        await departmentService.create(payload);
        showToast("Bo'lim muvaffaqiyatli yaratildi!");
      }
      setShowForm(false);
      await load(page);
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
      showToast(wasActive ? "Bo'lim noaktiv qilindi!" : "Bo'lim muvaffaqiyatli faollashtirildi!");
      setToggleTarget(null);
      await load(page);
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
  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: nomi..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Filter dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            ref={filterBtnRef}
            onClick={() => filterPanelOpen ? setFilterPanelOpen(false) : openFilterPanel()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "var(--radius)",
              border: `1px solid ${activeFilterCount > 0 ? "var(--accent)" : "var(--border2)"}`,
              background: activeFilterCount > 0 ? "var(--accent-dim)" : "var(--surface)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text2)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!activeFilterCount) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { if (!activeFilterCount) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)"; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtrlar
            {activeFilterCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--accent)", color: "#fff",
                fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>
                {activeFilterCount}
              </span>
            )}
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transition: "transform 0.2s", transform: filterPanelOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {filterPanelOpen && (
            <div
              ref={filterPanelRef}
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                width: 240,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                animation: "panel-appear 0.18s ease",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px 10px",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  Filtrlar
                </div>
                {pendingType !== "" && (
                  <button
                    onClick={clearFilters}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text3)", fontSize: 12, padding: "2px 4px",
                      borderRadius: 4, transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                  >
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Tozalash
                  </button>
                )}
              </div>

              <div style={{ padding: "14px 14px 0" }}>
                <div style={{ marginBottom: 14, position: "relative" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Toifa
                  </p>
                  <CheckSelect
                    value={pendingType}
                    onChange={setPendingType}
                    options={TYPE_FILTER_OPTIONS.map(o => ({ id: o.value, name: o.label }))}
                    placeholder="Barcha toifalar"
                    disablePortal
                  />
                </div>
              </div>

              <div style={{ padding: "0 14px 14px" }}>
                <button
                  onClick={applyFilters}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--radius)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--accent2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Filtrlarni qo&apos;llash
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="btn-icon" onClick={() => load()} title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
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

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Toifa</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Bo&apos;lim boshlig&apos;i</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Xodimlar</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : list.map((d, i) => {
                  const inactive = d.isActive === false;
                  return (
                    <tr key={d.id} style={inactive ? { opacity: 0.55 } : undefined}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                        {String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                      <td style={{ textAlign: "center", color: "var(--text1)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{DEPARTMENT_TYPE_LABELS[d.type]}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.headUserName ?? "—"}</td>
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
                                onClick={() => { setToggleTarget(d); setToggleError(""); }}
                              >
                                {inactive ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4" />
                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
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

      {/* Pagination footer */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} tadan {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;ko&apos;rsatilmoqda
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            ← Oldingi
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "var(--text3)", padding: "0 2px" }}>…</span>
              ) : (
                <button
                  key={p}
                  className="btn-secondary"
                  onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            Keyingi →
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {toggleTarget && createPortal(
        <div className="modal-overlay" onClick={() => { setToggleTarget(null); setToggleError(""); }}>
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
                  onClick={() => { setToggleTarget(null); setToggleError(""); }}
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
