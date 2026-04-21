"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  requisitionService,
  RequisitionStatus,
  type RequisitionResponse,
  type AttachmentResponse,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { fmtDateTime } from "../_types";
import { RequisitionStatusBadge } from "./StatusBadge";

interface Props {
  req: RequisitionResponse;
  onClose: () => void;
  onUpdate: (updated: RequisitionResponse) => void;
  onDeleted?: () => void;
}

export function RequisitionDrawer({ req, onClose, onUpdate }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canSendToWarehouse = hasPermission("Requisitions.SendToWarehouse");

  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [files, setFiles] = useState<AttachmentResponse[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    setFilesLoading(true);
    requisitionService.getFiles(req.id)
      .then(data => { setFiles(data); })
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, [req.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const refresh = async () => {
    const updated = await requisitionService.getById(req.id);
    if (updated) onUpdate(updated);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await requisitionService.reject(req.id, rejectReason.trim());
      showToast("Talabnoma rad etildi", "success");
      onClose();
    } catch {
      showToast("Xatolik yuz berdi", "error");
      setRejectSaving(false);
    }
  };

  const handleSendToWarehouse = async () => {
    setActing(true);
    try {
      await requisitionService.sendToWarehouse(req.id);
      showToast("Omborga yuborildi", "success");
      await refresh();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleFileDownload = async (file: AttachmentResponse) => {
    try {
      await requisitionService.downloadFile(req.id, file.id, file.fileName);
    } catch {
      showToast("Yuklab olishda xatolik", "error");
    }
  };

  const handleFilePreview = async (file: AttachmentResponse) => {
    const ext = file.fileName.split(".").pop()?.toLowerCase() ?? "";
    setPreviewingId(file.id);
    try {
      const blob = await requisitionService.getFileBlob(req.id, file.id);
      if (ext === "docx" || ext === "doc") {
        const { renderAsync } = await import("docx-preview");
        const container = document.createElement("div");
        container.style.cssText = "position:absolute;left:-9999px;top:0;width:816px;background:white";
        document.body.appendChild(container);
        const styleContainer = document.createElement("div");
        document.head.appendChild(styleContainer);
        await renderAsync(blob, container, styleContainer, { className: "docx", useBase64URL: true, breakPages: true });
        const styles = styleContainer.innerHTML;
        const content = container.innerHTML;
        document.body.removeChild(container);
        document.head.removeChild(styleContainer);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${file.fileName}</title>${styles}<style>html,body{margin:0;padding:24px;background:#f0f0f0;display:flex;justify-content:center}.docx-wrapper{box-shadow:0 2px 16px rgba(0,0,0,0.18)}</style></head><body>${content}</body></html>`;
        const htmlBlob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(htmlBlob);
        const tab = window.open(url, "_blank");
        if (!tab) showToast("Yangi tab ochilmadi. Popup bloker tekshiring.", "error");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const url = URL.createObjectURL(blob);
        const tab = window.open("", "_blank");
        if (tab) {
          tab.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
          URL.revokeObjectURL(url);
          showToast("Yangi tab ochilmadi. Popup bloker tekshiring.", "error");
        }
      }
    } catch {
      showToast("Faylni yuklashda xatolik", "error");
    } finally {
      setPreviewingId(null);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 1000 }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 700, maxWidth: "96vw",
        background: "var(--bg2)", boxShadow: "var(--shadow2)",
        zIndex: 1001, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{req.requisitionNo}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{req.typeLabel}</div>
          </div>
          <RequisitionStatusBadge status={req.status} />
          <button
            onClick={onClose}
            style={{ padding: 7, background: "none", border: "1.5px solid var(--danger)", cursor: "pointer", color: "var(--danger)", borderRadius: "var(--radius)", lineHeight: 1, transition: "background 0.15s, transform 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Main info */}
          <Section label="Asosiy ma'lumotlar">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InfoCard label="Maqsad" value={req.purpose} full />
              {req.contractNo && <InfoCard label="Shartnoma" value={req.contractNo} />}
              {req.departmentName && <InfoCard label="Bo'lim" value={req.departmentName} />}
              <InfoCard label="Yaratuvchi" value={req.createdByName} />
              <InfoCard label="Yaratilgan" value={fmtDateTime(req.createdAt)} />
              {req.notes && <InfoCard label="Izoh" value={req.notes} full />}
              {req.signerTitle && <InfoCard label="Lavozim" value={req.signerTitle} />}
              {req.signerName && <InfoCard label="F.I.O." value={req.signerName} />}
              {req.signDate && <InfoCard label="Imzo sanasi" value={req.signDate} />}
            </div>
          </Section>

          {/* Approval info */}
          {(req.status === RequisitionStatus.Approved || req.status === RequisitionStatus.SentToWarehouse) && (
            <Section label="Tasdiqlash">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: req.qrCodeData ? 12 : 0 }}>
                <InfoCard label="Tasdiqlagan" value={req.approvedByName ?? "—"} />
                <InfoCard label="Tasdiqlangan vaqt" value={fmtDateTime(req.approvedAt)} />
              </div>
              {req.qrCodeData && (
                <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "var(--bg3)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)" }}>Tasdiqlash QR kodi</div>
                  <img src={`data:image/png;base64,${req.qrCodeData}`} alt="QR kod" style={{ width: 140, height: 140, imageRendering: "pixelated" }} />
                </div>
              )}
            </Section>
          )}

          {/* Rejection reason */}
          {req.status === RequisitionStatus.Rejected && (
            <Section label="Rad etish sababi" danger>
              <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.2)", borderRadius: "var(--radius)", padding: "12px 16px", color: "var(--danger)", fontSize: 13 }}>
                {req.rejectionReason ?? "—"}
              </div>
            </Section>
          )}

          {/* Files */}
          {filesLoading ? (
            <Section label="Fayllar">
              <div style={{ color: "var(--text3)", fontSize: 13, padding: "10px 0" }}>Yuklanmoqda…</div>
            </Section>
          ) : files.length === 0 ? (
            <Section label="Fayllar">
              <div style={{ color: "var(--text3)", fontSize: 13, padding: "10px 0" }}>Fayllar yo'q</div>
            </Section>
          ) : (
            <>
              {files.filter(f => f.label === "tz").length > 0 && (
                <Section label={`TZ — Texnik Topshiriq (${files.filter(f => f.label === "tz").length})`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {files.filter(f => f.label === "tz").map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        previewing={previewingId === file.id}
                        onDownload={() => handleFileDownload(file)}
                        onPreview={() => handleFilePreview(file)}
                        accentColor="var(--purple)"
                      />
                    ))}
                  </div>
                </Section>
              )}

              {files.filter(f => f.label !== "tz").length > 0 && (
                <Section label={`Ilovalar (${files.filter(f => f.label !== "tz").length})`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {files.filter(f => f.label !== "tz").map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        previewing={previewingId === file.id}
                        onDownload={() => handleFileDownload(file)}
                        onPreview={() => handleFilePreview(file)}
                        accentColor="var(--accent)"
                      />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(req.status === RequisitionStatus.Draft || req.status === RequisitionStatus.Pending) && canSendToWarehouse && (
              <button
                disabled={acting}
                onClick={handleSendToWarehouse}
                style={{ padding: "11px 24px", borderRadius: "var(--radius)", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(26,110,235,0.25)", fontWeight: 600, fontSize: 13, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                {acting ? "…" : "Omborga yuborish"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setRejectOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--text)" }}>Rad etish sababi</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Sababni kiriting…"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--bg3)", color: "var(--text)" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setRejectOpen(false)}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                Bekor
              </button>
              <button
                disabled={!rejectReason.trim() || rejectSaving}
                onClick={handleRejectConfirm}
                style={{ flex: 1, padding: "9px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: !rejectReason.trim() || rejectSaving ? "not-allowed" : "pointer", fontWeight: 600, opacity: !rejectReason.trim() || rejectSaving ? 0.7 : 1 }}
              >
                {rejectSaving ? "…" : "Rad etish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  , document.body);
}

function Section({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="itm-card" style={{ padding: "20px 22px", overflow: "visible" }}>
      <div style={{ fontSize: 11, color: danger ? "var(--danger)" : "var(--accent)", fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {children}
    </div>
  );
}

function FileRow({ file, onDownload, onPreview, previewing, accentColor }: {
  file: AttachmentResponse;
  onDownload: () => void;
  onPreview: () => void;
  previewing: boolean;
  accentColor: string;
}) {
  const ext = file.fileName.split(".").pop()?.toLowerCase() ?? "";
  const previewable = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "docx", "doc"].includes(ext);
  const [previewHover, setPreviewHover] = useState(false);
  const [downloadHover, setDownloadHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1.5px solid var(--border)`, borderRadius: "var(--radius)", background: "var(--bg3)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.fileName}</div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
          {(file.fileSize / 1024).toFixed(1)} KB • {fmtDateTime(file.uploadedAt)}
        </div>
      </div>
      {previewable && (
        <button
          onClick={onPreview}
          disabled={previewing}
          title="Yangi tabda ko'rish"
          onMouseEnter={() => setPreviewHover(true)}
          onMouseLeave={() => setPreviewHover(false)}
          style={{
            padding: "4px 7px", border: "none", lineHeight: 1, borderRadius: "var(--radius)",
            cursor: previewing ? "wait" : "pointer",
            color: "#0ea5e9",
            background: previewHover && !previewing ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.07)",
            outline: "1px solid rgba(14,165,233,0.3)",
            opacity: previewing ? 0.5 : 1,
            transform: previewHover && !previewing ? "scale(1.1)" : "scale(1)",
            transition: "background 0.15s, color 0.15s, transform 0.15s",
          }}
        >
          {previewing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: "spin 0.8s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      )}
      <button
        onClick={onDownload}
        title="Yuklab olish"
        onMouseEnter={() => setDownloadHover(true)}
        onMouseLeave={() => setDownloadHover(false)}
        style={{
          padding: "4px 7px", border: "none", lineHeight: 1, borderRadius: "var(--radius)", cursor: "pointer",
          color: "#10b981",
          background: downloadHover ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.07)",
          outline: "1px solid rgba(16,185,129,0.3)",
          transform: downloadHover ? "scale(1.1)" : "scale(1)",
          transition: "background 0.15s, transform 0.15s",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    </div>
  );
}

function InfoCard({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}
