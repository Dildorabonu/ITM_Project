"use client";

import { useEffect, useState } from "react";
import { productService, type ProductSimilar } from "@/lib/userService";

// Yangi mahsulot nomi kiritilayotganda tanlangan bo'lim ichidan "o'xshash"
// mavjud mahsulotlarni topib, ogohlantirish ko'rsatadi. Bloklamaydi —
// foydalanuvchini bir xil mahsulotni qayta kiritib yuborishdan saqlaydi.
export function SimilarNameWarning({ name, departmentId }: { name: string; departmentId: string }) {
  const [matches, setMatches] = useState<ProductSimilar[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const term = name.trim();
    if (term.length < 2 || !departmentId) {
      setMatches([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await productService.findSimilar(term, departmentId);
        if (!active) return;
        // Aynan bir xil nom (faqat harf-katta-kichikligi farqi) — bu backend allaqachon
        // bloklaydigan holat, uni ro'yxatdan chiqarib tashlaymiz; qolgani "o'xshash".
        setMatches(res.filter(m => m.name.trim().toLowerCase() !== term.toLowerCase()));
        setExpanded(false);
      } catch {
        /* qidiruv xatosi — jim o'tkazib yuboramiz */
      }
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [name, departmentId]);

  if (matches.length === 0) return null;

  const top = matches[0];
  const rest = matches.slice(1);

  return (
    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: "var(--radius)", background: "var(--warn-dim)", border: "1px solid var(--warn)44", fontSize: 12, color: "var(--warn)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span style={{ fontWeight: 600, flexShrink: 0 }}>O&apos;xshash bor:</span>
        <span style={{ color: "var(--text1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={`${top.name} · ${top.invoiceNumber}`}>
          {top.name}
        </span>
        <span style={{ color: "var(--text3)", flexShrink: 0 }}>· {Math.round(top.similarity * 100)}%</span>
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{ marginLeft: "auto", flexShrink: 0, background: "transparent", border: "none", color: "var(--warn)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 2 }}
          >
            {expanded ? "Yopish" : `+${rest.length} ta yana`}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
      {expanded && rest.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--warn)22", display: "flex", flexDirection: "column", gap: 3 }}>
          {rest.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={`${m.name} · ${m.invoiceNumber}`}>
                {m.name}
              </span>
              <span style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{m.invoiceNumber}</span>
              <span style={{ color: "var(--text3)", marginLeft: "auto", flexShrink: 0 }}>{Math.round(m.similarity * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
