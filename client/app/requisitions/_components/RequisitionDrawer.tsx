"use client";

import { useAuthStore } from "@/lib/store/authStore";
import { RequisitionStatus, RequisitionType } from "@/lib/userService";

import { RequisitionStatusBadge } from "./StatusBadge";
import { fmtDateTime, type RequisitionResponse } from "../_types";

interface Props {
  req: RequisitionResponse;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSendToWarehouse: (id: string) => void;
  acting: boolean;
}

export function RequisitionDrawer({ req, onClose, onApprove, onReject, onSendToWarehouse, acting }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canApprove = hasPermission("Requisitions.Approve");
  const canSendToWarehouse = hasPermission("Requisitions.SendToWarehouse");

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 680, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          padding: "28px 28px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg2)", zIndex: 10, paddingBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>{req.requisitionNo}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{req.typeLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RequisitionStatusBadge status={req.status} />
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Asosiy ma'lumotlar */}
        <section>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Asosiy</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <InfoCard label="Maqsad" value={req.purpose} full />
            {req.contractNo && <InfoCard label="Shartnoma" value={req.contractNo} />}
            {req.departmentName && <InfoCard label="Bo'lim" value={req.departmentName} />}
            <InfoCard label="Yaratuvchi" value={req.createdByName} />
            <InfoCard label="Yaratilgan" value={fmtDateTime(req.createdAt)} />
            {req.notes && <InfoCard label="Izoh" value={req.notes} full />}
          </div>
        </section>

        {/* Materiallar */}
        <section>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>
            Materiallar ({req.items.length})
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  {["#", "Kod", "Nomi", "O'lchov", "Miqdor"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {req.items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text3)" }}>{i + 1}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text2)" }}>{item.materialCode}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text1)", fontWeight: 500 }}>{item.materialName}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text3)" }}>{item.unit}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text1)" }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tasdiqlash ma'lumotlari */}
        {req.status === RequisitionStatus.Approved || req.status === RequisitionStatus.SentToWarehouse ? (
          <section>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Tasdiqlash</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <InfoCard label="Tasdiqlagan" value={req.approvedByName ?? "—"} />
              <InfoCard label="Tasdiqlangan vaqt" value={fmtDateTime(req.approvedAt)} />
            </div>
            {req.qrCodeData && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg3)" }}>
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
          </section>
        ) : req.status === RequisitionStatus.Rejected ? (
          <section>
            <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600, marginBottom: 10 }}>Rad etish sababi</div>
            <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.2)", borderRadius: "var(--radius)", padding: "12px 16px", color: "var(--danger)", fontSize: 13 }}>
              {req.rejectionReason ?? "—"}
            </div>
          </section>
        ) : null}

        {/* Amallar */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Pending → approve / reject (Individual only) */}
          {req.status === RequisitionStatus.Pending && req.type === RequisitionType.Individual && canApprove && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={acting}
                onClick={() => onApprove(req.id)}
                style={{ flex: 1, padding: "10px 20px", borderRadius: "var(--radius)", background: "var(--success)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                {acting ? "…" : "Tasdiqlash"}
              </button>
              <button
                disabled={acting}
                onClick={() => onReject(req.id)}
                style={{ flex: 1, padding: "10px 20px", borderRadius: "var(--radius)", background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(217,48,37,0.3)", fontWeight: 600, fontSize: 13, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
              >
                Rad etish
              </button>
            </div>
          )}

          {/* Approved → send to warehouse (Individual only) */}
          {req.status === RequisitionStatus.Approved && req.type === RequisitionType.Individual && canSendToWarehouse && (
            <button
              disabled={acting}
              onClick={() => onSendToWarehouse(req.id)}
              style={{ padding: "10px 20px", borderRadius: "var(--radius)", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(26,110,235,0.25)", fontWeight: 600, fontSize: 13, cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1 }}
            >
              {acting ? "…" : "Omborga yuborish"}
            </button>
          )}
        </div>
      </div>
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
