"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  manufacturedProductService,
  departmentService,
  ManufacturingStatus,
  MANUFACTURING_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
  type ManufacturedProductResponse,
  type ManufacturedProductStats,
  type DepartmentOption,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { shipmentBatchService, type ShipmentBatch } from "@/lib/shipments";

const STATUS_FILTER_OPTIONS = [
  { id: "", name: "Barcha holatlar" },
  { id: String(ManufacturingStatus.InProgress), name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.InProgress] },
  { id: String(ManufacturingStatus.Completed),  name: MANUFACTURING_STATUS_LABELS[ManufacturingStatus.Completed] },
];

function StatusBadge({ status }: { status: ManufacturingStatus }) {
  const isCompleted = status === ManufacturingStatus.Completed;
  const bg = isCompleted ? "var(--success-dim)" : "var(--warn-dim)";
  const fg = isCompleted ? "var(--success)" : "var(--warn)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: fg,
        animation: isCompleted ? undefined : "dotPulse 1.6s infinite",
      }} />
      {MANUFACTURING_STATUS_LABELS[status]}
    </span>
  );
}

function ProgressBar({ produced, total }: { produced: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((produced / total) * 100)) : 0;
  const isDone = pct >= 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
        <span>{produced} / {total}</span>
        <span style={{ color: isDone ? "var(--success)" : "var(--accent)", fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--bg3)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: isDone ? "var(--success)" : "var(--accent)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

export default function ManufacturedProductsPage() {
  const [products, setProducts] = useState<ManufacturedProductResponse[]>([]);
  const [stats, setStats] = useState<ManufacturedProductStats>({ total: 0, inProgress: 0, completed: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // View drawer
  const [viewProduct, setViewProduct] = useState<ManufacturedProductResponse | null>(null);
  const [viewBatches, setViewBatches] = useState<ShipmentBatch[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (viewProduct) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [viewProduct]);

  useEffect(() => {
    let ignore = false;
    if (viewProduct?.contractId) {
      shipmentBatchService
        .getByContract(viewProduct.contractId, viewProduct.contractProductId ?? undefined)
        .then(list => { if (!ignore) setViewBatches(list); })
        .catch(() => { if (!ignore) setViewBatches([]); });
    } else {
      setViewBatches([]);
    }
    return () => { ignore = true; };
  }, [viewProduct]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const status = filterStatus !== "" ? (Number(filterStatus) as ManufacturingStatus) : undefined;
      const data = await manufacturedProductService.getAll(
        page, 50,
        search || undefined,
        filterDept || undefined,
        status,
      );
      setProducts(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const s = await manufacturedProductService.getStats();
      setStats(s);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    loadStats();
    departmentService.getAll().then(setDepartments).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, search, filterDept, filterStatus]);

  /* ===== List view ===== */
  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="itm-card nd-fadein-0" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Jami mahsulotlar</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{stats.total}</div>
          </div>
        </div>

        <div className="itm-card nd-fadein-1" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--warn-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--warn)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Ishlab chiqarilmoqda</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--warn)", fontFamily: "var(--font-mono)" }}>{stats.inProgress}</div>
          </div>
        </div>

        <div className="itm-card nd-fadein-2" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Ishlab chiqarilgan</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)", fontFamily: "var(--font-mono)" }}>{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Nomi, kodi, shartnoma yoki bo'lim bo'yicha qidirish"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <CheckSelect
          value={filterStatus}
          onChange={v => { setFilterStatus(v); setPage(1); }}
          options={STATUS_FILTER_OPTIONS}
          placeholder="Holati"
          style={{ width: 200 }}
        />
        <CheckSelect
          value={filterDept}
          onChange={v => { setFilterDept(v); setPage(1); }}
          options={departments.map(d => ({ id: d.id, name: d.name }))}
          placeholder="Bo'limlar"
          style={{ width: 200 }}
        />
        <button
          className="btn-icon"
          onClick={() => { load(); loadStats(); }}
          title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Info banner — explains auto-derivation */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", marginBottom: 12,
        background: "var(--accent-dim)", border: "1px solid var(--accent)33",
        borderRadius: "var(--radius)", fontSize: 12, color: "var(--text2)",
      }}>
        <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>
          Ushbu ro&apos;yxat avtomatik tarzda shartnoma vazifalaridan to&apos;ldiriladi.
          Vazifalarda ishlab chiqarish jarayoni boshlangan mahsulotlar shu yerda paydo bo&apos;ladi;
          shartnoma yakunlangan yoki bekor qilinganda ro&apos;yxatdan chiqib ketadi.
        </span>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Mahsulot</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sex</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Shartnoma</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", minWidth: 160 }}>Bajarilgani</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>O&apos;lchov</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Holati</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : products.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String((page - 1) * 50 + i + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600, color: "var(--text1)" }}>{p.name}</span>
                        {p.code && <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{p.code}</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.departmentName}</td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: p.contractNo ? "var(--text1)" : "var(--text3)" }}>
                      {p.contractNo ?? "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <ProgressBar produced={p.producedQuantity} total={p.quantity} />
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{PRODUCT_UNIT_LABELS[p.unit] ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" title="Ko'rish" onClick={() => setViewProduct(p)}
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>
              {totalCount} ta mahsulot &mdash; {page}/{totalPages} sahifa
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: page <= 1 ? "var(--text3)" : "var(--text1)", cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: 13 }}
              >
                ‹ Oldingi
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`ellipsis-${idx}`} style={{ padding: "5px 8px", color: "var(--text3)", fontSize: 13 }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "1.5px solid", borderColor: page === p ? "var(--accent)" : "var(--border)", background: page === p ? "var(--accent)" : "var(--bg3)", color: page === p ? "#fff" : "var(--text1)", cursor: "pointer", fontSize: 13, fontWeight: page === p ? 700 : 400 }}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: page >= totalPages ? "var(--text3)" : "var(--text1)", cursor: page >= totalPages ? "not-allowed" : "pointer", fontSize: 13 }}
              >
                Keyingi ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View drawer */}
      {viewProduct && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setViewProduct(null)}
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
              <button onClick={() => setViewProduct(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ gridColumn: "1 / -1", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Mahsulot nomi</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewProduct.name}</div>
                {viewProduct.code && (
                  <div style={{ marginTop: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                    Kod: {viewProduct.code}
                  </div>
                )}
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Sex / Bo&apos;lim</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{viewProduct.departmentName}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holati</div>
                <div style={{ marginTop: 4 }}><StatusBadge status={viewProduct.status} /></div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Miqdor</div>
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>Bajarilgani</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text1)" }}>
                    {viewProduct.producedQuantity} / {viewProduct.quantity} {PRODUCT_UNIT_LABELS[viewProduct.unit] ?? ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>Foiz</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: viewProduct.status === ManufacturingStatus.Completed ? "var(--success)" : "var(--accent)" }}>
                    {viewProduct.quantity > 0 ? Math.min(100, Math.round((viewProduct.producedQuantity / viewProduct.quantity) * 100)) : 0}%
                  </div>
                </div>
              </div>
              <ProgressBar produced={viewProduct.producedQuantity} total={viewProduct.quantity} />
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Bog&apos;liq ma&apos;lumotlar</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: viewProduct.contractNo ? "var(--text1)" : "var(--text3)", fontFamily: "var(--font-mono)" }}>
                  {viewProduct.contractNo ?? "—"}
                </div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratilgan sana</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>
                  {(() => { const d = viewProduct.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0]}` : "—"; })()}
                </div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlangan</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: viewProduct.startedAt ? "var(--text1)" : "var(--text3)" }}>
                  {viewProduct.startedAt ? new Date(viewProduct.startedAt).toLocaleDateString("uz-UZ") : "—"}
                </div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugallangan</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: viewProduct.completedAt ? "var(--success)" : "var(--text3)" }}>
                  {viewProduct.completedAt ? new Date(viewProduct.completedAt).toLocaleDateString("uz-UZ") : "—"}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>
              Partiyalar
              {viewBatches.length > 0 && (
                <span style={{ marginLeft: 8, color: "var(--text3)", fontWeight: 500 }}>
                  ({viewBatches.length} ta jo&apos;natma &mdash; jami{" "}
                  {viewBatches.reduce((s, b) => s + b.amount, 0).toLocaleString()}{" "}
                  {PRODUCT_UNIT_LABELS[viewProduct.unit] ?? ""})
                </span>
              )}
            </div>
            <div style={{ marginBottom: 22 }}>
              {!viewProduct.contractId ? (
                <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", fontSize: 13, color: "var(--text3)" }}>
                  Mahsulot shartnomaga bog&apos;lanmagan &mdash; partiyalar mavjud emas.
                </div>
              ) : viewBatches.length === 0 ? (
                <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", fontSize: 13, color: "var(--text3)" }}>
                  Hali jo&apos;natma yo&apos;q. Vazifalardan partiya yuborilganida bu yerda ko&apos;rinadi.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {[...viewBatches].sort((a, b) => b.batchNo - a.batchNo).map(b => {
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
                              {PRODUCT_UNIT_LABELS[viewProduct.unit] ?? ""}
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

            {(viewProduct.description || viewProduct.notes) && (
              <>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Qo&apos;shimcha</div>
                {viewProduct.description && (
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Tavsif</div>
                    <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{viewProduct.description}</div>
                  </div>
                )}
                {viewProduct.notes && (
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Izoh</div>
                    <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{viewProduct.notes}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
