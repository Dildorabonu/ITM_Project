import {
  DepartmentType,
  contractService,
  type ContractResponse,
  type AttachmentResponse,
  type ContractUserResponse,
} from "@/lib/userService";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import { WorkflowDiagram } from "./WorkflowDiagram";
import { fmt } from "./DatePickerField";

const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

interface Props {
  viewContract: ContractResponse;
  onClose: () => void;
  drawerFiles: AttachmentResponse[];
  drawerTzFiles: AttachmentResponse[];
  drawerUsers: ContractUserResponse[];
  filesLoading: boolean;
  tzFilesLoading: boolean;
  usersLoading: boolean;
}

export function ContractDrawer({
  viewContract, onClose,
  drawerFiles, drawerTzFiles, drawerUsers,
  filesLoading, tzFilesLoading, usersLoading,
}: Props) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 800, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          padding: "28px 28px 32px", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "sticky", top: 0, background: "var(--bg2)", zIndex: 10, paddingBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Shartnoma tafsilotlari</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <WorkflowDiagram status={viewContract.status} />

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma raqami</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "var(--font-inter)", wordBreak: "break-all", overflowWrap: "break-word" }}>{viewContract.contractNo}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holat</div>
            <StatusBadge status={viewContract.status} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Muhimlik</div>
            <PriorityBadge priority={viewContract.priority} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlanish sanasi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.startDate)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugash sanasi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.endDate)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratuvchi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{viewContract.createdByFullName ?? "—"}</div>
          </div>
          {viewContract.contractParty && (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma tuzilgan tomon</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", wordBreak: "break-word" }}>{viewContract.contractParty}</div>
            </div>
          )}
          {viewContract.departments?.length > 0 && (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Bo&apos;limlar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {viewContract.departments.map(d => {
                  const ts = TYPE_STYLE[d.type as DepartmentType];
                  return (
                    <span key={d.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: ts?.bg ?? "var(--bg3)", color: ts?.color ?? "var(--text1)",
                      border: `1px solid ${ts?.border ?? "var(--border)"}`,
                    }}>
                      {ts?.icon} {d.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {viewContract.notes && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
            <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewContract.notes}</div>
          </div>
        )}

        {/* ── Users ── */}
        <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4, marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Mas&apos;ul xodimlar</div>

          {usersLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>Yuklanmoqda...</div>
          ) : drawerUsers.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "14px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
              Hali xodim biriktirilmagan
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {([
                { role: 0, label: "Ma'sul xodimlar",  color: "#c2410c", bg: "#fff7ed", border: "#fdba7466" },
                { role: 1, label: "Ma'lumot uchun",   color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd66" },
                { role: 2, label: "Kuzatuvchilar",    color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd66" },
              ] as const).map(({ role, label, color, border }) => {
                const group = drawerUsers.filter(u => u.role === role);
                if (group.length === 0) return null;
                return (
                  <div key={role}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {group.map(u => (
                        <div key={u.userId} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          border: `1.5px solid ${border}`, borderRadius: 8,
                          padding: "9px 12px", background: "var(--bg2)",
                        }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: color, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: "#fff",
                          }}>
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fullName}</div>
                            {u.departmentName && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{u.departmentName}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Hujjatlar ── */}
        <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Hujjatlar</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ① Shartnoma fayli */}
            <div style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--bg3)", borderBottom: drawerFiles.length > 0 ? "1.5px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Shartnoma fayli</span>
                </div>
              </div>
              {filesLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
              ) : drawerFiles.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>Fayl yuklanmagan</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {drawerFiles.map((f, i) => (
                    <div key={f.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                      </div>
                      <button title="Yuklab olish" onClick={() => contractService.downloadFile(viewContract.id, f.id, f.fileName)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ② Texnik topshiriq (TZ) */}
            <div style={{ border: "1.5px solid var(--accent-mid)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--accent-dim)", borderBottom: drawerTzFiles.length > 0 ? "1.5px solid var(--accent-mid)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Texnik topshiriq <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>(TZ)</span></span>
                </div>
              </div>
              {tzFilesLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
              ) : drawerTzFiles.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>TZ yuklanmagan</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {drawerTzFiles.map((f, i) => (
                    <div key={f.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--accent-mid)" : "none",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                      </div>
                      <button title="Yuklab olish" onClick={() => contractService.downloadTzFile(viewContract.id, f.id, f.fileName)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
