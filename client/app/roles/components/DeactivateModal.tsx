"use client";

interface Props {
  deleteError: string | null;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeactivateModal({ deleteError, deleting, onConfirm, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header" style={{ color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Rolni noaktiv qilish
          </span>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            Ushbu rol noaktiv qilinadi va yangi foydalanuvchilarga biriktirib bo&apos;lmaydi. Davom etasizmi?
          </p>
          {deleteError && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              color: "#dc2626", fontSize: 13, padding: "10px 14px", textAlign: "left",
            }}>
              {deleteError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-outline" onClick={onClose} disabled={deleting}>Bekor qilish</button>
            {!deleteError && (
              <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
                {deleting ? "Noaktiv qilinmoqda..." : "Noaktiv qilish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
