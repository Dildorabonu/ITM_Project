"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  stockMovementService,
  stockMovementSign,
  STOCK_MOVEMENT_COLOR,
  STOCK_MOVEMENT_DIM,
  type StockMovement,
} from "@/lib/stockMovements";
import { useT } from "@/lib/i18n";
import { RequisitionNo } from "@/app/_components/RequisitionNo";

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

// Sanani "DD-MM-YY · HH:mm" ko'rinishida — mahsulot draweridagi formatga mos.
function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 16);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

// Bitta harakat qatorining maqsad/manba bo'limini "→ bo'lim" ko'rinishida tasvirlaydi.
function directionLabel(m: StockMovement): string | null {
  if (m.sourceDepartmentName && m.targetDepartmentName)
    return `${m.sourceDepartmentName} → ${m.targetDepartmentName}`;
  if (m.targetDepartmentName) return `→ ${m.targetDepartmentName}`;
  if (m.sourceDepartmentName) return `${m.sourceDepartmentName} →`;
  return null;
}

// Qoldiq (QuantityAfter) vaqt bo'yicha chiziqli grafigi. Har nuqta = harakatdan keyingi
// qoldiq snapshot — qayta hisoblash shart emas. `items` backenddan DESC keladi,
// grafikni xronologik (ASC) chizamiz.
function QuantityChart({ items }: { items: StockMovement[] }) {
  const t = useT();
  const series = [...items].reverse(); // eng eskidan eng yangiga
  const W = 560, H = 132, padX = 8, padTop = 14, padBottom = 18;

  const values = series.map(m => m.quantityAfter);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const x = (i: number) => padX + (series.length === 1 ? innerW / 2 : (innerW * i) / (series.length - 1));
  const y = (v: number) => padTop + innerH - ((v - min) / range) * innerH;

  const linePts = series.map((m, i) => `${x(i)},${y(m.quantityAfter)}`).join(" ");
  const areaPts = `${padX},${padTop + innerH} ${linePts} ${padX + innerW},${padTop + innerH}`;

  return (
    <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", padding: "12px 12px 6px", marginBottom: 22, background: "var(--bg3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, padding: "0 4px" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>{t("Qoldiq dinamikasi")}</span>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          min <span style={{ color: "var(--text1)", fontWeight: 600 }}>{min}</span>
          {" · "}max <span style={{ color: "var(--text1)", fontWeight: 600 }}>{max}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="sm-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#sm-area)" />
        <polyline points={linePts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {series.map((m, i) => (
          <circle key={m.id} cx={x(i)} cy={y(m.quantityAfter)} r="3.2"
            fill={STOCK_MOVEMENT_COLOR[m.type]} stroke="var(--bg3)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
            <title>{`${m.typeLabel}: ${m.quantityAfter}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

// Mahsulot bo'yicha ombor harakatlari tarixini o'ng tomonda timeline ko'rinishida ochadi.
export function StockMovementDrawer({ productId, productName, onClose }: Props) {
  const t = useT();
  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await stockMovementService.get({ productId, pageSize: 200 });
        if (!cancelled) setItems(data.items);
      } catch {
        if (!cancelled) setError(t("Harakat tarixini yuklashda xatolik yuz berdi."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          animation: "panel-appear 0.28s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px 18px", borderBottom: "1.5px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 6 }}>
              {t("Harakat tarixi")}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={productName}>
              {productName}
            </div>
            {!loading && !error && (
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                {items.length} {t("ta yozuv")}
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--surface2)", flexShrink: 0, marginTop: 4 }} className="animate-pulse" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ height: 14, width: "45%", background: "var(--surface2)", borderRadius: 4 }} className="animate-pulse" />
                    <div style={{ height: 12, width: "70%", background: "var(--surface2)", borderRadius: 4 }} className="animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--danger)", fontSize: 14 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>∅</div>
              {t("Bu mahsulot uchun harakat yozuvi yo'q")}
            </div>
          ) : (
            <>
            {/* Qoldiq grafigi — kamida 2 nuqta bo'lsa */}
            {items.length >= 2 && <QuantityChart items={items} />}
            <div style={{ position: "relative" }}>
              {/* Vertical timeline line */}
              <div style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map((m, i) => {
                  const color = STOCK_MOVEMENT_COLOR[m.type];
                  const dim = STOCK_MOVEMENT_DIM[m.type];
                  const sign = stockMovementSign(m.type);
                  const dir = directionLabel(m);
                  return (
                    <div
                      key={m.id}
                      className={`nd-fadein-${Math.min(i, 4)}`}
                      style={{ position: "relative", paddingLeft: 30, paddingBottom: 18 }}
                    >
                      {/* Node dot */}
                      <div style={{
                        position: "absolute", left: 0, top: 4, width: 14, height: 14, borderRadius: "50%",
                        background: dim, border: `2px solid ${color}`, boxShadow: "0 0 0 3px var(--bg2)",
                      }} />

                      {/* Row 1: badge + quantity + remaining */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "2px 9px", borderRadius: 999, background: dim, color,
                          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                          {m.typeLabel}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>
                          {sign}{m.quantity}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                          {t("qoldiq:")} <span style={{ color: "var(--text1)", fontWeight: 600 }}>{m.quantityAfter}</span>
                        </span>
                      </div>

                      {/* Row 2: direction + material */}
                      {(dir || m.materialName) && (
                        <div style={{ fontSize: 13, color: "var(--text1)", marginBottom: 3 }}>
                          {dir && <span style={{ fontFamily: "var(--font-mono)" }}>{dir}</span>}
                          {dir && m.materialName && <span style={{ color: "var(--text3)" }}>{" · "}</span>}
                          {m.materialName && <span style={{ color: "var(--text2)" }}>{m.materialName}</span>}
                        </div>
                      )}

                      {/* Row 3: meta — date, user, requisition */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--text3)" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{formatDateTime(m.createdAt)}</span>
                        <span>·</span>
                        <span>{m.userFullName || "—"}</span>
                        {m.requisitionNo && (
                          <>
                            <span>·</span>
                            <RequisitionNo no={m.requisitionNo} style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }} />
                          </>
                        )}
                      </div>

                      {/* Row 4: notes */}
                      {m.notes && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text2)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {m.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
