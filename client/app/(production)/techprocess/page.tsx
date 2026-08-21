"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDraft } from "@/lib/useDraft";
import { useToastStore } from "@/lib/store/toastStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { Upload, X, Image as ImageIcon, ImageOff } from "lucide-react";
import {
  techProcessService,
  contractService,
  costNormService,
  departmentService,
  ProcessStatus,
  DrawingStatus,
  type TechProcessCreatePayload,
  type ContractSummary,
  type AttachmentResponse,
  type DepartmentOption,
} from "@/lib/userService";
import {
  type MaterialRow,
  type ParsedTable,
  type TpMode,
  type CnMode,
  type ContractReadinessScope,
  type TechProcessResponse,
  type CostNormListItem,
  type CostNormResponse,
  type CostNormItemResponse,
  type CostNormMetadata,
  parseMainTables,
  parseDocxMetadata,
  autoMatchSections,
  fmt,
  scopeKey,
} from "./_types";
import { TpBadge } from "./_components/TpBadge";
import { CnBadge } from "./_components/CnBadge";
import { CollapsibleItemsTable } from "./_components/CollapsibleItemsTable";
import { CostNormA4Sheet } from "./_components/CostNormA4Sheet";
import { FileParsingOverlay } from "./_components/FileParsingOverlay";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechProductionPage() {
  // ── Tech Process state ─────────────────────────────────────────────────────
  const [tpList, setTpList] = useState<TechProcessResponse[]>([]);
  const [tpLoading, setTpLoading] = useState(true);
  const [tpSearch, setTpSearch] = useState("");

  // TP detail / edit
  const [tpMode, setTpMode] = useState<TpMode>("list");
  const [tpSelected, setTpSelected] = useState<TechProcessResponse | null>(null);
  const [tpEditForm, setTpEditForm] = useState({ title:"", notes:"" });
  const [tpEditSaving, setTpEditSaving] = useState(false);
  const [tpEditNewFile, setTpEditNewFile] = useState<File|null>(null);
  const tpEditFileRef = useRef<HTMLInputElement>(null);

  // TP create form
  const [tpShowForm, setTpShowForm] = useState(false);
  const [tpForm, setTpForm] = useState({ contractId:"", contractProductId:"", title:"", notes:"" });
  const [tpSubmitted, setTpSubmitted] = useState(false);
  const [tpSaving, setTpSaving] = useState(false);
  const [tpFormError, setTpFormError] = useState("");
  const [finalFile, setFinalFile] = useState<File|null>(null);
  const [tpFileError, setTpFileError] = useState("");

  const [tpDetailFiles, setTpDetailFiles] = useState<AttachmentResponse[]>([]);

  // TP draft warning modal
  const [tpDraftWarning, setTpDraftWarning] = useState<string|null>(null);
  // CN draft warning modal
  const [cnDraftWarning, setCnDraftWarning] = useState<string|null>(null);
  // Approve confirm modals
  const [tpApproveTarget, setTpApproveTarget] = useState<{id:string;title:string}|null>(null);
  const [cnApproveTarget, setCnApproveTarget] = useState<{id:string;title:string}|null>(null);
  const [tpApproving, setTpApproving] = useState(false);
  const [cnApproving, setCnApproving] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const t = useT();
  const showToast = useToastStore((s) => s.show);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreateTp = hasPermission("TechProcess.Create");
  const canUpdateTp = hasPermission("TechProcess.Update");
  const canCreateCn = hasPermission("CostNorm.Create");
  const canUpdateCn = hasPermission("CostNorm.Update");

  useDraft("draft_techprocess", tpShowForm, tpForm, (d)=>{ if(d.contractId) { setTpForm(d); setTpShowForm(true); } else { sessionStorage.removeItem("draft_techprocess"); } });

  // ── Cost Norm state ────────────────────────────────────────────────────────
  const [cnMode, setCnMode] = useState<CnMode>("list");
  const [cnShowPhotos, setCnShowPhotos] = useState(false);
  const [cnList, setCnList] = useState<CostNormListItem[]>([]);
  const [cnListLoading, setCnListLoading] = useState(true);
  const [cnSelected, setCnSelected] = useState<CostNormResponse|null>(null);
  const [cnActiveTab, setCnActiveTab] = useState(0);
  const [cnDetailFiles, setCnDetailFiles] = useState<AttachmentResponse[]>([]);
  const [cnDetailItems, setCnDetailItems] = useState<CostNormItemResponse[]>([]);
  const [cnDetailLoading, setCnDetailLoading] = useState(false);
  const [cnForm, setCnForm] = useState({ contractId:"", contractProductId:"", title:"", notes:"" });
  const [cnSubmitted, setCnSubmitted] = useState(false);
  const [cnSaving, setCnSaving] = useState(false);
  const [cnCreateTab, setCnCreateTab] = useState<"form"|"table">("form");
  const [cnSaveError, setCnSaveError] = useState<string|null>(null);
  const [cnEditingNorm, setCnEditingNorm] = useState<CostNormResponse|null>(null);
  const [cnEditForm, setCnEditForm] = useState({ title:"", notes:"" });
  const [cnEditItems, setCnEditItems] = useState<MaterialRow[]>([]);
  const [cnEditFiles, setCnEditFiles] = useState<AttachmentResponse[]>([]);
  const [cnEditNewFile, setCnEditNewFile] = useState<File|null>(null);
  const [cnEditSaving, setCnEditSaving] = useState(false);
  const [cnEditLoading, setCnEditLoading] = useState(false);
  const [cnEditSaveError, setCnEditSaveError] = useState<string|null>(null);
  const cnEditFileRef = useRef<HTMLInputElement>(null);
  const [cnFormFile, setCnFormFile] = useState<File|null>(null);
  const [cnParsedTables, setCnParsedTables] = useState<ParsedTable[]>([]);
  const [cnParsedMetadata, setCnParsedMetadata] = useState<CostNormMetadata|null>(null);
  const [cnParseLoading, setCnParseLoading] = useState(false);
  const [cnParseError, setCnParseError] = useState<string|null>(null);
  const cnFormFileRef = useRef<HTMLInputElement>(null);
  const [cnFileOverlayVisible, setCnFileOverlayVisible] = useState(false);
  const [cnFileParseReady, setCnFileParseReady] = useState(false);
  const cnPendingParseResult = useRef<{tables:ParsedTable[];metadata:CostNormMetadata|null;error:string|null;fileName:string}|null>(null);

  // ── Selected scope (contract + product) for inline detail panel ─────────────
  const [selectedScopeKey, setSelectedScopeKey] = useState<string|null>(null);
  const [tpInlineEditing, setTpInlineEditing] = useState(false);
  const [drawingWarningNo, setDrawingWarningNo] = useState<string|null>(null);
  const [contractList, setContractList] = useState<ContractSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [viewMode, setViewMode] = useState<"active" | "archive">("active");

  useDraft("draft_costnorm", cnMode==="create", cnForm, (d)=>{ if(d.contractId) { setCnForm(d); setCnMode("create"); } else { sessionStorage.removeItem("draft_costnorm"); } });

  // ── Contract readiness ─────────────────────────────────────────────────────
  // Har bir qator = bitta scope. Backend (`/api/contract/readiness`) joinni va
  // priority ni hisoblab, tartiblangan ro'yxat qaytaradi:
  //   priority 0 — chizma tasdiqlangan, lekin TP yoki me'yoriy sarf tasdiqlanmagan
  //   priority 1 — chizma yaratilgan, lekin tasdiqlanmagan
  //   priority 2 — chizma yaratilmagan
  //   priority 3 — to'liq yakunlangan
  const [readinessItems, setReadinessItems] = useState<ContractReadinessScope[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(true);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadContracts = useCallback(async()=>{
    try {
      const isActiveFlag = viewMode === "active";
      const data = await contractService.getAll(isActiveFlag);
      setContractList(data);
    } catch { setContractList([]); }
  },[viewMode]);

  const loadTp = useCallback(async () => {
    try { setTpLoading(true); const data=await techProcessService.getAll(undefined, viewMode === "active"); setTpList(data); }
    catch { /* ignore */ }
    finally { setTpLoading(false); }
  },[viewMode]);

  const loadCn = useCallback(async()=>{ setCnListLoading(true); const d=await costNormService.getAll(undefined, viewMode === "active"); setCnList(d); setCnListLoading(false); },[viewMode]);

  const loadReadiness = useCallback(async(p = page)=>{
    try {
      setReadinessLoading(true);
      const data = await contractService.getReadinessOverview(p, PAGE_SIZE, {
        search:   tpSearch || undefined,
        isActive: viewMode === "active",
      });
      setReadinessItems((data?.items ?? []) as ContractReadinessScope[]);
      setTotalPages(data?.totalPages ?? 1);
      setTotalCount(data?.totalCount ?? 0);
    } catch {
      setReadinessItems([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setReadinessLoading(false);
    }
  },[viewMode, tpSearch, page]);

  useEffect(()=>{ loadTp(); loadCn(); loadContracts(); },[loadTp, loadCn, loadContracts]);
  useEffect(()=>{ departmentService.getAll().then(setDepartments).catch(()=>setDepartments([])); },[]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [viewMode, tpSearch]);

  // Reload readiness when page or any filter changes (debounce search)
  useEffect(() => {
    const t = setTimeout(() => { loadReadiness(page); }, tpSearch ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, viewMode, tpSearch]);

  useEffect(()=>{ if(!tpShowForm) return; const h=()=>setTpShowForm(false); window.addEventListener("popstate",h); return ()=>window.removeEventListener("popstate",h); },[tpShowForm]);

  // ── TP Drawer ──────────────────────────────────────────────────────────────

  const openTpDetail = async (tp: TechProcessResponse) => {
    setTpSelected(tp); setTpMode("detail"); setTpDetailFiles([]);
    window.history.pushState({mode:"detail"},"");
    const [fresh, files] = await Promise.all([
      techProcessService.getById(tp.id),
      techProcessService.getFiles(tp.id).catch(()=>[] as AttachmentResponse[]),
    ]);
    setTpSelected(fresh);
    setTpDetailFiles(files);
  };

  const tpRefreshSelected = async (id: string) => {
    const fresh = await techProcessService.getById(id);
    setTpSelected(fresh);
    setTpList(prev=>prev.map(t=>t.id===id?fresh:t));
  };

  const handleTpEditSave = async () => {
    if(!tpSelected) return;
    setTpEditSaving(true);
    try {
      await techProcessService.update(tpSelected.id, { title: tpEditForm.title, notes: tpEditForm.notes||null });
      if(tpEditNewFile) await techProcessService.uploadFile(tpSelected.id, tpEditNewFile);
      await tpRefreshSelected(tpSelected.id);
      await Promise.all([loadTp(), loadReadiness()]);
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      alert(msg??t("Saqlashda xatolik yuz berdi. Qayta urinib ko'ring."));
    } finally { setTpEditSaving(false); }
  };

  // ── TP Create ──────────────────────────────────────────────────────────────

  const openTpCreate = async (prefilledContractId?: string, prefilledContractProductId?: string | null) => {
    setTpForm({contractId:prefilledContractId||"",contractProductId:prefilledContractProductId??"",title:"",notes:""}); setTpSubmitted(false); setTpFormError(""); setFinalFile(null); setTpFileError("");
    window.history.pushState({showForm:true},"");
    setTpShowForm(true);
  };

  const handleTpSave = () => {
    setTpSubmitted(true); setTpFileError(""); setTpFormError("");
    if(!tpForm.contractId) { setTpFormError(t("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring.")); return; }
    if(!tpForm.title.trim()&&!finalFile) { setTpFormError(t("Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting.")); return; }
    if(!finalFile) { setTpFileError(t("Texnologik jarayon faylini yuklang.")); return; }
    const title = tpForm.title.trim() || finalFile!.name.replace(/\.[^.]+$/, "");
    setTpDraftWarning(title);
  };

  const handleTpSaveConfirm = async () => {
    setTpSaving(true);
    try {
      const dto: TechProcessCreatePayload = { contractId:tpForm.contractId, contractProductId: tpForm.contractProductId || null, title:tpForm.title.trim()||finalFile!.name.replace(/\.[^.]+$/,""), notes:tpForm.notes||null };
      const newId = await techProcessService.create(dto);
      await techProcessService.uploadFile(newId, finalFile!);
      const fresh = await techProcessService.getById(newId);
      setTpList(prev=>[fresh,...prev]);
      await loadReadiness();
      setTpDraftWarning(null);
      setTpShowForm(false);
      showToast(t("Texnologik jarayon muvaffaqiyatli yaratildi!"));
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      setTpFormError(msg??t("Saqlashda xatolik yuz berdi."));
      setTpDraftWarning(null);
    } finally { setTpSaving(false); }
  };

  // ── CN Handlers ────────────────────────────────────────────────────────────

  async function handleCnFormFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.name.toLowerCase().endsWith(".docx")) { setCnParseError(t("Faqat .docx format")); return; }
    setCnFormFile(file); setCnParseError(null); setCnParsedTables([]); setCnParsedMetadata(null); setCnParseLoading(true); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current=null;
    try {
      const mammoth=await import("mammoth");
      const ab=await file.arrayBuffer();
      const res=await mammoth.convertToHtml({arrayBuffer:ab});
      const {tables:parsed,error:colError}=parseMainTables(res.value);
      const metadata=parseDocxMetadata(res.value);
      const matched=parsed.map(tb=>({...tb,rows:autoMatchSections(tb.rows,cnScopedDepartments(cnForm.contractId,cnForm.contractProductId||null))}));
      if(colError) cnPendingParseResult.current={tables:[],metadata,error:colError,fileName:file.name};
      else if(matched.length===0) cnPendingParseResult.current={tables:[],metadata,error:t("Faylda mos jadval topilmadi."),fileName:file.name};
      else cnPendingParseResult.current={tables:matched,metadata,error:null,fileName:file.name};
    } catch { cnPendingParseResult.current={tables:[],metadata:null,error:t("Faylni o'qishda xatolik"),fileName:file.name}; }
    setCnFileParseReady(true);
  }

  async function openCnCreate(prefilledContractId?: string, prefilledContractProductId?: string | null) {
    setCnForm({contractId:prefilledContractId||"",contractProductId:prefilledContractProductId??"",title:"",notes:""}); setCnFormFile(null); setCnParsedTables([]); setCnParsedMetadata(null); setCnParseError(null); setCnSaveError(null); setCnSubmitted(false); setCnActiveTab(0); setCnCreateTab("form");
    window.history.pushState({mode:"create"},"");
    setCnMode("create");
  }

  function handleCnSave() {
    setCnSubmitted(true); setCnSaveError(null);
    if(!cnForm.contractId) { setCnSaveError(t("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring.")); return; }
    if(!cnForm.title.trim()&&!cnFormFile) { setCnSaveError(t("Nomi kiritilmagan. Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting.")); return; }
    if(cnParsedTables.length===0) { setCnSaveError(t("Me'yoriy sarf jadvali faylini yuklang va qayta urinib ko'ring.")); return; }
    const title = cnForm.title.trim() || cnFormFile?.name?.replace(/\.docx$/i,"") || "";
    setCnDraftWarning(title);
  }

  async function handleCnSaveConfirm() {
    setCnSaving(true);
    try {
      const allRows=cnParsedTables.flatMap(t=>t.rows);
      const items=allRows.map((row,idx)=>({ isSection:row.isSection,sectionName:row.isSection?row.sectionName:null,departmentId:row.isSection&&row.departmentId?row.departmentId:null,no:row.no||null,name:row.name||null,unit:row.unit||null,readyQty:row.readyQty||null,wasteQty:row.wasteQty||null,totalQty:row.totalQty||null,photoRaw:row.photoRaw||null,photoSemi:row.photoSemi||null,importType:row.importType||null,sortOrder:idx }));
      await costNormService.create({contractId:cnForm.contractId,contractProductId:cnForm.contractProductId||null,title:cnForm.title||cnFormFile?.name?.replace(/\.docx$/i,"")||"",notes:cnForm.notes||null,items,metadata:cnParsedMetadata});
      await Promise.all([loadCn(), loadReadiness()]);
      setCnDraftWarning(null); setCnMode("list");
      showToast(t("Me'yoriy sarf muvaffaqiyatli yaratildi!"));
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      setCnSaveError(msg??t("Saqlashda xatolik yuz berdi"));
      setCnDraftWarning(null);
    }
    finally { setCnSaving(false); }
  }

  function handleCnApprove(norm: { id: string; title: string }) {
    setCnApproveTarget({ id: norm.id, title: norm.title });
  }

  async function handleCnApproveConfirm() {
    if (!cnApproveTarget) return;
    setCnApproving(true);
    try {
      await costNormService.approve(cnApproveTarget.id);
      setCnList(prev=>prev.map(n=>n.id===cnApproveTarget.id?{...n,status:DrawingStatus.Approved}:n));
      if(cnSelected?.id===cnApproveTarget.id) setCnSelected(n=>n?{...n,status:DrawingStatus.Approved}:n);
      await loadReadiness();
      setCnApproveTarget(null);
      showToast(t("Me'yoriy sarf tasdiqlandi!"));
    } finally { setCnApproving(false); }
  }

  async function handleTpApproveConfirm() {
    if (!tpApproveTarget) return;
    setTpApproving(true);
    try {
      await techProcessService.approve(tpApproveTarget.id);
      if (tpSelected?.id === tpApproveTarget.id) await tpRefreshSelected(tpApproveTarget.id);
      await Promise.all([loadTp(), loadReadiness()]);
      setTpApproveTarget(null);
      showToast(t("Texnologik jarayon tasdiqlandi!"));
    } finally { setTpApproving(false); }
  }

  function openCnDetail(norm: CostNormListItem) {
    // List endpointda items kelmaydi — to'liq versiya (items bilan) shu yerda so'raladi.
    setCnSelected({ ...norm, items: [] }); setCnActiveTab(0); setCnShowPhotos(false); setCnDetailFiles([]); setCnDetailItems([]); setCnDetailLoading(true);
    window.history.pushState({mode:"detail"},""); setCnMode("detail");
    Promise.all([
      costNormService.getById(norm.id),
      costNormService.getFiles(norm.id).catch(()=>[] as AttachmentResponse[]),
    ]).then(([fresh, files])=>{
      setCnSelected(fresh);
      setCnDetailItems([...fresh.items].sort((a,b)=>a.sortOrder-b.sortOrder));
      setCnDetailFiles(files);
    }).catch(()=>{}).finally(()=>setCnDetailLoading(false));
  }

  async function openCnEdit(norm: CostNormListItem) {
    // List endpointda items kelmaydi — to'liq versiya (items bilan) shu yerda so'raladi.
    setCnEditingNorm({ ...norm, items: [] }); setCnEditForm({title:norm.title,notes:norm.notes||""}); setCnEditNewFile(null); setCnEditSaveError(null); setCnEditSaving(false); setCnShowPhotos(false);
    setCnEditItems([]); setCnEditLoading(true);
    window.history.pushState({mode:"edit"},""); setCnMode("edit");
    try {
      const [fresh, files] = await Promise.all([
        costNormService.getById(norm.id),
        costNormService.getFiles(norm.id).catch(()=>[] as AttachmentResponse[]),
      ]);
      setCnEditingNorm(fresh);
      setCnEditForm({title:fresh.title,notes:fresh.notes||""});
      setCnEditItems([...fresh.items].sort((a,b)=>a.sortOrder-b.sortOrder).map(it=>({no:it.no||"",name:it.name||"",unit:it.unit||"",readyQty:it.readyQty||"",wasteQty:it.wasteQty||"",totalQty:it.totalQty||"",photoRaw:it.photoRaw||"",photoSemi:it.photoSemi||"",importType:it.importType||"",isSection:it.isSection,sectionName:it.sectionName||"",departmentId:it.departmentId||""})));
      setCnEditFiles(files);
    } catch {
      setCnEditFiles([]);
      setCnEditSaveError(t("Ma'lumotlarni yuklashda xatolik yuz berdi. Qayta urinib ko'ring."));
    } finally { setCnEditLoading(false); }
  }

  async function handleEditCnFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.name.toLowerCase().endsWith(".docx")) { setCnEditSaveError(t("Faqat .docx format")); return; }
    setCnEditNewFile(file); setCnEditSaveError(null); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current=null;
    try {
      const mammoth=await import("mammoth"); const ab=await file.arrayBuffer(); const res=await mammoth.convertToHtml({arrayBuffer:ab});
      const {tables:parsed,error}=parseMainTables(res.value);
      const metadata=parseDocxMetadata(res.value);
      const matched=parsed.map(tb=>({...tb,rows:autoMatchSections(tb.rows,cnScopedDepartments(null,cnEditingNorm?.contractProductId,cnEditingNorm?.contractNo))}));
      if(error) cnPendingParseResult.current={tables:[],metadata,error,fileName:file.name};
      else if(matched.length>0) { cnPendingParseResult.current={tables:matched,metadata,error:null,fileName:file.name}; }
      else cnPendingParseResult.current={tables:[],metadata,error:null,fileName:file.name};
    } catch { cnPendingParseResult.current={tables:[],metadata:null,error:t("Faylni o'qishda xatolik"),fileName:file.name}; }
    setCnFileParseReady(true);
  }

  async function handleCnEditSave() {
    if(!cnEditingNorm||cnEditLoading) return; setCnEditSaving(true); setCnEditSaveError(null);
    try {
      const items=cnEditItems.map((row,idx)=>({isSection:row.isSection,sectionName:row.isSection?row.sectionName:null,departmentId:row.isSection&&row.departmentId?row.departmentId:null,no:row.no||null,name:row.name||null,unit:row.unit||null,readyQty:row.readyQty||null,wasteQty:row.wasteQty||null,totalQty:row.totalQty||null,photoRaw:row.photoRaw||null,photoSemi:row.photoSemi||null,importType:row.importType||null,sortOrder:idx}));
      const newMeta=cnPendingParseResult.current?.metadata ?? null;
      await costNormService.update(cnEditingNorm.id,{title:cnEditForm.title,notes:cnEditForm.notes||null,items,metadata:newMeta});
      await Promise.all([loadCn(), loadReadiness()]);
      setCnMode("list"); setCnEditingNorm(null);
    } catch { setCnEditSaveError(t("Saqlashda xatolik yuz berdi")); }
    finally { setCnEditSaving(false); }
  }


  // ── CN computed ────────────────────────────────────────────────────────────

  const cnDataCount = cnParsedTables[cnActiveTab]?.rows.filter(r=>!r.isSection).length??0;
  const cnCurrentRows = cnParsedTables[cnActiveTab]?.rows??[];

  // Section dropdown'ida shartnoma yaratishda tanlangan mas'ul bo'limlargina chiqadi:
  // avval mahsulotga biriktirilganlari, bo'lmasa shartnomanikilari.
  // Shartnoma topilmasa (masalan, arxiv) — barcha bo'limlar fallback.
  const cnScopedDepartments = useCallback((contractId?: string|null, contractProductId?: string|null, contractNo?: string|null): {id:string;name:string}[] => {
    const c = contractList.find(x => (!!contractId && x.id === contractId) || (!!contractNo && x.contractNo === contractNo));
    if (!c) return departments;
    const prod = contractProductId ? c.products.find(p => p.id === contractProductId) : undefined;
    const scoped = (prod?.departments?.length ? prod.departments : c.departments) ?? [];
    return scoped.length ? scoped : departments;
  }, [contractList, departments]);


  // ── Render ─────────────────────────────────────────────────────────────────

  // TP: full-page create form
  if (tpShowForm) {
    return (
      <>
      <div style={{ display:"flex",flexDirection:"column",gap:24 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={()=>setTpShowForm(false)}
              style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {t("Orqaga")}
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>{t("Yangi texnologik jarayon")}</span>
          </div>
        </div>
        <div className="itm-card" style={{ padding:28 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {/* Mahsulot — mahsulotsiz shartnoma uchun Umumiy, aks holda har biriga alohida */}
            {(() => {
              const tpContract = contractList.find(c => c.id === tpForm.contractId);
              const tpProducts = tpContract?.products ?? [];
              const tpHasProducts = tpProducts.length > 0;
              return (
                <div>
                  <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>{t("Mahsulot")}</label>
                  <select
                    className="form-input"
                    value={tpForm.contractProductId}
                    onChange={e=>setTpForm(f=>({...f,contractProductId:e.target.value}))}
                  >
                    {!tpHasProducts && <option value="">{t("Umumiy (butun shartnoma uchun)")}</option>}
                    {tpProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.productType} — {p.quantity.toLocaleString()} {p.unit}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Sarlavha — full width */}
            <div>
              <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:tpSubmitted&&!tpForm.title.trim()&&!finalFile?"var(--danger)":"var(--text2)" }}>{t("Nomi")} <span style={{ color:"var(--danger)" }}>*</span></label>
              <input className="form-input" value={tpForm.title} onChange={e=>setTpForm(f=>({...f,title:e.target.value}))} placeholder={t("Avtomatik to'ldiriladi")} style={tpSubmitted&&!tpForm.title.trim()&&!finalFile?{borderColor:"var(--danger)"}:undefined}/>
              {tpSubmitted&&!tpForm.title.trim()&&!finalFile&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>{t("Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting")}</div>}
            </div>
            {/* Izoh + Fayl — two columns */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch" }}>
              <div style={{ display:"flex",flexDirection:"column" }}>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>{t("Izoh")}</label>
                <textarea className="form-input" value={tpForm.notes} onChange={e=>setTpForm(f=>({...f,notes:e.target.value}))} placeholder={t("Qo'shimcha izoh (ixtiyoriy)")} style={{ resize:"none",flex:1,minHeight:130 }}/>
              </div>
              <div style={{ display:"flex",flexDirection:"column" }}>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:tpSubmitted&&!finalFile?"var(--danger)":"var(--text2)" }}>{t("Texnologik jarayon fayli")} <span style={{ color:"var(--danger)" }}>*</span></label>
                <label htmlFor="tp-file-final" style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",border:`2px dashed ${tpSubmitted&&!finalFile?"var(--danger)":"var(--border)"}`,borderRadius:10,padding:"20px 16px",background:"var(--bg1)",transition:"border-color 0.15s",textAlign:"center",minHeight:130 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor=tpSubmitted&&!finalFile?"var(--danger)":"var(--border)"}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {finalFile?(
                    <>
                      <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{finalFile.name}</span>
                      <span style={{ fontSize:11,color:"var(--text3)" }}>{t("Fayl tanlandi — o'zgartirish uchun bosing")}</span>
                    </>
                  ):(
                    <>
                      <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{t("Fayl tanlash")}</span>
                      <span style={{ fontSize:11,color:"var(--text3)" }}>{t("Faylni tanlash uchun bosing")}</span>
                    </>
                  )}
                  <input id="tp-file-final" type="file" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]??null; setFinalFile(f); setTpFileError(""); if(f&&!tpForm.title.trim()) setTpForm(prev=>({...prev,title:f.name.replace(/\.[^.]+$/,"")})); }}/>
                </label>
                {tpFileError&&<div style={{ marginTop:6,fontSize:12,color:"var(--danger)" }}>{tpFileError}</div>}
              </div>
            </div>
          </div>
        </div>
        {tpFormError&&<div style={{ padding:"10px 14px",borderRadius:8,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",fontSize:13 }}>{tpFormError}</div>}
        <div style={{ display:"flex",justifyContent:"space-between",paddingTop:4 }}>
          <button onClick={()=>setTpShowForm(false)} style={{ background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"10px 24px",color:"var(--text2)",fontSize:14,fontWeight:500 }}>{t("Bekor qilish")}</button>
          <button onClick={handleTpSave} disabled={tpSaving}
            style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 28px",borderRadius:"var(--radius)",border:"none",background:"var(--accent)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:tpSaving?0.7:1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {tpSaving?t("Saqlanmoqda..."):t("Saqlash")}
          </button>
        </div>
      </div>
      {tpDraftWarning && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--warn)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--warn-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--warn)" }}>{t("Texnologik jarayon qoralama holatida")}</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpDraftWarning}»</span> {t("texnologik jarayon")}{" "}
              <span style={{ fontWeight:600,color:"var(--warn)" }}>{t("qoralama")}</span> {t("holatida saqlanadi.")}
              {t("Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.")}
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpDraftWarning(null)} disabled={tpSaving}>
                {t("Bekor qilish")}
              </button>
              <button className="btn btn-primary" onClick={handleTpSaveConfirm} disabled={tpSaving}>
                {tpSaving?t("Saqlanmoqda..."):t("Tushundim, saqlash")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  // CN: full-page create form
  if (cnMode === "create") {
    return (
      <>
      <div style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
        {cnFileOverlayVisible&&(
          <FileParsingOverlay dataReady={cnFileParseReady} onComplete={()=>{
            setCnFileOverlayVisible(false); setCnParseLoading(false);
            const res=cnPendingParseResult.current;
            if(res) {
              if(res.error) setCnParseError(res.error);
              else { setCnParsedTables(res.tables); setCnParsedMetadata(res.metadata); setCnCreateTab("table"); if(!cnForm.title) setCnForm(f=>({...f,title:res.fileName.replace(/\.docx$/i,"")})); }
            }
          }}/>
        )}
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={()=>setCnMode("list")}
              style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {t("Orqaga")}
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>{t("Yangi me'yoriy sarf")}</span>
          </div>
        </div>
        {/* Tab bar */}
        <div className="itm-card" style={{ display:"flex",alignItems:"center",gap:0,marginBottom:16,padding:"0 16px",flexShrink:0 }}>
          <button onClick={()=>setCnCreateTab("form")}
            style={{ padding:"12px 20px",fontSize:13,fontWeight:cnCreateTab==="form"?700:500,color:cnCreateTab==="form"?"var(--accent,#1a56db)":"var(--text2)",background:"none",border:"none",borderBottom:cnCreateTab==="form"?"2px solid var(--accent,#1a56db)":"2px solid transparent",cursor:"pointer",marginBottom:-1 }}>
            {t("Forma")}
          </button>
          <button onClick={()=>cnParsedTables.length>0&&setCnCreateTab("table")}
            style={{ padding:"12px 20px",fontSize:13,fontWeight:cnCreateTab==="table"?700:500,color:cnCreateTab==="table"?"var(--accent,#1a56db)":cnParsedTables.length===0?"var(--text3)":"var(--text2)",background:"none",border:"none",borderBottom:cnCreateTab==="table"?"2px solid var(--accent,#1a56db)":"2px solid transparent",cursor:cnParsedTables.length>0?"pointer":"default",marginBottom:-1,display:"flex",alignItems:"center",gap:6 }}>
            {t("Jadval ko'rinishi")}
            {cnParsedTables.length>0&&<span style={{ fontSize:11,fontWeight:600,background:"var(--accent,#1a56db)",color:"#fff",borderRadius:20,padding:"1px 7px" }}>{cnDataCount}</span>}
          </button>
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setCnMode("list")} style={{ padding:"8px 18px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,fontWeight:500,cursor:"pointer" }}>{t("Bekor qilish")}</button>
            <button onClick={handleCnSave} disabled={cnSaving}
              style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--accent,#1a56db)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:cnSaving?0.7:1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
              {cnSaving?t("Saqlanmoqda..."):t("Saqlash")}
            </button>
          </div>
        </div>
        {cnCreateTab==="form"&&(
          <div className="itm-card" style={{ padding:28,flexShrink:0 }}>
            {cnSaveError&&<div style={{ padding:"10px 14px",borderRadius:8,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",fontSize:13,marginBottom:16 }}>{cnSaveError}</div>}
            <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
              {/* Mahsulot dropdown — mahsulotsiz shartnoma uchun Umumiy */}
              {(() => {
                const cnContract = contractList.find(c => c.id === cnForm.contractId);
                const cnProducts = cnContract?.products ?? [];
                const cnHasProducts = cnProducts.length > 0;
                return (
                  <div>
                    <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>{t("Mahsulot")}</label>
                    <select
                      className="form-input"
                      value={cnForm.contractProductId}
                      onChange={e=>setCnForm(f=>({...f,contractProductId:e.target.value}))}
                    >
                      {!cnHasProducts && <option value="">{t("Umumiy (butun shartnoma uchun)")}</option>}
                      {cnProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.productType} — {p.quantity.toLocaleString()} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* Nomi — full width */}
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:cnSubmitted&&!cnForm.title.trim()&&!cnFormFile?"var(--danger)":"var(--text2)" }}>
                  {t("Nomi")} <span style={{ color:"var(--danger)" }}>*</span>
                </label>
                <input className="form-input" value={cnForm.title} onChange={e=>setCnForm(f=>({...f,title:e.target.value}))} placeholder={t("Avtomatik to'ldiriladi")} style={{ borderColor:cnSubmitted&&!cnForm.title.trim()&&!cnFormFile?"var(--danger)":undefined }}/>
              </div>
              {/* Izoh + Fayl — two columns */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch" }}>
                <div style={{ display:"flex",flexDirection:"column" }}>
                  <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>{t("Izoh")}</label>
                  <textarea className="form-input" value={cnForm.notes} onChange={e=>setCnForm(f=>({...f,notes:e.target.value}))} placeholder={t("Qo'shimcha izoh (ixtiyoriy)")} style={{ resize:"none",flex:1,minHeight:130 }}/>
                </div>
                <div style={{ display:"flex",flexDirection:"column" }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,gap:8,flexWrap:"wrap" }}>
                    <label style={{ fontSize:13,fontWeight:600,color:cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--text2)" }}>
                      {t("DOCX fayl")} <span style={{ color:"var(--danger)" }}>*</span>
                      <span style={{ fontWeight:400,color:"var(--text3)",marginLeft:6 }}>{t("(me'yoriy sarf jadvali)")}</span>
                    </label>
                    <a
                      href="/namuna_meyoriy_sarf.docx"
                      download
                      style={{ display:"inline-flex",alignItems:"center",gap:7,padding:"6px 14px",borderRadius:"var(--radius)",background:"var(--accent)",border:"1px solid var(--accent)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:"background 0.15s,transform 0.1s" }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="var(--accent2)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background="var(--accent)"; }}
                      title={t("Ustunlar tartibi to'g'ri bo'lgan namunaviy faylni yuklab oling")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      {t("Namuna fayl")}
                    </a>
                  </div>
                  <label htmlFor="cn-file-docx" style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",border:`2px dashed ${cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"}`,borderRadius:10,padding:"20px 16px",background:"var(--bg1)",transition:"border-color 0.15s",textAlign:"center",minHeight:130 }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor=cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {cnFormFile?(
                      <>
                        <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{cnFormFile.name}</span>
                        <span style={{ fontSize:11,color:"var(--text3)" }}>{(cnFormFile.size/1024).toFixed(0)} {t("KB — o'zgartirish uchun bosing")}</span>
                        <button onClick={e=>{ e.preventDefault(); setCnFormFile(null); setCnParsedTables([]); setCnCreateTab("form"); if(cnFormFileRef.current) cnFormFileRef.current.value=""; }} style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 8px",color:"var(--text3)",fontSize:11,textDecoration:"underline" }}>{t("Olib tashlash")}</button>
                      </>
                    ):(
                      <>
                        <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{t("Fayl tanlash")}</span>
                        <span style={{ fontSize:11,color:"var(--text3)" }}>{t("Faylni tanlash uchun bosing")}</span>
                      </>
                    )}
                    <input id="cn-file-docx" ref={cnFormFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleCnFormFileChange}/>
                  </label>
                  {cnSubmitted&&cnParsedTables.length===0&&!cnParseLoading&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>{t("Fayl yuklash shart")}</div>}
                  {cnParseError&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:6 }}>{cnParseError}</div>}
                  {cnParsedTables.length>0&&(
                    <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ fontSize:12,color:"var(--text2)" }}>{cnDataCount} {t("ta yozuv topildi")}</span>
                      <button onClick={()=>setCnCreateTab("table")} style={{ fontSize:12,color:"var(--accent,#1a56db)",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline" }}>{t("Jadvalga o'tish →")}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {cnCreateTab==="table"&&(
          <div className="cn-a4-toolbar itm-card" style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 14px",flexShrink:0,flexWrap:"wrap",marginBottom:12 }}>
            <span style={{ fontSize:12,color:"var(--text3)" }}>{cnParsedTables.length} {t("ta jadval")} · {cnDataCount} {t("ta yozuv")}</span>
            {cnParsedTables.length>1&&(
              <div style={{ display:"flex",gap:4 }}>
                {cnParsedTables.map((t,i)=>(
                  <button key={i} onClick={()=>setCnActiveTab(i)}
                    style={{ padding:"3px 10px",borderRadius:"var(--radius)",border:"1px solid var(--border)",fontSize:12,cursor:"pointer",fontWeight:cnActiveTab===i?700:400,background:cnActiveTab===i?"var(--accent,#1a56db)":"var(--bg2)",color:cnActiveTab===i?"#fff":"var(--text2)",whiteSpace:"nowrap" }}>
                    {t.title} <span style={{ opacity:0.75 }}>({t.rows.filter(r=>!r.isSection).length})</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex:1 }}/>
            <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"0 10px",height:30,borderRadius:"var(--radius)",border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim,#e8f0fe)":"var(--bg2)",color:cnShowPhotos?"var(--accent,#1a56db)":"var(--text2)",fontSize:12,cursor:"pointer" }}>
              {cnShowPhotos?<ImageIcon size={12}/>:<ImageOff size={12}/>} {cnShowPhotos?t("Yashirish"):t("Fotolar")}
            </button>
          </div>
        )}
        {cnCreateTab==="table"&&(
          <div style={{ flex:1,overflowX:"auto",overflowY:"auto",minHeight:0 }}>
            {(() => {
              const cnContract = contractList.find(c => c.id === cnForm.contractId);
              const cnProduct = cnContract?.products.find(p => p.id === cnForm.contractProductId);
              return (
                <CostNormA4Sheet
                  rows={cnCurrentRows}
                  showPhotos={cnShowPhotos}
                  title={cnForm.title || cnFormFile?.name?.replace(/\.docx$/i,"") || cnParsedTables[cnActiveTab]?.title}
                  contractNo={cnContract?.contractNo}
                  productType={cnProduct?.productType}
                  metadata={cnParsedMetadata}
                  departments={cnScopedDepartments(cnForm.contractId,cnForm.contractProductId||null)}
                  onUpdateRow={(flatIdx,updated)=>{ setCnParsedTables(prev=>{ const next=[...prev]; const tab={...next[cnActiveTab],rows:[...next[cnActiveTab].rows]}; tab.rows[flatIdx]={...tab.rows[flatIdx],...updated}; next[cnActiveTab]=tab; return next; }); }}
                  onDeleteRow={(flatIdx)=>{ setCnParsedTables(prev=>{ const next=[...prev]; const tab={...next[cnActiveTab],rows:[...next[cnActiveTab].rows]}; tab.rows.splice(flatIdx,1); next[cnActiveTab]=tab; return next; }); }}
                />
              );
            })()}
          </div>
        )}
      </div>
      {cnDraftWarning && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--warn)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--warn-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--warn)" }}>{t("Me'yoriy sarf qoralama holatida")}</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnDraftWarning}»</span> {t("me'yoriy sarf")}{" "}
              <span style={{ fontWeight:600,color:"var(--warn)" }}>{t("qoralama")}</span> {t("holatida saqlanadi.")}
              {t("Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.")}
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setCnDraftWarning(null)} disabled={cnSaving}>
                {t("Bekor qilish")}
              </button>
              <button className="btn btn-primary" onClick={handleCnSaveConfirm} disabled={cnSaving}>
                {cnSaving?t("Saqlanmoqda..."):t("Tushundim, saqlash")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  // TP: detail view
  if (tpMode === "detail" && tpSelected) {
    const canApprove = tpSelected.status === ProcessStatus.InProgress;
    return (
      <>
      <div style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button onClick={()=>{ setTpMode("list"); setTpSelected(null); }}
              style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {t("Orqaga")}
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:17,color:"var(--text1)" }}>{t("Texnologik jarayon")}</span>
            <TpBadge status={tpSelected.status}/>
          </div>
          {canApprove&&canUpdateTp&&(
            <button onClick={()=>setTpApproveTarget({id:tpSelected.id,title:tpSelected.title})} disabled={tpApproving}
              style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"7px 16px",borderRadius:"var(--radius)",border:"1px solid rgba(15,123,69,0.3)",background:"var(--success-dim)",color:"var(--success)",fontSize:13,fontWeight:600,cursor:"pointer",opacity:tpApproving?0.6:1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {tpApproving?t("Tasdiqlanmoqda..."):t("Tasdiqlash")}
            </button>
          )}
        </div>

        {/* Main info card */}
        <div className="itm-card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>{t("Asosiy ma'lumotlar")}</span>
          </div>
          <div style={{ padding:"18px 20px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px 24px" }}>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>{t("Shartnoma")}</div>
              <div style={{ fontSize:14,fontWeight:700,color:"var(--accent)" }}>{tpSelected.contractNo}</div>
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>{tpSelected.productType ? `📦 ${tpSelected.productType}` : `📋 ${t("Umumiy")}`}</div>
            </div>
            <div style={{ gridColumn:"span 2" }}>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>{t("Nomi")}</div>
              <div style={{ fontSize:14,fontWeight:600,color:"var(--text1)" }}>{tpSelected.title}</div>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:6,fontWeight:500 }}>{t("Holat")}</div>
              <TpBadge status={tpSelected.status}/>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>{t("Yaratilgan sana")}</div>
              <div style={{ fontSize:13,color:"var(--text1)" }}>{fmt(tpSelected.createdAt)}</div>
            </div>
            {tpSelected.approvedByFullName&&(
              <div>
                <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>{t("Tasdiqlagan")}</div>
                <div style={{ fontSize:13,color:"var(--text1)" }}>{tpSelected.approvedByFullName}</div>
              </div>
            )}
            {tpSelected.approvedAt&&(
              <div>
                <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>{t("Tasdiqlangan sana")}</div>
                <div style={{ fontSize:13,color:"var(--text1)" }}>{fmt(tpSelected.approvedAt)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Notes card */}
        {tpSelected.notes&&(
          <div className="itm-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>{t("Izoh")}</span>
            </div>
            <div style={{ padding:"14px 20px",fontSize:13,color:"var(--text1)",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{tpSelected.notes}</div>
          </div>
        )}

        {/* Files card */}
        {tpDetailFiles.length>0&&(
          <div className="itm-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>{t("Fayllar")}</span>
              <span style={{ fontSize:11,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"1px 8px",color:"var(--text3)" }}>{tpDetailFiles.length} {t("ta")}</span>
            </div>
            <div style={{ padding:"14px 20px",display:"flex",gap:8,flexWrap:"wrap" }}>
              {tpDetailFiles.map(f=>(
                <button key={f.id} onClick={()=>techProcessService.downloadFile(tpSelected.id,f.id,f.fileName)}
                  style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg2)",color:"var(--text1)",fontSize:13,cursor:"pointer",transition:"border-color 0.14s,background 0.14s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.background="var(--accent-dim)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="var(--bg2)"; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {f.fileName}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
      {tpApproveTarget && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> {t("texnologik jarayonni")}{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>{t("Bekor qilish")}</button>
              <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {tpApproving?t("Tasdiqlanmoqda..."):t("Ha, tasdiqlash")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  if (cnMode === "detail" && cnSelected) {
    return (
      <div style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0,flexWrap:"wrap",gap:8 }}>
          <button onClick={()=>{ setCnMode("list"); setCnSelected(null); }}
            style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            {t("Orqaga")}
          </button>
        </div>
        <div className="itm-card" style={{ marginBottom:16,flexShrink:0,overflow:"hidden" }}>
          <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
            <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>{t("Asosiy ma'lumotlar")}</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",alignItems:"center" }}>
              {cnDetailFiles.map(f=>(
                <button key={f.id} onClick={()=>costNormService.downloadFile(cnSelected.id,f.id,f.fileName)}
                  style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text1)",fontSize:12,cursor:"pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {f.fileName}
                </button>
              ))}
              <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim)":"var(--bg2)",color:cnShowPhotos?"var(--accent)":"var(--text2)",fontSize:12,cursor:"pointer" }}>
                {cnShowPhotos?<ImageIcon size={12}/>:<ImageOff size={12}/>} {cnShowPhotos?t("Fotolarni yashirish"):t("Fotolarni ko'rsatish")}
              </button>
            </div>
          </div>
          <div style={{ padding:"14px 20px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px 24px" }}>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>{t("Shartnoma")}</div>
              <div style={{ fontWeight:700,fontSize:15,color:"var(--accent)" }}>{cnSelected.contractNo}</div>
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>{cnSelected.productType ? `📦 ${cnSelected.productType}` : `📋 ${t("Umumiy")}`}</div>
            </div>
            <div style={{ gridColumn:"span 2" }}>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>{t("Nomi")}</div>
              <div style={{ fontWeight:600,fontSize:14,color:"var(--text1)" }}>{cnSelected.title}</div>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>{t("Holat")}</div>
              <CnBadge status={cnSelected.status}/>
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
          <div style={{ flex:1,overflowX:"auto",overflowY:"auto" }}>
            {cnDetailLoading?(
              <div style={{ padding:40,textAlign:"center",color:"var(--text2)",fontSize:13 }}>{t("Yuklanmoqda...")}</div>
            ):(
              <CollapsibleItemsTable rows={cnDetailItems} showPhotos={cnShowPhotos}/>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CN: edit view
  if (cnMode === "edit" && cnEditingNorm) {
    return (
      <div style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
        {cnFileOverlayVisible&&(
          <FileParsingOverlay dataReady={cnFileParseReady} onComplete={()=>{
            setCnFileOverlayVisible(false);
            const res=cnPendingParseResult.current;
            if(res&&!res.error&&res.tables.length>0) {
              setCnEditItems(res.tables.flatMap(t=>t.rows));
            } else if(res?.error) { setCnEditSaveError(res.error); }
          }}/>
        )}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0,flexWrap:"wrap",gap:8 }}>
          <button onClick={()=>{ setCnMode("list"); setCnEditingNorm(null); }}
            style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            {t("Orqaga")}
          </button>
          <button onClick={handleCnEditSave} disabled={cnEditSaving||cnEditLoading}
            style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--accent,#1a56db)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:cnEditSaving||cnEditLoading?0.7:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            {cnEditSaving?t("Saqlanmoqda..."):t("Saqlash")}
          </button>
        </div>
        <div className="itm-card" style={{ padding:20,marginBottom:16,flexShrink:0 }}>
          {cnEditSaveError&&<div style={{ padding:"10px 14px",borderRadius:8,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",fontSize:13,marginBottom:16 }}>{cnEditSaveError}</div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16 }}>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>{t("Nomi")}</label>
              <input className="form-input" value={cnEditForm.title} onChange={e=>setCnEditForm(f=>({...f,title:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>{t("Izoh")}</label>
              <input className="form-input" value={cnEditForm.notes} onChange={e=>setCnEditForm(f=>({...f,notes:e.target.value}))}/>
            </div>
            <div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,gap:8 }}>
                <label style={{ fontSize:12,fontWeight:600,color:"var(--text2)" }}>{t("Fayl almashtirish (ixtiyoriy)")}</label>
                <a
                  href="/namuna_meyoriy_sarf.docx"
                  download
                  style={{ display:"inline-flex",alignItems:"center",gap:4,color:"var(--accent)",fontSize:11,fontWeight:600,textDecoration:"none" }}
                  title={t("Namunaviy DOCX faylni yuklab oling")}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {t("Namuna")}
                </a>
              </div>
              <input ref={cnEditFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleEditCnFileChange}/>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",padding:"0 10px",height:40,boxSizing:"border-box" }}>
                <button onClick={()=>cnEditFileRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"transparent",color:"var(--text2)",fontSize:12,cursor:"pointer",transition:"border-color 0.14s,color 0.14s",flexShrink:0 }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
                  <Upload size={13}/> {t("Fayl tanlash")}
                </button>
                {cnEditNewFile&&<span style={{ fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{cnEditNewFile.name}</span>}
                {!cnEditNewFile&&cnEditFiles.length>0&&<span style={{ fontSize:11,color:"var(--text3)",flex:1 }}>{cnEditFiles.length} {t("ta fayl")}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
            <span style={{ fontSize:12,color:"var(--text3)" }}>{cnEditItems.filter(r=>!r.isSection).length} {t("ta yozuv")}</span>
            <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"0 10px",height:28,borderRadius:"var(--radius)",border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim)":"var(--bg2)",color:cnShowPhotos?"var(--accent)":"var(--text2)",fontSize:11,cursor:"pointer" }}>
              {cnShowPhotos?<ImageIcon size={11}/>:<ImageOff size={11}/>} {cnShowPhotos?t("Fotolar yashirish"):t("Fotolar")}
            </button>
          </div>
          <div style={{ flex:1,overflowX:"auto",overflowY:"auto" }}>
            {cnEditLoading?(
              <div style={{ padding:40,textAlign:"center",color:"var(--text2)",fontSize:13 }}>{t("Yuklanmoqda...")}</div>
            ):(
              <CollapsibleItemsTable rows={cnEditItems} showPhotos={cnShowPhotos}
                departments={(()=>{
                  // Scoped ro'yxat + ilgari saqlangan (lekin biriktirmadan chiqib ketgan) bo'limlar,
                  // aks holda select ularni ko'rsata olmay qiymat yo'qoladi.
                  const scoped=cnScopedDepartments(null,cnEditingNorm.contractProductId,cnEditingNorm.contractNo);
                  const ids=new Set(scoped.map(d=>d.id));
                  const extra=departments.filter(d=>!ids.has(d.id)&&cnEditItems.some(r=>r.isSection&&r.departmentId===d.id));
                  return [...scoped,...extra];
                })()}
                onUpdateRow={(flatIdx,updated)=>{ setCnEditItems(prev=>{ const next=[...prev]; next[flatIdx]={...next[flatIdx],...updated}; return next; }); }}
                onDeleteRow={(flatIdx)=>{ setCnEditItems(prev=>prev.filter((_,i)=>i!==flatIdx)); }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main view: contracts table + detail page ─────────────────────────────────

  const selectedItem = readinessItems.find(i => scopeKey(i.contractId, i.contractProductId) === selectedScopeKey) ?? null;

  // Backend `/api/contract/readiness` qatorlarni priority bo'yicha tartiblab,
  // qidiruv va sahifalashni o'zi qaytaradi.
  const sortedFilteredItems = readinessItems;

  // ── Detail full-page view ──────────────────────────────────────────────────

  if (selectedItem) {
    const closeDetail = () => { setSelectedScopeKey(null); setTpInlineEditing(false); };
    const drawingApproved = selectedItem.drawing?.status === DrawingStatus.Approved;
    const tpEffective = selectedItem.tp?.status !== ProcessStatus.Pending ? selectedItem.tp : null;
    const cnEffective = selectedItem.cn && selectedItem.cn.itemCount > 0 ? selectedItem.cn : null;
    const drawingDone = drawingApproved;
    const tpDone = tpEffective && (tpEffective.status === ProcessStatus.Approved || tpEffective.status === ProcessStatus.Completed);
    const cnDone = cnEffective && cnEffective.status === DrawingStatus.Approved;
    return (
      <>
      <div style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
          <button onClick={closeDetail}
            style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            {t("Orqaga")}
          </button>
          <span style={{ color:"var(--border)" }}>|</span>
          <span style={{ fontWeight:700,fontSize:15,color:"var(--accent)" }}>{selectedItem.contractNo}</span>
          <span style={{ color:"var(--border)" }}>·</span>
          {selectedItem.contractProductId === null ? (
            <span style={{ fontSize:12,fontWeight:600,color:"var(--text2)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 10px" }}>📋 {t("Umumiy")}</span>
          ) : (
            <span style={{ fontSize:13,fontWeight:600,color:"var(--text1)" }}>
              📦 {selectedItem.productType}
              {selectedItem.productQuantity !== null && (
                <span style={{ color:"var(--text3)",fontWeight:500,marginLeft:6 }}>
                  · {selectedItem.productQuantity.toLocaleString()} {selectedItem.productUnit ?? ""}
                </span>
              )}
            </span>
          )}
        </div>

        {/* ── Workflow pipeline: 3 qadam ── */}
        <div className="itm-card" style={{ padding:"14px 20px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:0 }}>

            {/* Step 1: Texnik chizma */}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1 }}>
              <div style={{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                background: drawingDone ? "var(--success)" : selectedItem.drawing ? "#e8f0fe" : "var(--bg3)",
                border: drawingDone ? "2px solid var(--success)" : selectedItem.drawing ? "2px solid #1a56db" : "2px solid var(--border)",
              }}>
                {drawingDone
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={selectedItem.drawing?"#1a56db":"var(--text3)"} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                }
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12,fontWeight:700,color: drawingDone ? "var(--success)" : selectedItem.drawing ? "#1a56db" : "var(--text3)" }}>{t("Texnik chizma")}</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!selectedItem.drawing ? t("Yaratilmagan") : drawingDone ? t("Tasdiqlangan") : t("Tasdiqlanmagan")}
                </div>
              </div>
            </div>

            {/* Arrow 1→2 */}
            <div style={{ flex:"0 0 40px",display:"flex",alignItems:"center",justifyContent:"center",paddingBottom:24 }}>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <line x1="0" y1="6" x2="18" y2="6" stroke={drawingDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
                <polyline points="14,2 20,6 14,10" fill="none" stroke={drawingDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
              </svg>
            </div>

            {/* Step 2: Texnologik jarayon */}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1 }}>
              <div style={{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                background: tpDone ? "var(--success)" : tpEffective ? "#e8f0fe" : "var(--bg3)",
                border: tpDone ? "2px solid var(--success)" : tpEffective ? "2px solid #1a56db" : "2px solid var(--border)",
              }}>
                {tpDone
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tpEffective?"#1a56db":"var(--text3)"} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                }
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12,fontWeight:700,color: tpDone ? "var(--success)" : tpEffective ? "#1a56db" : "var(--text3)" }}>{t("Texnologik jarayon")}</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!tpEffective ? t("Yaratilmagan") : tpDone ? t("Tasdiqlangan") : t("Kutilmoqda")}
                </div>
              </div>
            </div>

            {/* Arrow 2→3 */}
            <div style={{ flex:"0 0 40px",display:"flex",alignItems:"center",justifyContent:"center",paddingBottom:24 }}>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <line x1="0" y1="6" x2="18" y2="6" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
                <polyline points="14,2 20,6 14,10" fill="none" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
              </svg>
            </div>

            {/* Step 3: Me'yoriy sarf */}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1 }}>
              <div style={{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                background: cnDone ? "var(--success)" : cnEffective ? "#e8f0fe" : "var(--bg3)",
                border: cnDone ? "2px solid var(--success)" : cnEffective ? "2px solid #1a56db" : "2px solid var(--border)",
              }}>
                {cnDone
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={cnEffective?"#1a56db":"var(--text3)"} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                }
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12,fontWeight:700,color: cnDone ? "var(--success)" : cnEffective ? "#1a56db" : "var(--text3)" }}>{t("Me'yoriy sarf")}</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!cnEffective ? t("Yaratilmagan") : cnDone ? t("Tasdiqlangan") : t("Kutilmoqda")}
                </div>
              </div>
            </div>

          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>

          {/* TP Panel */}
          <div className="itm-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"11px 16px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6 }}>
              <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                <span style={{ fontWeight:700,fontSize:13,color:"var(--text1)" }}>{t("Texnologik jarayon")}</span>
              </div>
              {tpEffective&&!tpInlineEditing&&drawingApproved&&(
                <div style={{ display:"flex",gap:4 }}>
                  {tpEffective.status===ProcessStatus.InProgress&&canUpdateTp&&(
                    <button onClick={()=>setTpApproveTarget({id:tpEffective.id,title:tpEffective.title})} disabled={tpApproving}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:tpApproving?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {tpApproving?"...":t("Tasdiqlash")}
                    </button>
                  )}
                  <button onClick={()=>{ const full=tpList.find(t=>t.id===tpEffective.id); if(full) openTpDetail(full); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#e8f0fe",border:"1px solid #a4c0f4",color:"#1a56db",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {t("Ko'rish")}
                  </button>
                  {canUpdateTp&&(
                  <button onClick={()=>{ const full=tpList.find(t=>t.id===tpEffective.id); if(!full) return; setTpSelected(full); setTpEditForm({title:full.title,notes:full.notes||""}); setTpEditNewFile(null); setTpInlineEditing(true); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    {t("Tahrirlash")}
                  </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {/* Bloklash banneri */}
              {!drawingApproved&&(
                <div style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:8,background:"#fef9c3",border:"1px solid #fde047",marginBottom:tpEffective?12:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink:0,marginTop:1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <div style={{ fontSize:12,fontWeight:700,color:"#854d0e",marginBottom:2 }}>{t("Texnik chizma tasdiqlanmagan")}</div>
                    <div style={{ fontSize:12,color:"#92400e",lineHeight:1.5 }}>
                      {t("Texnologik jarayon bilan ishlash uchun")} <strong>{t("texnik chizma tasdiqlanishi")}</strong>{" "}{t("kerak. Texnik chizmalar bo'limiga o'ting va chizmaning tasdiqlanishini kuting.")}
                    </div>
                  </div>
                </div>
              )}
              {!tpEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>{t("Texnologik jarayon yaratilmagan")}</div>
                  {drawingApproved&&canCreateTp&&(
                  <button onClick={()=>openTpCreate(selectedItem.contractId, selectedItem.contractProductId)} className="btn-create-accent"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",transition:"border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                    onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor="var(--accent)";b.style.boxShadow="0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)";b.style.background="var(--accent-dim)";b.style.color="var(--accent)"}}
                    onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor="var(--border)";b.style.boxShadow="";b.style.background="var(--bg3)";b.style.color="var(--text2)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {t("Jarayon yaratish")}
                  </button>
                  )}
                </div>
              ):tpInlineEditing?(
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>{t("Nomi")}</label>
                    <input className="form-input" value={tpEditForm.title} onChange={e=>setTpEditForm(f=>({...f,title:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>{t("Izoh")}</label>
                    <textarea className="form-input" value={tpEditForm.notes} onChange={e=>setTpEditForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ resize:"none" }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>{t("Fayl (yangilash uchun)")}</label>
                    <input ref={tpEditFileRef} type="file" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) setTpEditNewFile(f); }}/>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <button type="button" onClick={()=>tpEditFileRef.current?.click()}
                        style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer",transition:"border-color 0.14s,color 0.14s" }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
                        <Upload size={12}/> {t("Fayl tanlash")}
                      </button>
                      {tpEditNewFile&&(
                        <span style={{ fontSize:12,color:"var(--text1)",display:"inline-flex",alignItems:"center",gap:4 }}>
                          {tpEditNewFile.name}
                          <button type="button" onClick={()=>{ setTpEditNewFile(null); if(tpEditFileRef.current) tpEditFileRef.current.value=""; }}
                            style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",display:"inline-flex",padding:0 }}>
                            <X size={12}/>
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
                    <button onClick={()=>setTpInlineEditing(false)}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}
                      style={{ padding:"6px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer" }}>{t("Bekor qilish")}</button>
                    <button onClick={async()=>{ await handleTpEditSave(); setTpInlineEditing(false); }} disabled={tpEditSaving}
                      style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 16px",borderRadius:"var(--radius)",border:"none",background:"var(--accent)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:tpEditSaving?0.7:1 }}>
                      {tpEditSaving?t("Saqlanmoqda..."):t("Saqlash")}
                    </button>
                  </div>
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>{t("Nomi")}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={tpEffective.title}>{tpEffective.title}</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>{t("Holat")}</div>
                    <TpBadge status={tpEffective.status}/>
                  </div>
                  {tpEffective.notes&&(
                    <div style={{ width:"100%",marginTop:2 }}>
                      <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>{t("Izoh")}</div>
                      <div style={{ fontSize:13,color:"var(--text1)",whiteSpace:"pre-wrap",lineHeight:1.5 }}>{tpEffective.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CN Panel */}
          <div className="itm-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"11px 16px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6 }}>
              <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span style={{ fontWeight:700,fontSize:13,color:"var(--text1)" }}>{t("Me'yoriy sarf")}</span>
              </div>
              {cnEffective&&(
                <div style={{ display:"flex",gap:4 }}>
                  {cnEffective.status===DrawingStatus.InProgress&&canUpdateCn&&(
                    <button onClick={()=>handleCnApprove({ id: cnEffective.id, title: cnEffective.title })} disabled={cnApproving}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:cnApproving?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {cnApproving?"...":t("Tasdiqlash")}
                    </button>
                  )}
                  <button onClick={()=>{ const full=cnList.find(n=>n.id===cnEffective.id); if(full) openCnDetail(full); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#e8f0fe",border:"1px solid #a4c0f4",color:"#1a56db",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {t("Ko'rish")}
                  </button>
                  {canUpdateCn&&(
                  <button onClick={()=>{ const full=cnList.find(n=>n.id===cnEffective.id); if(full) openCnEdit(full); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    {t("Tahrirlash")}
                  </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {!cnEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>{t("Me'yoriy sarf yaratilmagan")}</div>
                  {canCreateCn&&(<button onClick={()=>openCnCreate(selectedItem.contractId, selectedItem.contractProductId)} className="btn-create-accent"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",transition:"border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                    onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor="var(--accent)";b.style.boxShadow="0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)";b.style.background="var(--accent-dim)";b.style.color="var(--accent)"}}
                    onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor="var(--border)";b.style.boxShadow="";b.style.background="var(--bg3)";b.style.color="var(--text2)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {t("Me'yoriy sarf yaratish")}
                  </button>)}
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>{t("Nomi")}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={cnEffective!.title}>{cnEffective!.title}</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>{t("Holat")}</div>
                    <CnBadge status={cnEffective!.status}/>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
      {tpApproveTarget && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> {t("texnologik jarayonni")}{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>{t("Bekor qilish")}</button>
              <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {tpApproving?t("Tasdiqlanmoqda..."):t("Ha, tasdiqlash")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {cnApproveTarget && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnApproveTarget.title}»</span> {t("me'yoriy sarfni")}{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setCnApproveTarget(null)} disabled={cnApproving}>{t("Bekor qilish")}</button>
              <button className="btn btn-primary" onClick={handleCnApproveConfirm} disabled={cnApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {cnApproving?t("Tasdiqlanmoqda..."):t("Ha, tasdiqlash")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  return (
    <>
    <div className="page-transition" style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
      <style>{`
        @keyframes tp-row-pulse {
          0%, 100% { background-color: rgba(217,48,37,0.06); }
          50%      { background-color: rgba(217,48,37,0.20); }
        }
        .tp-row-ready > td {
          animation: tp-row-pulse 1.6s ease-in-out infinite;
        }
        .tp-row-ready:hover > td {
          animation-play-state: paused;
          background-color: rgba(217,48,37,0.22) !important;
        }

        .tp-empty-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          background: var(--danger-dim);
          color: var(--danger);
          border: 1px solid rgba(217,48,37,0.4);
        }
        .tp-empty-badge::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        @keyframes tp-badge-pulse {
          0%, 100% {
            background: var(--danger-dim);
            color: var(--danger);
          }
          50% {
            background: var(--danger);
            color: #fff;
          }
        }
        .tp-row-ready .tp-empty-badge {
          animation: tp-badge-pulse 1.6s ease-in-out infinite;
        }

      `}</style>

      {/* ── Toolbar ── */}
      <div className="itm-card" style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"8px 14px",flexWrap:"wrap" }}>
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

        <div className="search-wrap" style={{ flex:1,minWidth:180,maxWidth:"none" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder={t("Shartnoma raqami bo'yicha qidirish...")} value={tpSearch} onChange={e=>setTpSearch(e.target.value)}/>
        </div>
        <button className="btn-icon" onClick={()=>{ loadTp(); loadCn(); loadContracts(); loadReadiness(page); }} title={t("Yangilash")} style={{ background:"var(--accent-dim)",borderColor:"var(--accent)",color:"var(--accent)",width:36,height:36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>

      {/* ── Contracts table ── */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {(readinessLoading||tpLoading||cnListLoading)?(
          <div style={{ flex:1,padding:40,textAlign:"center",color:"var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ):readinessItems.length===0?(
          <div style={{ flex:1,padding:40,textAlign:"center",color:"var(--text2)" }}>
            {viewMode === "archive" ? t("Arxivda yozuvlar yo'q") : t("Ma'lumot topilmadi")}
          </div>
        ):(
          <div style={{ overflowX:"auto",overflowY:"auto",flex:1,minHeight:0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width:64,minWidth:64,textAlign:"center",borderRight:"2px solid var(--border)",color:"var(--text1)",textTransform:"none",background:"var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Shartnoma №")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Mahsulot")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Texnik chizma")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Texnologik jarayon")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Me'yoriy sarf")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",background:"var(--bg2)" }}>{t("Umumiy holat")}</th>
                  <th style={{ textAlign:"center",color:"var(--text1)",textTransform:"none",background:"var(--bg2)" }}>{t("Faollik")}</th>
                  <th style={{ textAlign:"center",borderLeft:"2px solid var(--border)",color:"var(--text1)",textTransform:"none",background:"var(--bg2)" }}>{t("Amal")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredItems.length===0?(
                  <tr><td colSpan={9} style={{ textAlign:"center",color:"var(--text2)",padding:32 }}>
                    {viewMode === "archive" ? t("Arxivda yozuvlar yo'q") : t("Ma'lumot topilmadi")}
                  </td></tr>
                ):sortedFilteredItems.map((item,i)=>{
                  const drawingOk=item.drawing?.status===DrawingStatus.Approved;
                  const tpEffective=item.tp?.status!==ProcessStatus.Pending?item.tp:null;
                  const cnEffective=item.cn&&item.cn.itemCount>0?item.cn:null;
                  const tpOk=tpEffective&&(tpEffective.status===ProcessStatus.Approved||tpEffective.status===ProcessStatus.Completed);
                  const cnOk=cnEffective&&cnEffective.status===DrawingStatus.Approved;
                  const drawingReadyPending = drawingOk && !(tpOk && cnOk);
                  const rowKey = scopeKey(item.contractId, item.contractProductId);
                  return (
                    <tr key={rowKey}
                      className={drawingReadyPending ? "tp-row-ready" : undefined}
                      onClick={()=>{ if(!drawingOk){ setDrawingWarningNo(item.contractNo); } else { setSelectedScopeKey(rowKey); setTpInlineEditing(false); } }}
                      style={{ cursor:"pointer",transition:"background 0.12s" }}>
                      <td style={{ textAlign:"center",borderRight:"2px solid var(--border)",minWidth:64,padding:"0 8px",fontSize:13, color: drawingReadyPending ? "var(--danger)" : undefined, fontWeight: drawingReadyPending ? 700 : undefined }}>{String((page - 1) * PAGE_SIZE + i + 1).padStart(2,"0")}</td>
                      <td style={{ textAlign:"center",fontSize:13,color:"var(--text1)",fontFamily:"var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</td>
                      <td style={{ textAlign:"center",fontSize:13,color:"var(--text1)" }}>
                        {item.contractProductId === null ? (
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--text2)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 10px" }}>📋 {t("Umumiy")}</span>
                        ) : (
                          <span style={{ fontWeight:600 }}>{item.productType}</span>
                        )}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {!item.drawing?(
                          <span className="tp-empty-badge">{t("Yaratilmagan")}</span>
                        ):drawingOk?(
                          <span className="tp-approved-badge" style={{ display:"inline-flex",alignItems:"center",fontSize:12,fontWeight:600,color:"var(--success)",background:"var(--success-dim)",borderRadius:20,padding:"2px 10px",border:"1px solid rgba(15,123,69,0.2)" }}>
                            {t("Tasdiqlangan")}
                          </span>
                        ):(
                          <span style={{ fontSize:11,fontWeight:600,color:"#ca8a04",background:"#fef9c3",borderRadius:20,padding:"2px 10px",border:"1px solid #fde047",display:"inline-block" }}>{t("Tasdiqlanmagan")}</span>
                        )}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {tpEffective?<TpBadge status={tpEffective.status}/>:<span className="tp-empty-badge">{t("Yaratilmagan")}</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {cnEffective?<CnBadge status={cnEffective.status}/>:<span className="tp-empty-badge">{t("Yaratilmagan")}</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {tpOk&&cnOk?(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--purple)",background:"var(--purple-dim)",borderRadius:20,padding:"2px 10px",border:"1px solid rgba(109,74,173,0.2)",display:"inline-block" }}>{t("Yakunlangan")}</span>
                        ):drawingOk?(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--text2)",background:"var(--bg3)",borderRadius:20,padding:"2px 10px",border:"1px solid var(--border)",display:"inline-block" }}>{t("Jarayonda")}</span>
                        ):(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--text3)",background:"var(--bg3)",borderRadius:20,padding:"2px 10px",border:"1px solid var(--border)",display:"inline-block",fontStyle:"italic" }}>{t("Boshlanmagan")}</span>
                        )}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        <span style={{
                          display:"inline-flex",alignItems:"center",padding:"2px 10px",
                          borderRadius:20,fontSize:13,fontWeight:600,
                          background: item.contractIsActive ? "#dcfce7" : "var(--danger-dim)",
                          color: item.contractIsActive ? "#16a34a" : "var(--danger)",
                          border: `1px solid ${item.contractIsActive ? "#86efac" : "var(--danger)"}`,
                        }}>
                          {item.contractIsActive ? t("Faol") : t("Nofaol")}
                        </span>
                      </td>
                      <td style={{ borderLeft:"2px solid var(--border)" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:"flex",gap:6,justifyContent:"center" }}>
                          {drawingOk && viewMode === "active" && !tpEffective && !cnEffective ? (
                            <button
                              className="btn-icon"
                              onClick={()=>{ setSelectedScopeKey(rowKey); setTpInlineEditing(false); }}
                              title={t("Yaratish")}
                              style={{ color:"var(--accent)",borderColor:"var(--accent)33",background:"var(--accent-dim)",width:28,height:28,fontSize:18,fontWeight:400,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}
                            >
                              +
                            </button>
                          ) : (
                            <button
                              className="btn-icon"
                              onClick={()=>{ if(!drawingOk){ setDrawingWarningNo(item.contractNo); } else { setSelectedScopeKey(rowKey); setTpInlineEditing(false); } }}
                              title={t("Ko'rish")}
                              style={{ color:"#0ea5e9",borderColor:"#0ea5e933",background:"#0ea5e912" }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
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

      {/* Drawing not approved — blur overlay warning */}
      {drawingWarningNo && createPortal(
        <div
          onClick={()=>setDrawingWarningNo(null)}
          style={{ position:"fixed",inset:0,zIndex:200,backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",background:"rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center" }}
        >
          <div
            onClick={e=>e.stopPropagation()}
            style={{ background:"#fef9c3",border:"1px solid #fde047",borderRadius:12,padding:"24px 28px",maxWidth:420,width:"90%",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",display:"flex",alignItems:"flex-start",gap:14 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink:0,marginTop:2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#854d0e",marginBottom:6 }}>{t("Texnik chizma tasdiqlanmagan")}</div>
              <div style={{ fontSize:13,color:"#92400e",lineHeight:1.6 }}>
                {t("Texnologik jarayon bilan ishlash uchun")} <strong>{t("texnik chizma tasdiqlanishi")}</strong>{" "}{t("kerak. Texnik chizmalar bo'limiga o'ting va chizmaning tasdiqlanishini kuting.")}
              </div>
              <button
                onClick={()=>setDrawingWarningNo(null)}
                style={{ marginTop:16,padding:"6px 18px",background:"#ca8a04",color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer" }}
              >
                {t("Yopish")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>

    {/* TP approve confirm modal */}
    {tpApproveTarget && createPortal(
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
            <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
          </div>
          <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
            <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> {t("texnologik jarayonni")}{" "}
            <span style={{ fontWeight:600,color:"var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>
              {t("Bekor qilish")}
            </button>
            <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
              style={{ background:"var(--success)",borderColor:"var(--success)" }}>
              {tpApproving?t("Tasdiqlanmoqda..."):t("Ha, tasdiqlash")}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* TP & CN approve confirm modals */}
    {cnApproveTarget && createPortal(
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
            <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{t("Tasdiqlashni tasdiqlaysizmi?")}</div>
          </div>
          <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
            <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnApproveTarget.title}»</span> {t("me'yoriy sarfni")}{" "}
            <span style={{ fontWeight:600,color:"var(--success)" }}>{t("tasdiqlangan")}</span> {t("holatiga o'tkazmoqchimisiz?")}
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <button className="btn btn-outline" onClick={()=>setCnApproveTarget(null)} disabled={cnApproving}>
              {t("Bekor qilish")}
            </button>
            <button className="btn btn-primary" onClick={handleCnApproveConfirm} disabled={cnApproving}
              style={{ background:"var(--success)",borderColor:"var(--success)" }}>
              {cnApproving?t("Tasdiqlanmoqda..."):t("Ha, tasdiqlash")}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
