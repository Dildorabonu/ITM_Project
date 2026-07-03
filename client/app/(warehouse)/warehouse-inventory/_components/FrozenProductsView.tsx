"use client";

import { useEffect, useState } from "react";
import {
  productService,
  requisitionService,
  RequisitionStatus,
  PRODUCT_UNIT_LABELS,
  type ProductReservationResponse,
} from "@/lib/userService";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

interface Props {
  canRelease: boolean;
  onClose: () => void;
  // Mahsulotlar berib yuborilgach asosiy ro'yxatni yangilash uchun chaqiriladi.
  onReleased: () => void | Promise<void>;
}

type FrozenGroup = {
  requisitionId: string;
  requisitionNo: string;
  purpose: string;
  targetDepartmentName: string | null;
  status: RequisitionStatus;
  statusLabel: string;
  warehouseCheckedAt: string | null;
  items: ProductReservationResponse[];
  totalReserved: number;
};

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = s.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—";
};

// Muzlatilgan (rezerv qilingan) mahsulotlarni talabnoma bo'yicha guruhlab ko'rsatadi
// va "berib yuborish" amalini bajaradi. O'zining barcha holatini o'zi boshqaradi.
export function FrozenProductsView({ canRelease, onClose, onReleased }: Props) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [frozenItems, setFrozenItems] = useState<ProductReservationResponse[]>([]);
  const [frozenTotalCount, setFrozenTotalCount] = useState(0);
  const [frozenSearch, setFrozenSearch] = useState("");
  const [frozenLoading, setFrozenLoading] = useState(false);
  const [frozenError, setFrozenError] = useState("");
  const [frozenStatusFilter, setFrozenStatusFilter] = useState<"all" | "ready" | "pending">("all");
  const [expandedReq, setExpandedReq] = useState<Set<string>>(new Set());
  const [releaseConfirm, setReleaseConfirm] = useState<{ id: string; no: string } | null>(null);
  const [releasing, setReleasing] = useState(false);

  const loadFrozen = async (q = frozenSearch) => {
    try {
      setFrozenLoading(true);
      setFrozenError("");
      // pageSize katta — guruhlash mijoz tomonida bo'lgani uchun barcha rezervlarni yuklaymiz
      const data = await productService.getReservations(1, 1000, q || undefined);
      setFrozenItems(data.items);
      setFrozenTotalCount(data.totalCount);
    } catch {
      setFrozenError(t("Muzlatilgan mahsulotlar yuklanmadi."));
    } finally {
      setFrozenLoading(false);
    }
  };

  useEffect(() => {
    loadFrozen(frozenSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozenSearch]);

  const toggleReqExpanded = (reqId: string) => {
    setExpandedReq(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  const handleRelease = async () => {
    if (!releaseConfirm) return;
    setReleasing(true);
    try {
      await requisitionService.release(releaseConfirm.id);
      showToast(`${t("Talabnoma")} "${releaseConfirm.no}" ${t("bo'yicha mahsulotlar berib yuborildi")}`, "success");
      setReleaseConfirm(null);
      await Promise.all([loadFrozen(frozenSearch), onReleased()]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      showToast(msg ?? t("Berib yuborishda xatolik yuz berdi"), t("Xatolik"));
    } finally {
      setReleasing(false);
    }
  };

  const groups: FrozenGroup[] = (() => {
    const map = new Map<string, FrozenGroup>();
    for (const r of frozenItems) {
      let g = map.get(r.requisitionId);
      if (!g) {
        g = {
          requisitionId: r.requisitionId,
          requisitionNo: r.requisitionNo,
          purpose: r.purpose,
          targetDepartmentName: r.targetDepartmentName,
          status: r.status,
          statusLabel: r.statusLabel,
          warehouseCheckedAt: r.warehouseCheckedAt,
          items: [],
          totalReserved: 0,
        };
        map.set(r.requisitionId, g);
      }
      g.items.push(r);
      g.totalReserved += r.reservedQuantity;
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.warehouseCheckedAt ?? "";
      const tb = b.warehouseCheckedAt ?? "";
      return tb.localeCompare(ta);
    });
  })();

  const filteredGroups = groups.filter(g => {
    if (frozenStatusFilter === "ready") return g.status === RequisitionStatus.ReadyForWarehouseRelease;
    if (frozenStatusFilter === "pending") return g.status === RequisitionStatus.PendingApproval;
    return true;
  });

  const readyCount = groups.filter(g => g.status === RequisitionStatus.ReadyForWarehouseRelease).length;
  const pendingCount = groups.filter(g => g.status === RequisitionStatus.PendingApproval).length;

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 14px", flexWrap: "wrap" }}>
        <button
          onClick={onClose}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 12px", height: 36, borderRadius: "var(--radius)",
            border: "1px solid var(--border)", background: "var(--bg2)",
            color: "var(--text2)", fontSize: 13, cursor: "pointer",
          }}
        >
          ← {t("Orqaga")}
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{t("Muzlatilgan mahsulotlar")}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>
            {groups.length} {t("ta talabnoma")} · {frozenTotalCount} {t("ta rezerv")}
          </span>
        </div>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 200 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder={t("Qidirish: mahsulot, talabnoma, sabab, bo'lim...")}
            value={frozenSearch}
            onChange={e => setFrozenSearch(e.target.value)}
          />
        </div>
        {([
          { key: "all" as const, label: `${t("Barchasi")} (${groups.length})` },
          { key: "ready" as const, label: `${t("Berishga tayyor")} (${readyCount})` },
          { key: "pending" as const, label: `${t("Tasdiqlash kutmoqda")} (${pendingCount})` },
        ]).map(f => (
          <button key={f.key} onClick={() => setFrozenStatusFilter(f.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "0 12px", height: 32, borderRadius: "var(--radius)",
              border: `1px solid ${frozenStatusFilter === f.key ? "var(--accent)" : "var(--border)"}`,
              background: frozenStatusFilter === f.key ? "var(--accent-dim)" : "var(--bg2)",
              color: frozenStatusFilter === f.key ? "var(--accent)" : "var(--text2)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          className="btn-icon"
          onClick={() => loadFrozen(frozenSearch)}
          title={t("Yangilash")}
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {frozenLoading ? (
          <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : frozenError ? (
          <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>{frozenError}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="itm-card" style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
            </svg>
            <div>{frozenSearch || frozenStatusFilter !== "all" ? t("Natija topilmadi") : t("Muzlatilgan mahsulotlar yo'q")}</div>
          </div>
        ) : filteredGroups.map((g) => {
          const ready = g.status === RequisitionStatus.ReadyForWarehouseRelease;
          const expanded = expandedReq.has(g.requisitionId);
          return (
            <div key={g.requisitionId} className="itm-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Group header */}
              <div
                onClick={() => toggleReqExpanded(g.requisitionId)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  cursor: "pointer", userSelect: "none",
                  borderBottom: expanded ? "1px solid var(--border)" : "none",
                  background: expanded ? "var(--bg2)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5"
                  style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                      {g.requisitionNo}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text1)", fontWeight: 500 }}>{g.purpose || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 12, color: "var(--text3)", flexWrap: "wrap" }}>
                    {g.targetDepartmentName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        </svg>
                        {g.targetDepartmentName}
                      </span>
                    )}
                    <span>{fmtDate(g.warehouseCheckedAt)}</span>
                    <span>{g.items.length} {t("ta mahsulot")}</span>
                  </div>
                </div>

                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: ready ? "var(--success-dim)" : "var(--warn-dim)",
                  color: ready ? "var(--success)" : "var(--warn)",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: ready ? "var(--success)" : "var(--warn)",
                  }} />
                  {g.statusLabel}
                </span>

                {canRelease && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (ready) setReleaseConfirm({ id: g.requisitionId, no: g.requisitionNo }); }}
                    disabled={!ready}
                    title={ready ? t("Talabnoma bo'yicha mahsulotlarni berib yuborish") : t("Direktor hali tasdiqlamagan")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: "var(--radius)",
                      border: `1px solid ${ready ? "var(--success)" : "var(--border)"}`,
                      background: ready ? "var(--success)" : "var(--bg3)",
                      color: ready ? "#fff" : "var(--text3)",
                      fontSize: 12, fontWeight: 600,
                      cursor: ready ? "pointer" : "not-allowed",
                      transition: "all 0.15s",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    {t("Berib yuborish")}
                  </button>
                )}
              </div>

              {/* Items table */}
              {expanded && (
                <div style={{ overflowX: "auto" }}>
                  <table className="itm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 48, minWidth: 48, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Mahsulot nomi")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Invoice raqami")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Muzlatilgan miqdor")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("O'lchov")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((r, i) => (
                        <tr key={`${r.requisitionId}-${r.productId}-${i}`}>
                          <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 48, padding: "0 8px" }}>
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500 }}>{r.productName}</td>
                          <td style={{ textAlign: "center", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{r.invoiceNumber || "—"}</td>
                          <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--warn)" }}>
                            {r.reservedQuantity}
                          </td>
                          <td style={{ textAlign: "center", color: "var(--text2)" }}>{PRODUCT_UNIT_LABELS[r.unit] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={!!releaseConfirm}
        title={t("Mahsulotlarni berib yuborish")}
        message={releaseConfirm
          ? `${t("Talabnoma")} "${releaseConfirm.no}" ${t("bo'yicha barcha muzlatilgan mahsulotlar bo'lim omboriga o'tkaziladi va korxona omborxonasidan ayriladi. Davom etasizmi?")}`
          : ""}
        confirmLabel={t("Berib yuborish")}
        loadingLabel={t("Berilmoqda...")}
        variant="primary"
        loading={releasing}
        onConfirm={handleRelease}
        onCancel={() => setReleaseConfirm(null)}
      />
    </div>
  );
}
