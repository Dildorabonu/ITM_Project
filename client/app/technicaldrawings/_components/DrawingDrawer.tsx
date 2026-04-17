"use client";

import { createPortal } from "react-dom";
import { technicalDrawingService, type TechnicalDrawingResponse, type AttachmentResponse } from "@/lib/userService";
import { StatusBadge } from "./StatusBadge";

function fmtDate(value: string) {
  if (!value) return "—";
  const [y, m, day] = value.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}.${m}.${y.slice(-2)}`;
}

interface DrawingDrawerProps {
  drawer: TechnicalDrawingResponse;
  drawerFiles: AttachmentResponse[];
  drawerLoading: boolean;
  onClose: () => void;
}

export function DrawingDrawer({
  drawer, drawerFiles, drawerLoading, onClose,
}: DrawingDrawerProps) {
  return createPortal(
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
          width: 700, maxWidth: "95vw", height: "calc(100vh - 32px)",
          margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          padding: "28px 28px 32px", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24, position: "sticky", top: 0,
          background: "var(--bg2)", zIndex: 10, paddingBottom: 8,
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

        {/* Info grid */}
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "Inter, sans-serif", wordBreak: "break-all" }}>
              {drawer.contractNo}
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Status</div>
            <StatusBadge status={drawer.status} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratilgan</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmtDate(drawer.createdAt)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Faollik</div>
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "2px 10px",
              borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: drawer.isActive ? "#dcfce7" : "var(--danger-dim)",
              color: drawer.isActive ? "#16a34a" : "var(--danger)",
              border: `1px solid ${drawer.isActive ? "#86efac" : "var(--danger)"}`,
            }}>
              {drawer.isActive ? "Faol" : "Nofaol"}
            </span>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratuvchi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{drawer.createdByFullName ?? "—"}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Nomi</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)", wordBreak: "break-word" }}>{drawer.title}</div>
          </div>
          {drawer.notes && (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Izoh</div>
              <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{drawer.notes}</div>
            </div>
          )}
        </div>


        {/* Files */}
        <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Fayllar</div>

          <div style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", background: "var(--bg3)",
              borderBottom: drawerLoading || drawerFiles.length > 0 ? "1.5px solid var(--border)" : "none",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff",
                fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {drawerFiles.length > 0 ? drawerFiles.length : "—"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Yuklangan fayllar</span>
            </div>

            {drawerLoading ? (
              <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
            ) : drawerFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>Fayl yuklanmagan</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {drawerFiles.map((file, i) => (
                  <div
                    key={file.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.fileName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>
                        {(file.fileSize / 1024).toFixed(1)} KB · {fmtDate(file.uploadedAt)}
                      </div>
                    </div>
                    <button
                      title="Yuklab olish"
                      onClick={() => technicalDrawingService.downloadFile(drawer.id, file.id, file.fileName)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
    </div>
  , document.body);
}
