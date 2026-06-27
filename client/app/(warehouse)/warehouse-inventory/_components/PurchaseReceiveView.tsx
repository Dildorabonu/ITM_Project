"use client";

import { useEffect, useState } from "react";
import {
  requisitionService,
  RequisitionStatus,
  type RequisitionResponse,
} from "@/lib/userService";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

interface Props {
  canReceive: boolean;
  onClose: () => void;
  // Qabul qilingach asosiy ro'yxat / muzlatilgan ro'yxatni yangilash uchun.
  onReceived: () => void | Promise<void>;
}

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = s.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—";
};

// Direktor tasdiqlagan "sotib olishga" (ReadyForPurchase) talabnomalarni ko'rsatadi
// va sotib olingan mahsulot kelganda "Omborga qabul qilindi" amalini bajaradi.
// Qabuldan keyin talabnoma "Berishga tayyor" (Muzlatilgan) navbatiga o'tadi.
export function PurchaseReceiveView({ canReceive, onClose, onReceived }: Props) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [items, setItems] = useState<RequisitionResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [receiveConfirm, setReceiveConfirm] = useState<{ id: string; no: string } | null>(null);
  const [receiving, setReceiving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await requisitionService.getAll(RequisitionStatus.ReadyForPurchase);
      setItems(data);
    } catch {
      setError(t("Sotib olingan talabnomalar yuklanmadi."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReceive = async () => {
    if (!receiveConfirm) return;
    setReceiving(true);
    try {
      await requisitionService.receivePurchase(receiveConfirm.id);
      showToast(`${t("Talabnoma")} "${receiveConfirm.no}" ${t("bo'yicha xarid omborga qabul qilindi")}`, "success");
      setReceiveConfirm(null);
      await Promise.all([load(), onReceived()]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      showToast(msg ?? t("Qabul qilishda xatolik yuz berdi"), "error");
    } finally {
      setReceiving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter(r =>
        r.requisitionNo.toLowerCase().includes(q)
        || (r.purpose ?? "").toLowerCase().includes(q)
        || (r.departmentName ?? "").toLowerCase().includes(q)
        || r.items.some(i => (i.materialName ?? "").toLowerCase().includes(q)))
    : items;

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
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{t("Sotib olinganlar")}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>
            {items.length} {t("ta talabnoma qabul kutmoqda")}
          </span>
        </div>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 200 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder={t("Qidirish: mahsulot, talabnoma, sabab, bo'lim...")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn-icon"
          onClick={load}
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
        {loading ? (
          <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="itm-card" style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
            <div>{search ? t("Natija topilmadi") : t("Qabul kutayotgan xarid yo'q")}</div>
          </div>
        ) : filtered.map((r) => {
          const isOpen = expanded.has(r.id);
          return (
            <div key={r.id} className="itm-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div
                onClick={() => toggleExpanded(r.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  cursor: "pointer", userSelect: "none",
                  borderBottom: isOpen ? "1px solid var(--border)" : "none",
                  background: isOpen ? "var(--bg2)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                      {r.requisitionNo}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text1)", fontWeight: 500 }}>{r.purpose || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 12, color: "var(--text3)", flexWrap: "wrap" }}>
                    {r.departmentName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        </svg>
                        {r.departmentName}
                      </span>
                    )}
                    <span>{fmtDate(r.approvedAt ?? r.createdAt)}</span>
                    <span>{r.items.length} {t("ta mahsulot")}</span>
                  </div>
                </div>

                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: "var(--accent-dim)", color: "var(--accent)",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                  {r.statusLabel}
                </span>

                {canReceive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReceiveConfirm({ id: r.id, no: r.requisitionNo }); }}
                    title={t("Sotib olingan mahsulotni omborga qabul qilish")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: "var(--radius)",
                      border: "1px solid var(--accent)", background: "var(--accent)",
                      color: "#fff", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    {t("Omborga qabul qilindi")}
                  </button>
                )}
              </div>

              {/* Items table */}
              {isOpen && (
                <div style={{ overflowX: "auto" }}>
                  <table className="itm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 48, minWidth: 48, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Mahsulot nomi")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Miqdor")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("O'lchov")}</th>
                        <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("Izoh")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((it, i) => (
                        <tr key={it.id}>
                          <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 48, padding: "0 8px" }}>
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500 }}>{it.materialName}</td>
                          <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>
                            {it.quantity}
                          </td>
                          <td style={{ textAlign: "center", color: "var(--text2)" }}>{it.unit || "—"}</td>
                          <td style={{ textAlign: "center", color: "var(--text2)" }}>{it.notes || "—"}</td>
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
        open={!!receiveConfirm}
        title={t("Xaridni omborga qabul qilish")}
        message={receiveConfirm
          ? `${t("Talabnoma")} "${receiveConfirm.no}" ${t("bo'yicha sotib olingan mahsulotlar markaziy omborxonaga kirim qilinadi va bo'lim omboriga berishga tayyor holatga o'tadi. Davom etasizmi?")}`
          : ""}
        confirmLabel={t("Qabul qilish")}
        loadingLabel={t("Qabul qilinmoqda...")}
        variant="primary"
        loading={receiving}
        onConfirm={handleReceive}
        onCancel={() => setReceiveConfirm(null)}
      />
    </div>
  );
}
