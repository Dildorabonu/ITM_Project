"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  employeeService,
  ContractStatus,
  ContractProductStatus,
  CONTRACT_STATUS_LABELS,
  CONTRACT_PRODUCT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_USER_ROLE_LABELS,
  type EmployeeResponse,
  type UserContractInfo,
} from "@/lib/userService";
import { STATUS_STYLE, CONTRACT_TYPE_STYLE, PRODUCT_STATUS_STYLE } from "@/app/(production)/contracts/_types";
import { useT } from "@/lib/i18n";

const ROLE_STYLE: Record<number, { color: string; bg: string; border: string }> = {
  0: { color: "#c2410c", bg: "#fff7ed", border: "#fdba7466" },
  1: { color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd66" },
  2: { color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd66" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function isOngoing(c: UserContractInfo): boolean {
  return c.isActive && c.status !== ContractStatus.Completed && c.status !== ContractStatus.Cancelled;
}

interface Props {
  employee: EmployeeResponse;
  onClose: () => void;
}

export default function EmployeeContractsDrawer({ employee, onClose }: Props) {
  const t = useT();
  const [contracts, setContracts] = useState<UserContractInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    employeeService.getContracts(employee.id)
      .then(data => { if (!cancelled) setContracts(data); })
      .catch(() => { if (!cancelled) setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  const ongoingCount = contracts.filter(isOngoing).length;

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
          padding: "28px 28px 32px", overflowY: "auto",
          animation: "panel-appear 0.28s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>{t("Xodim shartnomalari")}</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
              {employee.firstName} {employee.lastName}
              {employee.departmentName && (
                <span style={{ color: "var(--text3)" }}> · {employee.departmentName}</span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "1.5px solid var(--danger)", cursor: "pointer", color: "var(--danger)", fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: "var(--radius)", transition: "background 0.14s, transform 0.14s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ textAlign: "center", color: "var(--danger)", padding: 40 }}>{error}</div>
        ) : (
          <>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t("Jami")}</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{contracts.length}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t("Hozir ishlayotgan")}</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: ongoingCount > 0 ? "var(--success)" : "var(--text1)", fontFamily: "var(--font-mono)" }}>{ongoingCount}</div>
              </div>
            </div>

            {contracts.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: 40, border: "1.5px dashed var(--border)", borderRadius: "var(--radius)" }}>
                {t("Bu xodim shartnomalarga biriktirilmagan")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {contracts.map((c, i) => {
                  const st = STATUS_STYLE[c.status];
                  const ty = CONTRACT_TYPE_STYLE[c.contractType];
                  const ongoing = isOngoing(c);
                  return (
                    <div key={c.contractId} className={`nd-fadein-${Math.min(i, 4)}`} style={{
                      border: "1.5px solid var(--border)", borderRadius: "var(--radius2)",
                      padding: "14px 16px", background: "var(--surface)",
                      opacity: ongoing ? 1 : 0.72,
                    }}>
                      {/* Top row: contract no + badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                          {c.contractNo}
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", padding: "1px 9px", borderRadius: 999,
                          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                        }}>
                          {t(CONTRACT_STATUS_LABELS[c.status])}
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", padding: "1px 9px", borderRadius: 999,
                          background: ty.bg, color: ty.color, border: `1px solid ${ty.border}`,
                          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                        }}>
                          {t(CONTRACT_TYPE_LABELS[c.contractType])}
                        </span>
                        {!c.isActive && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "1px 9px", borderRadius: 999,
                            background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid var(--danger)",
                            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          }}>
                            {t("Nofaol")}
                          </span>
                        )}
                      </div>

                      {/* Party + dates */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: c.contractRole !== null || c.products.length > 0 ? 10 : 0 }}>
                        <span style={{ fontSize: 13, color: "var(--text1)", fontWeight: 500 }}>{c.contractParty || "—"}</span>
                        <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                          {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                        </span>
                      </div>

                      {/* Contract-level role */}
                      {c.contractRole !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: c.products.length > 0 ? 10 : 0 }}>
                          <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {t("Shartnoma bo'yicha")}:
                          </span>
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "1px 9px", borderRadius: 999,
                            background: ROLE_STYLE[c.contractRole]?.bg, color: ROLE_STYLE[c.contractRole]?.color,
                            border: `1px solid ${ROLE_STYLE[c.contractRole]?.border}`,
                            fontSize: 11, fontWeight: 600,
                          }}>
                            {t(CONTRACT_USER_ROLE_LABELS[c.contractRole] ?? "")}
                          </span>
                        </div>
                      )}

                      {/* Product-level assignments */}
                      {c.products.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                            {t("Biriktirilgan mahsulotlar")}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {c.products.map(p => {
                              const ps = PRODUCT_STATUS_STYLE[p.status as ContractProductStatus];
                              return (
                                <div key={p.contractProductId} style={{
                                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                                  padding: "7px 10px", borderRadius: "var(--radius)",
                                  background: "var(--bg3)", border: "1px solid var(--border)",
                                }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text1)", flex: 1, minWidth: 120 }}>
                                    {p.productType}
                                  </span>
                                  <span style={{ fontSize: 11.5, color: "var(--text2)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                                    {p.quantity} {p.unit}
                                  </span>
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999,
                                    background: ps?.bg, color: ps?.color, border: `1px solid ${ps?.border}`,
                                    fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap",
                                  }}>
                                    {t(CONTRACT_PRODUCT_STATUS_LABELS[p.status as ContractProductStatus] ?? "")}
                                  </span>
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999,
                                    background: ROLE_STYLE[p.role]?.bg, color: ROLE_STYLE[p.role]?.color,
                                    border: `1px solid ${ROLE_STYLE[p.role]?.border}`,
                                    fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap",
                                  }}>
                                    {t(CONTRACT_USER_ROLE_LABELS[p.role] ?? "")}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
