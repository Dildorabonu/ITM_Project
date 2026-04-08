"use client";

import { type PermissionModuleResponse, type RoleResponse, type RoleCreatePayload } from "@/lib/userService";

interface Props {
  editRole: RoleResponse | null;
  roleForm: RoleCreatePayload;
  setRoleForm: React.Dispatch<React.SetStateAction<RoleCreatePayload>>;
  selectedPerms: Set<string>;
  expandedEditModules: Set<string>;
  permissions: PermissionModuleResponse[];
  permsLoading: boolean;
  totalPermissions: number;
  formSubmitted: boolean;
  roleSaving: boolean;
  togglePerm: (actionId: string) => void;
  toggleAllModule: (mod: PermissionModuleResponse) => void;
  toggleEditModule: (mod: string) => void;
  saveRole: () => void;
  onClose: () => void;
}

export default function RoleFormView({
  editRole, roleForm, setRoleForm, selectedPerms, expandedEditModules,
  permissions, permsLoading, totalPermissions, formSubmitted, roleSaving,
  togglePerm, toggleAllModule, toggleEditModule, saveRole, onClose,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
          {editRole ? "Rolni tahrirlash" : "Yangi rol"}
        </span>
        <span style={{
          background: "var(--accent)", color: "#fff", borderRadius: 999,
          fontSize: 12, fontWeight: 700, padding: "6px 16px", letterSpacing: 0.3,
        }}>
          {totalPermissions} TA RUXSATDAN {selectedPerms.size} TASI TANLANGAN
        </span>
      </div>

      {/* Form fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: formSubmitted && !roleForm.name.trim() ? "var(--danger)" : "var(--text2)", marginBottom: 6, display: "block" }}>
            Rol nomi <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            className="form-input"
            value={roleForm.name}
            onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Rol nomi"
            style={formSubmitted && !roleForm.name.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
          />
          {formSubmitted && !roleForm.name.trim() && (
            <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Rol nomini kiriting</div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6, display: "block" }}>
            Tavsif
          </label>
          <textarea
            className="form-input"
            value={roleForm.description ?? ""}
            onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Tavsif kiriting"
            rows={1}
            style={{ resize: "none" }}
          />
        </div>
      </div>

      {/* Overview grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "var(--text3)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          Ruxsatlar umumiy ko&apos;rinishi
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        {permsLoading ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>Yuklanmoqda...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {permissions.map(mod => {
              const selected = mod.actions.filter(a => selectedPerms.has(a.id)).length;
              const total = mod.actions.length;
              const allSelected = selected === total;
              return (
                <div key={mod.module} style={{
                  border: `1.5px solid ${allSelected ? "#22c55e55" : "var(--border)"}`,
                  borderRadius: 10, padding: "12px 14px",
                  background: allSelected ? "#f0fdf4" : "var(--bg2)", transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{mod.moduleName}</span>
                    <span style={{
                      background: allSelected ? "#22c55e" : "var(--bg3)",
                      color: allSelected ? "#fff" : "var(--text3)",
                      borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 8px",
                    }}>{selected}/{total}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: allSelected ? "#22c55e" : selected > 0 ? "#86efac" : "transparent",
                      width: `${total > 0 ? (selected / total) * 100 : 0}%`,
                      transition: "width 0.2s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed accordion */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "var(--text3)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          Ruxsatlar
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {permissions.map(mod => {
            const selected = mod.actions.filter(a => selectedPerms.has(a.id)).length;
            const total = mod.actions.length;
            const allSelected = selected === total;
            const expanded = expandedEditModules.has(mod.module);
            return (
              <div key={mod.module} style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--bg2)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24"
                    fill={allSelected ? "#22c55e22" : "none"}
                    stroke={allSelected ? "#22c55e" : "var(--text3)"}
                    strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    {allSelected && <polyline points="9 12 11 14 15 10" />}
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{mod.moduleName}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>{total} ta ruxsatdan {selected} tasi tanlangan</div>
                  </div>
                  <button onClick={() => toggleAllModule(mod)} title="Hammasini tanlash" style={{
                    background: allSelected ? "#22c55e18" : "none", border: "none", cursor: "pointer",
                    padding: 6, borderRadius: 6, color: allSelected ? "#22c55e" : "var(--text3)",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button onClick={() => toggleEditModule(mod.module)} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text3)",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "block" }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {expanded && (
                  <div style={{
                    padding: "14px 16px 16px", background: "var(--bg3)",
                    borderTop: "1px solid var(--border)",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                  }}>
                    {mod.actions.map(a => {
                      const on = selectedPerms.has(a.id);
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button onClick={() => togglePerm(a.id)} style={{
                            width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                            background: on ? "#22c55e" : "#d1d5db",
                            position: "relative", flexShrink: 0, transition: "background 0.2s",
                          }}>
                            <span style={{
                              position: "absolute", top: 3, left: on ? 21 : 3,
                              width: 16, height: 16, borderRadius: "50%", background: "#fff",
                              transition: "left 0.2s", display: "block",
                            }} />
                          </button>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{a.actionName}</div>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.action}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
        <button className="btn-secondary" onClick={onClose}>Bekor qilish</button>
        <button className="btn-primary" onClick={saveRole} disabled={roleSaving}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {roleSaving ? "Saqlanmoqda..." : "Rolni saqlash"}
        </button>
      </div>
    </div>
  );
}
