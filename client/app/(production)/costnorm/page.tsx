"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDraft } from "@/lib/useDraft";
import { useToastStore } from "@/lib/store/toastStore";
import { useAuthStore } from "@/lib/store/authStore";
import { Upload, Image as ImageIcon, ImageOff } from "lucide-react";
import {
  costNormService,
  DrawingStatus,
  type AttachmentResponse,
} from "@/lib/userService";
import {
  type MaterialRow,
  type ParsedTable,
  type CnMode,
  type CostNormResponse,
  type CostNormItemResponse,
  type CostNormMetadata,
  computeGating,
  parseMainTables,
  parseDocxMetadata,
  scopeKey,
} from "../techprocess/_types";
import { CnBadge } from "../techprocess/_components/CnBadge";
import { TpBadge } from "../techprocess/_components/TpBadge";
import { CollapsibleItemsTable } from "../techprocess/_components/CollapsibleItemsTable";
import { CostNormA4Sheet } from "../techprocess/_components/CostNormA4Sheet";
import { FileParsingOverlay } from "../techprocess/_components/FileParsingOverlay";
import { WorkflowPipeline } from "../techprocess/_components/WorkflowPipeline";
import { ReadinessToolbar } from "../techprocess/_components/ReadinessToolbar";
import { ReadinessPagination } from "../techprocess/_components/ReadinessPagination";
import { DrawingWarningModal, ApproveConfirmModal, DraftWarningModal } from "../techprocess/_components/ReadinessModals";
import { useReadiness } from "../techprocess/_components/useReadiness";

// ─── Me'yoriy sarf (CostNorm) sahifasi ──────────────────────────────────────────
// Texnologik jarayondan alohida bo'lim — `StageType.CostNorm` bosqichi uchun.

