"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DepartmentType, DEPARTMENT_TYPE_LABELS, type DepartmentOption } from "@/lib/userService";

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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = departments.find(d => d.id === value);

  const groups = ([DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const)
    .map(t => ({ type: t, items: departments.filter(d => d.type === t) }))
    .filter(g => g.items.length > 0);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      onWheel={e => e.stopPropagation()}
      style={{
        ...dropdownStyle,
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
        maxHeight: 300,
        overflowY: "auto",
      }}
    >
      {groups.map((g, gi) => (
        <div key={g.type}>
          <div style={{
            padding: "5px 12px",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--text3)",
            borderTop: gi > 0 ? "1px solid var(--border)" : "none",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg2)",
            position: "sticky",
            top: 0,
          }}>
            {DEPARTMENT_TYPE_LABELS[g.type]}
          </div>

          {g.items.map(d => {
            const checked = d.id === value;
            return (
              <div
                key={d.id}
                onClick={() => { onChange(d.id); setOpen(false); }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: checked ? "var(--accent)" : "var(--text)",
                  fontWeight: checked ? 600 : 400,
                  background: checked ? "var(--accent-dim)" : "transparent",
                  transition: "background 0.1s",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d.name}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
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
          padding: "9px 12px",
          border: `1.5px solid ${open ? "var(--accent)" : hasError ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: 13,
          background: "var(--surface)",
          color: selected ? "var(--text)" : "var(--text3)",
          cursor: "pointer",
          transition: "border-color 0.15s",
          textAlign: "left",
          boxSizing: "border-box",
          boxShadow: !open && hasError ? "0 0 0 2px var(--danger)33" : undefined,
          fontFamily: "var(--font-inter), Inter, sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
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
