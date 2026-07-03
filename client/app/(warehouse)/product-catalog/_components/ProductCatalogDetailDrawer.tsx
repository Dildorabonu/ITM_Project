"use client";

import { useEffect, useState } from "react";
import {
  productCatalogService,
  ContractProductStatus,
  ContractType,
  CONTRACT_PRODUCT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type ProductCatalogDetail,
  type ProductCatalogContractUsage,
} from "@/lib/userService";
import { useT } from "@/lib/i18n";

// Har bir mahsulot bosqichiga tema tokenlaridan rang — dark/light ikkalasida ham ishlaydi.
const STATUS_STYLE: Record<ContractProductStatus, { color: string; dim: string }> = {
  [ContractProductStatus.DrawingPending]: { color: "var(--purple)", dim: "var(--purple-dim)" },
  [ContractProductStatus.TechProcessing]: { color: "var(--warn)", dim: "var(--warn-dim)" },
  [ContractProductStatus.InProduction]:   { color: "var(--accent)", dim: "var(--accent-dim)" },
  [ContractProductStatus.Completed]:      { color: "var(--success)", dim: "var(--success-dim)" },
  [ContractProductStatus.Cancelled]:      { color: "var(--danger)", dim: "var(--danger-dim)" },
};

// Raqamni ozoda ko'rsatish — ortiqcha nol kasrlarni olib tashlaydi (12.00 → 12).
const fmt = (n: number) =>
  Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export function ProductCatalogDetailDrawer({ productId, productName, onClose }: Props) {
  const t = useT();
  const [data, setData] = useState<ProductCatalogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError("");
        const d = await productCatalogService.getDetail(productId, controller.signal);
        setData(d);
      } catch (e) {
        if (controller.signal.aborted
            || (e as { code?: string })?.code === "ERR_CANCELED"
            || (e as { name?: string })?.name === "CanceledError") return;
        setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Escape bilan yopish + fon scroll qulfi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const unit = data?.unit ?? "";
  const ordered = data?.totalOrderedQuantity ?? 0;
  const produced = data?.totalProducedQuantity ?? 0;
  const producedPct = ordered > 0 ? Math.min(100, Math.round((produced / ordered) * 100)) : 0;

  // Donut uchun conic-gradient segmentlari.
  const totalStatus = data?.statusBreakdown.reduce((s, x) => s + x.count, 0) ?? 0;
  let acc = 0;
  const donutStops = (data?.statusBreakdown ?? []).map(s => {
    const start = totalStatus ? (acc / totalStatus) * 360 : 0;
    acc += s.count;
    const end = totalStatus ? (acc / totalStatus) * 360 : 0;
    return `${STATUS_STYLE[s.status].color} ${start}deg ${end}deg`;
  });
  const donutBg = donutStops.length
    ? `conic-gradient(${donutStops.join(", ")})`
    : "var(--bg3)";

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 600, height: "100%", background: "var(--surface)",
        borderLeft: "1px solid var(--border)", boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column",
        animation: "drawer-slide-in 0.28s cubic-bezier(0.22,1,0.36,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          flexShrink: 0, background: "var(--bg2)",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 4,
            }}>
              {t("Mahsulot tahlili")}
            </div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: "var(--text1)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {data?.name ?? productName}
            </div>
            {data?.code && (
              <div style={{
                display: "inline-block", marginTop: 6, padding: "2px 8px",
                borderRadius: 6, background: "var(--accent-dim)", color: "var(--accent)",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
              }}>
                {data.code}
              </div>
            )}
          </div>
          <button className="btn-icon" onClick={onClose} title={t("Yopish")} style={{ width: 32, height: 32, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
          ) : data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Meta qatori */}
              {(data.description || data.unit) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--text2)" }}>
                  {data.unit && (
                    <span><b style={{ color: "var(--text3)", fontWeight: 600 }}>{t("O'lchov")}:</b> {t(data.unit)}</span>
                  )}
                  {data.description && (
                    <span style={{ color: "var(--text3)" }}>{data.description}</span>
                  )}
                </div>
              )}

              {/* Stat kartalar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <StatCard
                  label={t("Shartnomalarda")}
                  value={String(data.contractCount)}
                  hint={`${data.activeContractCount} ${t("ta faol")}`}
                  accent="var(--accent)"
                  icon="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                />
                <StatCard
                  label={t("Yakunlanganlar")}
                  value={String(data.completedProductCount)}
                  hint={`${data.contracts.length} ${t("tadan")}`}
                  accent="var(--success)"
                  icon="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3"
                />
                <StatCard
                  label={t("Jami buyurtma")}
                  value={`${fmt(ordered)}${unit ? " " + t(unit) : ""}`}
                  hint={t("shartnomalar bo'yicha")}
                  accent="var(--warn)"
                  icon="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01"
                />
                <StatCard
                  label={t("Ishlab chiqarilgan")}
                  value={`${fmt(produced)}${unit ? " " + t(unit) : ""}`}
                  hint={`${producedPct}% ${t("bajarildi")}`}
                  accent="var(--purple)"
                  icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                />
              </div>

              {/* Ishlab chiqarish jarayoni — ordered vs produced */}
              <div className="itm-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
                    {t("Ishlab chiqarish jarayoni")}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--purple)" }}>
                    {producedPct}%
                  </span>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: "var(--bg3)", overflow: "hidden" }}>
                  <div style={{
                    width: `${producedPct}%`, height: "100%", borderRadius: 999,
                    background: "linear-gradient(90deg, var(--purple), var(--accent))",
                    transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--text2)" }}>
                  <span><b style={{ color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{fmt(produced)}</b> {t("ishlab chiqarilgan")}</span>
                  <span><b style={{ color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{fmt(ordered)}</b> {t("buyurtma")}</span>
                </div>
              </div>

              {/* Holat taqsimoti — donut */}
              {totalStatus > 0 && (
                <div className="itm-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 14 }}>
                    {t("Bosqichlar bo'yicha taqsimot")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{
                      width: 108, height: 108, borderRadius: "50%", flexShrink: 0,
                      background: donutBg, position: "relative",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{
                        width: 68, height: 68, borderRadius: "50%", background: "var(--surface)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--text1)", lineHeight: 1 }}>{totalStatus}</span>
                        <span style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{t("jami")}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.statusBreakdown.map(s => (
                        <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_STYLE[s.status].color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t(CONTRACT_PRODUCT_STATUS_LABELS[s.status])}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text1)" }}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Bog'langan shartnomalar */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 10 }}>
                  {t("Bog'langan shartnomalar")} ({data.contracts.length})
                </div>
                {data.contracts.length === 0 ? (
                  <div style={{
                    padding: "28px 20px", textAlign: "center", color: "var(--text3)",
                    fontSize: 13, background: "var(--bg3)", borderRadius: "var(--radius)",
                    border: "1px dashed var(--border)",
                  }}>
                    {t("Bu mahsulot hali birorta shartnomada ishlatilmagan.")}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.contracts.map((c, i) => (
                      <ContractRow key={c.contractProductId} c={c} index={i} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes drawer-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Stat karta ─────────────────────────────────────────────────────────────
function StatCard({ label, value, hint, accent, icon }: {
  label: string; value: string; hint: string; accent: string; icon: string;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: 14, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 12, right: 12, opacity: 0.18 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text1)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: accent, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

// ─── Shartnoma qatori ───────────────────────────────────────────────────────
function ContractRow({ c, index }: { c: ProductCatalogContractUsage; index: number }) {
  const t = useT();
  const s = STATUS_STYLE[c.productStatus];
  const pct = c.quantity > 0 ? Math.min(100, Math.round((c.producedQuantity / c.quantity) * 100)) : 0;
  const typeColor = c.contractType === ContractType.Tashqi ? "var(--accent)" : "var(--success)";

  return (
    <div
      className={`nd-fadein-${Math.min(index, 4)}`}
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 12,
        opacity: c.contractIsActive ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text1)" }}>
            {c.contractNo}
          </span>
          <span style={{
            padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600,
            background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor,
            border: `1px solid color-mix(in srgb, ${typeColor} 30%, transparent)`, whiteSpace: "nowrap",
          }}>
            {t(CONTRACT_TYPE_LABELS[c.contractType])}
          </span>
        </div>
        <span style={{
          padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          background: s.dim, color: s.color,
        }}>
          {t(CONTRACT_PRODUCT_STATUS_LABELS[c.productStatus])}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.contractParty}
      </div>

      {/* Mini progress: produced / quantity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--bg3)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: s.color, transition: "width 0.5s ease" }} />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>
          {fmt(c.producedQuantity)} / {fmt(c.quantity)} {t(c.unit)}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
        <span>{c.startDate} — {c.endDate}</span>
        {!c.contractIsActive && <span style={{ color: "var(--danger)" }}>{t("Nofaol")}</span>}
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
function DetailSkeleton() {
  const bar = (w: string, h = 14) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: "var(--surface2)" }} className="animate-pulse" />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ height: 84, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
        ))}
      </div>
      <div style={{ height: 96, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
      <div style={{ height: 140, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bar("40%", 12)}
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 92, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
        ))}
      </div>
    </div>
  );
}
