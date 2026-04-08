"use client";

import { useEffect, useRef, useState } from "react";

export function CustomSelect({
  value, onChange, options, placeholder, hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px",
        color: selected ? "var(--text)" : "var(--text3)",
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        <span>{selected ? selected.name : placeholder}</span>
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
          zIndex: 200, maxHeight: 220, overflowY: "auto",
        }}>
          {options.map(o => (
            <div key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = "var(--bg3)"; }}
              onMouseLeave={e => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}
              style={{
                padding: "9px 14px", cursor: "pointer", fontSize: 14,
                color: o.id === value ? "var(--accent)" : "var(--text)",
                background: o.id === value ? "var(--accent-dim)" : "transparent",
                fontWeight: o.id === value ? 600 : 400,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              {o.id === value ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : <span style={{ width: 12 }} />}
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
