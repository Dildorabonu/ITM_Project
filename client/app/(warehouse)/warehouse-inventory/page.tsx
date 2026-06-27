"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import {
  productService,
  departmentService,
  PRODUCT_UNIT_LABELS,
  type ProductResponse,
  type DepartmentOption,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { emptyForm, WAREHOUSE_DEPARTMENT_TYPE, type ProductForm } from "./_types";
import { ProductFormView } from "./_components/ProductFormView";
import { FrozenProductsView } from "./_components/FrozenProductsView";
import { PurchaseReceiveView } from "./_components/PurchaseReceiveView";
import { ProductViewDrawer } from "./_components/ProductViewDrawer";
import { StockMovementDrawer } from "./_components/StockMovementDrawer";

export default function ProductsPage() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Products.Create");
  const canUpdate = hasPermission("Products.Update");
  const canDelete = hasPermission("Products.Delete");
  const canRelease = hasPermission("Requisitions.WarehouseCheck");

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Inline create/edit form (form fields lifted here so useDraft can persist them)
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  // View drawer
  const [viewProduct, setViewProduct] = useState<ProductResponse | null>(null);

  // Harakat tarixi (StockMovement) drawer
  const [historyProduct, setHistoryProduct] = useState<ProductResponse | null>(null);

  // Frozen (reserved) products inline view
  const [showFrozen, setShowFrozen] = useState(false);

  // Purchase-receive (ReadyForPurchase) inline view
  const [showPurchase, setShowPurchase] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useDraft(
    "draft_products",
    showForm,
    { form, editTarget },
    (d) => { setForm(d.form); setEditTarget(d.editTarget); setShowForm(true); },
  );

  useEffect(() => {
    if (viewProduct || historyProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [viewProduct, historyProduct]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await productService.getAll(
        page,
        50,
        search || undefined,
        filterDept || undefined,
        WAREHOUSE_DEPARTMENT_TYPE,
      );
      setProducts(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    departmentService
      .getAll()
      .then(list => setDepartments(list.filter(d => d.type === WAREHOUSE_DEPARTMENT_TYPE)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, search, filterDept]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => setShowForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  useEffect(() => {
    if (!showFrozen) return;
    const handlePopState = () => setShowFrozen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showFrozen]);

  const openFrozen = () => {
    window.history.pushState({ frozen: true }, "");
    setShowFrozen(true);
  };

  const closeFrozen = () => {
    setShowFrozen(false);
    window.history.back();
  };

  useEffect(() => {
    if (!showPurchase) return;
    const handlePopState = () => setShowPurchase(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showPurchase]);

  const openPurchase = () => {
    window.history.pushState({ purchase: true }, "");
    setShowPurchase(true);
  };

  const closePurchase = () => {
    setShowPurchase(false);
    window.history.back();
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const openEdit = (p: ProductResponse) => {
    setEditTarget(p);
    setForm({ name: p.name, invoiceNumber: p.invoiceNumber ?? "", description: p.description ?? "", quantity: String(p.quantity), unit: String(p.unit), departmentId: p.departmentId });
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await productService.delete(deleteId);
      setDeleteId(null);
      await load();
    } catch {
      // stay open on error
    } finally {
      setDeleting(false);
    }
  };

  /* ===== Inline create/edit form view ===== */
  if (showForm) {
    return (
      <ProductFormView
        key={editTarget?.id ?? "new"}
        editTarget={editTarget}
        departments={departments}
        form={form}
        setForm={setForm}
        onClose={() => setShowForm(false)}
        onCreated={load}
        onUpdated={updated => setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))}
      />
    );
  }

  /* ===== Frozen products inline view ===== */
  if (showFrozen) {
    return (
      <FrozenProductsView
        canRelease={canRelease}
        onClose={closeFrozen}
        onReleased={load}
      />
    );
  }

  /* ===== Purchase-receive inline view ===== */
  if (showPurchase) {
    return (
      <PurchaseReceiveView
        canReceive={canRelease}
        onClose={closePurchase}
        onReceived={load}
      />
    );
  }

  /* ===== List view ===== */
  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Qidirish")}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <CheckSelect
          value={filterDept}
          onChange={v => { setFilterDept(v); setPage(1); }}
          options={departments.map(d => ({ id: d.id, name: d.name }))}
          placeholder={t("Bo'limlar")}
          style={{ width: 200 }}
        />
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
        <button
          onClick={openFrozen}
          title={t("Muzlatilgan mahsulotlar")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius)",
            background: "var(--warn-dim)", border: "1.5px solid var(--warn)44",
            color: "var(--warn)", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
          </svg>
          {t("Muzlatilgan")}
        </button>
        <button
          onClick={openPurchase}
          title={t("Sotib olingan mahsulotlarni omborga qabul qilish")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius)",
            background: "var(--accent-dim)", border: "1.5px solid var(--accent)44",
            color: "var(--accent)", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          {t("Sotib olinganlar")}
        </button>
        {canCreate && (
          <button
            className="btn-primary"
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("Yaratish")}
          </button>
        )}
      </div>

      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Mahsulot nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Invoice raqami")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Bo'lim")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Soni")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("O'lchov")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Tavsif")}</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)" }}>{t("Amal")}</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>{t("Ma'lumot topilmadi")}</td></tr>
                ) : products.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String((page - 1) * 50 + i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ textAlign: "center" }}>{p.name}</td>
                    <td style={{ textAlign: "center", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{p.invoiceNumber || "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.departmentName}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.quantity}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{PRODUCT_UNIT_LABELS[p.unit] ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.description ?? "—"}</td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" title={t("Harakat tarixi")} onClick={() => setHistoryProduct(p)}
                          style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3v5h5" />
                            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                            <path d="M12 7v5l4 2" />
                          </svg>
                        </button>
                        <button className="btn-icon" title={t("Ko'rish")} onClick={() => setViewProduct(p)}
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {(canUpdate || canDelete) && (
                          <>
                            {canUpdate && (
                              <button className="btn-icon" title={t("Tahrirlash")} onClick={() => openEdit(p)}
                                style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button className="btn-icon btn-icon-danger" title={t("O'chirish")}
                                style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                                onClick={() => setDeleteId(p.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * 50 + 1}&nbsp;–&nbsp;{Math.min(page * 50, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
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
                <button
                  key={p}
                  className="btn-secondary"
                  onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            {t("Keyingi")} →
          </button>
        </div>
      </div>

      {/* View drawer */}
      {viewProduct && (
        <ProductViewDrawer product={viewProduct} onClose={() => setViewProduct(null)} />
      )}

      {/* Harakat tarixi drawer */}
      {historyProduct && (
        <StockMovementDrawer
          productId={historyProduct.id}
          productName={historyProduct.name}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        title={t("Mahsulotni o'chirish")}
        message={t("Ushbu mahsulot o'chiriladi. Davom etasizmi?")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
