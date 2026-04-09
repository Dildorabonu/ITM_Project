"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  RequisitionStatus,
} from "@/lib/userService";
import { RequisitionStatusBadge } from "../_components/StatusBadge";
import { fmtDateTime, type RequisitionResponse } from "../_types";

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canApprove = hasPermission("Requisitions.Approve");
  const canSendToWarehouse = hasPermission("Requisitions.SendToWarehouse");

  const [req, setReq] = useState<RequisitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  useEffect(() => {
    requisitionService.getById(id).then(data => {
      setReq(data ?? null);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async () => {
    if (!req) return;
    setActing(true);
    try {
      await requisitionService.submit(req.id);
      showToast("Talabnoma direktorga yuborildi", "success");
      setReq(prev => prev ? { ...prev, status: RequisitionStatus.Pending } : prev);
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleApprove = async () => {
    if (!req) return;
    setActing(true);
    try {
      await requisitionService.approve(req.id);
      showToast("Talabnoma tasdiqlandi", "success");
      const updated = await requisitionService.getById(req.id);
      if (updated) setReq(updated);
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
      router.push("/requisitions");
    } catch {
      showToast("Xatolik yuz berdi", "error");
      setRejectSaving(false);
    }
  };

  const handleSendToWarehouse = async () => {
    if (!req) return;
    setActing(true);
    try {
      await requisitionService.sendToWarehouse(req.id);
      showToast("Omborga yuborildi", "success");
      setReq(prev => prev ? { ...prev, status: RequisitionStatus.SentToWarehouse } : prev);
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>Yuklanmoqda…</div>;
  }

  if (!req) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>Talabnoma topilmadi</div>;
  }

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
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{req.typeLabel}</div>
        </div>
        <RequisitionStatusBadge status={req.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Main info */}
        <div className="itm-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Asosiy ma'lumotlar</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoCard label="Maqsad" value={req.purpose} full />
            {req.contractNo && <InfoCard label="Shartnoma" value={req.contractNo} />}
            {req.departmentName && <InfoCard label="Bo'lim" value={req.departmentName} />}
            <InfoCard label="Yaratuvchi" value={req.createdByName} />
            <InfoCard label="Yaratilgan" value={fmtDateTime(req.createdAt)} />
            {req.notes && <InfoCard label="Izoh" value={req.notes} full />}
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
                  {["#", "Kod", "Nomi", "O'lchov", "Miqdor"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {req.items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text3)" }}>{i + 1}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text2)" }}>{item.materialCode}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text1)", fontWeight: 500 }}>{item.materialName}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text3)" }}>{item.unit}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text1)" }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval / rejection info */}
        {(req.status === RequisitionStatus.Approved || req.status === RequisitionStatus.SentToWarehouse) && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 14 }}>Tasdiqlash</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: req.qrCodeData ? 16 : 0 }}>
              <InfoCard label="Tasdiqlagan" value={req.approvedByName ?? "—"} />
              <InfoCard label="Tasdiqlangan vaqt" value={fmtDateTime(req.approvedAt)} />
            </div>
            {req.qrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Tasdiqlash QR kodi</div>
                <img
                  src={`data:image/png;base64,${req.qrCodeData}`}
                  alt="QR kod"
                  style={{ width: 180, height: 180, imageRendering: "pixelated" }}
                />
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  Chop etishda avtomatik chiqadi • Skanerlash orqali tasdiqlashni tekshirish mumkin
                </div>
              </div>
            )}
          </div>
        )}

        {req.status === RequisitionStatus.Rejected && (
          <div className="itm-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, marginBottom: 14 }}>Rad etish sababi</div>
            <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.2)", borderRadius: "var(--radius)", padding: "14px 18px", color: "var(--danger)", fontSize: 13 }}>
              {req.rejectionReason ?? "—"}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {req.status === RequisitionStatus.Draft && (
            <button
              disabled={acting}
              onClick={handleSubmit}
              style={{ padding: "12px 24px", borderRadius: "var(--radius)", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
            >
              {acting ? "Yuborilmoqda…" : "Direktorga yuborish"}
            </button>
          )}

          {req.status === RequisitionStatus.Pending && canApprove && (
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

          {req.status === RequisitionStatus.Approved && canSendToWarehouse && (
            <button
              disabled={acting}
              onClick={handleSendToWarehouse}
              style={{ padding: "12px 24px", borderRadius: "var(--radius)", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(26,110,235,0.25)", fontWeight: 600, fontSize: 14, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
            >
              {acting ? "…" : "Omborga yuborish"}
            </button>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
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
      )}
    </div>
  );
}

function InfoCard({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)", wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}
