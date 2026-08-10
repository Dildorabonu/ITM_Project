"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  stockMovementService,
  stockMovementSign,
  STOCK_MOVEMENT_COLOR,
  STOCK_MOVEMENT_DIM,
  type StockMovement,
  type StockMovementType,
  type StockMovementSummary,
} from "@/lib/stockMovements";
import { departmentService, type DepartmentOption } from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { RequisitionNo } from "@/app/_components/RequisitionNo";
import Tooltip from "@/app/_components/Tooltip";
import { MovementTypeLegend } from "./_components/MovementTypeLegend";
import { MovementFilterTiles } from "./_components/MovementFilterTiles";
import { MovementDetailDrawer } from "./_components/MovementDetailDrawer";
import { STOCK_MOVEMENT_DESC, MONTHS, PAGE_SIZE } from "./_types";
import { useT } from "@/lib/i18n";

// Backend UTC ISO qaytaradi va jadval uni konvertatsiyasiz, kesib ko'rsatadi —
// kun guruhlari ham shu bilan bir xil ramkada bo'lishi uchun UTC kaliti ishlatiladi.
const dayKeyOf = (iso: string) => (iso ?? "").slice(0, 10);
const timeOf = (iso: string) => (iso ?? "").slice(11, 16) || "—";

function directionLabel(m: StockMovement): string {
  if (m.sourceDepartmentName && m.targetDepartmentName)
    return `${m.sourceDepartmentName} → ${m.targetDepartmentName}`;
  if (m.targetDepartmentName) return `→ ${m.targetDepartmentName}`;
  if (m.sourceDepartmentName) return `${m.sourceDepartmentName} →`;
  return "—";
}

