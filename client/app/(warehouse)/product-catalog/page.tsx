"use client";

import { useEffect, useState } from "react";
import {
  productCatalogService,
  type ProductCatalogResponse,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { ProductCatalogDetailDrawer } from "./_components/ProductCatalogDetailDrawer";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

// Shartnoma o'lchov birliklari bilan bir xil qiymatlar — tanlashda mos kelishi uchun.
const UNIT_OPTIONS = [
  { id: "Dona", name: "Dona", icon: "🔢" },
  { id: "Kilogramm", name: "Kilogramm", icon: "⚖️" },
  { id: "Gramm", name: "Gramm", icon: "⚖️" },
  { id: "Litr", name: "Litr", icon: "💧" },
  { id: "Metr", name: "Metr", icon: "📏" },
  { id: "KvMetr", name: "Kv. Metr (m²)", icon: "⬜" },
  { id: "KubMetr", name: "Kub Metr (m³)", icon: "🧊" },
  { id: "Quti", name: "Quti", icon: "📦" },
  { id: "Paket", name: "Paket", icon: "🛍️" },
  { id: "Toʻplam", name: "To'plam", icon: "🗂️" },
];

interface FormState {
  name: string;
  unit: string;
  description: string;
}

const emptyForm: FormState = { name: "", unit: "", description: "" };

export default function ProductCatalogPage() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("ProductCatalog.Create");
  const canUpdate = hasPermission("ProductCatalog.Update");
  const canDelete = hasPermission("ProductCatalog.Delete");
  const showToast = useToastStore(s => s.show);

  const [items, setItems] = useState<ProductCatalogResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create / Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductCatalogResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProductCatalogResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail (ko'rish) drawer
  const [detailTarget, setDetailTarget] = useState<ProductCatalogResponse | null>(null);

  const PAGE_SIZE = 20;

  const load = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError("");
      const data = await productCatalogService.list(search || undefined, page, PAGE_SIZE, signal);
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (e) {
      if (signal?.aborted || (e as { code?: string; name?: string })?.code === "ERR_CANCELED"
          || (e as { name?: string })?.name === "CanceledError") {
        return;
      }
      setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(() => { load(controller.signal); }, 300);
    return () => { clearTimeout(id); controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    if (showForm) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  // Shartnoma formasidan "katalogga qo'shish" bilan kelinganda (?create=1&name=...)
  // qo'shish modalini avtomatik ochamiz va nomni oldindan to'ldiramiz.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "1") return;
    const name = params.get("name") ?? "";
    setEditTarget(null);
    setForm({ ...emptyForm, name });
    setSubmitted(false);
    setShowForm(true);
    // URL ni tozalaymiz — qayta yuklanishda modal takror ochilmasin.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setSubmitted(false);
    setShowForm(true);
  };

  const openEdit = (p: ProductCatalogResponse) => {
    setEditTarget(p);
    setForm({ name: p.name, unit: p.unit ?? "", description: p.description ?? "" });
    setSubmitted(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSubmitted(true);
    // Birlik majburiy — shartnoma formasi uni shu yerdan oladi va o'zgartirishga ruxsat bermaydi.
    if (!form.name.trim() || !form.unit) return;
    setSaving(true);
    try {
      const dto = {
        name: form.name.trim(),
        unit: form.unit || null,
        description: form.description.trim() || null,
      };
      if (editTarget) {
        await productCatalogService.update(editTarget.id, dto);
        showToast(t("Mahsulot yangilandi"));
      } else {
        await productCatalogService.create(dto);
        showToast(t("Mahsulot qo'shildi"));
      }
      setShowForm(false);
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0] ?? t("Saqlashda xatolik yuz berdi.");
      showToast(msg, t("Xatolik"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await productCatalogService.remove(deleteTarget.id);
      showToast(t("Mahsulot o'chirildi"));
      setDeleteTarget(null);
      // Oxirgi sahifadagi yagona element o'chirilsa, oldingi sahifaga qaytamiz.
      if (items.length === 1 && page > 1) setPage(p => p - 1);
      else await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0] ?? t("O'chirishda xatolik yuz berdi.");
      showToast(msg, t("Xatolik"));
    } finally {
      setDeleting(false);
    }
  };

  const nameErr = submitted && !form.name.trim();
  const unitErr = submitted && !form.unit;

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("Nomi yoki kodi bo'yicha qidirish")}
          />
        </div>
        <button
          className="btn-icon"
          onClick={() => load()}
          title={t("Yangilash")}
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
            className="btn-primary"
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("Yangi mahsulot")}
          </button>
        )}
      </div>

      {/* Info banner */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", marginBottom: 6,
        background: "var(--accent-dim)", border: "1px solid var(--accent)33",
        borderRadius: "var(--radius)", fontSize: 12, color: "var(--text2)",
      }}>
        <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>
          {t("Bu korxona ishlab chiqaradigan tayyor mahsulotlarning yagona katalogi. Shartnoma yaratishda mahsulot shu ro'yxatdan tanlanadi. Yangi mahsulotni bu yerdan yoki to'g'ridan-to'g'ri shartnoma formasidan qo'shish mumkin.")}
        </span>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table" style={{ height: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Mahsulot nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Kod")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("O'lchov")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Shartnomalarda")}</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)", width: 124 }}>{t("Amallar")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>{t("Ma'lumot topilmadi")}</td></tr>
                ) : items.map((p, i) => (
                  <tr key={p.id} onClick={() => setDetailTarget(p)}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ textAlign: "center" }} title={p.description || p.name}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text1)" }}>
                        {p.name}
                      </span>
                      {p.description && (
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "var(--text3)" }}>
                          {p.description}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>{p.code}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.unit ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block", minWidth: 26, padding: "2px 8px", borderRadius: 20,
                        fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
                        background: p.usageCount > 0 ? "var(--accent-dim)" : "var(--bg3)",
                        color: p.usageCount > 0 ? "var(--accent)" : "var(--text3)",
                      }}>
                        {p.usageCount}
                      </span>
                    </td>
                    <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" title={t("Ko'rish")} onClick={(e) => { e.stopPropagation(); setDetailTarget(p); }}
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {canUpdate && (
                          <button className="btn-icon" title={t("Tahrirlash")} onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn-icon btn-icon-danger" title={t("O'chirish")} onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
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
                {items.length > 0 && (
                  <tr className="itm-filler" aria-hidden style={{ height: "100%" }}>
                    <td style={{ padding: 0, borderBottom: "none", borderRight: "2px solid var(--border)" }} />
                    <td colSpan={4} style={{ padding: 0, borderBottom: "none" }} />
                    <td style={{ padding: 0, borderBottom: "none", borderLeft: "2px solid var(--border)" }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
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

      {/* Create / Edit modal */}
      {showForm && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div style={{
            width: "100%", maxWidth: 460, background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: "var(--radius2)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden",
            animation: "panel-appear 0.22s ease",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)" }}>
                {editTarget ? t("Mahsulotni tahrirlash") : t("Yangi mahsulot")}
              </span>
              <button className="btn-icon" onClick={() => setShowForm(false)} style={{ width: 30, height: 30 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: nameErr ? "var(--danger)" : "var(--text2)" }}>
                  {t("Mahsulot nomi")} <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t("Masalan: Metall konstruktsiya")}
                  autoFocus
                  style={nameErr ? { borderColor: "var(--danger)" } : undefined}
                />
                {nameErr && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{t("Mahsulot nomini kiriting")}</div>}
                {editTarget && (
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                    {t("Kod")}: {editTarget.code}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: unitErr ? "var(--danger)" : "var(--text2)" }}>
                  {t("O'lchov birligi")} <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <div style={unitErr ? { borderRadius: "var(--radius)", boxShadow: "0 0 0 1.5px var(--danger)" } : undefined}>
                  <CheckSelect
                    value={form.unit}
                    onChange={v => setForm(f => ({ ...f, unit: v }))}
                    options={UNIT_OPTIONS.map(o => ({ id: o.id, name: t(o.name), icon: o.icon }))}
                    placeholder={t("— Tanlang —")}
                  />
                </div>
                {unitErr
                  ? <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{t("Birlikni tanlang")}</div>
                  : <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{t("Shartnomalarda shu birlik ishlatiladi")}</div>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                  {t("Izoh")}
                </label>
                <textarea
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t("Ixtiyoriy tavsif...")}
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: "8px 16px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                {t("Bekor qilish")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "8px 18px", borderRadius: "var(--radius)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? t("Saqlanmoqda...") : t("Saqlash")}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <ProductCatalogDetailDrawer
          productId={detailTarget.id}
          productName={detailTarget.name}
          onClose={() => setDetailTarget(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        variant="danger"
        title={t("Mahsulotni o'chirish")}
        message={
          <span>
            «{deleteTarget?.name}» {t("katalogdan o'chirilsinmi?")}
            {deleteTarget && deleteTarget.usageCount > 0 && (
              <>
                {" "}
                <b>{deleteTarget.usageCount}</b> {t("ta shartnomada ishlatilgan — ular matn nomini saqlab qoladi, faqat bog'lanish uziladi.")}
              </>
            )}
          </span>
        }
        confirmLabel={t("O'chirish")}
        loading={deleting}
        loadingLabel={t("O'chirilmoqda...")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
