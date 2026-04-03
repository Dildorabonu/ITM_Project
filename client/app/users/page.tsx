"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDraft } from "@/lib/useDraft";
import {
  userService,
  roleService,
  departmentService,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type UserResponse,
  type RoleOption,
  type DepartmentOption,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";


const emptyForm = { firstName: "", lastName: "", login: "", password: "", roleId: "", departmentId: "", isActive: true, isHead: false };

const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

function CustomSelect({
  value, onChange, options, placeholder, hasError,
}: {
  value: string; onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder: string; hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px",
        color: selected ? "var(--text)" : "var(--text3)",
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        <span>{selected ? selected.name : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text3)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1.5px solid var(--border2)",
          borderRadius: "var(--radius2)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 200, maxHeight: 220, overflowY: "auto",
        }}>
          {options.map(o => (
            <div key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = "var(--bg3)"; }}
              onMouseLeave={e => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}
              style={{
                padding: "9px 14px", cursor: "pointer", fontSize: 14,
                color: o.id === value ? "var(--accent)" : "var(--text)",
                background: o.id === value ? "var(--accent-dim)" : "transparent",
                fontWeight: o.id === value ? 600 : 400,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              {o.id === value ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : <span style={{ width: 12 }} />}
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomGroupedSelect({
  value, onChange, departments, placeholder, hasError,
}: {
  value: string; onChange: (v: string) => void;
  departments: DepartmentOption[];
  placeholder: string; hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = departments.find(d => d.id === value);
  const selectedTs = selected?.type !== undefined ? TYPE_STYLE[selected.type] : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups = ([DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const)
    .map(t => ({ type: t, items: departments.filter(d => d.type === t) }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px",
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        {selected && selectedTs ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: selectedTs.bg, color: selectedTs.color, border: `1px solid ${selectedTs.border}`,
          }}>
            {selectedTs.icon} {selected.name}
          </span>
        ) : (
          <span style={{ color: "var(--text3)" }}>{placeholder}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text3)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1.5px solid var(--border2)",
          borderRadius: "var(--radius2)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 200, maxHeight: 260, overflowY: "auto",
        }}>
          {groups.map((g, gi) => {
            const ts = TYPE_STYLE[g.type];
            return (
              <div key={g.type}>
                <div style={{
                  padding: "7px 12px 5px", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.7px", textTransform: "uppercase",
                  color: ts.color, background: ts.bg,
                  display: "flex", alignItems: "center", gap: 6,
                  borderTop: gi > 0 ? "1px solid var(--border)" : "none",
                  position: "sticky", top: 0,
                }}>
                  {ts.icon} {DEPARTMENT_TYPE_LABELS[g.type]}
                </div>
                {g.items.map(d => (
                  <div key={d.id}
                    onClick={() => { onChange(d.id); setOpen(false); }}
                    onMouseEnter={e => { if (d.id !== value) e.currentTarget.style.background = "var(--bg3)"; }}
                    onMouseLeave={e => { if (d.id !== value) e.currentTarget.style.background = d.id === value ? ts.bg : "transparent"; }}
                    style={{
                      padding: "8px 16px 8px 20px", cursor: "pointer", fontSize: 13,
                      color: d.id === value ? ts.color : "var(--text)",
                      background: d.id === value ? ts.bg : "transparent",
                      fontWeight: d.id === value ? 600 : 400,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                    {d.id === value ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, color: ts.color }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : <span style={{ width: 11 }} />}
                    {d.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const animOffset = useRef(-(Date.now() % 1500) / 1000);

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<DepartmentType | null>(null);
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
  const [saveError, setSaveError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmHead, setConfirmHead] = useState<{ headName: string } | null>(null);

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
    roleService.getLookup().then(setRoles).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [page]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const deptIdsByType = typeFilter !== null
      ? new Set(departments.filter(d => d.type === typeFilter).map(d => d.id))
      : null;

    return users.filter(u => {
      if (deptIdsByType !== null && (!u.departmentId || !deptIdsByType.has(u.departmentId))) return false;
      if (roleFilter && u.roleId !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (q && !(
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        (u.roleName ?? "").toLowerCase().includes(q) ||
        (u.departmentName ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [search, typeFilter, roleFilter, statusFilter, users, departments]);

  const activeCount = users.filter(u => u.isActive).length;
  const inactiveCount = users.filter(u => !u.isActive).length;
  const headCount = users.filter(u => u.isHead).length;

  // Initialize form when entering edit mode or when editTarget becomes available
  const initializedEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (showEdit && editTarget && initializedEditIdRef.current !== editId) {
      initializedEditIdRef.current = editId;
      setFormSubmitted(false);
      setSaveError("");
      departmentService.getAll().then(setDepartments).catch(() => {});
      setForm({
        firstName: editTarget.firstName,
        lastName: editTarget.lastName,
        login: editTarget.login,
        password: "",
        roleId: editTarget.roleId ?? "",
        departmentId: editTarget.departmentId ?? "",
        isActive: editTarget.isActive,
        isHead: editTarget.isHead,
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
      setSaveError("");
      departmentService.getAll().then(setDepartments).catch(() => {});
    }
  }, [showCreate]);

  const openCreate = () => {
    router.push(`${pathname}?view=create`);
  };

  const openEdit = (u: UserResponse) => {
    router.push(`${pathname}?view=edit&id=${u.id}`);
  };

  const handleIsHeadChange = (checked: boolean) => {
    if (!checked) { setForm(f => ({ ...f, isHead: false })); return; }
    const dept = departments.find(d => d.id === form.departmentId);
    const existingHead = dept?.headUserName;
    const currentUserIsHead = showEdit && editTarget?.isHead && editTarget?.departmentId === form.departmentId;
    if (existingHead && !currentUserIsHead) {
      setConfirmHead({ headName: existingHead });
    } else {
      setForm(f => ({ ...f, isHead: true }));
    }
  };

  const handleCreate = async () => {
    setFormSubmitted(true);
    if (!form.firstName || !form.lastName || !form.login || !form.password || !form.roleId || !form.departmentId) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: UserCreatePayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        login: form.login,
        password: form.password,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        isHead: form.isHead,
      };
      await userService.create(payload);
      sessionStorage.removeItem("draft_users");
      router.push(pathname);
      await load();
      departmentService.getAll().then(setDepartments).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setSaveError(msg || "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setFormSubmitted(true);
    if (!form.roleId || !form.departmentId) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: UserUpdatePayload = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        login: form.login || undefined,
        password: form.password || undefined,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        isActive: form.isActive,
        isHead: form.isHead,
      };
      await userService.update(editTarget.id, payload);
      sessionStorage.removeItem("draft_users");
      router.push(pathname);
      await load();
      departmentService.getAll().then(setDepartments).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setSaveError(msg || "Saqlashda xatolik yuz berdi.");
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

  function getRoleBadgeClass(roleName: string | null): string {
    if (!roleName) return "um-badge";
    const lower = roleName.toLowerCase();
    if (lower.includes("admin")) return "um-badge um-badge-admin";
    if (lower.includes("boshli") || lower.includes("director") || lower.includes("manager")) return "um-badge um-badge-manager";
    return "um-badge um-badge-worker";
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  /* ===== Edit inline view ===== */
  if (showEdit) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Foydalanuvchini tahrirlash</span>
        </div>

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
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.roleId ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Rol <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <CustomSelect
              value={form.roleId}
              onChange={v => setForm(f => ({ ...f, roleId: v }))}
              options={roles}
              placeholder="— Rol tanlang —"
              hasError={formSubmitted && !form.roleId}
            />
            {formSubmitted && !form.roleId && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Rol tanlang</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.departmentId ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Tuzilma <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <CustomGroupedSelect
              value={form.departmentId}
              onChange={v => setForm(f => ({ ...f, departmentId: v }))}
              departments={departments}
              placeholder="— Tuzilma tanlang —"
              hasError={formSubmitted && !form.departmentId}
            />
            {formSubmitted && !form.departmentId && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Tuzilma tanlang</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Aktiv
            </label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: "var(--radius)",
              border: `1.5px solid ${form.isHead ? "#fbbf24" : "var(--border)"}`,
              background: form.isHead ? "#fffbeb" : "var(--bg3)",
              cursor: form.departmentId ? "pointer" : "not-allowed",
              opacity: form.departmentId ? 1 : 0.5,
              transition: "all 0.15s",
            }}>
              <input type="checkbox" checked={form.isHead}
                onChange={e => handleIsHeadChange(e.target.checked)}
                disabled={!form.departmentId}
                style={{ width: 16, height: 16, cursor: form.departmentId ? "pointer" : "not-allowed", accentColor: "#f59e0b" }} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>👑</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.isHead ? "#92400e" : "var(--text2)" }}>
                  Tuzilma boshlig&apos;i
                </span>
                {!form.departmentId && (
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>
                    (avval bo&apos;lim tanlang)
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {saveError && (
          <div style={{ color: "#e05252", fontSize: 13, background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 8 }}>
            {saveError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button className="btn-secondary" onClick={() => { setSaveError(""); sessionStorage.removeItem("draft_users"); router.push(pathname); }}>Bekor qilish</button>
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
        {confirmHead && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 360, maxWidth: "95vw", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>👑</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--text1)" }}>Rahbar allaqachon belgilangan</div>
              <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
                Ushbu tuzilmaning rahbari: <strong>{confirmHead.headName}</strong>.<br />
                Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn" onClick={() => setConfirmHead(null)}>Tushundim</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ===== Create inline view ===== */
  if (showCreate) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi foydalanuvchi</span>
        </div>

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
              autoComplete="off"
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
              autoComplete="new-password"
              style={formSubmitted && !form.password.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
            />
            {formSubmitted && !form.password.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Parolni kiriting</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.roleId ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Rol <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <CustomSelect
              value={form.roleId}
              onChange={v => setForm(f => ({ ...f, roleId: v }))}
              options={roles}
              placeholder="— Rol tanlang —"
              hasError={formSubmitted && !form.roleId}
            />
            {formSubmitted && !form.roleId && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Rol tanlang</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !form.departmentId ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
              Tuzilma <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <CustomGroupedSelect
              value={form.departmentId}
              onChange={v => setForm(f => ({ ...f, departmentId: v }))}
              departments={departments}
              placeholder="— Tuzilma tanlang —"
              hasError={formSubmitted && !form.departmentId}
            />
            {formSubmitted && !form.departmentId && (
              <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Tuzilma tanlang</div>
            )}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: "var(--radius)",
              border: `1.5px solid ${form.isHead ? "#fbbf24" : "var(--border)"}`,
              background: form.isHead ? "#fffbeb" : "var(--bg3)",
              cursor: form.departmentId ? "pointer" : "not-allowed",
              opacity: form.departmentId ? 1 : 0.5,
              transition: "all 0.15s",
            }}>
              <input type="checkbox" checked={form.isHead}
                onChange={e => handleIsHeadChange(e.target.checked)}
                disabled={!form.departmentId}
                style={{ width: 16, height: 16, cursor: form.departmentId ? "pointer" : "not-allowed", accentColor: "#f59e0b" }} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>👑</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.isHead ? "#92400e" : "var(--text2)" }}>
                  Tuzilma boshlig&apos;i
                </span>
                {!form.departmentId && (
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>
                    (avval bo&apos;lim tanlang)
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {saveError && (
          <div style={{ color: "#e05252", fontSize: 13, background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 8 }}>
            {saveError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button className="btn-secondary" onClick={() => { setSaveError(""); sessionStorage.removeItem("draft_users"); router.push(pathname); }}>Bekor qilish</button>
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
        {confirmHead && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 360, maxWidth: "95vw", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>👑</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--text1)" }}>Rahbar allaqachon belgilangan</div>
              <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
                Ushbu tuzilmaning rahbari: <strong>{confirmHead.headName}</strong>.<br />
                Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn" onClick={() => setConfirmHead(null)}>Tushundim</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ===== Main list view ===== */
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
        .sdot-on  { background: #22c55e; animation: sdot-ping 1.5s ease-out ${animOffset.current}s infinite; }
        .sdot-off { background: #94a3b8; }
        @keyframes um-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .um-card-anim { animation: um-card-in 0.35s ease-out both; }
        .um-card-anim:nth-child(2) { animation-delay: 0.06s; }
        .um-card-anim:nth-child(3) { animation-delay: 0.12s; }
        .um-card-anim:nth-child(4) { animation-delay: 0.18s; }
      `}</style>

      {/* Summary cards */}
      <div className="um-summary-row">
        <div className="um-summary-card um-card-anim">
          <div className="um-summary-icon" style={{ background: "var(--accent-dim)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{totalCount}</span>
            <span className="um-summary-label">Jami foydalanuvchilar</span>
          </div>
        </div>
        <div className="um-summary-card um-card-anim">
          <div className="um-summary-icon" style={{ background: "var(--success-dim)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{activeCount}</span>
            <span className="um-summary-label">Faol</span>
          </div>
        </div>
        <div className="um-summary-card um-card-anim">
          <div className="um-summary-icon" style={{ background: "var(--surface2)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{inactiveCount}</span>
            <span className="um-summary-label">Nofaol</span>
          </div>
        </div>
        <div className="um-summary-card um-card-anim">
          <div className="um-summary-icon" style={{ background: "#fffbeb" }}>
            <svg width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{headCount}</span>
            <span className="um-summary-label">Boshliqlar</span>
          </div>
        </div>
      </div>

      {/* Department type filter chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {([null, DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const).map(t => {
          const active = typeFilter === t;
          const label = t === null ? "Barchasi" : DEPARTMENT_TYPE_LABELS[t];
          const deptIds = t === null ? null : new Set(departments.filter(d => d.type === t).map(d => d.id));
          const count = t === null ? users.length : users.filter(u => u.departmentId && deptIds!.has(u.departmentId)).length;
          const s = t !== null ? TYPE_STYLE[t] : null;
          return (
            <button
              key={String(t)}
              type="button"
              onClick={() => setTypeFilter(t)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600,
                border: active ? `1.5px solid ${s ? s.color : "var(--accent)"}` : "1.5px solid var(--border)",
                background: active ? (s ? s.bg : "var(--accent-dim)") : "var(--bg1)",
                color: active ? (s ? s.color : "var(--accent)") : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {t !== null && <span>{s!.icon}</span>}
              {label}
              <span style={{
                background: active ? (s ? s.color : "var(--accent)") : "var(--border)",
                color: active ? "#fff" : "var(--text2)",
                borderRadius: 10, padding: "1px 7px", fontSize: 11,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + filters toolbar */}
      <div className="um-controls">
        <div className="um-search">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Ism, login yoki rol bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="um-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Rol filtri"
        >
          <option value="">Rol: Barchasi</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          className="um-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Holat filtri"
        >
          <option value="">Holat: Barchasi</option>
          <option value="active">Faol</option>
          <option value="inactive">Nofaol</option>
        </select>
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

      {/* Table */}
      <div className="itm-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
            <div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Yuklanmoqda...
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div className="um-table-wrap">
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 48, textAlign: "center" }}>T/r</th>
                  <th style={{ textAlign: "left", width: "18%" }}>F.I.SH</th>
                  <th style={{ textAlign: "left", width: "12%" }}>Login</th>
                  <th style={{ width: "14%" }}>Rol</th>
                  <th style={{ width: "16%" }}>Tuzilma</th>
                  <th style={{ width: "8%" }}>Holat</th>
                  <th style={{ width: "10%" }}>Yaratilgan</th>
                  <th style={{ width: "12%" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, i) => {
                  const dept = user.departmentId ? departments.find(d => d.id === user.departmentId) : null;
                  const ts = dept?.type !== undefined ? TYPE_STYLE[dept.type] : null;
                  return (
                    <tr key={user.id} style={{ opacity: user.isActive ? 1 : 0.65 }}>
                      <td style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
                        {String((page - 1) * 20 + i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ textAlign: "left", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, var(--accent-dim), var(--accent)22)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: "var(--accent)",
                            border: "1.5px solid var(--accent)33",
                          }}>
                            {user.firstName[0]}{user.lastName[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>
                              {user.firstName} {user.lastName}
                            </div>
                            {user.isHead && (
                              <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 2 }}>
                                👑 Boshliq
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "left", color: "var(--text2)", fontSize: 13 }}>
                        {user.login}
                      </td>
                      <td>
                        <span className={getRoleBadgeClass(user.roleName)}>
                          {user.roleName || "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {user.departmentName && ts ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                            background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                            maxWidth: "100%", overflow: "hidden",
                          }} title={user.departmentName}>
                            <span style={{ flexShrink: 0 }}>{ts.icon}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{user.departmentName}</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`sdot ${user.isActive ? "sdot-on" : "sdot-off"}`}
                          title={user.isActive ? "Faol" : "Nofaol"}
                        />
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="td-actions">
                        <div className="um-actions" style={{ justifyContent: "center" }}>
                          {user.id !== "00000000-0000-0000-0000-000000000001" && (
                            <>
                              {canUpdate && (
                                <button className="um-action-btn" title="Tahrirlash" type="button" onClick={() => openEdit(user)}>
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                              )}
                              {canDelete && (
                                <button className="um-action-btn danger" title="O'chirish" type="button" onClick={() => setDeleteId(user.id)}>
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>
                      Foydalanuvchilar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="um-pagination">
          <span className="um-pagination-info">
            Jami {totalCount} ta foydalanuvchi · Sahifa {page} / {totalPages}
          </span>
          <div className="um-pagination-btns">
            <button
              className="um-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              type="button"
              aria-label="Oldingi sahifa"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;
                return (
                  <span key={p} style={{ display: "contents" }}>
                    {showEllipsis && <span style={{ padding: "0 4px", color: "var(--text3)" }}>...</span>}
                    <button
                      className={`um-page-btn ${p === page ? "active" : ""}`}
                      onClick={() => setPage(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
            <button
              className="um-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              type="button"
              aria-label="Keyingi sahifa"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {confirmHead && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 28, width: 360, maxWidth: "95vw", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>👑</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--text1)" }}>
              Rahbar allaqachon belgilangan
            </div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              Ushbu tuzilmaning rahbari: <strong>{confirmHead.headName}</strong>.<br />
              Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn" onClick={() => setConfirmHead(null)}>Tushundim</button>
            </div>
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
