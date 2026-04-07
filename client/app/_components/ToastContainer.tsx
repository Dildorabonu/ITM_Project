"use client";

import React, { useEffect, useState } from "react";
import { useToastStore, Toast } from "@/lib/store/toastStore";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [exiting, setExiting] = useState(false);

  const close = () => {
    setExiting(true);
    setTimeout(() => dismiss(toast.id), 350);
  };

  useEffect(() => {
    const t = setTimeout(close, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid #10b981",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 260,
        maxWidth: 360,
        animation: exiting
          ? "slideOutToast 0.35s ease forwards"
          : "slideInToast 0.25s ease",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#d1fae5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 2 }}>
          {toast.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)" }}>{toast.message}</div>
      </div>
      <button
        onClick={close}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text3)",
          fontSize: 16,
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
