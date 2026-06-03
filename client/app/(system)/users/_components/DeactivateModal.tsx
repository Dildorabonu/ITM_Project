"use client";

interface Props {
  deactivateError: string | null;
  deactivating: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeactivateModal({ deactivateError, deactivating, onConfirm, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header" style={{ color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Foydalanuvchini noaktiv qilish
          </span>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            Ushbu foydalanuvchi noaktiv qilinadi va tizimga kira olmaydi. Davom etasizmi?
          </p>
          {deactivateError && (
            <div style={{
              background: "var(--danger-dim)", border: "1px solid var(--danger)",
              borderRadius: 8, color: "var(--danger)", fontSize: 13,
              padding: "10px 14px", textAlign: "left",
            }}>
              {deactivateError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-outline" onClick={onClose} disabled={deactivating}>Bekor qilish</button>
            {!deactivateError && (
              <button className="btn btn-danger" onClick={onConfirm} disabled={deactivating}>
                {deactivating ? "Noaktiv qilinmoqda..." : "Noaktiv qilish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
