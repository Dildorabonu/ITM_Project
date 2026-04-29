"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  RequisitionStatus,
  RequisitionSource,
  type AttachmentResponse,
} from "@/lib/userService";
import { RequisitionStatusBadge } from "../_components/StatusBadge";
import { WorkflowDiagram } from "../_components/WorkflowDiagram";
import { downloadRequisitionPdf, openRequisitionPdfInNewTab } from "../_utils/downloadRequisitionPdf";
import { fmtDateTime, type RequisitionResponse } from "../_types";

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canApprove = hasPermission("Requisitions.Approve");

  const [req, setReq] = useState<RequisitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [files, setFiles] = useState<AttachmentResponse[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [childActing, setChildActing] = useState<{ id: string; action: "download" | "open" } | null>(null);

  useEffect(() => {
    setLoading(true);
    requisitionService.getById(id).then(data => {
      setReq(data ?? null);
      setLoading(false);
    });
    setFilesLoading(true);
    requisitionService.getFiles(id)
      .then(data => { setFiles(data); })
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, [id]);

  const refresh = async () => {
    const updated = await requisitionService.getById(id);
    if (updated) setReq(updated);
  };

  const handleFileDownload = async (file: AttachmentResponse) => {
    try {
      await requisitionService.downloadFile(id, file.id, file.fileName);
    } catch {
      showToast("Yuklab olishda xatolik", "error");
    }
  };

  const handleFilePreview = async (file: AttachmentResponse) => {
    setPreviewingId(file.id);
    try {
      const url = await requisitionService.getFileBlobUrl(id, file.id);
      const tab = window.open("", "_blank");
      if (tab) {
        tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        URL.revokeObjectURL(url);
        showToast("Yangi tab ochilmadi. Popup bloker tekshiring.", "error");
      }
    } catch {
      showToast("Faylni yuklashda xatolik", "error");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleChildDownload = async (childId: string) => {
    setChildActing({ id: childId, action: "download" });
    try {
      const ok = await downloadRequisitionPdf(childId);
      if (!ok) showToast("PDF yaratilmadi", "error");
    } catch {
      showToast("Yuklab olishda xatolik", "error");
    } finally {
      setChildActing(null);
    }
  };

  const handleChildOpen = async (childId: string) => {
    setChildActing({ id: childId, action: "open" });
    try {
      const result = await openRequisitionPdfInNewTab(childId);
      if (result === "blocked") showToast("Yangi tab ochilmadi. Popup bloker tekshiring.", "error");
      else if (result === "error") showToast("PDF yaratilmadi", "error");
    } catch {
      showToast("Faylni yuklashda xatolik", "error");
    } finally {
      setChildActing(null);
    }
  };

  const handleApprove = async () => {
    if (!req) return;
    setActing(true);
    try {
      await requisitionService.approve(req.id);
      showToast("Talabnoma tasdiqlandi", "success");
      await refresh();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleRejectConfirm = async () => {
    if (!req || !rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await requisitionService.reject(req.id, rejectReason.trim());
      showToast("Talabnoma rad etildi", "success");
      setRejectOpen(false);
      setRejectSaving(false);
      await refresh();
    } catch {
      showToast("Xatolik yuz berdi", "error");
      setRejectSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>Yuklanmoqda…</div>;
  }

  if (!req) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>Talabnoma topilmadi</div>;
  }

  const canDoApproval = canApprove && req.status === RequisitionStatus.PendingApproval;
  const isChild = !!req.parentRequisitionId;
  const showAvailability = req.status === RequisitionStatus.WarehouseChecked;
  const isApproved = req.status === RequisitionStatus.ReadyForWarehouseRelease || req.status === RequisitionStatus.ReadyForPurchase;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/requisitions")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Orqaga
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{req.requisitionNo}</h1>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {req.typeLabel}
            {req.sourceLabel && <span style={{ marginLeft: 8, color: req.source === RequisitionSource.Warehouse ? "var(--success)" : "var(--accent)", fontWeight: 500 }}>· {req.sourceLabel}</span>}
          </div>
        </div>
        <RequisitionStatusBadge status={req.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Workflow diagram */}
        <div className="itm-card" style={{ padding: 22 }}>
          <WorkflowDiagram
            status={req.status}
            source={req.source}
            splitChildren={req.children}
          />
        </div>

        {/* Parent / Children */}
        {(isChild || (req.children?.length ?? 0) > 0) && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Bog&apos;liq talabnomalar</div>
            {isChild && req.parentRequisitionNo && req.parentRequisitionId && (
              <div style={{ marginBottom: req.children.length > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Asl talabnoma</div>
                <button
                  onClick={() => router.push(`/requisitions/${req.parentRequisitionId}`)}
                  style={{ width: "100%", padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg3)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 4 4v2"/></svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>{req.parentRequisitionNo}</span>
                </button>
              </div>
            )}
            {(req.children?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Bo&apos;lingan talabnomalar</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {req.children.map(ch => {
                    const isWh = ch.source === RequisitionSource.Warehouse;
                    const destColor = isWh ? "var(--success)" : "var(--accent)";
                    const destLabel = isWh ? "Ombordan olishga" : "Sotib olishga";
                    const isOpening = childActing?.id === ch.id && childActing.action === "open";
                    const isDownloading = childActing?.id === ch.id && childActing.action === "download";
                    const anyActing = childActing !== null;
                    return (
                      <div
                        key={ch.id}
                        style={{ padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg3)", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)", flex: 1 }}>{ch.requisitionNo}</span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>{ch.itemCount} ta material</span>
                        <RequisitionStatusBadge status={ch.status} small />
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 20,
                          fontSize: 11, fontWeight: 600,
                          background: isWh ? "var(--success-dim)" : "var(--accent-dim)",
                          color: destColor,
                          border: `1px solid ${isWh ? "rgba(15,123,69,0.25)" : "rgba(26,110,235,0.3)"}`,
                          whiteSpace: "nowrap",
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="13 6 19 12 13 18"/>
                          </svg>
                          {destLabel}
                        </span>
                        <ChildPdfButton
                          variant="open"
                          loading={isOpening}
                          disabled={anyActing}
                          onClick={() => handleChildOpen(ch.id)}
                        />
                        <ChildPdfButton
                          variant="download"
                          loading={isDownloading}
                          disabled={anyActing}
                          onClick={() => handleChildDownload(ch.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main info */}
        <div className="itm-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Asosiy ma&apos;lumotlar</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoCard label="Maqsad" value={req.purpose} full />
            {req.contractNo && <InfoCard label="Shartnoma" value={req.contractNo} />}
            {req.departmentName && <InfoCard label="Bo'lim" value={req.departmentName} />}
            <InfoCard label="Yaratuvchi" value={req.createdByName} />
            <InfoCard label="Yaratilgan" value={fmtDateTime(req.createdAt)} />
            {req.notes && <InfoCard label="Izoh" value={req.notes} full />}
            {req.signerTitle && <InfoCard label="Lavozim" value={req.signerTitle} />}
            {req.signerName && <InfoCard label="F.I.O." value={req.signerName} />}
          </div>
        </div>

        {/* Materials */}
        <div className="itm-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>
            Materiallar ({req.items.length})
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>#</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>Nomi</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 90 }}>O&apos;lchov</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 110 }}>Miqdor</th>
                  {showAvailability && <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 130 }}>Mavjud</th>}
                  {isChild && <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 130 }}>Asl miqdor</th>}
                </tr>
              </thead>
              <tbody>
                {req.items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text3)" }}>{i + 1}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text1)", fontWeight: 500 }}>
                      {item.materialName}
                      {item.warehouseNotes && (
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, fontStyle: "italic" }}>{item.warehouseNotes}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text3)", textAlign: "center" }}>{item.unit || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text1)", textAlign: "center" }}>{item.quantity}</td>
                    {showAvailability && (
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {item.availableQuantity != null ? (
                          <span style={{
                            fontWeight: 600,
                            color: item.availableQuantity >= item.quantity ? "var(--success)" :
                                   item.availableQuantity > 0 ? "var(--warn)" : "var(--danger)",
                          }}>
                            {item.availableQuantity}
                          </span>
                        ) : "—"}
                      </td>
                    )}
                    {isChild && (
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--text3)" }}>
                        {item.originalQuantity ?? "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warehouse check info */}
        {req.warehouseCheckedAt && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Ombor tekshiruvi</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: req.warehouseCheckQrCodeData ? 16 : 0 }}>
              <InfoCard label="Tekshirgan" value={req.warehouseCheckedByName ?? "—"} />
              <InfoCard label="Tekshirilgan vaqt" value={fmtDateTime(req.warehouseCheckedAt)} />
            </div>
            {req.warehouseCheckQrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Omborchi imzo QR kodi</div>
                <img src={`data:image/png;base64,${req.warehouseCheckQrCodeData}`} alt="Omborchi QR kodi" style={{ width: 180, height: 180, imageRendering: "pixelated" }} />
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  Skanerlash orqali ombor tekshiruvini tekshirish mumkin
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approval info */}
        {isApproved && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Tasdiqlash</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: req.qrCodeData ? 16 : 0 }}>
              <InfoCard label="Tasdiqlagan" value={req.approvedByName ?? "—"} />
              <InfoCard label="Tasdiqlangan vaqt" value={fmtDateTime(req.approvedAt)} />
            </div>
            {req.qrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Tasdiqlash QR kodi</div>
                <img src={`data:image/png;base64,${req.qrCodeData}`} alt="QR kod" style={{ width: 180, height: 180, imageRendering: "pixelated" }} />
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  Skanerlash orqali tasdiqlashni tekshirish mumkin
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {req.status === RequisitionStatus.Rejected && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, marginBottom: 14 }}>Rad etish sababi</div>
            <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.2)", borderRadius: "var(--radius)", padding: "14px 18px", color: "var(--danger)", fontSize: 13 }}>
              {req.rejectionReason ?? "—"}
            </div>
          </div>
        )}

        {/* Files */}
        {filesLoading ? (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Fayllar</div>
            <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Yuklanmoqda…</div>
          </div>
        ) : files.length === 0 ? (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Fayllar</div>
            <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Fayllar yo&apos;q</div>
          </div>
        ) : (
          <>
            {files.filter(f => f.label === "tz").length > 0 && (
              <div className="itm-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 12, color: "var(--purple)", fontWeight: 600, marginBottom: 14 }}>
                  TZ — Texnik Topshiriq ({files.filter(f => f.label === "tz").length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {files.filter(f => f.label === "tz").map(file => (
                    <FileRow key={file.id} file={file} previewing={previewingId === file.id} onDownload={() => handleFileDownload(file)} onPreview={() => handleFilePreview(file)} accentColor="var(--purple)" />
                  ))}
                </div>
              </div>
            )}
            {files.filter(f => f.label !== "tz").length > 0 && (
              <div className="itm-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>
                  Ilovalar ({files.filter(f => f.label !== "tz").length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {files.filter(f => f.label !== "tz").map(file => (
                    <FileRow key={file.id} file={file} previewing={previewingId === file.id} onDownload={() => handleFileDownload(file)} onPreview={() => handleFilePreview(file)} accentColor="var(--accent)" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {canDoApproval && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={acting}
                onClick={handleApprove}
                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius)", background: "var(--success)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                {acting ? "…" : "Tasdiqlash"}
              </button>
              <button
                disabled={acting}
                onClick={() => { setRejectOpen(true); setRejectReason(""); }}
                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius)", background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(217,48,37,0.3)", fontWeight: 600, fontSize: 14, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                Rad etish
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectOpen && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setRejectOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--text1)" }}>Rad etish sababi</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Sababni kiriting…"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--bg3)", color: "var(--text1)" }}
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
      , document.body)}
    </div>
  );
}

function InfoCard({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)", wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

function ChildPdfButton({ variant, loading, disabled, onClick }: {
  variant: "open" | "download";
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isOpen = variant === "open";
  const color = isOpen ? "#0ea5e9" : "#10b981";
  const bgIdle = isOpen ? "rgba(14,165,233,0.07)" : "rgba(16,185,129,0.07)";
  const bgHover = isOpen ? "rgba(14,165,233,0.15)" : "rgba(16,185,129,0.15)";
  const outline = isOpen ? "rgba(14,165,233,0.3)" : "rgba(16,185,129,0.3)";
  const title = isOpen ? "Yangi tabda ko'rish" : "Yuklab olish";
  const interactive = !disabled && !loading;
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "5px 8px", border: "none", borderRadius: "var(--radius)",
        cursor: loading ? "wait" : disabled ? "not-allowed" : "pointer",
        color,
        background: hover && interactive ? bgHover : bgIdle,
        outline: `1px solid ${outline}`,
        opacity: disabled && !loading ? 0.5 : loading ? 0.6 : 1,
        transform: hover && interactive ? "scale(1.1)" : "scale(1)",
        transition: "background 0.15s, transform 0.15s",
        flexShrink: 0,
      }}
    >
      {loading ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: "spin 0.8s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : isOpen ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      )}
    </button>
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
  const previewable = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
  const [previewHover, setPreviewHover] = useState(false);
  const [downloadHover, setDownloadHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg3)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.fileName}</div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
          {(file.fileSize / 1024).toFixed(1)} KB • {fmtDateTime(file.uploadedAt)}
          {file.uploadedByFullName && ` • ${file.uploadedByFullName}`}
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
            padding: "5px 8px", border: "none", borderRadius: "var(--radius)",
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
          padding: "5px 8px", border: "none", borderRadius: "var(--radius)", cursor: "pointer",
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
