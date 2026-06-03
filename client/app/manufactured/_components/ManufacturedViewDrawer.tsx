"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ManufacturingStatus,
  PRODUCT_UNIT_LABELS,
  type ManufacturedProductResponse,
} from "@/lib/userService";
import { shipmentBatchService, type ShipmentBatch } from "@/lib/shipments";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";

interface Props {
  product: ManufacturedProductResponse;
  onClose: () => void;
}

// Tayyor mahsulot tafsilotlari va unga tegishli jo'natma partiyalarini ko'rsatadigan drawer.
export function ManufacturedViewDrawer({ product, onClose }: Props) {
  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    if (product.contractId) {
      shipmentBatchService
        .getByContract(product.contractId, product.contractProductId ?? undefined)
        .then(list => { if (!ignore) setBatches(list); })
        .catch(() => { if (!ignore) setBatches([]); });
    } else {
      setBatches([]);
    }
    return () => { ignore = true; };
  }, [product]);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          padding: "28px 28px 32px", overflowY: "auto",
          animation: "panel-appear 0.28s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Mahsulot tafsilotlari</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ gridColumn: "1 / -1", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Mahsulot nomi</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{product.name}</div>
            {product.code && (
              <div style={{ marginTop: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                Kod: {product.code}
              </div>
            )}
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Sex / Bo&apos;lim</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{product.departmentName}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holati</div>
            <div style={{ marginTop: 4 }}><StatusBadge status={product.status} /></div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Miqdor</div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Bajarilgani</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text1)" }}>
                {product.producedQuantity} / {product.quantity} {PRODUCT_UNIT_LABELS[product.unit] ?? ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Foiz</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: product.status === ManufacturingStatus.Completed ? "var(--success)" : "var(--accent)" }}>
                {product.quantity > 0 ? Math.min(100, Math.round((product.producedQuantity / product.quantity) * 100)) : 0}%
              </div>
            </div>
          </div>
          <ProgressBar produced={product.producedQuantity} total={product.quantity} />
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Bog&apos;liq ma&apos;lumotlar</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: product.contractNo ? "var(--text1)" : "var(--text3)", fontFamily: "var(--font-mono)" }}>
              {product.contractNo ?? "—"}
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratilgan sana</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>
              {(() => { const d = product.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0]}` : "—"; })()}
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlangan</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: product.startedAt ? "var(--text1)" : "var(--text3)" }}>
              {product.startedAt ? new Date(product.startedAt).toLocaleDateString("uz-UZ") : "—"}
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugallangan</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: product.completedAt ? "var(--success)" : "var(--text3)" }}>
              {product.completedAt ? new Date(product.completedAt).toLocaleDateString("uz-UZ") : "—"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>
          Partiyalar
          {batches.length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--text3)", fontWeight: 500 }}>
              ({batches.length} ta jo&apos;natma &mdash; jami{" "}
              {batches.reduce((s, b) => s + b.amount, 0).toLocaleString()}{" "}
              {PRODUCT_UNIT_LABELS[product.unit] ?? ""})
            </span>
          )}
        </div>
        <div style={{ marginBottom: 22 }}>
          {!product.contractId ? (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", fontSize: 13, color: "var(--text3)" }}>
              Mahsulot shartnomaga bog&apos;lanmagan &mdash; partiyalar mavjud emas.
            </div>
          ) : batches.length === 0 ? (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", fontSize: 13, color: "var(--text3)" }}>
              Hali jo&apos;natma yo&apos;q. Vazifalardan partiya yuborilganida bu yerda ko&apos;rinadi.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {[...batches].sort((a, b) => b.batchNo - a.batchNo).map(b => {
                const isExpanded = expandedBatchId === b.id;
                const hasDetails = !!(b.createdByFullName || b.departmentName);
                return (
                  <div
                    key={b.id}
                    onClick={() => hasDetails && setExpandedBatchId(isExpanded ? null : b.id)}
                    style={{
                      display: "flex", flexDirection: "column", gap: 8,
                      padding: "10px 14px", borderRadius: "var(--radius)",
                      background: "var(--surface2, var(--bg3))",
                      border: `1px solid ${isExpanded ? "var(--accent)" : "var(--accent-mid)"}`,
                      fontSize: 13,
                      cursor: hasDetails ? "pointer" : "default",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 32, height: 22, padding: "0 8px",
                        borderRadius: 6, background: "var(--accent)", color: "#fff",
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>
                        #{b.batchNo}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                        {b.amount.toLocaleString()}{" "}
                        <span style={{ color: "var(--text3)", fontWeight: 500, fontSize: 11 }}>
                          {PRODUCT_UNIT_LABELS[product.unit] ?? ""}
                        </span>
                      </span>
                      <span style={{ marginLeft: "auto", color: "var(--text3)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                        {new Date(b.createdAt).toLocaleString("uz-UZ", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {hasDetails && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: "transform 0.2s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </div>
                    {isExpanded && hasDetails && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 14,
                        paddingTop: 8, borderTop: "1px solid var(--accent-mid)",
                        fontSize: 12,
                      }}>
                        {b.createdByFullName && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span style={{ color: "var(--text3)" }}>Yuboruvchi:</span>
                            <span style={{ color: "var(--text1)", fontWeight: 600 }}>{b.createdByFullName}</span>
                          </div>
                        )}
                        {b.departmentName && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18" />
                              <path d="M5 21V7l8-4v18" />
                              <path d="M19 21V11l-6-4" />
                            </svg>
                            <span style={{ color: "var(--text3)" }}>Bo&apos;lim:</span>
                            <span style={{ color: "var(--text1)", fontWeight: 600 }}>{b.departmentName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(product.description || product.notes) && (
          <>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Qo&apos;shimcha</div>
            {product.description && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Tavsif</div>
                <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{product.description}</div>
              </div>
            )}
            {product.notes && (
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Izoh</div>
                <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{product.notes}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
