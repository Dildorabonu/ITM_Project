"use client";

import { useEffect, useMemo, useState } from "react";
import {
  productCatalogService,
  techProcessService,
  technicalDrawingService,
  costNormService,
  ContractProductStatus,
  ContractType,
  ProcessStatus,
  DrawingStatus,
  CONTRACT_PRODUCT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  DRAWING_STATUS_LABELS,
  type ProductCatalogDetail,
  type ProductCatalogContractUsage,
  type ProductCatalogResource,
  type ProductCatalogTask,
  type AttachmentResponse,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";

// Har bir mahsulot bosqichiga tema tokenlaridan rang — dark/light ikkalasida ham ishlaydi.
const STATUS_STYLE: Record<ContractProductStatus, { color: string; dim: string }> = {
  [ContractProductStatus.DrawingPending]: { color: "var(--purple)", dim: "var(--purple-dim)" },
  [ContractProductStatus.TechProcessing]: { color: "var(--warn)", dim: "var(--warn-dim)" },
  [ContractProductStatus.InProduction]:   { color: "var(--accent)", dim: "var(--accent-dim)" },
  [ContractProductStatus.Completed]:      { color: "var(--success)", dim: "var(--success-dim)" },
  [ContractProductStatus.Cancelled]:      { color: "var(--danger)", dim: "var(--danger-dim)" },
};

// Tex jarayon holati (ProcessStatus) → rang.
const PROCESS_COLOR: Record<ProcessStatus, string> = {
  [ProcessStatus.Pending]:    "var(--text3)",
  [ProcessStatus.InProgress]: "var(--accent)",
  [ProcessStatus.Approved]:   "var(--success)",
  [ProcessStatus.Rejected]:   "var(--danger)",
  [ProcessStatus.Completed]:  "var(--success)",
};

// Chizma va me'yoriy sarf holati (DrawingStatus) → rang.
const DRAWING_COLOR: Record<DrawingStatus, string> = {
  [DrawingStatus.Draft]:      "var(--text3)",
  [DrawingStatus.Approved]:   "var(--success)",
  [DrawingStatus.InProgress]: "var(--accent)",
};

// Resurs guruhlari — yorliq, ikonka va status talqini bir joyda.
type ResourceKind = "tech" | "drawing" | "norm";

const RESOURCE_META: Record<ResourceKind, {
  label: string; icon: string; accent: string;
  color: (s: number) => string; statusLabel: (s: number) => string;
  // `metaValue` ni ko'rsatiladigan matnga aylantiradi — tarjima uchun `t` beriladi.
  metaText?: (v: number, t: (s: string) => string) => string;
}> = {
  tech: {
    label: "Tex jarayon",
    icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    accent: "var(--warn)",
    color: s => PROCESS_COLOR[s as ProcessStatus] ?? "var(--text3)",
    statusLabel: s => PROCESS_STATUS_LABELS[s as ProcessStatus] ?? "",
    metaText: (v, t) => `${v}-${t("bosqich")}`,
  },
  drawing: {
    label: "Chizma",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h3",
    accent: "var(--purple)",
    color: s => DRAWING_COLOR[s as DrawingStatus] ?? "var(--text3)",
    statusLabel: s => DRAWING_STATUS_LABELS[s as DrawingStatus] ?? "",
  },
  norm: {
    label: "Me'yoriy sarf",
    icon: "M9 11H3v10h6V11z M15 3H9v18h6V3z M21 7h-6v14h6V7z",
    accent: "var(--accent)",
    color: s => DRAWING_COLOR[s as DrawingStatus] ?? "var(--text3)",
    statusLabel: s => DRAWING_STATUS_LABELS[s as DrawingStatus] ?? "",
    metaText: (v, t) => `${v} ${t("ta material")}`,
  },
};

const TASK_ICON = "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11";

// Har bir hujjat turining fayl endpointlari o'z modulining View ruxsatini talab qiladi —
// ProductCatalog.View yetarli emas, shuning uchun fayl bo'limi ruxsatga qarab ochiladi.
const FILE_API: Record<ResourceKind, {
  perm: string;
  getFiles: (id: string) => Promise<AttachmentResponse[]>;
  downloadFile: (id: string, fileId: string, fileName: string) => Promise<void>;
}> = {
  tech:    { perm: "TechProcess.View",       getFiles: techProcessService.getFiles,      downloadFile: techProcessService.downloadFile },
  drawing: { perm: "TechnicalDrawings.View", getFiles: technicalDrawingService.getFiles, downloadFile: technicalDrawingService.downloadFile },
  norm:    { perm: "CostNorm.View",          getFiles: costNormService.getFiles,         downloadFile: costNormService.downloadFile },
};

const fmtBytes = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB`
  : b >= 1024 ? `${Math.round(b / 1024)} KB`
  : `${b} B`;

// Raqamni ozoda ko'rsatish — ortiqcha nol kasrlarni olib tashlaydi (12.00 → 12).
const fmt = (n: number) =>
  Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const docCount = (c: ProductCatalogContractUsage) =>
  c.techProcesses.length + c.drawings.length + c.costNorms.length + c.tasks.length;

const producedPctOf = (c: ProductCatalogContractUsage) =>
  c.quantity > 0 ? Math.min(100, Math.round((c.producedQuantity / c.quantity) * 100)) : 0;

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
  // Shartnomalar oynasi: null — yopiq, string — tanlangan qator, "" — birinchisi tanlanadi.
  const [explorerCpId, setExplorerCpId] = useState<string | null>(null);

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

  // Escape bilan yopish + fon scroll qulfi. Shartnomalar oynasi ochiq bo'lsa avval o'sha yopiladi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (explorerCpId !== null) setExplorerCpId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, explorerCpId]);

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
    <>
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

              {/* Bog'langan shartnomalar — ixcham preview, bosilganda alohida oyna ochiladi */}
              <ContractsPreview
                contracts={data.contracts}
                onOpen={cpId => setExplorerCpId(cpId)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes drawer-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes explorer-pop {
          from { transform: scale(0.97) translateY(10px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>

    {explorerCpId !== null && data && (
      <ContractsExplorer
        productName={data.name}
        productCode={data.code}
        contracts={data.contracts}
        initialCpId={explorerCpId || null}
        onClose={() => setExplorerCpId(null)}
      />
    )}
    </>
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

// ─── Drawer ichidagi ixcham preview ─────────────────────────────────────────
// Faqat dastlabki bir nechta shartnoma bir qatordan ko'rsatiladi; qator yoki
// "Barchasini ko'rish" bosilganda hujjatlari bilan alohida oynada ochiladi.
const PREVIEW_COUNT = 4;

function ContractsPreview({ contracts, onOpen }: {
  contracts: ProductCatalogContractUsage[];
  onOpen: (cpId: string) => void;
}) {
  const t = useT();
  const shown = contracts.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, marginBottom: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
          {t("Bog'langan shartnomalar")}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text3)" }}>
          {contracts.length}
        </span>
      </div>

      {contracts.length === 0 ? (
        <div style={{
          padding: "28px 20px", textAlign: "center", color: "var(--text3)",
          fontSize: 13, background: "var(--bg3)", borderRadius: "var(--radius)",
          border: "1px dashed var(--border)",
        }}>
          {t("Bu mahsulot hali birorta shartnomada ishlatilmagan.")}
        </div>
      ) : (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", overflow: "hidden",
        }}>
          {shown.map((c, i) => {
            const s = STATUS_STYLE[c.productStatus];
            const docs = docCount(c);
            return (
              <div
                key={c.contractProductId}
                className={`nd-fadein-${Math.min(i, 4)}`}
                onClick={() => onOpen(c.contractProductId)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", cursor: "pointer",
                  // Oxirgi qatordan keyin tugma bo'lmasa, ajratuvchi chiziq ham kerak emas.
                  borderBottom: i === shown.length - 1 && contracts.length <= PREVIEW_COUNT
                    ? "none" : "1px solid var(--border)",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: "var(--text1)", flexShrink: 0 }}>
                  {c.contractNo}
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 12, color: "var(--text3)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {c.contractParty}
                </span>
                {/* Hujjatlar soni — nol bo'lsa ogohlantiruvchi rangda */}
                <span
                  title={t("Biriktirilgan hujjatlar")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                    padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: docs ? "var(--text2)" : "var(--warn)",
                    background: docs ? "var(--bg3)" : "var(--warn-dim)",
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {docs}
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                  whiteSpace: "nowrap", flexShrink: 0, background: s.dim, color: s.color,
                }}>
                  {t(CONTRACT_PRODUCT_STATUS_LABELS[c.productStatus])}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            );
          })}

          {/* Tugma faqat ro'yxatga sig'magan shartnomalar bo'lsa chiqadi —
              hammasi ko'rinib turganda ortiqcha (qator bosilsa o'zi ochiladi). */}
          {contracts.length > shown.length && (
            <button
              onClick={() => onOpen("")}
              style={{
                width: "100%", padding: "9px 12px", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 12, fontWeight: 600, color: "var(--accent)",
                background: "var(--accent-dim)", transition: "filter 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
            >
              {t("Barchasini ko'rish")}
              <span style={{ fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                (+{contracts.length - shown.length})
              </span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7 M7 7h10v10" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shartnomalar oynasi — chapda ro'yxat, o'ngda tanlanganning hujjatlari ──
function ContractsExplorer({ productName, productCode, contracts, initialCpId, onClose }: {
  productName: string;
  productCode: string;
  contracts: ProductCatalogContractUsage[];
  initialCpId: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ContractProductStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCpId ?? contracts[0]?.contractProductId ?? null,
  );

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => contracts.filter(c => {
      if (status !== "all" && c.productStatus !== status) return false;
      if (!query) return true;
      return c.contractNo.toLowerCase().includes(query)
          || c.contractParty.toLowerCase().includes(query);
    }),
    [contracts, status, query],
  );

  const selected = contracts.find(c => c.contractProductId === selectedId) ?? null;

  // Filtr uchun faqat haqiqatan mavjud bosqichlar chiqariladi.
  const statuses = [...new Set(contracts.map(c => c.productStatus))].sort((a, b) => a - b);

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        width: "min(980px, 96vw)", height: "min(700px, 92vh)",
        background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: "var(--radius2)", boxShadow: "var(--shadow2, 0 24px 80px rgba(0,0,0,0.5))",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "explorer-pop 0.26s cubic-bezier(0.22,1,0.36,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexShrink: 0, background: "var(--bg2)",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 3,
            }}>
              {t("Bog'langan shartnomalar")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{
                fontSize: 15, fontWeight: 700, color: "var(--text1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {productName}
              </span>
              <span style={{
                padding: "1px 7px", borderRadius: 6, flexShrink: 0,
                background: "var(--accent-dim)", color: "var(--accent)",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              }}>
                {productCode}
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title={t("Yopish")} style={{ width: 32, height: 32, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body: chap ro'yxat + o'ng tafsilot */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Chap panel */}
          <div style={{
            width: "min(320px, 42%)", flexShrink: 0, borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg2)",
          }}>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
                     strokeWidth="2" strokeLinecap="round"
                     style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={t("Shartnoma raqami yoki kontragent…")}
                  style={{
                    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "7px 10px 7px 30px",
                    fontSize: 12, color: "var(--text1)", outline: "none",
                  }}
                />
              </div>
              {statuses.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  <FilterChip
                    label={t("Hammasi")} count={contracts.length}
                    color="var(--text2)" active={status === "all"}
                    onClick={() => setStatus("all")}
                  />
                  {statuses.map(st => (
                    <FilterChip
                      key={st}
                      label={t(CONTRACT_PRODUCT_STATUS_LABELS[st])}
                      count={contracts.filter(c => c.productStatus === st).length}
                      color={STATUS_STYLE[st].color}
                      active={status === st}
                      onClick={() => setStatus(st)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
              {filtered.length === 0 ? (
                <div style={{
                  padding: "22px 12px", textAlign: "center", color: "var(--text3)", fontSize: 12,
                }}>
                  {t("Filtrga mos shartnoma topilmadi.")}
                </div>
              ) : filtered.map(c => {
                const s = STATUS_STYLE[c.productStatus];
                const active = c.contractProductId === selectedId;
                const docs = docCount(c);
                return (
                  <div
                    key={c.contractProductId}
                    onClick={() => setSelectedId(c.contractProductId)}
                    style={{
                      padding: "8px 10px", borderRadius: "var(--radius)", cursor: "pointer",
                      marginBottom: 2, minWidth: 0,
                      background: active ? "var(--accent-dim)" : "transparent",
                      border: `1px solid ${active ? "var(--accent-mid)" : "transparent"}`,
                      opacity: c.contractIsActive ? 1 : 0.65,
                      transition: "background 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface2)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700,
                        color: "var(--text1)", flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.contractNo}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
                        color: producedPctOf(c) > 0 ? s.color : "var(--text3)", flexShrink: 0,
                      }}>
                        {producedPctOf(c)}%
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3, paddingLeft: 14 }}>
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 11, color: "var(--text3)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.contractParty}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                        color: docs ? "var(--text3)" : "var(--warn)",
                      }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {docs}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* O'ng panel — tanlangan shartnoma tafsiloti */}
          <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
            {selected ? (
              <ContractDetailPane key={selected.contractProductId} c={selected} />
            ) : (
              <div style={{
                height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text3)", fontSize: 13,
              }}>
                {t("Shartnoma tanlang")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Holat filtri chipi ─────────────────────────────────────────────────────
function FilterChip({ label, count, color, active, onClick }: {
  label: string; count: number; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 999, cursor: "pointer",
        fontSize: 11, fontWeight: 600,
        color: active ? "#fff" : color,
        background: active ? color : `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        transition: "all 0.15s ease",
      }}
    >
      {label}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
        opacity: active ? 0.85 : 0.6,
      }}>
        {count}
      </span>
    </button>
  );
}

