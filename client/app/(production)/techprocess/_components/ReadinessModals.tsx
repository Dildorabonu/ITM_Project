"use client";

import { createPortal } from "react-dom";

// Chizma tasdiqlanmaganda ko'rsatiladigan blur ogohlantirish — qator bosilganda.
export function DrawingWarningModal({ contractNo, onClose }: { contractNo: string | null; onClose: () => void }) {
  if (!contractNo) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "24px 28px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#854d0e", marginBottom: 6 }}>Texnik chizma tasdiqlanmagan</div>
          <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
            Texnologik jarayon bilan ishlash uchun <strong>texnik chizma tasdiqlanishi</strong>{" "}kerak. Texnik chizmalar bo&apos;limiga o&apos;ting va chizmaning tasdiqlanishini kuting.
          </div>
          <button onClick={onClose} style={{ marginTop: 16, padding: "6px 18px", background: "#ca8a04", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Yopish
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tasdiqlash (approve) tasdiqlash oynasi — TP ham, CN ham ishlatadi. `kindLabel`
// jumlani moslaydi ("texnologik jarayonni" / "me'yoriy sarfni").
export function ApproveConfirmModal({
  target, kindLabel, busy, onCancel, onConfirm,
}: {
  target: { title: string } | null;
  kindLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!target) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "95vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 20px" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>«{target.title}»</span> {kindLabel}{" "}
          <span style={{ fontWeight: 600, color: "var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy} style={{ background: "var(--success)", borderColor: "var(--success)" }}>
            {busy ? "Tasdiqlanmoqda..." : "Ha, tasdiqlash"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// "Qoralama holatida saqlanadi" ogohlantirish oynasi — yaratishni tasdiqlash.
export function DraftWarningModal({
  title, kindLabel, busy, onCancel, onConfirm,
}: {
  title: string | null;
  kindLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!title) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--warn)", borderRadius: 12, padding: 28, width: 400, maxWidth: "95vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--warn-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--warn)" }}>{kindLabel} qoralama holatida</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 20px" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>«{title}»</span> {kindLabel.toLowerCase()}{" "}
          <span style={{ fontWeight: 600, color: "var(--warn)" }}>qoralama</span> holatida saqlanadi.
          Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Saqlanmoqda..." : "Tushundim, saqlash"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
