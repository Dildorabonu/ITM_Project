"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DepartmentType,
  contractService,
  CONTRACT_PRODUCT_STATUS_LABELS,
  type ContractResponse,
  type AttachmentResponse,
  type ContractUserResponse,
  type ContractProductResponse,
} from "@/lib/userService";
import { PRODUCT_STATUS_STYLE } from "../_types";
import { StatusBadge, ContractTypeBadge } from "./StatusBadge";
import { WorkflowDiagram } from "./WorkflowDiagram";
import { fmt } from "./DatePickerField";

function ProductStatusBadge({ status }: { status: ContractProductResponse["status"] }) {
  const s = PRODUCT_STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>
      {CONTRACT_PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

const ROLE_STYLE: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "Ma'sul xodimlar", color: "#c2410c", bg: "#fff7ed", border: "#fdba7466" },
  1: { label: "Ma'lumot uchun",  color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd66" },
  2: { label: "Kuzatuvchilar",   color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd66" },
};

interface Props {
  viewContract: ContractResponse;
  onClose: () => void;
  drawerFiles: AttachmentResponse[];
  drawerTzFiles: AttachmentResponse[];
  drawerUsers: ContractUserResponse[];
  filesLoading: boolean;
  tzFilesLoading: boolean;
  usersLoading: boolean;
}

export function ContractDrawer({
  viewContract, onClose,
  drawerFiles, drawerTzFiles, drawerUsers,
  filesLoading, tzFilesLoading, usersLoading,
}: Props) {
  // Per-product TZ files: { productId -> AttachmentResponse[] }
  const [productTzFiles, setProductTzFiles] = useState<Record<string, AttachmentResponse[]>>({});
  const [productTzLoading, setProductTzLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProductTzLoading(true);
    const products = viewContract.products ?? [];
    if (products.length === 0) {
      setProductTzFiles({});
      setProductTzLoading(false);
      return;
    }
    Promise.all(products.map(p =>
      contractService.getProductTzFiles(viewContract.id, p.id).then(files => [p.id, files] as const).catch(() => [p.id, []] as const)
    )).then(pairs => {
      if (cancelled) return;
      setProductTzFiles(Object.fromEntries(pairs));
    }).finally(() => {
      if (!cancelled) setProductTzLoading(false);
    });
    return () => { cancelled = true; };
  }, [viewContract.id, viewContract.products]);

  const hasProductLevelData = (viewContract.products ?? []).some(p =>
    (p.departments?.length ?? 0) > 0 || (p.assignedUsers?.length ?? 0) > 0,
  );

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 800, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          padding: "28px 28px 32px", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "sticky", top: 0, background: "var(--bg2)", zIndex: 10, paddingBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Shartnoma tafsilotlari</span>
          <button onClick={onClose}
            style={{ background: "none", border: "1.5px solid var(--danger)", cursor: "pointer", color: "var(--danger)", fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: "var(--radius)", transition: "background 0.14s, transform 0.14s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}>✕</button>
        </div>

        <WorkflowDiagram status={viewContract.status} products={viewContract.products} />

        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma raqami</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "var(--font-inter)", wordBreak: "break-all", overflowWrap: "break-word" }}>{viewContract.contractNo}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holat</div>
            <StatusBadge status={viewContract.status} products={viewContract.products} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma turi</div>
            <ContractTypeBadge contractType={viewContract.contractType} />
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlanish sanasi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.startDate)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugash sanasi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.endDate)}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratuvchi</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{viewContract.createdByFullName ?? "—"}</div>
          </div>
          {viewContract.contractParty && (
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma tuzilgan tomon</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", wordBreak: "break-word" }}>{viewContract.contractParty}</div>
            </div>
          )}
        </div>

        {/* ── Mahsulotlar (har biri o'z bo'lim/xodim/TZ bilan) ── */}
        {viewContract.products && viewContract.products.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Mahsulotlar ({viewContract.products.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {viewContract.products.map((p, i) => {
                const tzFiles = productTzFiles[p.id] ?? [];
                return (
                  <div key={p.id} style={{
                    border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden",
                    background: "var(--bg2)",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px", background: "var(--bg3)",
                      borderBottom: "1.5px solid var(--border)",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: "var(--accent)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.productType || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
                          {p.quantity != null ? p.quantity.toLocaleString() : "—"} {p.unit}
                        </div>
                      </div>
                      <ProductStatusBadge status={p.status} />
                    </div>

                    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Bo'limlar */}
                      {p.departments && p.departments.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Bo&apos;limlar</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {p.departments.map(d => {
                              const ts = TYPE_STYLE[d.type as DepartmentType];
                              return (
                                <span key={d.id} style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                                  background: ts?.bg ?? "var(--bg3)", color: ts?.color ?? "var(--text1)",
                                  border: `1px solid ${ts?.border ?? "var(--border)"}`,
                                }}>
                                  {ts?.icon} {d.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Xodimlar (rol bo'yicha) */}
                      {p.assignedUsers && p.assignedUsers.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[0, 1, 2].map(role => {
                            const group = p.assignedUsers.filter(u => u.role === role);
                            if (group.length === 0) return null;
                            const style = ROLE_STYLE[role];
                            return (
                              <div key={role}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: style.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{style.label}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {group.map(u => (
                                    <div key={u.userId} style={{
                                      display: "inline-flex", alignItems: "center", gap: 6,
                                      border: `1.5px solid ${style.border}`, borderRadius: 16,
                                      padding: "3px 10px 3px 4px", background: style.bg, fontSize: 12, color: style.color,
                                    }}>
                                      <span style={{
                                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                                        background: style.color, display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700, color: "#fff",
                                      }}>
                                        {u.fullName.charAt(0).toUpperCase()}
                                      </span>
                                      <span style={{ fontWeight: 600 }}>{u.fullName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* TZ fayllari */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Texnik topshiriq (TZ)</div>
                        {productTzLoading ? (
                          <div style={{ fontSize: 12, color: "var(--text3)" }}>Yuklanmoqda...</div>
                        ) : tzFiles.length === 0 ? (
                          <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>TZ yuklanmagan</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {tzFiles.map(f => (
                              <div key={f.id} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6,
                                background: "var(--bg3)",
                              }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                                </div>
                                <button title="Yuklab olish" onClick={() => contractService.downloadProductTzFile(viewContract.id, p.id, f.id, f.fileName)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 3, flexShrink: 0 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {p.notes && (
                        <div style={{ fontSize: 12, color: "var(--text2)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                          {p.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewContract.notes && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
            <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewContract.notes}</div>
          </div>
        )}

        {/* ── Legacy: contract-level departments (faqat eski shartnomalar uchun) ── */}
        {!hasProductLevelData && viewContract.departments?.length > 0 && (
          <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginBottom: 22 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Bo&apos;limlar</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {viewContract.departments.map(d => {
                const ts = TYPE_STYLE[d.type as DepartmentType];
                return (
                  <span key={d.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: ts?.bg ?? "var(--bg3)", color: ts?.color ?? "var(--text1)",
                    border: `1px solid ${ts?.border ?? "var(--border)"}`,
                  }}>
                    {ts?.icon} {d.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Legacy: contract-level users (faqat eski shartnomalar uchun) ── */}
        {!hasProductLevelData && (
          <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4, marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Mas&apos;ul xodimlar</div>

            {usersLoading ? (
              <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>Yuklanmoqda...</div>
            ) : drawerUsers.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "14px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                Hali xodim biriktirilmagan
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[0, 1, 2].map(role => {
                  const group = drawerUsers.filter(u => u.role === role);
                  if (group.length === 0) return null;
                  const style = ROLE_STYLE[role];
                  return (
                    <div key={role}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: style.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{style.label}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {group.map(u => (
                          <div key={u.userId} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            border: `1.5px solid ${style.border}`, borderRadius: 8,
                            padding: "9px 12px", background: "var(--bg2)",
                          }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                              background: style.color, display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, color: "#fff",
                            }}>
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fullName}</div>
                              {u.departmentName && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{u.departmentName}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Hujjatlar (kontrakt darajasidagi) ── */}
        <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Shartnoma fayllari</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {filesLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
              ) : drawerFiles.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>Fayl yuklanmagan</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {drawerFiles.map((f, i) => (
                    <div key={f.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                      </div>
                      <button title="Yuklab olish" onClick={() => contractService.downloadFile(viewContract.id, f.id, f.fileName)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legacy: contract-level TZ files (eski shartnomalar uchun) */}
            {(tzFilesLoading || drawerTzFiles.length > 0) && (
              <div style={{ border: "1.5px solid var(--accent-mid)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--accent-dim)", borderBottom: drawerTzFiles.length > 0 ? "1.5px solid var(--accent-mid)" : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)" }}>
                    Eski TZ fayllar <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>(legacy, kontrakt darajasida)</span>
                  </span>
                </div>
                {tzFilesLoading ? (
                  <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {drawerTzFiles.map((f, i) => (
                      <div key={f.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--accent-mid)" : "none",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                        </div>
                        <button title="Yuklab olish" onClick={() => contractService.downloadTzFile(viewContract.id, f.id, f.fileName)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  , document.body);
}