export default function CostNormPage() {
  const showToast = useToastStore((s) => s.show);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreateCn = hasPermission("CostNorm.Create");
  const canUpdateCn = hasPermission("CostNorm.Update");

  const {
    viewMode, setViewMode, search, setSearch,
    items, loading, page, setPage, totalPages, totalCount,
    contractList, reload, loadContracts, PAGE_SIZE,
  } = useReadiness();

  // Detallarni ochish uchun to'liq CostNorm yozuvlari.
  const [cnList, setCnList] = useState<CostNormResponse[]>([]);
  const [cnListLoading, setCnListLoading] = useState(true);

  const loadCn = useCallback(async () => {
    setCnListLoading(true);
    const d = await costNormService.getAll(undefined, viewMode === "active");
    setCnList(d); setCnListLoading(false);
  }, [viewMode]);
  useEffect(() => { loadCn(); }, [loadCn]);

  // ── Scope detail (pipeline + CN panel) ──────────────────────────────────────
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);
  const [drawingWarningNo, setDrawingWarningNo] = useState<string | null>(null);

  // ── CN flows: create / detail / edit ────────────────────────────────────────
  const [cnMode, setCnMode] = useState<CnMode>("list");
  const [cnShowPhotos, setCnShowPhotos] = useState(false);
  const [cnSelected, setCnSelected] = useState<CostNormResponse | null>(null);
  const [cnActiveTab, setCnActiveTab] = useState(0);
  const [cnDetailFiles, setCnDetailFiles] = useState<AttachmentResponse[]>([]);
  const [cnDetailItems, setCnDetailItems] = useState<CostNormItemResponse[]>([]);
  const [cnForm, setCnForm] = useState({ contractId: "", contractProductId: "", title: "", notes: "" });
  const [cnSubmitted, setCnSubmitted] = useState(false);
  const [cnSaving, setCnSaving] = useState(false);
  const [cnCreateTab, setCnCreateTab] = useState<"form" | "table">("form");
  const [cnSaveError, setCnSaveError] = useState<string | null>(null);
  const [cnDraftWarning, setCnDraftWarning] = useState<string | null>(null);
  const [cnApproveTarget, setCnApproveTarget] = useState<{ id: string; title: string } | null>(null);
  const [cnApproving, setCnApproving] = useState(false);
  const [cnEditingNorm, setCnEditingNorm] = useState<CostNormResponse | null>(null);
  const [cnEditForm, setCnEditForm] = useState({ title: "", notes: "" });
  const [cnEditItems, setCnEditItems] = useState<MaterialRow[]>([]);
  const [cnEditFiles, setCnEditFiles] = useState<AttachmentResponse[]>([]);
  const [cnEditNewFile, setCnEditNewFile] = useState<File | null>(null);
  const [cnEditSaving, setCnEditSaving] = useState(false);
  const [cnEditSaveError, setCnEditSaveError] = useState<string | null>(null);
  const cnEditFileRef = useRef<HTMLInputElement>(null);
  const [cnFormFile, setCnFormFile] = useState<File | null>(null);
  const [cnParsedTables, setCnParsedTables] = useState<ParsedTable[]>([]);
  const [cnParsedMetadata, setCnParsedMetadata] = useState<CostNormMetadata | null>(null);
  const [cnParseLoading, setCnParseLoading] = useState(false);
  const [cnParseError, setCnParseError] = useState<string | null>(null);
  const cnFormFileRef = useRef<HTMLInputElement>(null);
  const [cnFileOverlayVisible, setCnFileOverlayVisible] = useState(false);
  const [cnFileParseReady, setCnFileParseReady] = useState(false);
  const cnPendingParseResult = useRef<{ tables: ParsedTable[]; metadata: CostNormMetadata | null; error: string | null; fileName: string } | null>(null);

  useDraft("draft_costnorm", cnMode === "create", cnForm, (d) => { if (d.contractId) { setCnForm(d); setCnMode("create"); } else { sessionStorage.removeItem("draft_costnorm"); } });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleCnFormFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) { setCnParseError("Faqat .docx format"); return; }
    setCnFormFile(file); setCnParseError(null); setCnParsedTables([]); setCnParsedMetadata(null); setCnParseLoading(true); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current = null;
    try {
      const mammoth = await import("mammoth");
      const ab = await file.arrayBuffer();
      const res = await mammoth.convertToHtml({ arrayBuffer: ab });
      const { tables: parsed, error: colError } = parseMainTables(res.value);
      const metadata = parseDocxMetadata(res.value);
      if (colError) cnPendingParseResult.current = { tables: [], metadata, error: colError, fileName: file.name };
      else if (parsed.length === 0) cnPendingParseResult.current = { tables: [], metadata, error: "Faylda mos jadval topilmadi.", fileName: file.name };
      else cnPendingParseResult.current = { tables: parsed, metadata, error: null, fileName: file.name };
    } catch { cnPendingParseResult.current = { tables: [], metadata: null, error: "Faylni o'qishda xatolik", fileName: file.name }; }
    setCnFileParseReady(true);
  }

  function openCnCreate(prefilledContractId?: string, prefilledContractProductId?: string | null) {
    setCnForm({ contractId: prefilledContractId || "", contractProductId: prefilledContractProductId ?? "", title: "", notes: "" }); setCnFormFile(null); setCnParsedTables([]); setCnParsedMetadata(null); setCnParseError(null); setCnSaveError(null); setCnSubmitted(false); setCnActiveTab(0); setCnCreateTab("form");
    window.history.pushState({ mode: "create" }, "");
    setCnMode("create");
  }

  function handleCnSave() {
    setCnSubmitted(true); setCnSaveError(null);
    if (!cnForm.contractId) { setCnSaveError("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring."); return; }
    if (!cnForm.title.trim() && !cnFormFile) { setCnSaveError("Nomi kiritilmagan. Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting."); return; }
    if (cnParsedTables.length === 0) { setCnSaveError("Me'yoriy sarf jadvali faylini yuklang va qayta urinib ko'ring."); return; }
    const title = cnForm.title.trim() || cnFormFile?.name?.replace(/\.docx$/i, "") || "";
    setCnDraftWarning(title);
  }

  async function handleCnSaveConfirm() {
    setCnSaving(true);
    try {
      const allRows = cnParsedTables.flatMap(t => t.rows);
      const items = allRows.map((row, idx) => ({ isSection: row.isSection, sectionName: row.isSection ? row.sectionName : null, no: row.no || null, name: row.name || null, unit: row.unit || null, readyQty: row.readyQty || null, wasteQty: row.wasteQty || null, totalQty: row.totalQty || null, photoRaw: row.photoRaw || null, photoSemi: row.photoSemi || null, importType: row.importType || null, sortOrder: idx }));
      await costNormService.create({ contractId: cnForm.contractId, contractProductId: cnForm.contractProductId || null, title: cnForm.title || cnFormFile?.name?.replace(/\.docx$/i, "") || "", notes: cnForm.notes || null, items, metadata: cnParsedMetadata });
      await Promise.all([loadCn(), reload()]);
      setCnDraftWarning(null); setCnMode("list");
      showToast("Me'yoriy sarf muvaffaqiyatli yaratildi!");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setCnSaveError(msg ?? "Saqlashda xatolik yuz berdi");
      setCnDraftWarning(null);
    } finally { setCnSaving(false); }
  }

  function handleCnApprove(norm: { id: string; title: string }) { setCnApproveTarget({ id: norm.id, title: norm.title }); }

  async function handleCnApproveConfirm() {
    if (!cnApproveTarget) return;
    setCnApproving(true);
    try {
      await costNormService.approve(cnApproveTarget.id);
      setCnList(prev => prev.map(n => n.id === cnApproveTarget.id ? { ...n, status: DrawingStatus.Approved } : n));
      if (cnSelected?.id === cnApproveTarget.id) setCnSelected(n => n ? { ...n, status: DrawingStatus.Approved } : n);
      await reload();
      setCnApproveTarget(null);
      showToast("Me'yoriy sarf tasdiqlandi!");
    } finally { setCnApproving(false); }
  }

  function openCnDetail(norm: CostNormResponse) {
    setCnSelected(norm); setCnActiveTab(0); setCnShowPhotos(false); setCnDetailFiles([]); setCnDetailItems([...norm.items].sort((a, b) => a.sortOrder - b.sortOrder));
    window.history.pushState({ mode: "detail" }, ""); setCnMode("detail");
    costNormService.getFiles(norm.id).then(setCnDetailFiles).catch(() => {});
  }

  async function openCnEdit(norm: CostNormResponse) {
    setCnEditingNorm(norm); setCnEditForm({ title: norm.title, notes: norm.notes || "" }); setCnEditNewFile(null); setCnEditSaveError(null); setCnEditSaving(false); setCnShowPhotos(false);
    setCnEditItems([...norm.items].sort((a, b) => a.sortOrder - b.sortOrder).map(it => ({ no: it.no || "", name: it.name || "", unit: it.unit || "", readyQty: it.readyQty || "", wasteQty: it.wasteQty || "", totalQty: it.totalQty || "", photoRaw: it.photoRaw || "", photoSemi: it.photoSemi || "", importType: it.importType || "", isSection: it.isSection, sectionName: it.sectionName || "" })));
    window.history.pushState({ mode: "edit" }, ""); setCnMode("edit");
    try { const files = await costNormService.getFiles(norm.id); setCnEditFiles(files); } catch { setCnEditFiles([]); }
  }

  async function handleEditCnFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) { setCnEditSaveError("Faqat .docx format"); return; }
    setCnEditNewFile(file); setCnEditSaveError(null); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current = null;
    try {
      const mammoth = await import("mammoth"); const ab = await file.arrayBuffer(); const res = await mammoth.convertToHtml({ arrayBuffer: ab });
      const { tables: parsed, error } = parseMainTables(res.value);
      const metadata = parseDocxMetadata(res.value);
      if (error) cnPendingParseResult.current = { tables: [], metadata, error, fileName: file.name };
      else if (parsed.length > 0) { cnPendingParseResult.current = { tables: parsed, metadata, error: null, fileName: file.name }; }
      else cnPendingParseResult.current = { tables: [], metadata, error: null, fileName: file.name };
    } catch { cnPendingParseResult.current = { tables: [], metadata: null, error: "Faylni o'qishda xatolik", fileName: file.name }; }
    setCnFileParseReady(true);
  }

  async function handleCnEditSave() {
    if (!cnEditingNorm) return; setCnEditSaving(true); setCnEditSaveError(null);
    try {
      const items = cnEditItems.map((row, idx) => ({ isSection: row.isSection, sectionName: row.isSection ? row.sectionName : null, no: row.no || null, name: row.name || null, unit: row.unit || null, readyQty: row.readyQty || null, wasteQty: row.wasteQty || null, totalQty: row.totalQty || null, photoRaw: row.photoRaw || null, photoSemi: row.photoSemi || null, importType: row.importType || null, sortOrder: idx }));
      const newMeta = cnPendingParseResult.current?.metadata ?? null;
      await costNormService.update(cnEditingNorm.id, { title: cnEditForm.title, notes: cnEditForm.notes || null, items, metadata: newMeta });
      await Promise.all([loadCn(), reload()]);
      setCnMode("list"); setCnEditingNorm(null);
    } catch { setCnEditSaveError("Saqlashda xatolik yuz berdi"); }
    finally { setCnEditSaving(false); }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const cnDataCount = cnParsedTables[cnActiveTab]?.rows.filter(r => !r.isSection).length ?? 0;
  const cnCurrentRows = cnParsedTables[cnActiveTab]?.rows ?? [];

  // ── CN: full-page create form ────────────────────────────────────────────────
  if (cnMode === "create") {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {cnFileOverlayVisible && (
            <FileParsingOverlay dataReady={cnFileParseReady} onComplete={() => {
              setCnFileOverlayVisible(false); setCnParseLoading(false);
              const res = cnPendingParseResult.current;
              if (res) {
                if (res.error) setCnParseError(res.error);
                else { setCnParsedTables(res.tables); setCnParsedMetadata(res.metadata); setCnCreateTab("table"); if (!cnForm.title) setCnForm(f => ({ ...f, title: res.fileName.replace(/\.docx$/i, "") })); }
              }
            }} />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setCnMode("list")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                Orqaga
              </button>
              <span style={{ color: "var(--border)" }}>|</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi me&apos;yoriy sarf</span>
            </div>
          </div>
          <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16, padding: "0 16px", flexShrink: 0 }}>
            <button onClick={() => setCnCreateTab("form")}
              style={{ padding: "12px 20px", fontSize: 13, fontWeight: cnCreateTab === "form" ? 700 : 500, color: cnCreateTab === "form" ? "var(--accent,#1a56db)" : "var(--text2)", background: "none", border: "none", borderBottom: cnCreateTab === "form" ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
              Forma
            </button>
            <button onClick={() => cnParsedTables.length > 0 && setCnCreateTab("table")}
              style={{ padding: "12px 20px", fontSize: 13, fontWeight: cnCreateTab === "table" ? 700 : 500, color: cnCreateTab === "table" ? "var(--accent,#1a56db)" : cnParsedTables.length === 0 ? "var(--text3)" : "var(--text2)", background: "none", border: "none", borderBottom: cnCreateTab === "table" ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: cnParsedTables.length > 0 ? "pointer" : "default", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
              Jadval ko&apos;rinishi
              {cnParsedTables.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: "var(--accent,#1a56db)", color: "#fff", borderRadius: 20, padding: "1px 7px" }}>{cnDataCount}</span>}
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setCnMode("list")} style={{ padding: "8px 18px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Bekor qilish</button>
              <button onClick={handleCnSave} disabled={cnSaving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: "var(--radius)", border: "none", background: "var(--accent,#1a56db)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: cnSaving ? 0.7 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /></svg>
                {cnSaving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
          {cnCreateTab === "form" && (
            <div className="itm-card" style={{ padding: 28, flexShrink: 0 }}>
              {cnSaveError && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{cnSaveError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {(() => {
                  const cnContract = contractList.find(c => c.id === cnForm.contractId);
                  const cnProducts = cnContract?.products ?? [];
                  const cnHasProducts = cnProducts.length > 0;
                  return (
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Mahsulot</label>
                      <select className="form-input" value={cnForm.contractProductId} onChange={e => setCnForm(f => ({ ...f, contractProductId: e.target.value }))}>
                        {!cnHasProducts && <option value="">Umumiy (butun shartnoma uchun)</option>}
                        {cnProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.productType} — {p.quantity.toLocaleString()} {p.unit}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: cnSubmitted && !cnForm.title.trim() && !cnFormFile ? "var(--danger)" : "var(--text2)" }}>
                    Nomi <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input className="form-input" value={cnForm.title} onChange={e => setCnForm(f => ({ ...f, title: e.target.value }))} placeholder="Avtomatik to'ldiriladi" style={{ borderColor: cnSubmitted && !cnForm.title.trim() && !cnFormFile ? "var(--danger)" : undefined }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Izoh</label>
                    <textarea className="form-input" value={cnForm.notes} onChange={e => setCnForm(f => ({ ...f, notes: e.target.value }))} placeholder="Qo'shimcha izoh (ixtiyoriy)" style={{ resize: "none", flex: 1, minHeight: 130 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: cnSubmitted && cnParsedTables.length === 0 ? "var(--danger)" : "var(--text2)" }}>
                        DOCX fayl <span style={{ color: "var(--danger)" }}>*</span>
                        <span style={{ fontWeight: 400, color: "var(--text3)", marginLeft: 6 }}>(me&apos;yoriy sarf jadvali)</span>
                      </label>
                      <a href="/namuna_meyoriy_sarf.docx" download
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: "var(--radius)", background: "var(--accent)", border: "1px solid var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "background 0.15s,transform 0.1s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--accent2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
                        title="Ustunlar tartibi to'g'ri bo'lgan namunaviy faylni yuklab oling">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Namuna fayl
                      </a>
                    </div>
                    <label htmlFor="cn-file-docx" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", border: `2px dashed ${cnSubmitted && cnParsedTables.length === 0 ? "var(--danger)" : "var(--border)"}`, borderRadius: 10, padding: "20px 16px", background: "var(--bg1)", transition: "border-color 0.15s", textAlign: "center", minHeight: 130 }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"} onMouseLeave={e => e.currentTarget.style.borderColor = cnSubmitted && cnParsedTables.length === 0 ? "var(--danger)" : "var(--border)"}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      {cnFormFile ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{cnFormFile.name}</span>
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>{(cnFormFile.size / 1024).toFixed(0)} KB — o&apos;zgartirish uchun bosing</span>
                          <button onClick={e => { e.preventDefault(); setCnFormFile(null); setCnParsedTables([]); setCnCreateTab("form"); if (cnFormFileRef.current) cnFormFileRef.current.value = ""; }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 8px", color: "var(--text3)", fontSize: 11, textDecoration: "underline" }}>Olib tashlash</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Fayl tanlash</span>
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>Faylni tanlash uchun bosing</span>
                        </>
                      )}
                      <input id="cn-file-docx" ref={cnFormFileRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleCnFormFileChange} />
                    </label>
                    {cnSubmitted && cnParsedTables.length === 0 && !cnParseLoading && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Fayl yuklash shart</div>}
                    {cnParseError && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{cnParseError}</div>}
                    {cnParsedTables.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--text2)" }}>{cnDataCount} ta yozuv topildi</span>
                        <button onClick={() => setCnCreateTab("table")} style={{ fontSize: 12, color: "var(--accent,#1a56db)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Jadvalga o&apos;tish →</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {cnCreateTab === "table" && (
            <div className="cn-a4-toolbar itm-card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", flexShrink: 0, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>{cnParsedTables.length} ta jadval · {cnDataCount} ta yozuv</span>
              {cnParsedTables.length > 1 && (
                <div style={{ display: "flex", gap: 4 }}>
                  {cnParsedTables.map((t, i) => (
                    <button key={i} onClick={() => setCnActiveTab(i)}
                      style={{ padding: "3px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", fontWeight: cnActiveTab === i ? 700 : 400, background: cnActiveTab === i ? "var(--accent,#1a56db)" : "var(--bg2)", color: cnActiveTab === i ? "#fff" : "var(--text2)", whiteSpace: "nowrap" }}>
                      {t.title} <span style={{ opacity: 0.75 }}>({t.rows.filter(r => !r.isSection).length})</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setCnShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", height: 30, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: cnShowPhotos ? "var(--accent-dim,#e8f0fe)" : "var(--bg2)", color: cnShowPhotos ? "var(--accent,#1a56db)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                {cnShowPhotos ? <ImageIcon size={12} /> : <ImageOff size={12} />} {cnShowPhotos ? "Yashirish" : "Fotolar"}
              </button>
            </div>
          )}
          {cnCreateTab === "table" && (
            <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", minHeight: 0 }}>
              {(() => {
                const cnContract = contractList.find(c => c.id === cnForm.contractId);
                const cnProduct = cnContract?.products.find(p => p.id === cnForm.contractProductId);
                return (
                  <CostNormA4Sheet
                    rows={cnCurrentRows}
                    showPhotos={cnShowPhotos}
                    title={cnForm.title || cnFormFile?.name?.replace(/\.docx$/i, "") || cnParsedTables[cnActiveTab]?.title}
                    contractNo={cnContract?.contractNo}
                    productType={cnProduct?.productType}
                    metadata={cnParsedMetadata}
                    onUpdateRow={(flatIdx, updated) => { setCnParsedTables(prev => { const next = [...prev]; const tab = { ...next[cnActiveTab], rows: [...next[cnActiveTab].rows] }; tab.rows[flatIdx] = { ...tab.rows[flatIdx], ...updated }; next[cnActiveTab] = tab; return next; }); }}
                    onDeleteRow={(flatIdx) => { setCnParsedTables(prev => { const next = [...prev]; const tab = { ...next[cnActiveTab], rows: [...next[cnActiveTab].rows] }; tab.rows.splice(flatIdx, 1); next[cnActiveTab] = tab; return next; }); }}
                  />
                );
              })()}
            </div>
          )}
        </div>
        <DraftWarningModal title={cnDraftWarning} kindLabel="Me'yoriy sarf" busy={cnSaving} onCancel={() => setCnDraftWarning(null)} onConfirm={handleCnSaveConfirm} />
      </>
    );
  }

  // ── CN: items detail view ────────────────────────────────────────────────────
  if (cnMode === "detail" && cnSelected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => { setCnMode("list"); setCnSelected(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            Orqaga
          </button>
        </div>
        <div className="itm-card" style={{ marginBottom: 16, flexShrink: 0, overflow: "hidden" }}>
          <div style={{ padding: "11px 20px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>Asosiy ma&apos;lumotlar</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {cnDetailFiles.map(f => (
                <button key={f.id} onClick={() => costNormService.downloadFile(cnSelected.id, f.id, f.fileName)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text1)", fontSize: 12, cursor: "pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  {f.fileName}
                </button>
              ))}
              <button onClick={() => setCnShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: cnShowPhotos ? "var(--accent-dim)" : "var(--bg2)", color: cnShowPhotos ? "var(--accent)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                {cnShowPhotos ? <ImageIcon size={12} /> : <ImageOff size={12} />} {cnShowPhotos ? "Fotolarni yashirish" : "Fotolarni ko'rsatish"}
              </button>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 24px" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Shartnoma</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>{cnSelected.contractNo}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{cnSelected.productType ? `📦 ${cnSelected.productType}` : "📋 Umumiy"}</div>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Nomi</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{cnSelected.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Holat</div>
              <CnBadge status={cnSelected.status} />
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <CollapsibleItemsTable rows={cnDetailItems} showPhotos={cnShowPhotos} />
          </div>
        </div>
      </div>
    );
  }

  // ── CN: edit view ────────────────────────────────────────────────────────────
  if (cnMode === "edit" && cnEditingNorm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {cnFileOverlayVisible && (
          <FileParsingOverlay dataReady={cnFileParseReady} onComplete={() => {
            setCnFileOverlayVisible(false);
            const res = cnPendingParseResult.current;
            if (res && !res.error && res.tables.length > 0) { setCnEditItems(res.tables.flatMap(t => t.rows)); }
            else if (res?.error) { setCnEditSaveError(res.error); }
          }} />
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => { setCnMode("list"); setCnEditingNorm(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            Orqaga
          </button>
          <button onClick={handleCnEditSave} disabled={cnEditSaving}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 20px", borderRadius: "var(--radius)", border: "none", background: "var(--accent,#1a56db)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: cnEditSaving ? 0.7 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /></svg>
            {cnEditSaving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
        <div className="itm-card" style={{ padding: 20, marginBottom: 16, flexShrink: 0 }}>
          {cnEditSaveError && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{cnEditSaveError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5, color: "var(--text2)" }}>Nomi</label>
              <input className="form-input" value={cnEditForm.title} onChange={e => setCnEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5, color: "var(--text2)" }}>Izoh</label>
              <input className="form-input" value={cnEditForm.notes} onChange={e => setCnEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Fayl almashtirish (ixtiyoriy)</label>
                <a href="/namuna_meyoriy_sarf.docx" download
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent)", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                  title="Namunaviy DOCX faylni yuklab oling">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Namuna
                </a>
              </div>
              <input ref={cnEditFileRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleEditCnFileChange} />
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "0 10px", height: 40, boxSizing: "border-box" }}>
                <button onClick={() => cnEditFileRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "border-color 0.14s,color 0.14s", flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
                  <Upload size={13} /> Fayl tanlash
                </button>
                {cnEditNewFile && <span style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{cnEditNewFile.name}</span>}
                {!cnEditNewFile && cnEditFiles.length > 0 && <span style={{ fontSize: 11, color: "var(--text3)", flex: 1 }}>{cnEditFiles.length} ta fayl</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{cnEditItems.filter(r => !r.isSection).length} ta yozuv</span>
            <button onClick={() => setCnShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: cnShowPhotos ? "var(--accent-dim)" : "var(--bg2)", color: cnShowPhotos ? "var(--accent)" : "var(--text2)", fontSize: 11, cursor: "pointer" }}>
              {cnShowPhotos ? <ImageIcon size={11} /> : <ImageOff size={11} />} {cnShowPhotos ? "Fotolar yashirish" : "Fotolar"}
            </button>
          </div>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <CollapsibleItemsTable rows={cnEditItems} showPhotos={cnShowPhotos}
              onUpdateRow={(flatIdx, updated) => { setCnEditItems(prev => { const next = [...prev]; next[flatIdx] = { ...next[flatIdx], ...updated }; return next; }); }}
              onDeleteRow={(flatIdx) => { setCnEditItems(prev => prev.filter((_, i) => i !== flatIdx)); }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Scope detail (pipeline + CN panel) ───────────────────────────────────────
  const selectedItem = items.find(i => scopeKey(i.contractId, i.contractProductId) === selectedScopeKey) ?? null;

  if (selectedItem) {
    const g = computeGating(selectedItem);
    const cnEffective = g.cn;
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => setSelectedScopeKey(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Orqaga
            </button>
            <span style={{ color: "var(--border)" }}>|</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>{selectedItem.contractNo}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            {selectedItem.contractProductId === null ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 10px" }}>📋 Umumiy</span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>
                📦 {selectedItem.productType}
                {selectedItem.productQuantity !== null && (
                  <span style={{ color: "var(--text3)", fontWeight: 500, marginLeft: 6 }}>· {selectedItem.productQuantity.toLocaleString()} {selectedItem.productUnit ?? ""}</span>
                )}
              </span>
            )}
          </div>

          <WorkflowPipeline scope={selectedItem} />

          {/* CN Panel */}
          <div className="itm-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text1)" }}>Me&apos;yoriy sarf</span>
              </div>
              {cnEffective && (
                <div style={{ display: "flex", gap: 4 }}>
                  {cnEffective.status === DrawingStatus.InProgress && canUpdateCn && (
                    <button onClick={() => handleCnApprove({ id: cnEffective.id, title: cnEffective.title })} disabled={cnApproving}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--success-dim)", border: "1px solid rgba(15,123,69,0.2)", color: "var(--success)", cursor: "pointer", opacity: cnApproving ? 0.6 : 1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      {cnApproving ? "..." : "Tasdiqlash"}
                    </button>
                  )}
                  <button onClick={() => { const full = cnList.find(n => n.id === cnEffective.id); if (full) openCnDetail(full); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#e8f0fe", border: "1px solid #a4c0f4", color: "#1a56db", cursor: "pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    Ko&apos;rish
                  </button>
                  {canUpdateCn && (
                    <button onClick={() => { const full = cnList.find(n => n.id === cnEffective.id); if (full) openCnEdit(full); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Tahrirlash
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 16px" }}>
              {!g.cnReachable && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#fef9c3", border: "1px solid #fde047", marginBottom: cnEffective ? 12 : 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#854d0e", marginBottom: 2 }}>Bosqich hali boshlanmagan</div>
                    <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                      Me&apos;yoriy sarf bilan ishlash uchun <strong>avvalgi bosqichlar yakunlanishi</strong>{" "}kerak.
                    </div>
                  </div>
                </div>
              )}
              {!cnEffective ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 12 }}>Me&apos;yoriy sarf yaratilmagan</div>
                  {g.cnReachable && canCreateCn && (<button onClick={() => openCnCreate(selectedItem.contractId, selectedItem.contractProductId)} className="btn-create-accent"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", transition: "border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = "var(--accent)"; b.style.boxShadow = "0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)"; b.style.background = "var(--accent-dim)"; b.style.color = "var(--accent)"; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = "var(--border)"; b.style.boxShadow = ""; b.style.background = "var(--bg3)"; b.style.color = "var(--text2)"; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Me&apos;yoriy sarf yaratish
                  </button>)}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Nomi</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cnEffective.title}>{cnEffective.title}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Holat</div>
                    <CnBadge status={cnEffective.status} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <ApproveConfirmModal target={cnApproveTarget} kindLabel="me'yoriy sarfni" busy={cnApproving} onCancel={() => setCnApproveTarget(null)} onConfirm={handleCnApproveConfirm} />
      </>
    );
  }

  // ── Main list view ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <style>{`
          @keyframes tp-row-pulse {
            0%, 100% { background-color: rgba(217,48,37,0.06); }
            50%      { background-color: rgba(217,48,37,0.20); }
          }
          .tp-row-ready > td { animation: tp-row-pulse 1.6s ease-in-out infinite; }
          .tp-row-ready:hover > td { animation-play-state: paused; background-color: rgba(217,48,37,0.22) !important; }
          .tp-empty-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(217,48,37,0.4); }
          .tp-empty-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
          @keyframes tp-badge-pulse { 0%, 100% { background: var(--danger-dim); color: var(--danger); } 50% { background: var(--danger); color: #fff; } }
          .tp-row-ready .tp-empty-badge { animation: tp-badge-pulse 1.6s ease-in-out infinite; }
        `}</style>

        <ReadinessToolbar
          viewMode={viewMode} onViewMode={setViewMode}
          search={search} onSearch={setSearch}
          onRefresh={() => { loadCn(); loadContracts(); reload(page); }}
        />

        <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
          {(loading || cnListLoading) ? (
            <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
          ) : items.length === 0 ? (
            <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>
              {viewMode === "archive" ? "Arxivda yozuvlar yo'q" : "Ma'lumot topilmadi"}
            </div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
              <table className="itm-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>T/r</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Shartnoma №</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Mahsulot</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Texnologik jarayon</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Me&apos;yoriy sarf</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>Faollik</th>
                    <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const g = computeGating(item);
                    // Dinamik workflow: me'yoriy sarf bosqichi navbatda kelganda yonadi —
                    // TP tugagani emas, balki CN reachable ekani muhim.
                    const cnNeedsWork = g.cnReachable && !g.cnDone;
                    const rowKey = scopeKey(item.contractId, item.contractProductId);
                    const open = () => {
                      // Chizma haqiqiy to'siq bo'lgan (CN'dan oldin turib, hali CN ham yo'q)
                      // klassik holatdagina chizma ogohlantirishini ko'rsatamiz.
                      if (!g.cnReachable && g.drawingBlocksTp && !g.cn) { setDrawingWarningNo(item.contractNo); return; }
                      setSelectedScopeKey(rowKey);
                    };
                    return (
                      <tr key={rowKey}
                        className={cnNeedsWork ? "tp-row-ready" : undefined}
                        onClick={open}
                        style={{ cursor: "pointer", transition: "background 0.12s" }}>
                        <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px", fontSize: 13, color: cnNeedsWork ? "var(--danger)" : undefined, fontWeight: cnNeedsWork ? 700 : undefined }}>{String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}</td>
                        <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</td>
                        <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)" }}>
                          {item.contractProductId === null ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 10px" }}>📋 Umumiy</span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{item.productType}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {g.tp ? <TpBadge status={g.tp.status} /> : <span className="tp-empty-badge">Yaratilmagan</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {g.cn ? <CnBadge status={g.cn.status} /> : <span className="tp-empty-badge">Yaratilmagan</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "2px 10px",
                            borderRadius: 20, fontSize: 13, fontWeight: 600,
                            background: item.contractIsActive ? "#dcfce7" : "var(--danger-dim)",
                            color: item.contractIsActive ? "#16a34a" : "var(--danger)",
                            border: `1px solid ${item.contractIsActive ? "#86efac" : "var(--danger)"}`,
                          }}>
                            {item.contractIsActive ? "Faol" : "Nofaol"}
                          </span>
                        </td>
                        <td style={{ borderLeft: "2px solid var(--border)" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            {viewMode === "active" && g.cnReachable && !g.cn ? (
                              <button className="btn-icon" onClick={() => { setSelectedScopeKey(rowKey); }} title="Yaratish"
                                style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)", width: 28, height: 28, fontSize: 18, fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                                +
                              </button>
                            ) : (
                              <button className="btn-icon" onClick={open} title="Ko'rish"
                                style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ReadinessPagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPage={setPage} />

        <DrawingWarningModal contractNo={drawingWarningNo} onClose={() => setDrawingWarningNo(null)} />
      </div>

      <ApproveConfirmModal target={cnApproveTarget} kindLabel="me'yoriy sarfni" busy={cnApproving} onCancel={() => setCnApproveTarget(null)} onConfirm={handleCnApproveConfirm} />
    </>
  );
}
