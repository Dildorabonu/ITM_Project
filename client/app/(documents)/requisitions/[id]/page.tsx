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
import { RequisitionNo } from "@/app/_components/RequisitionNo";
import { RequisitionStatusBadge } from "../_components/StatusBadge";
import { AllowanceBadge } from "../_components/AllowanceBadge";
import { WorkflowDiagram } from "../_components/WorkflowDiagram";
import { RequisitionMovements } from "../_components/RequisitionMovements";
import { downloadRequisitionPdf, openRequisitionPdfInNewTab } from "../_utils/downloadRequisitionPdf";
import { childStatusesOf, fmtDateTime, isRequisitionCompleted, isRequisitionRejected, REQUISITION_STATUS_LABELS, type RequisitionResponse } from "../_types";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canApprove = hasPermission("Requisitions.Approve");
  const canRelease = hasPermission("Requisitions.WarehouseCheck");

  const [req, setReq] = useState<RequisitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [releaseOpen, setReleaseOpen] = useState(false);

  const [receiving, setReceiving] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

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
      showToast(t("Yuklab olishda xatolik"), "error");
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
        showToast(t("Yangi tab ochilmadi. Popup bloker tekshiring."), "error");
      }
    } catch {
      showToast(t("Faylni yuklashda xatolik"), "error");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleChildDownload = async (childId: string) => {
    setChildActing({ id: childId, action: "download" });
    try {
      const ok = await downloadRequisitionPdf(childId);
      if (!ok) showToast(t("PDF yaratilmadi"), "error");
    } catch {
      showToast(t("Yuklab olishda xatolik"), "error");
    } finally {
      setChildActing(null);
    }
  };

  const handleChildOpen = async (childId: string) => {
    setChildActing({ id: childId, action: "open" });
    try {
      const result = await openRequisitionPdfInNewTab(childId);
      if (result === "blocked") showToast(t("Yangi tab ochilmadi. Popup bloker tekshiring."), "error");
      else if (result === "error") showToast(t("PDF yaratilmadi"), "error");
    } catch {
      showToast(t("Faylni yuklashda xatolik"), "error");
    } finally {
      setChildActing(null);
    }
  };

  const handleApprove = async () => {
    if (!req) return;
    setActing(true);
    try {
      await requisitionService.approve(req.id);
      showToast(t("Talabnoma tasdiqlandi"), "success");
      await refresh();
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
    } finally { setActing(false); }
  };

  const handleRejectConfirm = async () => {
    if (!req || !rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await requisitionService.reject(req.id, rejectReason.trim());
      showToast(t("Talabnoma rad etildi"), "success");
      setRejectOpen(false);
      setRejectSaving(false);
      await refresh();
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
      setRejectSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!req) return;
    setReleasing(true);
    try {
      await requisitionService.release(req.id);
      showToast(t("Mahsulotlar bo'lim omboriga tushdi"), "success");
      setReleaseOpen(false);
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      showToast(msg ?? t("Chiqarib berishda xatolik yuz berdi"), "error");
    } finally {
      setReleasing(false);
    }
  };

  const handleReceivePurchase = async () => {
    if (!req) return;
    setReceiving(true);
    try {
      await requisitionService.receivePurchase(req.id);
      showToast(t("Xarid omborga qabul qilindi"), "success");
      setReceiveOpen(false);
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      showToast(msg ?? t("Qabul qilishda xatolik yuz berdi"), "error");
    } finally {
      setReceiving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>{t("Yuklanmoqda…")}</div>;
  }

  if (!req) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>{t("Talabnoma topilmadi")}</div>;
  }

  const canDoApproval = canApprove && req.status === RequisitionStatus.PendingApproval;
  const canDoRelease = canRelease
    && req.status === RequisitionStatus.ReadyForWarehouseRelease;
  const canDoReceivePurchase = canRelease
    && req.status === RequisitionStatus.ReadyForPurchase
    && req.source === RequisitionSource.Purchase;
  const isChild = !!req.parentRequisitionId;
  const showAvailability = req.status === RequisitionStatus.WarehouseChecked;
  const isApproved = req.status === RequisitionStatus.ReadyForWarehouseRelease
    || req.status === RequisitionStatus.ReadyForPurchase
    || req.status === RequisitionStatus.Released
    || req.status === RequisitionStatus.Delivered;

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
          {t("Orqaga")}
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text1)", fontFamily: "var(--font-mono)" }}>
            <RequisitionNo no={req.requisitionNo} hideSourceTag />
          </h1>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {req.typeLabel}
            {req.sourceLabel && <span style={{ marginLeft: 8, color: req.source === RequisitionSource.Warehouse ? "var(--success)" : "var(--accent)", fontWeight: 500 }}>· {t(req.sourceLabel)}</span>}
          </div>
        </div>
        <AllowanceBadge percent={req.allowancePercent} />
        <RequisitionStatusBadge status={req.status} completed={isRequisitionCompleted(req.status, childStatusesOf(req))} rejected={isRequisitionRejected(req.status, childStatusesOf(req))} />
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
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Bog'liq talabnomalar")}</div>
            {isChild && req.parentRequisitionNo && req.parentRequisitionId && (
              <div style={{ marginBottom: req.children.length > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>{t("Asl talabnoma")}</div>
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
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>{t("Bo'lingan talabnomalar")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {req.children.map(ch => {
                    const isWh = ch.source === RequisitionSource.Warehouse;
                    const destColor = isWh ? "var(--success)" : "var(--accent)";
                    const destLabel = isWh ? "Ombordan olishga" : "Sotib olishga";
                    // Tasdiqlangandan keyin status yorlig'i ("Ombordan olishga"/"Sotib olishga")
                    // yo'nalish chipi bilan aynan bir xil bo'lib qoladi — takrorlamaymiz.
                    const showDest = REQUISITION_STATUS_LABELS[ch.status] !== destLabel;
                    const isOpening = childActing?.id === ch.id && childActing.action === "open";
                    const isDownloading = childActing?.id === ch.id && childActing.action === "download";
                    const anyActing = childActing !== null;
                    return (
                      <div
                        key={ch.id}
                        style={{ padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg3)", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                      >
                        <RequisitionNo no={ch.requisitionNo} hideSourceTag style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)", flex: 1 }} />
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>{ch.itemCount} {t("ta material")}</span>
                        <RequisitionStatusBadge status={ch.status} small />
                        {showDest && (
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
                            {t(destLabel)}
                          </span>
                        )}
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
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Asosiy ma'lumotlar")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoCard label={t("Maqsad")} value={req.purpose} full />
            {req.contractNo && <InfoCard label={t("Shartnoma")} value={req.contractNo} />}
            {req.departmentName && <InfoCard label={t("Bo'lim")} value={req.departmentName} />}
            <InfoCard label={t("Yaratuvchi")} value={req.createdByName} />
            <InfoCard label={t("Yaratilgan")} value={fmtDateTime(req.createdAt)} />
            {req.notes && <InfoCard label={t("Izoh")} value={req.notes} full />}
            {req.signerTitle && <InfoCard label={t("Lavozim")} value={req.signerTitle} />}
            {req.signerName && <InfoCard label={t("F.I.O.")} value={req.signerName} />}
          </div>
        </div>

        {/* Materials */}
        <div className="itm-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>
            {t("Materiallar")} ({req.items.length})
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>#</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>{t("Nomi")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 90 }}>{t("O'lchov")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 110 }}>{t("Miqdor")}</th>
                  {showAvailability && <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 130 }}>{t("Mavjud")}</th>}
                  {isChild && <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", width: 130 }}>{t("Asl miqdor")}</th>}
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
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text1)", textAlign: "center" }}>{fmtDecimal(item.quantity)}</td>
                    {showAvailability && (
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {item.availableQuantity != null ? (
                          <span style={{
                            fontWeight: 600,
                            color: item.availableQuantity >= item.quantity ? "var(--success)" :
                                   item.availableQuantity > 0 ? "var(--warn)" : "var(--danger)",
                          }}>
                            {fmtDecimal(item.availableQuantity)}
                          </span>
                        ) : "—"}
                      </td>
                    )}
                    {isChild && (
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--text3)" }}>
                        {item.originalQuantity != null ? fmtDecimal(item.originalQuantity) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ombor harakatlari izi (audit trail) — harakat bo'lsa ko'rsatiladi */}
        <RequisitionMovements requisitionId={req.id} />

        {/* Warehouse check info */}
        {req.warehouseCheckedAt && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Ombor tekshiruvi")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: req.warehouseCheckQrCodeData ? 16 : 0 }}>
              <InfoCard label={t("Tekshirgan")} value={req.warehouseCheckedByName ?? "—"} />
              <InfoCard label={t("Tekshirilgan vaqt")} value={fmtDateTime(req.warehouseCheckedAt)} />
            </div>
            {req.warehouseCheckQrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{t("Omborchi imzo QR kodi")}</div>
                <img src={`data:image/png;base64,${req.warehouseCheckQrCodeData}`} alt={t("Omborchi QR kodi")} style={{ width: 180, height: 180, imageRendering: "pixelated" }} />
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  {t("Skanerlash orqali ombor tekshiruvini tekshirish mumkin")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approval info */}
        {isApproved && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Tasdiqlash")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: req.qrCodeData ? 16 : 0 }}>
              <InfoCard label={t("Tasdiqlagan")} value={req.approvedByName ?? "—"} />
              <InfoCard label={t("Tasdiqlangan vaqt")} value={fmtDateTime(req.approvedAt)} />
            </div>
            {req.qrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{t("Tasdiqlash QR kodi")}</div>
                <img src={`data:image/png;base64,${req.qrCodeData}`} alt={t("QR kod")} style={{ width: 180, height: 180, imageRendering: "pixelated" }} />
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  {t("Skanerlash orqali tasdiqlashni tekshirish mumkin")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {req.status === RequisitionStatus.Rejected && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, marginBottom: 14 }}>{t("Rad etish sababi")}</div>
            <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.2)", borderRadius: "var(--radius)", padding: "14px 18px", color: "var(--danger)", fontSize: 13 }}>
              {req.rejectionReason ?? "—"}
            </div>
          </div>
        )}

        {/* Files */}
        {filesLoading ? (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Fayllar")}</div>
            <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>{t("Yuklanmoqda…")}</div>
          </div>
        ) : files.length === 0 ? (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>{t("Fayllar")}</div>
            <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>{t("Fayllar yo'q")}</div>
          </div>
        ) : (
          <>
            {files.filter(f => f.label === "tz").length > 0 && (
              <div className="itm-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 12, color: "var(--purple)", fontWeight: 600, marginBottom: 14 }}>
                  {t("TZ — Texnik Topshiriq")} ({files.filter(f => f.label === "tz").length})
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
                  {t("Ilovalar")} ({files.filter(f => f.label !== "tz").length})
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
                {acting ? "…" : t("Tasdiqlash")}
              </button>
              <button
                disabled={acting}
                onClick={() => { setRejectOpen(true); setRejectReason(""); }}
                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius)", background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(217,48,37,0.3)", fontWeight: 600, fontSize: 14, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                {t("Rad etish")}
              </button>
            </div>
          )}
          {canDoRelease && (
            <button
              disabled={releasing}
              onClick={() => setReleaseOpen(true)}
              style={{ padding: "12px", borderRadius: "var(--radius)", background: "var(--success)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: releasing ? "not-allowed" : "pointer", opacity: releasing ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              {releasing ? t("Chiqarilmoqda…") : t("Mahsulotlarni chiqarib berish")}
            </button>
          )}
          {canDoReceivePurchase && (
            <button
              disabled={receiving}
              onClick={() => setReceiveOpen(true)}
              style={{ padding: "12px", borderRadius: "var(--radius)", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: receiving ? "not-allowed" : "pointer", opacity: receiving ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              {receiving ? t("Qabul qilinmoqda…") : t("Omborga qabul qilindi")}
            </button>
          )}
          {(req.status === RequisitionStatus.Released || req.status === RequisitionStatus.Delivered) && (
            <div style={{ padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--success-dim)", color: "var(--success)", border: "1px solid rgba(15,123,69,0.25)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {req.status === RequisitionStatus.Delivered
                ? t("Sotib olinib, bo'lim omboriga yetkazildi")
                : t("Mahsulotlar bo'lim omboriga tushdi")}
            </div>
          )}
        </div>
      </div>

      {/* Release confirm modal */}
      {releaseOpen && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => !releasing && setReleaseOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 460, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--text1)" }}>{t("Mahsulotlarni chiqarib berish")}</div>
            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 16 }}>
              {t("Talabnomadagi")} <b>{req.items.length} {t("ta")}</b> {t("material ombordan chiqariladi va")}{" "}
              <b style={{ color: "var(--accent)" }}>{req.departmentName ?? t("bo'lim")}</b> {t("omboriga tushadi.")}
              {" "}{t("Bu amalni qaytarib bo'lmaydi.")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={releasing}
                onClick={() => setReleaseOpen(false)}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: releasing ? "not-allowed" : "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                {t("Bekor")}
              </button>
              <button
                disabled={releasing}
                onClick={handleRelease}
                style={{ flex: 1, padding: "9px", background: "var(--success)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: releasing ? "not-allowed" : "pointer", fontWeight: 600, opacity: releasing ? 0.7 : 1 }}
              >
                {releasing ? t("Chiqarilmoqda…") : t("Chiqarish")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Receive purchase confirm modal */}
      {receiveOpen && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => !receiving && setReceiveOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 460, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--text1)" }}>{t("Sotib olingan mahsulotni omborga qabul qilish")}</div>
            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 16 }}>
              {t("Sotib olingan")} <b>{req.items.length} {t("ta")}</b> {t("mahsulot markaziy omborxonaga kirim qilinadi va")}{" "}
              <b style={{ color: "var(--accent)" }}>{req.departmentName ?? t("bo'lim")}</b> {t("omboriga berishga tayyor holatga o'tadi.")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={receiving}
                onClick={() => setReceiveOpen(false)}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: receiving ? "not-allowed" : "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                {t("Bekor")}
              </button>
              <button
                disabled={receiving}
                onClick={handleReceivePurchase}
                style={{ flex: 1, padding: "9px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: receiving ? "not-allowed" : "pointer", fontWeight: 600, opacity: receiving ? 0.7 : 1 }}
              >
                {receiving ? t("Qabul qilinmoqda…") : t("Qabul qilish")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Reject modal */}
      {rejectOpen && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setRejectOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--text1)" }}>{t("Rad etish sababi")}</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder={t("Sababni kiriting…")}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--bg3)", color: "var(--text1)" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setRejectOpen(false)}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                {t("Bekor")}
              </button>
              <button
                disabled={!rejectReason.trim() || rejectSaving}
                onClick={handleRejectConfirm}
                style={{ flex: 1, padding: "9px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: !rejectReason.trim() || rejectSaving ? "not-allowed" : "pointer", fontWeight: 600, opacity: !rejectReason.trim() || rejectSaving ? 0.7 : 1 }}
              >
                {rejectSaving ? "…" : t("Rad etish")}
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
  const t = useT();
  const [hover, setHover] = useState(false);
  const isOpen = variant === "open";
  const color = isOpen ? "#0ea5e9" : "#10b981";
  const bgIdle = isOpen ? "rgba(14,165,233,0.07)" : "rgba(16,185,129,0.07)";
  const bgHover = isOpen ? "rgba(14,165,233,0.15)" : "rgba(16,185,129,0.15)";
  const outline = isOpen ? "rgba(14,165,233,0.3)" : "rgba(16,185,129,0.3)";
  const title = isOpen ? t("Yangi tabda ko'rish") : t("Yuklab olish");
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
  const t = useT();
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
          title={t("Yangi tabda ko'rish")}
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
        title={t("Yuklab olish")}
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
