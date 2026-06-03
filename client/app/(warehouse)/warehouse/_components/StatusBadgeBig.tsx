"use client";

import type { MaterialStatus } from "../_types";

// Material yetarliligini katta badge ko'rinishida ko'rsatadi (yetarli / qisman / yo'q).
export function StatusBadgeBig({ status, available, required }: { status: MaterialStatus; available: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((available / required) * 100)) : 0;
  if (status === "yetarli") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
        borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: "var(--success-dim)", color: "var(--success)", border: "1px solid rgba(15,123,69,0.25)",
        animation: "fadeSlideIn 0.3s ease-out",
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Yetarli
      </span>
    );
  }
  if (status === "yetishmadi") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
        borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: "var(--warn-dim)", color: "var(--warn)", border: "1px solid rgba(224,123,0,0.25)",
        animation: "fadeSlideIn 0.3s ease-out",
      }}>
        Qisman ({pct}%)
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(217,48,37,0.25)",
      animation: "fadeSlideIn 0.3s ease-out",
    }}>
      Yo&apos;q
    </span>
  );
}
