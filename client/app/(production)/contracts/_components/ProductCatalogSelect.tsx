"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  productCatalogService,
  type ProductCatalogResponse,
} from "@/lib/userService";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

export interface ProductCatalogSelection {
  productCatalogId: string | null;
  productCode: string | null;
  productType: string;
  unit?: string | null;
}

interface Props {
  productType: string;
  productCode: string | null;
  hasError?: boolean;
  canCreate?: boolean;
  // Faqat productType (erkin matn) o'zgarganda — hali katalog tanlanmagan.
  onType: (value: string) => void;
  // Katalogdan tanlanganda yoki yangi mahsulot yaratilganda.
  onSelect: (selection: ProductCatalogSelection) => void;
}

// Kanonik taqqoslash — ProductCatalogSelect ichida "aniq moslik bormi?" tekshiruvi uchun
// (backend TextNormalizer bilan bir xil g'oya: registr/probel farqini e'tiborsiz qoldiradi).
const canon = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function ProductCatalogSelect({
  productType, productCode, hasError, canCreate = true, onType, onSelect,
}: Props) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductCatalogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Tashqariga bosilganda yopish.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Debounce qidiruv.
  useEffect(() => {
    if (!open) return;
    const term = productType.trim();
    const ctrl = new AbortController();
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const paged = await productCatalogService.search(term || undefined, 1, 20, ctrl.signal);
        setResults(paged.items ?? []);
      } catch {
        // AbortError yoki tarmoq xatosi — jim o'tkazamiz.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [productType, open]);

  const term = productType.trim();
  const exactMatch = useMemo(
    () => results.some(r => canon(r.name) === canon(term)),
    [results, term],
  );
  const showCreate = canCreate && term.length > 0 && !exactMatch && !loading;

  const pick = (r: ProductCatalogResponse) => {
    onSelect({ productCatalogId: r.id, productCode: r.code, productType: r.name, unit: r.unit });
    setOpen(false);
  };

  const createNew = async () => {
    if (!term || creating) return;
    setCreating(true);
    try {
      const created = await productCatalogService.quickCreate({ name: term });
      onSelect({ productCatalogId: created.id, productCode: created.code, productType: created.name, unit: created.unit });
      showToast(`${t("Mahsulot katalogga qo'shildi")}: ${created.code}`);
      setOpen(false);
    } catch {
      showToast(t("Mahsulotni yaratib bo'lmadi"), "Xatolik");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          className="form-input"
          value={productType}
          onChange={e => { onType(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("Mahsulot nomini yozing yoki tanlang...")}
          style={{
            ...(hasError ? { borderColor: "var(--danger)" } : {}),
            paddingRight: productCode ? 78 : undefined,
          }}
        />
        {productCode && (
          <span style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
            padding: "2px 6px", borderRadius: 5,
            background: "var(--accent-dim)", color: "var(--accent)",
            pointerEvents: "none", letterSpacing: 0.3,
          }}>
            {productCode}
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          maxHeight: 240, overflowY: "auto", padding: 4,
          animation: "panel-appear 0.16s ease",
        }}>
          {loading && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text3)" }}>
              {t("Qidirilmoqda...")}
            </div>
          )}

          {!loading && results.map(r => (
            <button
              key={r.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(r)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, padding: "8px 10px", background: "transparent", border: "none",
                borderRadius: 6, cursor: "pointer", textAlign: "left",
                color: "var(--text)", fontSize: 13,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
                {r.unit && <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: 6 }}>· {r.unit}</span>}
              </span>
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                padding: "2px 6px", borderRadius: 5, background: "var(--bg3)", color: "var(--text3)",
              }}>
                {r.code}
              </span>
            </button>
          ))}

          {!loading && results.length === 0 && !showCreate && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text3)" }}>
              {t("Mahsulot topilmadi")}
            </div>
          )}

          {showCreate && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={createNew}
              disabled={creating}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "9px 10px", marginTop: results.length ? 4 : 0,
                borderTop: results.length ? "1px solid var(--border)" : "none",
                borderRight: "none", borderBottom: "none", borderLeft: "none",
                background: "transparent", borderRadius: 6,
                cursor: creating ? "default" : "pointer", textAlign: "left",
                color: "var(--accent)", fontSize: 13, fontWeight: 600,
              }}
              onMouseEnter={e => { if (!creating) e.currentTarget.style.background = "var(--accent-dim)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              {creating
                ? t("Yaratilmoqda...")
                : <span>«{term}» {t("— yangi mahsulot yaratish")}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
