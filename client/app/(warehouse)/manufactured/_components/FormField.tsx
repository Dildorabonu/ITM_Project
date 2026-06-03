"use client";

import type { ReactNode } from "react";

// Forma maydoni uchun yagona label + xato ko'rinishi.
export function FormField({
  label, required, error, children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
        color: error ? "var(--danger)" : "var(--text3)",
      }}>
        {label}{required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
