"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface CheckSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  style?: React.CSSProperties;
  error?: boolean;
  disablePortal?: boolean;
}

export function CheckSelect({ value, onChange, options, placeholder = "— Tanlang —", style, error, disablePortal }: CheckSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position dropdown relative to trigger using fixed coords
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    if (disablePortal) {
      setDropdownStyle({ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999 });
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const minW = 160;
    const dropW = Math.max(rect.width, minW);
    const leftPos = rect.left + dropW > window.innerWidth ? window.innerWidth - dropW - 4 : rect.left;
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: leftPos,
      width: dropW,
      zIndex: 9999,
    });
  }, [open, disablePortal]);

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

  // Close on scroll / resize
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
        Tanlanmagan
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
              color: checked ? (opt.color ?? "var(--accent)") : (opt.color ?? "var(--text1)"),
              fontWeight: checked ? 600 : 400,
              background: checked ? (opt.color ? `${opt.color}15` : "var(--accent-dim)") : "transparent",
              borderBottom: "1px solid var(--border)",
              transition: "background 0.1s",
            }}
          >
            <span style={{
              width: 15, height: 15, flexShrink: 0,
              border: `1.5px solid ${checked ? (opt.color ?? "var(--accent)") : "var(--border)"}`,
              borderRadius: 3,
              background: checked ? (opt.color ?? "var(--accent)") : "transparent",
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
            {opt.color && !opt.icon && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, flexShrink: 0, boxShadow: `0 0 0 2px ${opt.color}33` }} />
            )}
            {opt.icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{opt.icon}</span>}
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
          border: `1.5px solid ${open ? "var(--accent)" : error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: 13,
          background: "var(--bg2)",
          color: selected ? "var(--text1)" : "var(--text3)",
          cursor: "pointer",
          transition: "border-color 0.15s",
          textAlign: "left",
          boxSizing: "border-box",
          boxShadow: !open && error ? "0 0 0 2px var(--danger)33" : undefined,
        }}
      >
        {selected?.color && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: selected.color, flexShrink: 0, boxShadow: `0 0 0 2px ${selected.color}33` }} />
        )}
        {selected?.icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{selected.icon}</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: selected?.color ?? undefined }}>
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

      {dropdown
        ? (disablePortal ? dropdown : (typeof document !== "undefined" ? createPortal(dropdown, document.body) : null))
        : null}
    </div>
  );
}
