"use client";

import { useEffect, useRef, useState } from "react";
import { DepartmentType, DEPARTMENT_TYPE_LABELS, type DepartmentResponse } from "@/lib/userService";

const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

export function CustomGroupedMultiSelect({
  values = [], onChange, departments, placeholder, hasError,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  departments: DepartmentResponse[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups = ([DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const)
    .map(t => ({ type: t, items: departments.filter(d => d.type === t) }))
    .filter(g => g.items.length > 0);

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id]);
  };

  const selectedDepts = departments.filter(d => values.includes(d.id));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px", minHeight: 40,
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
          {selectedDepts.length === 0 ? (
            <span style={{ color: "var(--text3)" }}>{placeholder}</span>
          ) : selectedDepts.map(d => {
            const ts = TYPE_STYLE[d.type];
            return (
              <span key={d.id} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
              }}>
                {ts.icon} {d.name}
                <span
                  onClick={e => { e.stopPropagation(); toggle(d.id); }}
                  style={{ cursor: "pointer", marginLeft: 2, lineHeight: 1, opacity: 0.7 }}
                >✕</span>
              </span>
            );
          })}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text3)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1.5px solid var(--border2)",
          borderRadius: "var(--radius2)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 200, maxHeight: 260, overflowY: "auto",
        }}>
          {groups.map((g, gi) => {
            const ts = TYPE_STYLE[g.type];
            return (
              <div key={g.type}>
                <div style={{
                  padding: "7px 12px 5px", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.7px", textTransform: "uppercase",
                  color: ts.color, background: ts.bg,
                  display: "flex", alignItems: "center", gap: 6,
                  borderTop: gi > 0 ? "1px solid var(--border)" : "none",
                  position: "sticky", top: 0,
                }}>
                  {ts.icon} {DEPARTMENT_TYPE_LABELS[g.type]}
                </div>
                {g.items.map(d => {
                  const checked = values.includes(d.id);
                  return (
                    <div key={d.id}
                      onClick={() => toggle(d.id)}
                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg3)"; }}
                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                      style={{
                        padding: "8px 16px 8px 20px", cursor: "pointer", fontSize: 13,
                        color: checked ? ts.color : "var(--text)",
                        background: checked ? ts.bg : "transparent",
                        fontWeight: checked ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                      {checked ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, color: ts.color }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : <span style={{ width: 11 }} />}
                      {d.name}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
