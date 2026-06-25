"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { useToastStore } from "@/lib/store/toastStore";
import { useAuthStore } from "@/lib/store/authStore";
import { Upload, X } from "lucide-react";
import {
  techProcessService,
  ProcessStatus,
  type TechProcessCreatePayload,
  type AttachmentResponse,
} from "@/lib/userService";
import {
  type TpMode,
  type TechProcessResponse,
  computeGating,
  fmt,
  scopeKey,
} from "./_types";
import { TpBadge } from "./_components/TpBadge";
import { WorkflowPipeline } from "./_components/WorkflowPipeline";
import { ReadinessToolbar } from "./_components/ReadinessToolbar";
import { ReadinessPagination } from "./_components/ReadinessPagination";
import { DrawingWarningModal, ApproveConfirmModal, DraftWarningModal } from "./_components/ReadinessModals";
import { useReadiness } from "./_components/useReadiness";

// ─── Texnologik jarayon (TechProcess) sahifasi ──────────────────────────────────
// Me'yoriy sarfdan alohida bo'lim — `StageType.TechProcess` bosqichi uchun.

export default function TechProcessPage() {
  const showToast = useToastStore((s) => s.show);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreateTp = hasPermission("TechProcess.Create");
  const canUpdateTp = hasPermission("TechProcess.Update");

  const {
    viewMode, setViewMode, search, setSearch,
    items, loading, page, setPage, totalPages, totalCount,
    contractList, reload, loadContracts, PAGE_SIZE,
  } = useReadiness();

  // To'liq TechProcess yozuvlari — detal/tahrir ochish uchun.
  const [tpList, setTpList] = useState<TechProcessResponse[]>([]);
  const [tpLoading, setTpLoading] = useState(true);

  const loadTp = React.useCallback(async () => {
    try { setTpLoading(true); setTpList(await techProcessService.getAll(undefined, viewMode === "active")); }
    catch { /* ignore */ }
    finally { setTpLoading(false); }
  }, [viewMode]);
  useEffect(() => { loadTp(); }, [loadTp]);

  // ── Scope detail (pipeline + TP panel) ──────────────────────────────────────
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);
  const [tpInlineEditing, setTpInlineEditing] = useState(false);
  const [drawingWarningNo, setDrawingWarningNo] = useState<string | null>(null);

  // ── TP detail/edit ──────────────────────────────────────────────────────────
  const [tpMode, setTpMode] = useState<TpMode>("list");
  const [tpSelected, setTpSelected] = useState<TechProcessResponse | null>(null);
  const [tpEditForm, setTpEditForm] = useState({ title: "", notes: "" });
  const [tpEditSaving, setTpEditSaving] = useState(false);
  const [tpEditNewFile, setTpEditNewFile] = useState<File | null>(null);
  const tpEditFileRef = useRef<HTMLInputElement>(null);
  const [tpDetailFiles, setTpDetailFiles] = useState<AttachmentResponse[]>([]);

  // ── TP create form ───────────────────────────────────────────────────────────
  const [tpShowForm, setTpShowForm] = useState(false);
  const [tpForm, setTpForm] = useState({ contractId: "", contractProductId: "", title: "", notes: "" });
  const [tpSubmitted, setTpSubmitted] = useState(false);
  const [tpSaving, setTpSaving] = useState(false);
  const [tpFormError, setTpFormError] = useState("");
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [tpFileError, setTpFileError] = useState("");
  const [tpDraftWarning, setTpDraftWarning] = useState<string | null>(null);

  // ── Approve ──────────────────────────────────────────────────────────────────
  const [tpApproveTarget, setTpApproveTarget] = useState<{ id: string; title: string } | null>(null);
  const [tpApproving, setTpApproving] = useState(false);

  useDraft("draft_techprocess", tpShowForm, tpForm, (d) => { if (d.contractId) { setTpForm(d); setTpShowForm(true); } else { sessionStorage.removeItem("draft_techprocess"); } });

  useEffect(() => { if (!tpShowForm) return; const h = () => setTpShowForm(false); window.addEventListener("popstate", h); return () => window.removeEventListener("popstate", h); }, [tpShowForm]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openTpDetail = async (tp: TechProcessResponse) => {
    setTpSelected(tp); setTpMode("detail"); setTpDetailFiles([]);
    window.history.pushState({ mode: "detail" }, "");
    const [fresh, files] = await Promise.all([
      techProcessService.getById(tp.id),
      techProcessService.getFiles(tp.id).catch(() => [] as AttachmentResponse[]),
    ]);
    setTpSelected(fresh);
    setTpDetailFiles(files);
  };

  const tpRefreshSelected = async (id: string) => {
    const fresh = await techProcessService.getById(id);
    setTpSelected(fresh);
    setTpList(prev => prev.map(t => t.id === id ? fresh : t));
  };

  const handleTpEditSave = async () => {
    if (!tpSelected) return;
    setTpEditSaving(true);
    try {
      await techProcessService.update(tpSelected.id, { title: tpEditForm.title, notes: tpEditForm.notes || null });
      if (tpEditNewFile) await techProcessService.uploadFile(tpSelected.id, tpEditNewFile);
      await tpRefreshSelected(tpSelected.id);
      await Promise.all([loadTp(), reload()]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      alert(msg ?? "Saqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally { setTpEditSaving(false); }
  };

  const openTpCreate = (prefilledContractId?: string, prefilledContractProductId?: string | null) => {
    setTpForm({ contractId: prefilledContractId || "", contractProductId: prefilledContractProductId ?? "", title: "", notes: "" }); setTpSubmitted(false); setTpFormError(""); setFinalFile(null); setTpFileError("");
    window.history.pushState({ showForm: true }, "");
    setTpShowForm(true);
  };

  const handleTpSave = () => {
    setTpSubmitted(true); setTpFileError(""); setTpFormError("");
    if (!tpForm.contractId) { setTpFormError("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring."); return; }
    if (!tpForm.title.trim() && !finalFile) { setTpFormError("Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting."); return; }
    if (!finalFile) { setTpFileError("Texnologik jarayon faylini yuklang."); return; }
    const title = tpForm.title.trim() || finalFile!.name.replace(/\.[^.]+$/, "");
    setTpDraftWarning(title);
  };

  const handleTpSaveConfirm = async () => {
    setTpSaving(true);
    try {
      const dto: TechProcessCreatePayload = { contractId: tpForm.contractId, contractProductId: tpForm.contractProductId || null, title: tpForm.title.trim() || finalFile!.name.replace(/\.[^.]+$/, ""), notes: tpForm.notes || null };
      const newId = await techProcessService.create(dto);
      await techProcessService.uploadFile(newId, finalFile!);
      const fresh = await techProcessService.getById(newId);
      setTpList(prev => [fresh, ...prev]);
      await reload();
      setTpDraftWarning(null);
      setTpShowForm(false);
      showToast("Texnologik jarayon muvaffaqiyatli yaratildi!");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setTpFormError(msg ?? "Saqlashda xatolik yuz berdi.");
      setTpDraftWarning(null);
    } finally { setTpSaving(false); }
  };

  async function handleTpApproveConfirm() {
    if (!tpApproveTarget) return;
    setTpApproving(true);
    try {
      await techProcessService.approve(tpApproveTarget.id);
      if (tpSelected?.id === tpApproveTarget.id) await tpRefreshSelected(tpApproveTarget.id);
      await Promise.all([loadTp(), reload()]);
      setTpApproveTarget(null);
      showToast("Texnologik jarayon tasdiqlandi!");
    } finally { setTpApproving(false); }
  }

  // ── TP: full-page create form ────────────────────────────────────────────────
  if (tpShowForm) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setTpShowForm(false)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                Orqaga
              </button>
              <span style={{ color: "var(--border)" }}>|</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi texnologik jarayon</span>
            </div>
          </div>
          <div className="itm-card" style={{ padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {(() => {
                const tpContract = contractList.find(c => c.id === tpForm.contractId);
                const tpProducts = tpContract?.products ?? [];
                const tpHasProducts = tpProducts.length > 0;
                return (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Mahsulot</label>
                    <select className="form-input" value={tpForm.contractProductId} onChange={e => setTpForm(f => ({ ...f, contractProductId: e.target.value }))}>
                      {!tpHasProducts && <option value="">Umumiy (butun shartnoma uchun)</option>}
                      {tpProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.productType} — {p.quantity.toLocaleString()} {p.unit}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: tpSubmitted && !tpForm.title.trim() && !finalFile ? "var(--danger)" : "var(--text2)" }}>Nomi <span style={{ color: "var(--danger)" }}>*</span></label>
                <input className="form-input" value={tpForm.title} onChange={e => setTpForm(f => ({ ...f, title: e.target.value }))} placeholder="Avtomatik to'ldiriladi" style={tpSubmitted && !tpForm.title.trim() && !finalFile ? { borderColor: "var(--danger)" } : undefined} />
                {tpSubmitted && !tpForm.title.trim() && !finalFile && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Fayl yuklanmagan bo&apos;lsa, nomni qo&apos;lda kiriting</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Izoh</label>
                  <textarea className="form-input" value={tpForm.notes} onChange={e => setTpForm(f => ({ ...f, notes: e.target.value }))} placeholder="Qo'shimcha izoh (ixtiyoriy)" style={{ resize: "none", flex: 1, minHeight: 130 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: tpSubmitted && !finalFile ? "var(--danger)" : "var(--text2)" }}>Texnologik jarayon fayli <span style={{ color: "var(--danger)" }}>*</span></label>
                  <label htmlFor="tp-file-final" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", border: `2px dashed ${tpSubmitted && !finalFile ? "var(--danger)" : "var(--border)"}`, borderRadius: 10, padding: "20px 16px", background: "var(--bg1)", transition: "border-color 0.15s", textAlign: "center", minHeight: 130 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"} onMouseLeave={e => e.currentTarget.style.borderColor = tpSubmitted && !finalFile ? "var(--danger)" : "var(--border)"}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    {finalFile ? (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{finalFile.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>Fayl tanlandi — o&apos;zgartirish uchun bosing</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Fayl tanlash</span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>Faylni tanlash uchun bosing</span>
                      </>
                    )}
                    <input id="tp-file-final" type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0] ?? null; setFinalFile(f); setTpFileError(""); if (f && !tpForm.title.trim()) setTpForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") })); }} />
                  </label>
                  {tpFileError && <div style={{ marginTop: 6, fontSize: 12, color: "var(--danger)" }}>{tpFileError}</div>}
                </div>
              </div>
            </div>
          </div>
          {tpFormError && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>{tpFormError}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
            <button onClick={() => setTpShowForm(false)} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>Bekor qilish</button>
            <button onClick={handleTpSave} disabled={tpSaving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: "var(--radius)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: tpSaving ? 0.7 : 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              {tpSaving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
        <DraftWarningModal title={tpDraftWarning} kindLabel="Texnologik jarayon" busy={tpSaving} onCancel={() => setTpDraftWarning(null)} onConfirm={handleTpSaveConfirm} />
      </>
    );
  }

  // ── TP: detail view ──────────────────────────────────────────────────────────
  if (tpMode === "detail" && tpSelected) {
    const canApprove = tpSelected.status === ProcessStatus.InProgress;
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => { setTpMode("list"); setTpSelected(null); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                Orqaga
              </button>
              <span style={{ color: "var(--border)" }}>|</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Texnologik jarayon</span>
              <TpBadge status={tpSelected.status} />
            </div>
            {canApprove && canUpdateTp && (
              <button onClick={() => setTpApproveTarget({ id: tpSelected.id, title: tpSelected.title })} disabled={tpApproving}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: "var(--radius)", border: "1px solid rgba(15,123,69,0.3)", background: "var(--success-dim)", color: "var(--success)", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: tpApproving ? 0.6 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {tpApproving ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
              </button>
            )}
          </div>

          <div className="itm-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "11px 20px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>Asosiy ma&apos;lumotlar</span>
            </div>
            <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px 24px" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 500 }}>Shartnoma</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{tpSelected.contractNo}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{tpSelected.productType ? `📦 ${tpSelected.productType}` : "📋 Umumiy"}</div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 500 }}>Nomi</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{tpSelected.title}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontWeight: 500 }}>Holat</div>
                <TpBadge status={tpSelected.status} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 500 }}>Yaratilgan sana</div>
                <div style={{ fontSize: 13, color: "var(--text1)" }}>{fmt(tpSelected.createdAt)}</div>
              </div>
              {tpSelected.approvedByFullName && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 500 }}>Tasdiqlagan</div>
                  <div style={{ fontSize: 13, color: "var(--text1)" }}>{tpSelected.approvedByFullName}</div>
                </div>
              )}
              {tpSelected.approvedAt && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 500 }}>Tasdiqlangan sana</div>
                  <div style={{ fontSize: 13, color: "var(--text1)" }}>{fmt(tpSelected.approvedAt)}</div>
                </div>
              )}
            </div>
          </div>

          {tpSelected.notes && (
            <div className="itm-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "11px 20px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>Izoh</span>
              </div>
              <div style={{ padding: "14px 20px", fontSize: 13, color: "var(--text1)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{tpSelected.notes}</div>
            </div>
          )}

          {tpDetailFiles.length > 0 && (
            <div className="itm-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "11px 20px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>Fayllar</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "1px 8px", color: "var(--text3)" }}>{tpDetailFiles.length} ta</span>
              </div>
              <div style={{ padding: "14px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {tpDetailFiles.map(f => (
                  <button key={f.id} onClick={() => techProcessService.downloadFile(tpSelected.id, f.id, f.fileName)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg2)", color: "var(--text1)", fontSize: 13, cursor: "pointer", transition: "border-color 0.14s,background 0.14s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg2)"; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    {f.fileName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ApproveConfirmModal target={tpApproveTarget} kindLabel="texnologik jarayonni" busy={tpApproving} onCancel={() => setTpApproveTarget(null)} onConfirm={handleTpApproveConfirm} />
      </>
    );
  }

  // ── Scope detail (pipeline + TP panel) ───────────────────────────────────────
  const selectedItem = items.find(i => scopeKey(i.contractId, i.contractProductId) === selectedScopeKey) ?? null;

  if (selectedItem) {
    const g = computeGating(selectedItem);
    const tpEffective = g.tp;
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setSelectedScopeKey(null); setTpInlineEditing(false); }}
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

          {/* TP Panel */}
          <div className="itm-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text1)" }}>Texnologik jarayon</span>
              </div>
              {tpEffective && !tpInlineEditing && g.tpReachable && (
                <div style={{ display: "flex", gap: 4 }}>
                  {tpEffective.status === ProcessStatus.InProgress && canUpdateTp && (
                    <button onClick={() => setTpApproveTarget({ id: tpEffective.id, title: tpEffective.title })} disabled={tpApproving}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--success-dim)", border: "1px solid rgba(15,123,69,0.2)", color: "var(--success)", cursor: "pointer", opacity: tpApproving ? 0.6 : 1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      {tpApproving ? "..." : "Tasdiqlash"}
                    </button>
                  )}
                  <button onClick={() => { const full = tpList.find(t => t.id === tpEffective.id); if (full) openTpDetail(full); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#e8f0fe", border: "1px solid #a4c0f4", color: "#1a56db", cursor: "pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    Ko&apos;rish
                  </button>
                  {canUpdateTp && (
                    <button onClick={() => { const full = tpList.find(t => t.id === tpEffective.id); if (!full) return; setTpSelected(full); setTpEditForm({ title: full.title, notes: full.notes || "" }); setTpEditNewFile(null); setTpInlineEditing(true); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Tahrirlash
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 16px" }}>
              {g.drawingBlocksTp && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#fef9c3", border: "1px solid #fde047", marginBottom: tpEffective ? 12 : 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#854d0e", marginBottom: 2 }}>Texnik chizma tasdiqlanmagan</div>
                    <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                      Texnologik jarayon bilan ishlash uchun <strong>texnik chizma tasdiqlanishi</strong>{" "}kerak. Texnik chizmalar bo&apos;limiga o&apos;ting va chizmaning tasdiqlanishini kuting.
                    </div>
                  </div>
                </div>
              )}
              {!tpEffective ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 12 }}>Texnologik jarayon yaratilmagan</div>
                  {g.tpReachable && canCreateTp && (
                    <button onClick={() => openTpCreate(selectedItem.contractId, selectedItem.contractProductId)} className="btn-create-accent"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", transition: "border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                      onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = "var(--accent)"; b.style.boxShadow = "0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)"; b.style.background = "var(--accent-dim)"; b.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = "var(--border)"; b.style.boxShadow = ""; b.style.background = "var(--bg3)"; b.style.color = "var(--text2)"; }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Jarayon yaratish
                    </button>
                  )}
                </div>
              ) : tpInlineEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "var(--text2)" }}>Nomi</label>
                    <input className="form-input" value={tpEditForm.title} onChange={e => setTpEditForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "var(--text2)" }}>Izoh</label>
                    <textarea className="form-input" value={tpEditForm.notes} onChange={e => setTpEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ resize: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "var(--text2)" }}>Fayl (yangilash uchun)</label>
                    <input ref={tpEditFileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setTpEditNewFile(f); }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button type="button" onClick={() => tpEditFileRef.current?.click()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "border-color 0.14s,color 0.14s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
                        <Upload size={12} /> Fayl tanlash
                      </button>
                      {tpEditNewFile && (
                        <span style={{ fontSize: 12, color: "var(--text1)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {tpEditNewFile.name}
                          <button type="button" onClick={() => { setTpEditNewFile(null); if (tpEditFileRef.current) tpEditFileRef.current.value = ""; }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "inline-flex", padding: 0 }}>
                            <X size={12} />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setTpInlineEditing(false)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
                      style={{ padding: "6px 14px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>Bekor qilish</button>
                    <button onClick={async () => { await handleTpEditSave(); setTpInlineEditing(false); }} disabled={tpEditSaving}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: "var(--radius)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: tpEditSaving ? 0.7 : 1 }}>
                      {tpEditSaving ? "Saqlanmoqda..." : "Saqlash"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Nomi</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tpEffective.title}>{tpEffective.title}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Holat</div>
                    <TpBadge status={tpEffective.status} />
                  </div>
                  {tpEffective.notes && (
                    <div style={{ width: "100%", marginTop: 2 }}>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Izoh</div>
                      <div style={{ fontSize: 13, color: "var(--text1)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{tpEffective.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <ApproveConfirmModal target={tpApproveTarget} kindLabel="texnologik jarayonni" busy={tpApproving} onCancel={() => setTpApproveTarget(null)} onConfirm={handleTpApproveConfirm} />
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
          onRefresh={() => { loadTp(); loadContracts(); reload(page); }}
        />

        <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
          {(loading || tpLoading) ? (
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
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Texnik chizma</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Texnologik jarayon</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>Faollik</th>
                    <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const g = computeGating(item);
                    const drawingOk = g.drawingApproved;
                    // Dinamik workflow: TP bosqichi navbatda kelganda "ish kerak" deb
                    // yonadi — chizma tasdiqlangani emas, balki TP reachable ekani muhim.
                    const tpNeedsWork = g.tpReachable && !g.tpDone;
                    const rowKey = scopeKey(item.contractId, item.contractProductId);
                    const open = () => {
                      // Faqat chizma haqiqiy to'siq bo'lganda (TP'dan oldin turib,
                      // hali TP ham yo'q) chizma ogohlantirishini ko'rsatamiz.
                      if (!g.tpReachable && g.drawingBlocksTp && !g.tp) { setDrawingWarningNo(item.contractNo); return; }
                      setSelectedScopeKey(rowKey); setTpInlineEditing(false);
                    };
                    return (
                      <tr key={rowKey}
                        className={tpNeedsWork ? "tp-row-ready" : undefined}
                        onClick={open}
                        style={{ cursor: "pointer", transition: "background 0.12s" }}>
                        <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px", fontSize: 13, color: tpNeedsWork ? "var(--danger)" : undefined, fontWeight: tpNeedsWork ? 700 : undefined }}>{String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}</td>
                        <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</td>
                        <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)" }}>
                          {item.contractProductId === null ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 10px" }}>📋 Umumiy</span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{item.productType}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {!item.drawing ? (
                            <span className="tp-empty-badge">Yaratilmagan</span>
                          ) : drawingOk ? (
                            <span className="tp-approved-badge" style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--success)", background: "var(--success-dim)", borderRadius: 20, padding: "2px 10px", border: "1px solid rgba(15,123,69,0.2)" }}>
                              Tasdiqlangan
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#ca8a04", background: "#fef9c3", borderRadius: 20, padding: "2px 10px", border: "1px solid #fde047", display: "inline-block" }}>Tasdiqlanmagan</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {g.tp ? <TpBadge status={g.tp.status} /> : <span className="tp-empty-badge">Yaratilmagan</span>}
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
                            {g.tpReachable && viewMode === "active" && !g.tp ? (
                              <button className="btn-icon" onClick={() => { setSelectedScopeKey(rowKey); setTpInlineEditing(false); }} title="Yaratish"
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

      <ApproveConfirmModal target={tpApproveTarget} kindLabel="texnologik jarayonni" busy={tpApproving} onCancel={() => setTpApproveTarget(null)} onConfirm={handleTpApproveConfirm} />
    </>
  );
}