// ─── Tanlangan shartnoma tafsiloti ──────────────────────────────────────────
function ContractDetailPane({ c }: { c: ProductCatalogContractUsage }) {
  const t = useT();
  const s = STATUS_STYLE[c.productStatus];
  const pct = producedPctOf(c);
  const typeColor = c.contractType === ContractType.Tashqi ? "var(--accent)" : "var(--success)";

  return (
    <div className="nd-fadein-0" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Shartnoma sarlavhasi */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text1)" }}>
              {c.contractNo}
            </span>
            <span style={{
              padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600,
              background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor,
              border: `1px solid color-mix(in srgb, ${typeColor} 30%, transparent)`, whiteSpace: "nowrap",
            }}>
              {t(CONTRACT_TYPE_LABELS[c.contractType])}
            </span>
            {!c.contractIsActive && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--danger)" }}>{t("Nofaol")}</span>
            )}
          </div>
          <span style={{
            padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            whiteSpace: "nowrap", background: s.dim, color: s.color,
          }}>
            {t(CONTRACT_PRODUCT_STATUS_LABELS[c.productStatus])}
          </span>
        </div>

        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>
          {c.contractParty}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text3)", marginTop: 3 }}>
          {c.startDate} — {c.endDate}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1, height: 7, borderRadius: 999, background: "var(--bg3)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: s.color, transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text2)", flexShrink: 0 }}>
            {fmt(c.producedQuantity)} / {fmt(c.quantity)} {t(c.unit)}
          </span>
        </div>
      </div>

      {/* Hujjat bo'limlari */}
      <ResourceSection kind="tech"    items={c.techProcesses} />
      <ResourceSection kind="drawing" items={c.drawings} />
      <ResourceSection kind="norm"    items={c.costNorms} />
      <TaskSection tasks={c.tasks} />
    </div>
  );
}

