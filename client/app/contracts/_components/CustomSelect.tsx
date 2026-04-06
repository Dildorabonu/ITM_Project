"use client";

import { useEffect, useRef, useState } from "react";
import { SelectOption } from "../_types";

export function CustomSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px", height: 40, borderRadius: 8, cursor: "pointer",
          background: "var(--bg2)", border: `1.5px solid ${(open || hovered) ? "var(--accent)" : "var(--border)"}`,
          color: "var(--text1)", fontWeight: 400,
          fontSize: 14, transition: "border-color .15s", outline: "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selected?.color && (
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: selected.color, flexShrink: 0,
              boxShadow: `0 0 0 3px ${selected.color}33`,
            }} />
          )}
          {selected?.icon && <span style={{ fontSize: 15 }}>{selected.icon}</span>}
          <span style={{
            color: (selected && selected.value !== "") ? (selected.color ?? "var(--text1)") : "var(--text3)",
            fontWeight: selected?.color ? 600 : 400,
          }}>
            {(selected && selected.value !== "") ? selected.label : (placeholder ?? "— Tanlang —")}
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
          <path d="M2 4.5L7 9.5L12 4.5" stroke="var(--text3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.14)", overflow: "hidden",
          maxHeight: 260, overflowY: "auto",
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", cursor: "pointer",
                background: opt.value === value ? "var(--bg3)" : "transparent",
                color: opt.color ?? "var(--text1)",
                fontWeight: opt.color ? 600 : opt.value === value ? 600 : 400,
                fontSize: 14, transition: "background .1s",
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = "var(--bg2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? "var(--bg3)" : "transparent"; }}
            >
              {opt.color && (
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", background: opt.color, flexShrink: 0,
                  boxShadow: `0 0 0 3px ${opt.color}33`,
                }} />
              )}
              {opt.icon && <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0 }}>{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.value === value && opt.value !== "" && (
                <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 10.5L12 3.5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
