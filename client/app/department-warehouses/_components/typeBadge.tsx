"use client";

import type { ReactNode } from "react";
import { DepartmentType } from "@/lib/userService";

// Bo'lim turiga qarab rang va ikona. [departmentId] tafsilot sahifasi sarlavhasida ishlatiladi.
export const TYPE_BADGE: Record<DepartmentType, { color: string; bg: string; border: string; icon: ReactNode }> = {
  [DepartmentType.IshlabChiqarish]: {
    color: "var(--warn)", bg: "var(--warn-dim)", border: "rgba(224,123,0,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20" />
        <path d="M4 20V10l5 3V8l5 3V6l5 3v11" />
        <path d="M8 20v-4" /><path d="M13 20v-4" /><path d="M18 20v-4" />
      </svg>
    ),
  },
  [DepartmentType.Bolim]: {
    color: "var(--accent)", bg: "var(--accent-dim)", border: "rgba(26,110,235,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="8" height="16" rx="1" />
        <rect x="13" y="9" width="8" height="11" rx="1" />
        <path d="M6 8h2M6 12h2M6 16h2M16 13h2M16 17h2" />
      </svg>
    ),
  },
  [DepartmentType.Boshqaruv]: {
    color: "var(--purple)", bg: "var(--purple-dim)", border: "rgba(124,58,237,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 4v5c0 4.5-3.4 8.5-8 9.5C7.4 20.5 4 16.5 4 12V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  [DepartmentType.Omborxona]: {
    color: "var(--success)", bg: "var(--success-dim)", border: "rgba(15,123,69,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
        <path d="M3 13h18" />
        <path d="M9 21V13" /><path d="M15 21V13" />
      </svg>
    ),
  },
};