export default function WarehouseMovementsPage() {
  const t = useT();
  const [items, setItems] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<StockMovementSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StockMovement | null>(null);

  // Filtrlar — barchasi query param sifatida backendga ketadi (frontendda filter YO'Q).
  const [type, setType] = useState<StockMovementType | "">("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // "Bugun"/"Kecha" yorliqlari faqat mount'dan keyin hisoblanadi — SSR va klient
  // sanasi farq qilib hydration mismatch bermasligi uchun.
  const [nowKeys, setNowKeys] = useState<{ today: string; yesterday: string } | null>(null);
  useEffect(() => {
    const ms = Date.now();
    setNowKeys({
      today: new Date(ms).toISOString().slice(0, 10),
      yesterday: new Date(ms - 86_400_000).toISOString().slice(0, 10),
    });
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const filters = {
        type: type || undefined,
        departmentId: departmentId || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      // Ro'yxat va tugmacha sonlari birga — biri ikkinchisini kutib turmasin.
      const [data, sum] = await Promise.all([
        stockMovementService.get({ ...filters, page, pageSize: PAGE_SIZE }),
        stockMovementService.getSummary(filters),
      ]);
      setItems(data.items);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount);
      setSummary(sum);
    } catch {
      setError(t("Harakatlar jurnalini yuklashda xatolik yuz berdi."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, type, departmentId, from, to]);

  const resetFilters = () => {
    setType("");
    setDepartmentId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const hasFilters = !!(type || departmentId || from || to);

  // Backend CreatedAt DESC beradi, shuning uchun ketma-ket guruhlash yetarli.
  const dayGroups = useMemo(() => {
    const out: { key: string; items: StockMovement[] }[] = [];
    for (const m of items) {
      const key = dayKeyOf(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(m);
      else out.push({ key, items: [m] });
    }
    return out;
  }, [items]);

  const dayLabel = (key: string) => {
    if (nowKeys?.today === key) return t("Bugun");
    if (nowKeys?.yesterday === key) return t("Kecha");
    const [y, mo, d] = key.split("-");
    if (!y || !mo || !d) return key;
    return `${Number(d)} ${t(MONTHS[Number(mo) - 1] ?? "")} ${y}`;
  };

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <style>{`
        .mv-row { transition: background 0.1s; }
        .mv-day td { cursor: default; }
        .mv-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
      `}</style>

      {/* Tur bo'yicha filtr tugmachalari — son va filtr bitta boshqaruvda */}
      <MovementFilterTiles
        summary={summary}
        loading={loading}
        value={type}
        onChange={next => { setType(next); setPage(1); }}
      />

      {/* Qolgan filtrlar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <CheckSelect
          value={departmentId}
          onChange={v => { setDepartmentId(v); setPage(1); }}
          options={departments.map(d => ({ id: d.id, name: d.name }))}
          placeholder={t("Bo'lim")}
          style={{ width: 220 }}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          {t("dan")}
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 13, color: "var(--text)" }} />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          {t("gacha")}
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 13, color: "var(--text)" }} />
        </label>
        {hasFilters && (
          <button onClick={resetFilters}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, borderRadius: "var(--radius)", background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>
            ✕ {t("Tozalash")}
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <MovementTypeLegend />
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
      </div>

      {/* Jadval */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {error ? (
          <EmptyState
            tone="danger"
            title={error}
            hint={t("Sahifani yangilang yoki keyinroq qayta urinib ko'ring.")}
          />
        ) : !loading && items.length === 0 ? (
          <EmptyState
            title={hasFilters ? t("Bu filtrga mos harakat yo'q") : t("Jurnal hozircha bo'sh")}
            hint={hasFilters
              ? t("Filtrlarni kengaytiring yoki tozalang.")
              : t("Ombordagi har bir kirim, chiqim va ko'chirish shu yerda qayd etiladi.")}
            action={hasFilters ? { label: t("Filtrlarni tozalash"), onClick: resetFilters } : undefined}
          />
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <colgroup>
                <col style={{ width: 52 }} />
                <col style={{ width: 74 }} />
                <col style={{ width: 172 }} />
                <col />
                <col style={{ width: 210 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 98 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <Th align="center" divider>{t("T/r")}</Th>
                  <Th align="center">{t("Vaqt")}</Th>
                  <Th align="left">{t("Tur")}</Th>
                  <Th align="left">{t("Mahsulot")}</Th>
                  <Th align="left">{t("Yo'nalish")}</Th>
                  <Th align="right">{t("Miqdor")}</Th>
                  <Th align="right">{t("Qoldiq")}</Th>
                  <Th align="left">{t("Talabnoma")}</Th>
                  <Th align="left">{t("Foydalanuvchi")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={`sk-${i}`} className="mv-day">
                      {Array.from({ length: 9 }, (__, c) => (
                        <td key={c} style={{ padding: "9px 14px" }}>
                          <span style={{ display: "block", height: 11, borderRadius: 3, background: "var(--surface2)", opacity: 1 - i * 0.1 }} className="animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  dayGroups.map(group => {
                    // Guruh ichidagi tartib raqami umumiy sahifa raqamlashiga mos bo'lishi kerak.
                    const offset = items.indexOf(group.items[0]);
                    return (
                      <Fragment key={group.key}>
                        <tr className="mv-day">
                          <td
                            colSpan={9}
                            style={{
                              background: "var(--bg3)", padding: "5px 14px", textAlign: "left",
                              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.11em",
                              color: "var(--text3)", borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {dayLabel(group.key)}
                            <span style={{ marginLeft: 8, color: "var(--text3)", opacity: 0.7, letterSpacing: 0 }}>
                              · {group.items.length}
                            </span>
                          </td>
                        </tr>
                        {group.items.map((m, i) => {
                          const color = STOCK_MOVEMENT_COLOR[m.type];
                          const dim = STOCK_MOVEMENT_DIM[m.type];
                          const sign = stockMovementSign(m.type);
                          return (
                            <tr
                              key={m.id}
                              className="mv-row"
                              onClick={() => setSelected(m)}
                              title={t("Tafsilotni ochish")}
                            >
                              <td className="mv-num" style={{ textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text3)" }}>
                                {String((page - 1) * PAGE_SIZE + offset + i + 1).padStart(2, "0")}
                              </td>
                              <td className="mv-num" style={{ textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
                                {timeOf(m.createdAt)}
                              </td>
                              <td style={{ textAlign: "left" }}>
                                <Tooltip label={t(STOCK_MOVEMENT_DESC[m.type] ?? "")}>
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    padding: "2px 9px", borderRadius: 999, background: dim, color,
                                    fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                                    cursor: "help",
                                  }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                    {m.typeLabel}
                                  </span>
                                </Tooltip>
                              </td>
                              <td style={{ textAlign: "left", color: "var(--text1)", fontWeight: 500 }} title={m.productName}>
                                {m.productName}
                              </td>
                              <td style={{ textAlign: "left", color: "var(--text2)", fontSize: 12.5 }} title={directionLabel(m)}>
                                {directionLabel(m)}
                              </td>
                              <td className="mv-num" style={{ textAlign: "right", fontWeight: 700, color }}>
                                {sign}{m.quantity}
                              </td>
                              <td className="mv-num" style={{ textAlign: "right", color: "var(--text3)" }}>
                                {m.quantityAfter}
                              </td>
                              <td className="mv-num" style={{ textAlign: "left", color: m.requisitionNo ? "var(--accent)" : "var(--text3)", fontSize: 12.5 }}>
                                {m.requisitionNo ? <RequisitionNo no={m.requisitionNo} /> : "—"}
                              </td>
                              <td style={{ textAlign: "left", color: "var(--text2)" }} title={m.userFullName}>
                                {m.userFullName || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", marginTop: 8, gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, color: "var(--text2)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
            ← {t("Oldingi")}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "var(--text3)", padding: "0 2px" }}>…</span>
              ) : (
                <button key={p} className="btn-secondary" onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}>
                  {p}
                </button>
              )
            )}
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
            {t("Keyingi")} →
          </button>
        </div>
      </div>

      {selected && <MovementDetailDrawer movement={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// Global `.itm-table th` markazga tekislaydi — bu yerda ustunga qarab bekor qilamiz.
function Th({ children, align, divider }: { children: React.ReactNode; align: "left" | "center" | "right"; divider?: boolean }) {
  return (
    <th style={{
      textAlign: align,
      color: "var(--text1)",
      background: "var(--bg2)",
      textTransform: "none",
      ...(divider ? { borderRight: "2px solid var(--border)" } : {}),
    }}>
      {children}
    </th>
  );
}

function EmptyState({ title, hint, action, tone }: {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
  tone?: "danger";
}) {
  const color = tone === "danger" ? "var(--danger)" : "var(--text3)";
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 10, padding: 40, textAlign: "center",
    }}>
      <span style={{
        width: 48, height: 48, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: tone === "danger" ? "var(--danger-dim)" : "var(--surface2)", color,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {tone === "danger"
            ? <><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></>
            : <><path d="M3 7h18M3 12h18M3 17h10" strokeLinecap="round" /></>}
        </svg>
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, color: tone === "danger" ? "var(--danger)" : "var(--text1)" }}>{title}</p>
      <p style={{ fontSize: 12.5, color: "var(--text3)", maxWidth: 380, lineHeight: 1.5 }}>{hint}</p>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: "7px 14px", fontSize: 12, fontWeight: 600,
            borderRadius: "var(--radius)", background: "var(--surface2)",
            border: "1.5px solid var(--border)", color: "var(--text2)", cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
