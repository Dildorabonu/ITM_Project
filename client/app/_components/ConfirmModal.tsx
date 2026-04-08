"use client";

import { ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title = "O'chirishni tasdiqlang",
  message = "Bu amal qaytarib bo'lmaydi.",
  confirmLabel = "O'chirish",
  cancelLabel = "Bekor qilish",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div
          className="modal-header"
          style={{ color: "var(--danger)", borderBottom: "1px solid var(--border)" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            {title}
          </span>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            {message}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-outline" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
              {loading ? "O'chirilmoqda..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
