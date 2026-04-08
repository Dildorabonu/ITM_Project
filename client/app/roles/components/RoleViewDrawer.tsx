"use client";

import { type PermissionModuleResponse, type RoleResponse } from "@/lib/userService";

interface Props {
  viewRole: RoleResponse;
  viewPerms: Set<string>;
  viewPermsLoading: boolean;
  permissions: PermissionModuleResponse[];
  expandedViewModules: Set<string>;
  toggleViewModule: (mod: string) => void;
  onClose: () => void;
}

export default function RoleViewDrawer({
  viewRole, viewPerms, viewPermsLoading, permissions,
  expandedViewModules, toggleViewModule, onClose,
}: Props) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          padding: "28px 28px 32px", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Rol tafsilotlari</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Rol nomi</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewRole.name}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Ruxsatlar</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewPermsLoading ? "..." : viewPerms.size}</div>
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Tavsif</div>
          <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewRole.description || "—"}</div>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Ruxsatlar</div>
        {viewPermsLoading ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>Yuklanmoqda...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {permissions.map(mod => {
              const selectedCount = mod.actions.filter(a => viewPerms.has(a.id)).length;
              const expanded = expandedViewModules.has(mod.module);
              return (
                <div key={mod.module} style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                  <button onClick={() => toggleViewModule(mod.module)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", background: "var(--bg2)", border: "none", cursor: "pointer",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{mod.moduleName}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>{mod.actions.length} ta ruxsatdan {selectedCount} tasi berilgan</div>
                    </div>
                    <span style={{
                      background: selectedCount > 0 ? "#22c55e" : "var(--bg3)",
                      color: selectedCount > 0 ? "#fff" : "var(--text3)",
                      borderRadius: 999, fontSize: 12, fontWeight: 700, minWidth: 24, height: 24,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px",
                    }}>{selectedCount}/{mod.actions.length}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"
                      style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {expanded && (
                    <div style={{ padding: "12px 16px 16px", background: "var(--bg3)", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {mod.actions.map(a => {
                        const has = viewPerms.has(a.id);
                        return (
                          <div key={a.id} style={{
                            background: has ? "#f0fdf4" : "var(--bg2)",
                            border: `1.5px solid ${has ? "#bbf7d0" : "var(--border)"}`,
                            borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke={has ? "#22c55e" : "var(--text3)"} strokeWidth="2" style={{ flexShrink: 0 }}>
                              {has
                                ? <><circle cx="7.5" cy="15.5" r="4.5" /><path d="M21 2l-9.6 9.6M15.5 7.5L19 11l2-2M12 10l2 2" /></>
                                : <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                              }
                            </svg>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: has ? "#111" : "var(--text2)" }}>{a.actionName}</div>
                              <div style={{ fontSize: 11, color: has ? "#6b7280" : "var(--text3)" }}>{a.action}</div>
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
        )}
      </div>
    </div>
  );
}
