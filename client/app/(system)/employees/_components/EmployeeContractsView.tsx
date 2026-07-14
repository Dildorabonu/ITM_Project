"use client";

import { useEffect, useRef, useState } from "react";
import {
  employeeService,
  ContractStatus,
  ContractProductStatus,
  CONTRACT_PRODUCT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_USER_ROLE_LABELS,
  type EmployeeResponse,
  type UserContractInfo,
} from "@/lib/userService";
import { CONTRACT_TYPE_STYLE, PRODUCT_STATUS_STYLE } from "@/app/(production)/contracts/_types";
import { CheckSelect } from "@/app/_components/CheckSelect";
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

type StatusFilter = "" | "ongoing" | "finished";

interface Props {
  employee: EmployeeResponse;
  onBack: () => void;
}

export default function EmployeeContractsView({ employee, onBack }: Props) {
  const t = useT();
  const [contracts, setContracts] = useState<UserContractInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ongoing");

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>("ongoing");
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

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

  const ongoing = contracts.filter(isOngoing);
  const finished = contracts.filter(c => !isOngoing(c));
  const shown =
    statusFilter === "ongoing" ? ongoing :
    statusFilter === "finished" ? finished :
    contracts;

  const activeFilterCount = statusFilter !== "" ? 1 : 0;

  const statusOptions = [
    { id: "ongoing",  name: `${t("Hozir ishlayotgan")} · ${ongoing.length}` },
    { id: "finished", name: `${t("Yakunlangan")} · ${finished.length}` },
  ];

  // Close filter panel on outside click
  useEffect(() => {
    if (!filterPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node) &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)
      ) setFilterPanelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterPanelOpen]);

  const openFilterPanel = () => {
    setPendingStatus(statusFilter);
    setFilterPanelOpen(true);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, padding: "10px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <button
          onClick={onBack}
          title={t("Orqaga")}
          className="btn-icon"
          style={{ width: 36, height: 36, flexShrink: 0 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--text1)" }}>{t("Xodim shartnomalari")}</div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 1 }}>
            {employee.firstName} {employee.lastName}
            {employee.departmentName && (
              <span style={{ color: "var(--text3)" }}> · {employee.departmentName}</span>
            )}
          </div>
        </div>
        <span style={{ flex: 1 }} />

        {/* Filter dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            ref={filterBtnRef}
            onClick={() => (filterPanelOpen ? setFilterPanelOpen(false) : openFilterPanel())}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "var(--radius)",
              border: `1px solid ${activeFilterCount > 0 ? "var(--accent)" : "var(--border2)"}`,
              background: activeFilterCount > 0 ? "var(--accent-dim)" : "var(--surface)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text2)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {t("Filtrlar")}
            {activeFilterCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--accent)", color: "#fff",
                fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>
                {activeFilterCount}
              </span>
            )}
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transition: "transform 0.2s", transform: filterPanelOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {filterPanelOpen && (
            <div
              ref={filterPanelRef}
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                width: 240,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                animation: "panel-appear 0.18s ease",
              }}
            >
              <div style={{ padding: "14px 14px 0" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {t("Holati")}
                </p>
                <CheckSelect
                  value={pendingStatus}
                  onChange={setPendingStatus}
                  options={statusOptions}
                  placeholder={`${t("Barchasi")} · ${contracts.length}`}
                  disablePortal
                />
              </div>
              <div style={{ padding: "12px 14px 14px" }}>
                <button
                  onClick={() => {
                    setStatusFilter(pendingStatus as StatusFilter);
                    setFilterPanelOpen(false);
                  }}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--radius)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {t("Filtrlarni qo'llash")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 60 }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ textAlign: "center", color: "var(--danger)", padding: 60 }}>{error}</div>
        ) : contracts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 60, border: "1.5px dashed var(--border)", borderRadius: "var(--radius2)" }}>
            {t("Bu xodim shartnomalarga biriktirilmagan")}
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 60, border: "1.5px dashed var(--border)", borderRadius: "var(--radius2)" }}>
            {t("Ma'lumot topilmadi")}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
            gap: 10,
            alignItems: "start",
          }}>
            {shown.map((c, i) => {
              const ty = CONTRACT_TYPE_STYLE[c.contractType];
              const ongoingCard = isOngoing(c);
              return (
                <div key={c.contractId} className={`nd-fadein-${Math.min(i, 4)}`} style={{
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${ongoingCard ? "var(--accent)" : "var(--border2)"}`,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "var(--surface)",
                  opacity: ongoingCard ? 1 : 0.75,
                }}>
                  {/* Title row: no + type */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>
                      {c.contractNo}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{t("Turi")}:</span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 999,
                      background: ty.bg, color: ty.color, border: `1px solid ${ty.border}`,
                      fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {t(CONTRACT_TYPE_LABELS[c.contractType])}
                    </span>
                    {!c.isActive && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 999,
                        background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid var(--danger)",
                        fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap",
                      }}>
                        {t("Nofaol")}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "8px 10px" }}>
                    {/* Meta — "Label: qiymat" ko'rinishida, bir qatorda */}
                    <div style={{ display: "flex", flexWrap: "wrap", columnGap: 14, rowGap: 3, fontSize: 12 }}>
                      <span>
                        <span style={{ color: "var(--text3)" }}>{t("Kontragent")}: </span>
                        <span style={{ color: "var(--text1)", fontWeight: 600 }}>{c.contractParty || "—"}</span>
                      </span>
                      <span>
                        <span style={{ color: "var(--text3)" }}>{t("Muddat")}: </span>
                        <span style={{ color: "var(--text2)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                          {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                        </span>
                      </span>
                      {c.contractRole !== null && (
                        <span>
                          <span style={{ color: "var(--text3)" }}>{t("Roli")}: </span>
                          <span style={{ color: ROLE_STYLE[c.contractRole]?.color, fontWeight: 600 }}>
                            {t(CONTRACT_USER_ROLE_LABELS[c.contractRole] ?? "")}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Product-level assignments — har bir mahsulot ikki qatorda */}
                    {c.products.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px dashed var(--border2)" }}>
                        <div style={{
                          fontSize: 9.5, fontWeight: 600, color: "var(--text3)",
                          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
                        }}>
                          {t("Biriktirilgan mahsulotlar")} · {c.products.length}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {c.products.map(p => {
                            const ps = PRODUCT_STATUS_STYLE[p.status as ContractProductStatus];
                            return (
                              <div key={p.contractProductId} style={{
                                padding: "5px 8px", borderRadius: "var(--radius)",
                                background: "var(--bg3)",
                                borderLeft: `2px solid ${ps?.color ?? "var(--border2)"}`,
                              }}>
                                {/* 1-qator: nomi + miqdori */}
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)", flex: 1, minWidth: 0 }}>
                                    {p.productType}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                                    {p.quantity} {p.unit}
                                  </span>
                                </div>
                                {/* 2-qator: holati + roli — har biri o'z yorlig'i bilan */}
                                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{t("Holati")}:</span>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 999,
                                      background: ps?.bg, color: ps?.color, border: `1px solid ${ps?.border}`,
                                      fontSize: 10, fontWeight: 600,
                                    }}>
                                      {t(CONTRACT_PRODUCT_STATUS_LABELS[p.status as ContractProductStatus] ?? "")}
                                    </span>
                                  </span>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{t("Roli")}:</span>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 999,
                                      background: ROLE_STYLE[p.role]?.bg, color: ROLE_STYLE[p.role]?.color,
                                      border: `1px solid ${ROLE_STYLE[p.role]?.border}`,
                                      fontSize: 10, fontWeight: 600,
                                    }}>
                                      {t(CONTRACT_USER_ROLE_LABELS[p.role] ?? "")}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
