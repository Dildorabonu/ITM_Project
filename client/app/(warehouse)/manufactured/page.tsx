"use client";

import { useEffect, useState } from "react";
import {
  manufacturedProductService,
  departmentService,
  ManufacturingStatus,
  PRODUCT_UNIT_LABELS,
  type ManufacturedProductResponse,
  type ManufacturedProductStats,
  type DepartmentOption,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { STATUS_FILTER_OPTIONS, isManualEntry } from "./_types";
import { StatusBadge } from "./_components/StatusBadge";
import { ProgressBar } from "./_components/ProgressBar";
import { ManufacturedViewDrawer } from "./_components/ManufacturedViewDrawer";
import { ManufacturedFormDrawer } from "./_components/ManufacturedFormDrawer";

export default function ManufacturedProductsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("ManufacturedProducts.Create");
  const canUpdate = hasPermission("ManufacturedProducts.Update");
  const canDelete = hasPermission("ManufacturedProducts.Delete");
  const showToast = useToastStore(s => s.show);

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

  // Create / Edit form drawer
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ManufacturedProductResponse | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (viewProduct || showForm) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [viewProduct, showForm]);

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

  const openCreate = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (p: ManufacturedProductResponse) => {
    setEditTarget(p);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await manufacturedProductService.delete(deleteId);
      showToast("Mahsulot o'chirildi");
      setDeleteId(null);
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0] ?? "O'chirishda xatolik yuz berdi.";
      showToast(msg, "Xatolik");
    } finally {
      setDeleting(false);
    }
  };

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
        {canCreate && (
          <button
            onClick={openCreate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", height: 36,
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: "var(--radius)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--accent2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yangi mahsulot
          </button>
        )}
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
          Shartnomadan tashqari mahsulotlarni esa &laquo;+ Yangi mahsulot&raquo; tugmasi orqali qo&apos;lda kiritish va keyinchalik tahrirlash mumkin.
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
                        {canUpdate && isManualEntry(p) && (
                          <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(p)}
                            style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && isManualEntry(p) && (
                          <button className="btn-icon" title="O'chirish" onClick={() => setDeleteId(p.id)}
                            style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
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
      {viewProduct && (
        <ManufacturedViewDrawer product={viewProduct} onClose={() => setViewProduct(null)} />
      )}

      {/* Create / Edit drawer */}
      {showForm && (
        <ManufacturedFormDrawer
          editTarget={editTarget}
          departments={departments}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={() => Promise.all([load(), loadStats()]).then(() => {})}
        />
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Mahsulotni o'chirish"
        message="Bu mahsulot ro'yxatdan butunlay o'chiriladi. Davom etasizmi?"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
