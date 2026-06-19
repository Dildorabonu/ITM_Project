"use client";

import { useEffect, useState } from "react";
import {
  stockMovementService,
  stockMovementSign,
  STOCK_MOVEMENT_COLOR,
  STOCK_MOVEMENT_DIM,
  type StockMovement,
} from "@/lib/stockMovements";

interface Props {
  requisitionId: string;
}

function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 16);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

function directionLabel(m: StockMovement): string | null {
  if (m.sourceDepartmentName && m.targetDepartmentName)
    return `${m.sourceDepartmentName} → ${m.targetDepartmentName}`;
  if (m.targetDepartmentName) return `→ ${m.targetDepartmentName}`;
  if (m.sourceDepartmentName) return `${m.sourceDepartmentName} →`;
  return null;
}

// Talabnomaning ombor harakatlari izi (audit trail): rezerv → omborga kirim →
// bo'limga ko'chirish ketma-ketligi. requisitionId bo'yicha StockMovementlarni oladi.
// Harakat bo'lmasa umuman ko'rsatilmaydi (talabnomaning erta bosqichlari uchun).
export function RequisitionMovements({ requisitionId }: Props) {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Backend CreatedAt DESC qaytaradi — audit izi uchun xronologik (ASC) ko'rsatamiz.
        const data = await stockMovementService.get({ requisitionId, pageSize: 200 });
        if (!cancelled) setItems([...data.items].reverse());
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requisitionId]);

  // Yuklanayotgan bo'lsa ham, bo'sh bo'lsa ham — kartani ko'rsatmaymiz (clutter kamaytirish).
  if (loading || items.length === 0) return null;

  return (
    <div className="itm-card" style={{ padding: 22 }}>
      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 16 }}>
        Ombor harakatlari izi ({items.length})
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((m, i) => {
            const color = STOCK_MOVEMENT_COLOR[m.type];
            const dim = STOCK_MOVEMENT_DIM[m.type];
            const sign = stockMovementSign(m.type);
            const dir = directionLabel(m);
            return (
              <div key={m.id} className={`nd-fadein-${Math.min(i, 4)}`} style={{ position: "relative", paddingLeft: 30, paddingBottom: i === items.length - 1 ? 0 : 18 }}>
                <div style={{
                  position: "absolute", left: 0, top: 3, width: 14, height: 14, borderRadius: "50%",
                  background: dim, border: `2px solid ${color}`, boxShadow: "0 0 0 3px var(--bg2)",
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 9px", borderRadius: 999, background: dim, color,
                    fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                    {m.typeLabel}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text1)", fontWeight: 500 }}>{m.productName}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>{sign}{m.quantity}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    qoldiq: <span style={{ color: "var(--text1)", fontWeight: 600 }}>{m.quantityAfter}</span>
                  </span>
                </div>
                {dir && (
                  <div style={{ fontSize: 12.5, color: "var(--text2)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>{dir}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "var(--text3)" }}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{formatDateTime(m.createdAt)}</span>
                  <span>·</span>
                  <span>{m.userFullName || "—"}</span>
                </div>
                {m.notes && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text2)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
