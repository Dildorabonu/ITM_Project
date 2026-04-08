"use client";

import { useEffect, useRef, useState } from "react";
import { DepartmentType, DEPARTMENT_TYPE_LABELS, type DepartmentOption } from "@/lib/userService";
import { TYPE_STYLE } from "./constants";

export function CustomGroupedSelect({
  value, onChange, departments, placeholder, hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  departments: DepartmentOption[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = departments.find(d => d.id === value);
  const selectedTs = selected?.type !== undefined ? TYPE_STYLE[selected.type] : null;

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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px",
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        {selected && selectedTs ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: selectedTs.bg, color: selectedTs.color, border: `1px solid ${selectedTs.border}`,
          }}>
            {selectedTs.icon} {selected.name}
          </span>
        ) : (
          <span style={{ color: "var(--text3)" }}>{placeholder}</span>
        )}
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
                {g.items.map(d => (
                  <div key={d.id}
                    onClick={() => { onChange(d.id); setOpen(false); }}
                    onMouseEnter={e => { if (d.id !== value) e.currentTarget.style.background = "var(--bg3)"; }}
                    onMouseLeave={e => { if (d.id !== value) e.currentTarget.style.background = d.id === value ? ts.bg : "transparent"; }}
                    style={{
                      padding: "8px 16px 8px 20px", cursor: "pointer", fontSize: 13,
                      color: d.id === value ? ts.color : "var(--text)",
                      background: d.id === value ? ts.bg : "transparent",
                      fontWeight: d.id === value ? 600 : 400,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                    {d.id === value ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, color: ts.color }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : <span style={{ width: 11 }} />}
                    {d.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
