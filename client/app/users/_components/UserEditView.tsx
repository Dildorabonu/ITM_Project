"use client";

import { createPortal } from "react-dom";
import { type RoleOption, type DepartmentOption } from "@/lib/userService";
import { CustomSelect } from "./CustomSelect";
import { CustomGroupedSelect } from "./CustomGroupedSelect";
import { type UserForm } from "./constants";

interface UserEditViewProps {
  form: UserForm;
  setForm: React.Dispatch<React.SetStateAction<UserForm>>;
  formSubmitted: boolean;
  saving: boolean;
  saveError: string;
  roles: RoleOption[];
  departments: DepartmentOption[];
  confirmHead: { headName: string } | null;
  setConfirmHead: (v: { headName: string } | null) => void;
  handleUpdate: () => void;
  handleIsHeadChange: (checked: boolean) => void;
  onCancel: () => void;
}

export function UserEditView({
  form, setForm, formSubmitted, saving, saveError,
  roles, departments, confirmHead, setConfirmHead,
  handleUpdate, handleIsHeadChange, onCancel,
}: UserEditViewProps) {
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
        <button className="btn-secondary" onClick={onCancel}>Bekor qilish</button>
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

      {confirmHead && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