// ─── Bo'lim sarlavhasi (ikonka + yorliq + soni) ─────────────────────────────
function SectionHeader({ icon, label, count, accent }: {
  icon: string; label: string; count: number; accent: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text2)" }}>
        {label}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
        padding: "0 6px", borderRadius: 999,
        color: count ? accent : "var(--text3)",
        background: count ? `color-mix(in srgb, ${accent} 12%, transparent)` : "var(--bg3)",
      }}>
        {count}
      </span>
    </div>
  );
}

// ─── Hujjat bo'limi: tex jarayon / chizma / me'yoriy sarf ───────────────────
function ResourceSection({ kind, items }: { kind: ResourceKind; items: ProductCatalogResource[] }) {
  const t = useT();
  const meta = RESOURCE_META[kind];

  return (
    <div>
      <SectionHeader icon={meta.icon} label={t(meta.label)} count={items.length} accent={meta.accent} />
      {items.length === 0 ? (
        <EmptyBox text={`${t(meta.label)} — ${t("hali biriktirilmagan")}`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map(res => <ResourceRow key={res.id} kind={kind} res={res} />)}
        </div>
      )}
    </div>
  );
}

// ─── Hujjat qatori — bosilganda biriktirilgan fayllari ochiladi ─────────────
function ResourceRow({ kind, res }: { kind: ResourceKind; res: ProductCatalogResource }) {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const meta = RESOURCE_META[kind];
  const api = FILE_API[kind];
  // Fayl endpointi o'z modulining View ruxsatini talab qiladi.
  const canFiles = hasPermission(api.perm);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<AttachmentResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  const color = meta.color(res.status);
  const metaText = res.metaValue != null && meta.metaText
    ? meta.metaText(res.metaValue, t)
    : null;

  // Birinchi ochilishda fayllar dangasa yuklanadi.
  const toggle = async () => {
    if (!canFiles) return;
    const next = !open;
    setOpen(next);
    if (!next || files !== null || loading) return;
    try {
      setLoading(true);
      setError(false);
      setFiles(await api.getFiles(res.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const download = async (f: AttachmentResponse) => {
    if (busyFileId) return;
    try {
      setBusyFileId(f.id);
      await api.downloadFile(res.id, f.id, f.fileName);
    } finally {
      setBusyFileId(null);
    }
  };

  return (
    <div style={{
      borderRadius: "var(--radius)",
      background: "var(--surface)", border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      <div
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px", cursor: canFiles ? "pointer" : "default",
          transition: "background 0.12s ease",
        }}
        onMouseEnter={e => { if (canFiles) e.currentTarget.style.background = "var(--surface2)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {res.title}
        </span>
        {metaText && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text3)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {metaText}
          </span>
        )}
        <span style={{
          padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
          flexShrink: 0, color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
        }}>
          {t(meta.statusLabel(res.status))}
        </span>
        {canFiles && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.18s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      {open && (
        <div style={{
          borderTop: "1px solid var(--border)", background: "var(--bg3)",
          padding: 6, display: "flex", flexDirection: "column", gap: 4,
        }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ height: 30, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, color: "var(--danger)" }}>
              {t("Ma'lumotlarni yuklashda xatolik yuz berdi.")}
            </div>
          ) : !files?.length ? (
            <div style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, color: "var(--text3)" }}>
              {t("Fayl biriktirilmagan.")}
            </div>
          ) : files.map(f => (
            <div key={f.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 8px", borderRadius: "var(--radius)",
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--text1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {f.fileName}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text3)", flexShrink: 0 }}>
                {fmtBytes(f.fileSize)}
              </span>
              <button
                onClick={() => download(f)}
                title={t("Yuklab olish")}
                disabled={busyFileId !== null}
                style={{
                  width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: "none",
                  cursor: busyFileId ? "default" : "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", background: "var(--accent-dim)",
                  opacity: busyFileId && busyFileId !== f.id ? 0.5 : 1,
                }}
              >
                {busyFileId === f.id ? (
                  <span className="nd-spinner" style={{ width: 11, height: 11, borderWidth: 2 }} />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vazifalar bo'limi ──────────────────────────────────────────────────────
function TaskSection({ tasks }: { tasks: ProductCatalogTask[] }) {
  const t = useT();

  return (
    <div>
      <SectionHeader icon={TASK_ICON} label={t("Vazifalar")} count={tasks.length} accent="var(--success)" />
      {tasks.length === 0 ? (
        <EmptyBox text={`${t("Vazifalar")} — ${t("hali biriktirilmagan")}`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {tasks.map(task => {
            const pct = task.totalAmount > 0
              ? Math.min(100, Math.round((task.completedAmount / task.totalAmount) * 100))
              : 0;
            const color = pct >= 100 ? "var(--success)" : pct > 0 ? "var(--accent)" : "var(--text3)";
            return (
              <div key={task.id} style={{
                padding: "7px 10px", borderRadius: "var(--radius)",
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--text3)",
                    minWidth: 16, flexShrink: 0,
                  }}>
                    {task.orderNo}
                  </span>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {task.name}
                  </span>
                  {/* Muhimlilik — vazifaning umumiy 100% ichidagi ulushi */}
                  <span
                    title={t("Muhimlilik")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                      padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                      color: "var(--purple)", background: "var(--purple-dim)",
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(task.importance)}%</span>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--bg3)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.4s ease" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text3)", flexShrink: 0 }}>
                    {fmt(task.completedAmount)} / {fmt(task.totalAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Bo'sh bo'lim plashkasi ─────────────────────────────────────────────────
function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{
      padding: "12px 10px", textAlign: "center", fontSize: 11, color: "var(--text3)",
      background: "var(--bg3)", borderRadius: "var(--radius)", border: "1px dashed var(--border)",
    }}>
      {text}
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
          <div key={i} style={{ height: 44, borderRadius: "var(--radius)", background: "var(--surface2)" }} className="animate-pulse" />
        ))}
      </div>
    </div>
  );
}
