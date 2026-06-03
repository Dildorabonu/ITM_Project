"use client";

import { ManufacturingStatus, MANUFACTURING_STATUS_LABELS } from "@/lib/userService";

// Ishlab chiqarish holatini rangli badge ko'rinishida ko'rsatadi.
export function StatusBadge({ status }: { status: ManufacturingStatus }) {
  const isCompleted = status === ManufacturingStatus.Completed;
  const bg = isCompleted ? "var(--success-dim)" : "var(--warn-dim)";
  const fg = isCompleted ? "var(--success)" : "var(--warn)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: fg,
        animation: isCompleted ? undefined : "dotPulse 1.6s infinite",
      }} />
      {MANUFACTURING_STATUS_LABELS[status]}
    </span>
  );
}
