"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  technicalDrawingService,
  contractService,
  DrawingStatus,
  type TechnicalDrawingResponse,
  type TechnicalDrawingRow,
  type AttachmentResponse,
} from "@/lib/userService";

import { useToastStore } from "@/lib/store/toastStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";

import { type DrawingFormValues, emptyDrawingForm } from "./_types";
import { StatusBadge } from "./_components/StatusBadge";
import { DrawingForm } from "./_components/DrawingForm";
import { DrawingDrawer } from "./_components/DrawingDrawer";
import { CheckSelect } from "@/app/_components/CheckSelect";

function fmtDate(value: string) {
  if (!value) return "—";
  const [y, m, day] = value.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}.${m}.${y.slice(-2)}`;
}

type CreateContractContext = { id: string; contractNo: string; products: { id: string; productType: string; quantity: number; unit: string }[] };

export default function TechnicalDrawingsPage() {
  const t = useT();
  const showToast = useToastStore((s) => s.show);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission("TechnicalDrawings.Create");
  const canUpdate = hasPermission("TechnicalDrawings.Update");
  const [rows, setRows] = useState<TechnicalDrawingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"active" | "archive">("active");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Drawer
  const [drawer, setDrawer] = useState<TechnicalDrawingResponse | null>(null);
  const [drawerFiles, setDrawerFiles] = useState<AttachmentResponse[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createContract, setCreateContract] = useState<CreateContractContext | null>(null);
  const [createForm, setCreateForm] = useState<DrawingFormValues>(emptyDrawingForm);
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);

  // Draft warning banner
  const [draftWarning, setDraftWarning] = useState<string | null>(null);

  // Sana column info tooltip
  const [sanaTipPos, setSanaTipPos] = useState<{ x: number; y: number } | null>(null);

  // Approve
  const [approving, setApproving] = useState(false);
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<TechnicalDrawingResponse | null>(null);

  // Edit form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TechnicalDrawingResponse | null>(null);
  const [editForm, setEditForm] = useState<DrawingFormValues>(emptyDrawingForm);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = async (p = page) => {
    setLoading(true);
    try {
      const isActiveFlag = viewMode === "active";
      const opts: Parameters<typeof technicalDrawingService.getPaged>[2] = { isActive: isActiveFlag };
      if (search.trim()) opts.search = search.trim();
      if (filterStatus === "no_drawing") opts.onlyMissing = true;
      else if (filterStatus !== "") opts.status = Number(filterStatus) as DrawingStatus;
      const data = await technicalDrawingService.getPaged(p, PAGE_SIZE, opts);
      setRows(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setRows([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [viewMode, search, filterStatus]);

  // Reload when page or filters change (debounce search)
  useEffect(() => {
    const t = setTimeout(() => { loadData(page); }, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, viewMode, search, filterStatus]);

  useEffect(() => {
    if (loading) return;
    const id = requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>(
        ".td-row-empty > td, .td-row-draft > td, .td-empty-badge, .td-row-draft .td-status-badge"
      );
      let anchor: number | null = null;
      els.forEach((el) => {
        for (const anim of el.getAnimations()) {
          const st = anim.startTime as number | null;
          if (anchor === null && typeof st === "number") anchor = st;
        }
      });
      if (anchor === null) return;
      const anchorTime = anchor;
      els.forEach((el) => {
        for (const anim of el.getAnimations()) {
          anim.startTime = anchorTime;
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [loading, rows]);

  // ── Drawer ────────────────────────────────────────────────────────────────

  const openDrawer = async (item: TechnicalDrawingResponse) => {
    setDrawer(item);
    setDrawerFiles([]);
    setDrawerLoading(true);
    try {
      const files = await technicalDrawingService.getFiles(item.id);
      setDrawerFiles(files);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = (ctx: { contractId: string; contractNo: string; product: { id: string; productType: string; quantity: number; unit: string } | null }) => {
    const products = ctx.product ? [ctx.product] : [];
    setCreateContract({ id: ctx.contractId, contractNo: ctx.contractNo, products });
    setCreateForm({
      ...emptyDrawingForm,
      contractProductId: ctx.product?.id ?? "",
    });
    setCreateSubmitted(false);
    window.history.pushState(null, "");
    setShowCreateForm(true);
  };

  const handleCreateSave = () => {
    setCreateSubmitted(true);
    if (!createForm.title.trim()) return;
    setDraftWarning(createForm.title.trim());
  };

  const handleCreateConfirm = async () => {
    setCreateSaving(true);
    try {
      const newId = await technicalDrawingService.create({
        contractId: createContract!.id,
        contractProductId: createForm.contractProductId || null,
        title: createForm.title.trim(),
        notes: createForm.notes.trim() || null,
      });
      if (createForm.files.length > 0) {
        await Promise.all(createForm.files.map((f) => technicalDrawingService.uploadFile(newId, f)));
      }
      await loadData();
      setDraftWarning(null);
      setShowCreateForm(false);
      showToast(t("Texnik chizma muvaffaqiyatli yaratildi!"));
    } finally {
      setCreateSaving(false);
    }
  };

  useEffect(() => {
    if (!showCreateForm) return;
    const handlePopState = () => setShowCreateForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showCreateForm]);

  // ── Approve ───────────────────────────────────────────────────────────────

  const handleApprove = (item: TechnicalDrawingResponse) => {
    setApproveConfirmTarget(item);
  };

  const handleApproveConfirm = async () => {
    if (!approveConfirmTarget) return;
    setApproving(true);
    try {
      await technicalDrawingService.updateStatus(approveConfirmTarget.id, DrawingStatus.Approved);
      await loadData();
      setDrawer(null);
      setDraftWarning(null);
      setApproveConfirmTarget(null);
      showToast(t("Texnik chizma tasdiqlandi!"));
    } finally {
      setApproving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const [editProducts, setEditProducts] = useState<{ id: string; productType: string; quantity: number; unit: string }[]>([]);

  const openEdit = async (item: TechnicalDrawingResponse) => {
    setEditTarget(item);
    setEditForm({ title: item.title, notes: item.notes || "", files: [], contractProductId: item.contractProductId ?? "" });
    setEditSubmitted(false);
    setDrawer(null);
    window.history.pushState(null, "");
    setShowEditForm(true);
    try {
      const products = await contractService.getProductsLookup(item.contractId);
      setEditProducts(products.map((p) => ({ id: p.id, productType: p.productType, quantity: p.quantity, unit: p.unit })));
    } catch {
      setEditProducts([]);
    }
  };

  const handleEditSave = async () => {
    setEditSubmitted(true);
    if (!editForm.title.trim()) return;
    setEditSaving(true);
    try {
      await technicalDrawingService.update(editTarget!.id, {
        title: editForm.title.trim(),
        notes: editForm.notes.trim() || null,
        contractProductId: editForm.contractProductId || undefined,
        clearContractProduct: !editForm.contractProductId,
      });
      if (editForm.files.length > 0) {
        await Promise.all(editForm.files.map((f) => technicalDrawingService.uploadFile(editTarget!.id, f)));
      }
      await loadData();
      setShowEditForm(false);
      showToast(t("Texnik chizma muvaffaqiyatli yangilandi!"));
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    if (!showEditForm) return;
    const handlePopState = () => setShowEditForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showEditForm]);

  // ── Draft warning modal ───────────────────────────────────────────────────

  const draftWarningModal = draftWarning && createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--warn)", borderRadius: 12, padding: 28, width: 380, maxWidth: "95vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--warn-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--warn)" }}>{t("Chizma qoralama holatida")}</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 20px" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>«{draftWarning}»</span> {t("chizmasi")}{" "}
          <span style={{ fontWeight: 600, color: "var(--warn)" }}>{t("qoralama")}</span> {t("holatida saqlanadi.")}
          {t("Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={() => setDraftWarning(null)} disabled={createSaving}>
            {t("Bekor qilish")}
          </button>
          <button className="btn btn-primary" onClick={handleCreateConfirm} disabled={createSaving}>
            {createSaving ? t("Saqlanmoqda...") : t("Tushundim, saqlash")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ── Approve confirm modal ─────────────────────────────────────────────────

  const approveConfirmModal = approveConfirmTarget && createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "95vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 20px" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>«{approveConfirmTarget.title}»</span> {t("texnik chizmasini")}{" "}
          <span style={{ fontWeight: 600, color: "var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={() => setApproveConfirmTarget(null)} disabled={approving}>
            {t("Bekor qilish")}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApproveConfirm}
            disabled={approving}
            style={{ background: "var(--success)", borderColor: "var(--success)" }}
          >
            {approving ? t("Tasdiqlanmoqda...") : t("Ha, tasdiqlash")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ── Render: Create form ───────────────────────────────────────────────────

  if (showCreateForm && createContract) {
    return (
      <>
        <DrawingForm
          mode="create"
          contract={createContract}
          form={createForm}
          setForm={setCreateForm}
          submitted={createSubmitted}
          saving={createSaving}
          onSave={handleCreateSave}
          onCancel={() => setShowCreateForm(false)}
        />
        {draftWarningModal}
        {approveConfirmModal}
      </>
    );
  }

  // ── Render: Edit form ─────────────────────────────────────────────────────

  if (showEditForm && editTarget) {
    return (
      <DrawingForm
        mode="edit"
        contract={{ contractNo: editTarget.contractNo, products: editProducts }}
        form={editForm}
        setForm={setEditForm}
        submitted={editSubmitted}
        saving={editSaving}
        onSave={handleEditSave}
        onCancel={() => setShowEditForm(false)}
      />
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes td-row-pulse {
          0%, 100% { background-color: var(--td-row-dim); }
          50%      { background-color: var(--td-row-bright); }
        }
        @keyframes td-badge-pulse {
          0%, 100% {
            background: var(--td-badge-dim-bg);
            color: var(--td-badge-dim-fg);
            box-shadow: 0 0 0 0 var(--td-badge-ring);
          }
          50% {
            background: var(--td-badge-bright-bg);
            color: #fff;
            box-shadow: 0 0 0 6px transparent;
          }
        }

        .td-row-empty {
          --td-row-dim: rgba(217,48,37,0.06);
          --td-row-bright: rgba(217,48,37,0.20);
          --td-badge-dim-bg: var(--danger-dim);
          --td-badge-dim-fg: var(--danger);
          --td-badge-bright-bg: var(--danger);
          --td-badge-ring: rgba(217,48,37,0.55);
        }
        .td-row-draft {
          --td-row-dim: rgba(224,123,0,0.06);
          --td-row-bright: rgba(224,123,0,0.20);
          --td-badge-dim-bg: var(--warn-dim);
          --td-badge-dim-fg: var(--warn);
          --td-badge-bright-bg: var(--warn);
          --td-badge-ring: rgba(224,123,0,0.55);
        }

        .td-row-empty > td,
        .td-row-draft > td {
          animation: td-row-pulse 1.6s ease-in-out infinite;
        }
        .td-row-empty:hover > td {
          animation-play-state: paused;
          background-color: rgba(217,48,37,0.22) !important;
        }
        .td-row-draft:hover > td {
          animation-play-state: paused;
          background-color: rgba(224,123,0,0.22) !important;
        }
        .td-empty-badge,
        .td-row-draft .td-status-badge {
          animation: td-badge-pulse 1.6s ease-in-out infinite;
        }
        .td-empty-badge {
          border: 1px solid rgba(217,48,37,0.4) !important;
        }
        .td-row-draft .td-status-badge {
          border: 1px solid rgba(224,123,0,0.45) !important;
        }

        .td-th-info-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .td-th-info {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid var(--text3);
          color: var(--text3);
          font-size: 10px;
          font-weight: 700;
          font-style: italic;
          font-family: Georgia, serif;
          line-height: 1;
          cursor: default;
          transition: color 0.15s, border-color 0.15s;
        }
        .td-th-info-wrap:hover .td-th-info {
          color: var(--accent);
          border-color: var(--accent);
        }
        .td-th-info-tip {
          position: fixed;
          transform: translateX(-50%);
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          width: 240px;
          font-family: Inter, sans-serif;
          font-size: 12px;
          font-weight: 400;
          font-style: normal;
          text-transform: none;
          letter-spacing: 0;
          line-height: 1.55;
          text-align: left;
          white-space: normal;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
          pointer-events: none;
          z-index: 1000;
          animation: td-tip-fade 0.15s ease-out;
        }
        @keyframes td-tip-fade {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .td-th-info-tip::before,
        .td-th-info-tip::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 100%;
          border: 6px solid transparent;
          border-bottom-color: var(--border);
          transform: translateX(-50%);
        }
        .td-th-info-tip::after {
          border-width: 5px;
          border-bottom-color: var(--surface);
          transform: translateX(-50%) translateY(1px);
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontFamily: "Inter, sans-serif" }}>

        {/* Filter bar */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
          {/* Faol / Arxiv tab toggle */}
          <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0 }}>
            <button
              onClick={() => setViewMode("active")}
              style={{
                padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
                background: viewMode === "active" ? "var(--accent)" : "transparent",
                color: viewMode === "active" ? "#fff" : "var(--text2)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {t("Faol")}
            </button>
            <button
              onClick={() => setViewMode("archive")}
              style={{
                padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
                background: viewMode === "archive" ? "var(--text3)" : "transparent",
                color: viewMode === "archive" ? "#fff" : "var(--text2)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="21 8 21 21 3 21 3 8"/>
                <rect x="1" y="3" width="22" height="5"/>
                <line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              {t("Arxiv")}
            </button>
          </div>

          <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
            <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              placeholder={t("Qidirish: nomi, shartnoma...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <CheckSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { id: "no_drawing", name: t("Chizma yo'q") },
              { id: String(DrawingStatus.Draft), name: t("Qoralama") },
              { id: String(DrawingStatus.InProgress), name: t("Jarayonda") },
              { id: String(DrawingStatus.Approved), name: t("Tasdiqlangan") },
            ]}
            placeholder={t("Barcha statuslar")}
            style={{ width: 175 }}
          />

          <button
            className="btn-icon"
            onClick={() => loadData()}
            title={t("Yangilash")}
            style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23,4 23,10 17,10" />
              <polyline points="1,20 1,14 7,14" />
              <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
          {loading ? (
            <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
              <table className="itm-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Shartnoma")}</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Mahsulot")}</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Yaratuvchi")}</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Status")}</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>
                      <span className="td-th-info-wrap">
                        {t("Sana")}
                        <span
                          className="td-th-info"
                          onMouseEnter={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setSanaTipPos({ x: r.left + r.width / 2, y: r.bottom + 8 });
                          }}
                          onMouseLeave={() => setSanaTipPos(null)}
                        >
                          i
                        </span>
                      </span>
                    </th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Faollik")}</th>
                    <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)" }}>{t("Amal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px 14px", color: "var(--text3)" }}>
                        {viewMode === "archive" ? t("Arxivda chizmalar yo'q") : t("Ma'lumot topilmadi")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => {
                      const ordinal = String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0");
                      if (row.kind === 1 && row.empty) {
                        const e = row.empty;
                        const rowKey = `empty-${e.contractId}-${e.productId ?? "general"}`;
                        return (
                          <tr key={rowKey} className="td-row-empty">
                            <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px", color: "var(--danger)", fontWeight: 700 }}>
                              {ordinal}
                            </td>
                            <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", fontWeight: 600 }}>{e.contractNo}</td>
                            <td style={{ textAlign: "center", maxWidth: 220, color: "var(--text1)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.productType ?? t("Umumiy")}
                            </td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ textAlign: "center" }}>
                              <span
                                className="td-empty-badge"
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                                  padding: "3px 12px", minWidth: 120,
                                  borderRadius: 20, fontSize: 12, fontWeight: 700,
                                }}
                              >
                                <span style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: "currentColor",
                                }} />
                                {t("Chizma yo'q")}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ borderLeft: "2px solid var(--border)" }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                {canCreate && (
                                  <button
                                    className="btn-icon"
                                    onClick={() => openCreate({
                                      contractId: e.contractId,
                                      contractNo: e.contractNo,
                                      product: e.productId && e.productType && e.quantity != null && e.unit != null
                                        ? { id: e.productId, productType: e.productType, quantity: e.quantity, unit: e.unit }
                                        : null,
                                    })}
                                    title={t("Chizma yaratish")}
                                    style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)", width: 28, height: 28, fontSize: 18, fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (!row.drawing) return null;
                      const item = row.drawing;
                      const isDraft = item.status === DrawingStatus.Draft;
                      return (
                        <tr key={item.id} className={isDraft ? "td-row-draft" : undefined}>
                          <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px", color: isDraft ? "var(--warn)" : undefined, fontWeight: isDraft ? 700 : undefined }}>
                            {ordinal}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => openDrawer(item)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "Inter, sans-serif" }}
                            >
                              {item.contractNo}
                            </button>
                          </td>
                          <td style={{ textAlign: "center", maxWidth: 220, color: "var(--text1)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.productType ? item.productType : t("Umumiy")}
                          </td>
                          <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.createdByFullName ?? "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <StatusBadge status={item.status} className="td-status-badge" />
                          </td>
                          <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", fontFamily: "Inter, sans-serif" }}>
                            {fmtDate(item.createdAt)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", padding: "2px 10px",
                              borderRadius: 20, fontSize: 13, fontWeight: 600,
                              background: item.isActive ? "#dcfce7" : "var(--danger-dim)",
                              color: item.isActive ? "#16a34a" : "var(--danger)",
                              border: `1px solid ${item.isActive ? "#86efac" : "var(--danger)"}`,
                            }}>
                              {item.isActive ? t("Faol") : t("Nofaol")}
                            </span>
                          </td>
                          <td style={{ borderLeft: "2px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                className="btn-icon"
                                onClick={() => openDrawer(item)}
                                title={t("Ko'rish")}
                                style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              {canUpdate && item.status !== DrawingStatus.Approved && (
                                <button
                                  className="btn-icon"
                                  onClick={() => openEdit(item)}
                                  title={t("Tahrirlash")}
                                  style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              )}
                              {canUpdate && item.status !== DrawingStatus.Approved && (
                                <button
                                  className="btn-icon"
                                  onClick={() => handleApprove(item)}
                                  title={t("Tasdiqlash")}
                                  disabled={approving}
                                  style={{ color: "#f59e0b", borderColor: "#f59e0b33", background: "#f59e0b12" }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
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
      </div>

      {/* Drawer */}
      {drawer && (
        <DrawingDrawer
          drawer={drawer}
          drawerFiles={drawerFiles}
          drawerLoading={drawerLoading}
          onClose={() => setDrawer(null)}
        />
      )}

      {draftWarningModal}
      {approveConfirmModal}

      {sanaTipPos && createPortal(
        <div className="td-th-info-tip" style={{ left: sanaTipPos.x, top: sanaTipPos.y }}>
          {t("Texnik chizma yaratilgan sana ko'rsatiladi. Chizma yaratilmagan bo'lsa — chiziqcha chiqadi.")}
        </div>,
        document.body
      )}

    </div>
  );
}
