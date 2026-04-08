import { technicalDrawingService, type TechnicalDrawingResponse, type AttachmentResponse } from "@/lib/userService";
import { StatusBadge } from "./StatusBadge";

function fmtDate(value: string) {
  if (!value) return "—";
  const [y, m, day] = value.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

function fileIcon(contentType: string) {
  if (contentType.includes("pdf"))
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  if (contentType.includes("image"))
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

interface DrawingDrawerProps {
  drawer: TechnicalDrawingResponse;
  drawerFiles: AttachmentResponse[];
  drawerLoading: boolean;
  onClose: () => void;
  onEdit: (item: TechnicalDrawingResponse) => void;
}

export function DrawingDrawer({ drawer, drawerFiles, drawerLoading, onClose, onEdit }: DrawingDrawerProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)", zIndex: 1000,
        display: "flex", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "95vw", height: "calc(100% - 32px)",
          margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          padding: "28px 28px 32px", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 0,
        }}
      >
        {/* Sticky header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24, position: "sticky", top: 0,
          background: "var(--bg2)", zIndex: 1, paddingBottom: 8,
        }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>
            Texnik chizma tafsilotlari
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Info cards */}
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Shartnoma</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", fontFamily: "Inter, sans-serif" }}>
              {drawer.contractNo}
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Status</div>
            <StatusBadge status={drawer.status} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Yaratilgan</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text1)" }}>{fmtDate(drawer.createdAt)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Yaratuvchi</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{drawer.createdByFullName ?? "—"}</div>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Nomi</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>{drawer.title}</div>
        </div>

        {/* Notes */}
        {drawer.notes && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
            <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {drawer.notes}
            </div>
          </div>
        )}

        {/* Edit button */}
        <div style={{ marginBottom: 20 }}>
          <button
            className="btn btn-outline"
            onClick={() => onEdit(drawer)}
            style={{ fontSize: 13, padding: "8px 18px" }}
          >
            Tahrirlash
          </button>
        </div>

        {/* Files */}
        <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
          <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 14 }}>
            Fayllar {drawerFiles.length > 0 ? `(${drawerFiles.length})` : ""}
          </div>

          {drawerLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "16px 0" }}>
              Yuklanmoqda...
            </div>
          ) : drawerFiles.length === 0 ? (
            <div style={{
              fontSize: 13, color: "var(--text3)", textAlign: "center",
              padding: "28px 0", border: "1.5px dashed var(--border)", borderRadius: 8,
            }}>
              Fayllar yo&apos;q
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drawerFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    border: "1.5px solid var(--border)", borderRadius: 8,
                    padding: "10px 14px", background: "var(--bg1)",
                  }}
                >
                  <div style={{ flexShrink: 0 }}>{fileIcon(file.contentType)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text1)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.fileName}
                    </div>
                  </div>
                  <button
                    onClick={() => technicalDrawingService.downloadFile(drawer.id, file.id, file.fileName)}
                    title="Yuklab olish"
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                      color: "var(--accent)", border: "1.5px solid var(--accent)33",
                      background: "var(--accent-dim)", cursor: "pointer",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
