"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { productService, type ProductSimilar } from "@/lib/userService";
import { useT } from "@/lib/i18n";

// Mahsulot nomi yozilayotganda, ilk harflardan boshlab (StartsWith) tanlangan bo'lim
// ichidan mos keluvchi mavjud mahsulotlarni input ostida dropdown (typeahead) ko'rsatadi.
// Maqsad: foydalanuvchini bir xil mahsulotni qayta kiritib yuborishdan saqlash.
// Elementga bosilganda uning nomi inputga to'ldiriladi (autocomplete kabi).
// Dropdown portal orqali <body> ga chiqariladi — shunda `.itm-card` ning
// overflow:hidden klipi tufayli kesilib qolmaydi va ichida scroll ishlaydi.
// excludeId — tahrirlashda mahsulotning o'zini ro'yxatda ko'rsatmaslik uchun.
export function SimilarNameWarning({
  name,
  departmentId,
  excludeId,
  onSelect,
}: {
  name: string;
  departmentId: string;
  excludeId?: string;
  onSelect?: (name: string) => void;
}) {
  const t = useT();
  const [matches, setMatches] = useState<ProductSimilar[]>([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Element tanlangach onSelect nomni o'zgartiradi — keyingi qidiruvni o'tkazib yuborib,
  // dropdown darhol qayta ochilib ketishining oldini olamiz.
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const term = name.trim();
    if (term.length < 1 || !departmentId) {
      setMatches([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await productService.autocomplete(term, departmentId);
        if (!active) return;
        setMatches(res.filter(m => m.id !== excludeId));
        setOpen(true);
      } catch {
        /* qidiruv xatosi — jim o'tkazib yuboramiz */
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [name, departmentId, excludeId]);

  // Dropdown joylashuvini input (anchor o'rovi) bo'yicha hisoblaymiz; scroll/resize
  // da yangilanadi, chunki portal <body> ga fixed joylashuvda chiqariladi.
  useLayoutEffect(() => {
    if (!open || matches.length === 0) return;
    const update = () => {
      const wrap = anchorRef.current?.parentElement;
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, matches]);

  // Tashqariga bosilganda yopiladi (input va dropdownning o'zi bundan mustasno).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const wrap = anchorRef.current?.parentElement;
      const target = e.target as Node;
      if (wrap?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (m: ProductSimilar) => {
    skipNext.current = true;
    onSelect?.(m.name);
    setOpen(false);
  };

  const showList = open && matches.length > 0 && pos;

  return (
    <span ref={anchorRef} style={{ position: "absolute", width: 0, height: 0 }}>
      {showList && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 1000,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            maxHeight: 240, overflowY: "auto",
          }}
        >
          <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--text3)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)" }}>
            {t("Mavjud mahsulotlar")}
          </div>
          {matches.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 10px", background: "transparent", border: "none",
                borderBottom: "1px solid var(--border)", cursor: "pointer",
                textAlign: "left", fontSize: 12, color: "var(--text1)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-dim)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }} title={`${m.name} · ${m.invoiceNumber}`}>
                {m.name}
              </span>
              <span style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>{m.invoiceNumber}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </span>
  );
}
