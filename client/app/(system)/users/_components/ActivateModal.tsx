"use client";

interface Props {
  activating: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ActivateModal({ activating, onConfirm, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header" style={{ color: "#16a34a", borderBottom: "1px solid var(--border)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Foydalanuvchini aktivlashtirish
          </span>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            Ushbu foydalanuvchi aktiv qilinadi va tizimga kira oladi. Davom etasizmi?
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-outline" onClick={onClose} disabled={activating}>Bekor qilish</button>
            <button
              onClick={onConfirm}
              disabled={activating}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: 600,
                background: "#16a34a", color: "#fff", border: "none",
                borderRadius: "var(--radius)", cursor: activating ? "not-allowed" : "pointer",
                opacity: activating ? 0.7 : 1,
              }}
            >
              {activating ? "Aktivlanmoqda..." : "Aktivlashtirish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
