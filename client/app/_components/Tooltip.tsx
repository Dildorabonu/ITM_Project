"use client";

import { ReactNode, useRef, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  /** Tooltip qaysi tomonda chiqishi (default: "top") */
  side?: "top" | "bottom";
  /** Wrapper span uchun qo'shimcha className */
  className?: string;
}

/**
 * Portal orqali `position: fixed` bilan chiqadigan tooltip.
 * `overflow: hidden/auto/clip` ota-elementlar ichida ham qirqilmaydi (jadval, scroll konteyner).
 * Ishlatish:
 *   <Tooltip label="Tasdiqlash"><button ...>...</button></Tooltip>
 */
export default function Tooltip({ label, children, side = "top", className }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      x: r.left + r.width / 2,
      y: side === "top" ? r.top : r.bottom,
    });
  }, [side]);

  const hide = useCallback(() => setCoords(null), []);

  // Scroll yoki resize bo'lsa tooltipni yashir (joyi siljib qolmasligi uchun)
  useLayoutEffect(() => {
    if (!coords) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [coords, hide]);

  return (
    <span
      ref={wrapRef}
      className={className}
      style={{ display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            className="ui-tip-bubble"
            data-side={side}
            style={{
              position: "fixed",
              left: coords.x,
              top: side === "top" ? coords.y - 9 : coords.y + 9,
              transform: `translateX(-50%) ${side === "top" ? "translateY(-100%)" : ""}`,
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
