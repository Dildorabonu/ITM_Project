"use client";

import { ReactNode } from "react";

type ConfirmVariant = "danger" | "warn" | "primary";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, { color: string; btnClass: string; icon: ReactNode }> = {
  danger: {
    color: "var(--danger)",
    btnClass: "btn btn-danger",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
    ),
  },
  warn: {
    color: "var(--warn)",
    btnClass: "btn btn-primary",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  primary: {
    color: "var(--accent)",
    btnClass: "btn btn-primary",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

export function ConfirmModal({
  open,
  title = "O'chirishni tasdiqlang",
  message = "Bu amal qaytarib bo'lmaydi.",
  confirmLabel = "O'chirish",
  cancelLabel = "Bekor qilish",
  loading = false,
  loadingLabel,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;
  const v = VARIANT_STYLES[variant];
  const defaultLoadingLabel = variant === "danger" ? "O'chirilmoqda..." : "Yuklanmoqda...";

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div
          className="modal-header"
          style={{ color: v.color, borderBottom: "1px solid var(--border)" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {v.icon}
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
            <button className={v.btnClass} onClick={onConfirm} disabled={loading}>
              {loading ? (loadingLabel ?? defaultLoadingLabel) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
