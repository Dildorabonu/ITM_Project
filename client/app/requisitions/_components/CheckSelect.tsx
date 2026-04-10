"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  id: string;
  name: string;
}

interface CheckSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  style?: React.CSSProperties;
}

export function CheckSelect({ value, onChange, options, placeholder = "— Tanlang —", style }: CheckSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position dropdown relative to trigger using fixed coords
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on scroll (but not when scrolling inside dropdown) / resize
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onResize); };
  }, [open]);

  const selected = options.find(o => o.id === value);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      onWheel={e => e.stopPropagation()}
      style={{
        ...dropdownStyle,
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
        maxHeight: 300,
        overflowY: "auto",
      }}
    >
      {/* Reset option */}
      <div
        onClick={() => { onChange(""); setOpen(false); }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--text3)",
          borderBottom: "1px solid var(--border)",
          fontStyle: "italic",
        }}
      >
        <span style={{
          width: 15, height: 15, flexShrink: 0,
          border: "1.5px solid var(--border)",
          borderRadius: 3,
          display: "inline-flex",
        }} />
        {placeholder}
      </div>

      {options.map(opt => {
        const checked = opt.id === value;
        return (
          <div
            key={opt.id}
            onClick={() => { onChange(opt.id); setOpen(false); }}
            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg3)"; }}
            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = checked ? "var(--accent-dim)" : ""; }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              cursor: "pointer",
              fontSize: 13,
              color: checked ? "var(--accent)" : "var(--text1)",
              fontWeight: checked ? 600 : 400,
              background: checked ? "var(--accent-dim)" : "transparent",
              borderBottom: "1px solid var(--border)",
              transition: "background 0.1s",
            }}
          >
            <span style={{
              width: 15, height: 15, flexShrink: 0,
              border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 3,
              background: checked ? "var(--accent)" : "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
            }}>
              {checked && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {opt.name}
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div style={{ position: "relative", width: "100%", ...style }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "6px 10px",
          border: `1.5px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: 13,
          background: "var(--bg2)",
          color: selected ? "var(--text1)" : "var(--text3)",
          cursor: "pointer",
          transition: "border-color 0.15s",
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.name : placeholder}
        </span>
        <svg
          width="12" height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            flexShrink: 0,
            color: "var(--text3)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
