"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDraft } from "@/lib/useDraft";
import { useToastStore } from "@/lib/store/toastStore";
import { Upload, X, Image as ImageIcon, ImageOff } from "lucide-react";
import {
  techProcessService,
  contractService,
  costNormService,
  technicalDrawingService,
  ContractStatus,
  ProcessStatus,
  DrawingStatus,
  type TechProcessCreatePayload,
  type ContractResponse,
  type AttachmentResponse,
} from "@/lib/userService";
import {
  type MaterialRow,
  type ParsedTable,
  type TpMode,
  type CnMode,
  type ContractReadinessItem,
  type TechProcessResponse,
  type CostNormResponse,
  type CostNormItemResponse,
  type TechnicalDrawingResponse,
  parseMainTables,
  fmt,
} from "./_types";
import { TpBadge } from "./_components/TpBadge";
import { CnBadge } from "./_components/CnBadge";
import { CollapsibleItemsTable } from "./_components/CollapsibleItemsTable";
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
  const [tpForm, setTpForm] = useState({ contractId:"", title:"", notes:"" });
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

  // TP actions
const [tpApprovingId, setTpApprovingId] = useState<string|null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useToastStore((s) => s.show);

  useDraft("draft_techprocess", tpShowForm, tpForm, (d)=>{ if(d.contractId) { setTpForm(d); setTpShowForm(true); } else { sessionStorage.removeItem("draft_techprocess"); } });

  // ── Cost Norm state ────────────────────────────────────────────────────────
  const [cnMode, setCnMode] = useState<CnMode>("list");
  const [cnShowPhotos, setCnShowPhotos] = useState(false);
  const [cnList, setCnList] = useState<CostNormResponse[]>([]);
  const [cnListLoading, setCnListLoading] = useState(true);
  const [cnSelected, setCnSelected] = useState<CostNormResponse|null>(null);
  const [cnActiveTab, setCnActiveTab] = useState(0);
  const [cnDetailFiles, setCnDetailFiles] = useState<AttachmentResponse[]>([]);
  const [cnDetailItems, setCnDetailItems] = useState<CostNormItemResponse[]>([]);
  const [cnForm, setCnForm] = useState({ contractId:"", title:"", notes:"" });
  const [cnSubmitted, setCnSubmitted] = useState(false);
  const [cnSaving, setCnSaving] = useState(false);
  const [cnCreateTab, setCnCreateTab] = useState<"form"|"table">("form");
  const [cnSaveError, setCnSaveError] = useState<string|null>(null);
  const [cnApprovingId, setCnApprovingId] = useState<string|null>(null);
  const [cnEditingNorm, setCnEditingNorm] = useState<CostNormResponse|null>(null);
  const [cnEditForm, setCnEditForm] = useState({ title:"", notes:"" });
  const [cnEditItems, setCnEditItems] = useState<MaterialRow[]>([]);
  const [cnEditFiles, setCnEditFiles] = useState<AttachmentResponse[]>([]);
  const [cnEditNewFile, setCnEditNewFile] = useState<File|null>(null);
  const [cnEditSaving, setCnEditSaving] = useState(false);
  const [cnEditSaveError, setCnEditSaveError] = useState<string|null>(null);
  const cnEditFileRef = useRef<HTMLInputElement>(null);
  const [cnFormFile, setCnFormFile] = useState<File|null>(null);
  const [cnParsedTables, setCnParsedTables] = useState<ParsedTable[]>([]);
  const [cnParseLoading, setCnParseLoading] = useState(false);
  const [cnParseError, setCnParseError] = useState<string|null>(null);
  const cnFormFileRef = useRef<HTMLInputElement>(null);
  const [cnFileOverlayVisible, setCnFileOverlayVisible] = useState(false);
  const [cnFileParseReady, setCnFileParseReady] = useState(false);
  const cnPendingParseResult = useRef<{tables:ParsedTable[];error:string|null;fileName:string}|null>(null);

  // ── Selected contract for inline detail panel ──────────────────────────────
  const [selectedContractId, setSelectedContractId] = useState<string|null>(null);
  const [tpInlineEditing, setTpInlineEditing] = useState(false);
  const [drawingWarningNo, setDrawingWarningNo] = useState<string|null>(null);
  const [contractList, setContractList] = useState<ContractResponse[]>([]);
  const [drawingList, setDrawingList] = useState<TechnicalDrawingResponse[]>([]);

  useDraft("draft_costnorm", cnMode==="create", cnForm, (d)=>{ if(d.contractId) { setCnForm(d); setCnMode("create"); } else { sessionStorage.removeItem("draft_costnorm"); } });

  // ── Contract readiness ─────────────────────────────────────────────────────
  const readinessItems = useMemo<ContractReadinessItem[]>(()=>{
    const map = new Map<string, ContractReadinessItem>();
    for (const c of contractList) {
      if (!map.has(c.id)) map.set(c.id, { contractId:c.id, contractNo:c.contractNo, drawing:null, tp:null, cn:null });
    }
    for (const tp of tpList) {
      if (!map.has(tp.contractId)) map.set(tp.contractId, { contractId:tp.contractId, contractNo:tp.contractNo, drawing:null, tp:null, cn:null });
      const entry = map.get(tp.contractId)!;
      if (!entry.tp || tp.status > entry.tp.status) entry.tp = tp;
    }
    for (const cn of cnList) {
      if (!map.has(cn.contractId)) map.set(cn.contractId, { contractId:cn.contractId, contractNo:cn.contractNo, drawing:null, tp:null, cn:null });
      const entry = map.get(cn.contractId)!;
      if (!entry.cn || (entry.cn.items.length === 0 && cn.items.length > 0)) entry.cn = cn;
    }
    for (const d of drawingList) {
      if (!map.has(d.contractId)) continue;
      const entry = map.get(d.contractId)!;
      // Tasdiqlangan chizmani ustun ko'r, bo'lmasa eng so'nggi
      if (!entry.drawing || d.status > entry.drawing.status) entry.drawing = d;
    }
    return Array.from(map.values()).sort((a,b)=>a.contractNo.localeCompare(b.contractNo));
  },[contractList, tpList, cnList, drawingList]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadContracts = useCallback(async()=>{
    try {
      const statuses = [ContractStatus.DrawingPending, ContractStatus.TechProcessing, ContractStatus.TechProcessApproved, ContractStatus.WarehouseCheck];
      const results = await Promise.all(statuses.map(s=>contractService.getAll(s)));
      const all = results.flat();
      // Dublikatlarni olib tashlash
      const unique = Array.from(new Map(all.map(c=>[c.id,c])).values());
      setContractList(unique);
    } catch { setContractList([]); }
  },[]);

  const loadTp = async () => {
    try { setTpLoading(true); const data=await techProcessService.getAll(); setTpList(data); }
    catch { /* ignore */ }
    finally { setTpLoading(false); }
  };

  const loadCn = useCallback(async()=>{ setCnListLoading(true); const d=await costNormService.getAll(); setCnList(d); setCnListLoading(false); },[]);

  const loadDrawings = useCallback(async()=>{ try { const d=await technicalDrawingService.getAll(); setDrawingList(d); } catch { setDrawingList([]); } },[]);

  useEffect(()=>{ loadTp(); loadCn(); loadContracts(); loadDrawings(); },[loadCn, loadContracts, loadDrawings]);

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
      await loadTp();
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      alert(msg??"Saqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally { setTpEditSaving(false); }
  };

  // ── TP Create ──────────────────────────────────────────────────────────────

  const openTpCreate = async (prefilledContractId?: string) => {
    setTpForm({contractId:prefilledContractId||"",title:"",notes:""}); setTpSubmitted(false); setTpFormError(""); setFinalFile(null); setTpFileError("");
    window.history.pushState({showForm:true},"");
    setTpShowForm(true);
  };

  const handleTpSave = () => {
    setTpSubmitted(true); setTpFileError(""); setTpFormError("");
    if(!tpForm.contractId) { setTpFormError("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring."); return; }
    if(!tpForm.title.trim()&&!finalFile) { setTpFormError("Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting."); return; }
    if(!finalFile) { setTpFileError("Texnologik jarayon faylini yuklang."); return; }
    const title = tpForm.title.trim() || finalFile!.name.replace(/\.[^.]+$/, "");
    setTpDraftWarning(title);
  };

  const handleTpSaveConfirm = async () => {
    setTpSaving(true);
    try {
      const dto: TechProcessCreatePayload = { contractId:tpForm.contractId, title:tpForm.title.trim()||finalFile!.name.replace(/\.[^.]+$/,""), notes:tpForm.notes||null };
      const newId = await techProcessService.create(dto);
      await techProcessService.uploadFile(newId, finalFile!);
      const fresh = await techProcessService.getById(newId);
      setTpList(prev=>[fresh,...prev]);
      setTpDraftWarning(null);
      setTpShowForm(false);
      showToast("Texnologik jarayon muvaffaqiyatli yaratildi!");
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      setTpFormError(msg??"Saqlashda xatolik yuz berdi.");
      setTpDraftWarning(null);
    } finally { setTpSaving(false); }
  };

  // ── CN Handlers ────────────────────────────────────────────────────────────

  async function handleCnFormFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.name.toLowerCase().endsWith(".docx")) { setCnParseError("Faqat .docx format"); return; }
    setCnFormFile(file); setCnParseError(null); setCnParsedTables([]); setCnParseLoading(true); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current=null;
    try {
      const mammoth=await import("mammoth");
      const ab=await file.arrayBuffer();
      const res=await mammoth.convertToHtml({arrayBuffer:ab});
      const {tables:parsed,error:colError}=parseMainTables(res.value);
      if(colError) cnPendingParseResult.current={tables:[],error:colError,fileName:file.name};
      else if(parsed.length===0) cnPendingParseResult.current={tables:[],error:"Faylda mos jadval topilmadi.",fileName:file.name};
      else cnPendingParseResult.current={tables:parsed,error:null,fileName:file.name};
    } catch { cnPendingParseResult.current={tables:[],error:"Faylni o'qishda xatolik",fileName:file.name}; }
    setCnFileParseReady(true);
  }

  async function openCnCreate(prefilledContractId?: string) {
    setCnForm({contractId:prefilledContractId||"",title:"",notes:""}); setCnFormFile(null); setCnParsedTables([]); setCnParseError(null); setCnSaveError(null); setCnSubmitted(false); setCnActiveTab(0); setCnCreateTab("form");
    window.history.pushState({mode:"create"},"");
    setCnMode("create");
  }

  function handleCnSave() {
    setCnSubmitted(true); setCnSaveError(null);
    if(!cnForm.contractId) { setCnSaveError("Shartnoma tanlanmagan. Iltimos, ro'yxatdan shartnomani tanlang va qayta urinib ko'ring."); return; }
    if(!cnForm.title.trim()&&!cnFormFile) { setCnSaveError("Nomi kiritilmagan. Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting."); return; }
    if(cnParsedTables.length===0) { setCnSaveError("Me'yoriy sarf jadvali faylini yuklang va qayta urinib ko'ring."); return; }
    const title = cnForm.title.trim() || cnFormFile?.name?.replace(/\.docx$/i,"") || "";
    setCnDraftWarning(title);
  }

  async function handleCnSaveConfirm() {
    setCnSaving(true);
    try {
      const allRows=cnParsedTables.flatMap(t=>t.rows);
      const items=allRows.map((row,idx)=>({ isSection:row.isSection,sectionName:row.isSection?row.sectionName:null,no:row.no||null,name:row.name||null,unit:row.unit||null,readyQty:row.readyQty||null,wasteQty:row.wasteQty||null,totalQty:row.totalQty||null,photoRaw:row.photoRaw||null,photoSemi:row.photoSemi||null,importType:row.importType||null,sortOrder:idx }));
      const newId=await costNormService.create({contractId:cnForm.contractId,title:cnForm.title||cnFormFile?.name?.replace(/\.docx$/i,"")||"",notes:cnForm.notes||null,items});
      if(cnFormFile&&newId) await costNormService.uploadFile(newId,cnFormFile);
      await loadCn(); setCnDraftWarning(null); setCnMode("list");
      showToast("Me'yoriy sarf muvaffaqiyatli yaratildi!");
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      setCnSaveError(msg??"Saqlashda xatolik yuz berdi");
      setCnDraftWarning(null);
    }
    finally { setCnSaving(false); }
  }

  function handleCnApprove(norm: CostNormResponse) {
    setCnApproveTarget({ id: norm.id, title: norm.title });
  }

  async function handleCnApproveConfirm() {
    if (!cnApproveTarget) return;
    setCnApproving(true);
    try {
      await costNormService.approve(cnApproveTarget.id);
      setCnList(prev=>prev.map(n=>n.id===cnApproveTarget.id?{...n,status:DrawingStatus.Approved}:n));
      if(cnSelected?.id===cnApproveTarget.id) setCnSelected(n=>n?{...n,status:DrawingStatus.Approved}:n);
      setCnApproveTarget(null);
      showToast("Me'yoriy sarf tasdiqlandi!");
    } finally { setCnApproving(false); }
  }

  async function handleTpApproveConfirm() {
    if (!tpApproveTarget) return;
    setTpApproving(true);
    try {
      await techProcessService.approve(tpApproveTarget.id);
      if (tpSelected?.id === tpApproveTarget.id) await tpRefreshSelected(tpApproveTarget.id);
      await loadTp();
      setTpApproveTarget(null);
      showToast("Texnologik jarayon tasdiqlandi!");
    } finally { setTpApproving(false); }
  }

  function openCnDetail(norm: CostNormResponse) {
    setCnSelected(norm); setCnActiveTab(0); setCnShowPhotos(false); setCnDetailFiles([]); setCnDetailItems([...norm.items].sort((a,b)=>a.sortOrder-b.sortOrder));
    window.history.pushState({mode:"detail"},""); setCnMode("detail");
    costNormService.getFiles(norm.id).then(setCnDetailFiles).catch(()=>{});
  }

  async function openCnEdit(norm: CostNormResponse) {
    setCnEditingNorm(norm); setCnEditForm({title:norm.title,notes:norm.notes||""}); setCnEditNewFile(null); setCnEditSaveError(null); setCnEditSaving(false); setCnShowPhotos(false);
    setCnEditItems([...norm.items].sort((a,b)=>a.sortOrder-b.sortOrder).map(it=>({no:it.no||"",name:it.name||"",unit:it.unit||"",readyQty:it.readyQty||"",wasteQty:it.wasteQty||"",totalQty:it.totalQty||"",photoRaw:it.photoRaw||"",photoSemi:it.photoSemi||"",importType:it.importType||"",isSection:it.isSection,sectionName:it.sectionName||""})));
    window.history.pushState({mode:"edit"},""); setCnMode("edit");
    try { const files=await costNormService.getFiles(norm.id); setCnEditFiles(files); } catch { setCnEditFiles([]); }
  }

  async function handleEditCnFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.name.toLowerCase().endsWith(".docx")) { setCnEditSaveError("Faqat .docx format"); return; }
    setCnEditNewFile(file); setCnEditSaveError(null); setCnFileParseReady(false); setCnFileOverlayVisible(true); cnPendingParseResult.current=null;
    try {
      const mammoth=await import("mammoth"); const ab=await file.arrayBuffer(); const res=await mammoth.convertToHtml({arrayBuffer:ab});
      const {tables:parsed,error}=parseMainTables(res.value);
      if(error) cnPendingParseResult.current={tables:[],error,fileName:file.name};
      else if(parsed.length>0) { cnPendingParseResult.current={tables:parsed,error:null,fileName:file.name}; }
      else cnPendingParseResult.current={tables:[],error:null,fileName:file.name};
    } catch { cnPendingParseResult.current={tables:[],error:"Faylni o'qishda xatolik",fileName:file.name}; }
    setCnFileParseReady(true);
  }

  async function handleCnEditSave() {
    if(!cnEditingNorm) return; setCnEditSaving(true); setCnEditSaveError(null);
    try {
      const items=cnEditItems.map((row,idx)=>({isSection:row.isSection,sectionName:row.isSection?row.sectionName:null,no:row.no||null,name:row.name||null,unit:row.unit||null,readyQty:row.readyQty||null,wasteQty:row.wasteQty||null,totalQty:row.totalQty||null,photoRaw:row.photoRaw||null,photoSemi:row.photoSemi||null,importType:row.importType||null,sortOrder:idx}));
      await costNormService.update(cnEditingNorm.id,{title:cnEditForm.title,notes:cnEditForm.notes||null,items});
      if(cnEditNewFile) { for(const f of cnEditFiles) await costNormService.deleteFile(cnEditingNorm.id,f.id); await costNormService.uploadFile(cnEditingNorm.id,cnEditNewFile); }
      await loadCn(); setCnMode("list"); setCnEditingNorm(null);
    } catch { setCnEditSaveError("Saqlashda xatolik yuz berdi"); }
    finally { setCnEditSaving(false); }
  }


  // ── CN computed ────────────────────────────────────────────────────────────

  const cnDetailTables = useMemo(()=>cnSelected?[{title:cnSelected.title,rows:cnDetailItems}]:[],[cnSelected,cnDetailItems]);
  const cnDetailRows = cnDetailTables[cnActiveTab]?.rows??[];
  const cnDataCount = cnParsedTables[cnActiveTab]?.rows.filter(r=>!r.isSection).length??0;
  const cnCurrentRows = cnParsedTables[cnActiveTab]?.rows??[];


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
              Orqaga
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>Yangi texnologik jarayon</span>
          </div>
        </div>
        <div className="itm-card" style={{ padding:28 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {/* Sarlavha — full width */}
            <div>
              <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:tpSubmitted&&!tpForm.title.trim()&&!finalFile?"var(--danger)":"var(--text2)" }}>Nomi <span style={{ color:"var(--danger)" }}>*</span></label>
              <input className="form-input" value={tpForm.title} onChange={e=>setTpForm(f=>({...f,title:e.target.value}))} placeholder="Avtomatik to'ldiriladi" style={tpSubmitted&&!tpForm.title.trim()&&!finalFile?{borderColor:"var(--danger)"}:undefined}/>
              {tpSubmitted&&!tpForm.title.trim()&&!finalFile&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>Fayl yuklanmagan bo'lsa, nomni qo'lda kiriting</div>}
            </div>
            {/* Izoh + Fayl — two columns */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch" }}>
              <div style={{ display:"flex",flexDirection:"column" }}>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>Izoh</label>
                <textarea className="form-input" value={tpForm.notes} onChange={e=>setTpForm(f=>({...f,notes:e.target.value}))} placeholder="Qo'shimcha izoh (ixtiyoriy)" style={{ resize:"none",flex:1,minHeight:130 }}/>
              </div>
              <div style={{ display:"flex",flexDirection:"column" }}>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:tpSubmitted&&!finalFile?"var(--danger)":"var(--text2)" }}>Texnologik jarayon fayli <span style={{ color:"var(--danger)" }}>*</span></label>
                <label htmlFor="tp-file-final" style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",border:`2px dashed ${tpSubmitted&&!finalFile?"var(--danger)":"var(--border)"}`,borderRadius:10,padding:"20px 16px",background:"var(--bg1)",transition:"border-color 0.15s",textAlign:"center",minHeight:130 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor=tpSubmitted&&!finalFile?"var(--danger)":"var(--border)"}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {finalFile?(
                    <>
                      <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{finalFile.name}</span>
                      <span style={{ fontSize:11,color:"var(--text3)" }}>Fayl tanlandi — o'zgartirish uchun bosing</span>
                    </>
                  ):(
                    <>
                      <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>Fayl tanlash</span>
                      <span style={{ fontSize:11,color:"var(--text3)" }}>Faylni tanlash uchun bosing</span>
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
          <button onClick={()=>setTpShowForm(false)} style={{ background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"10px 24px",color:"var(--text2)",fontSize:14,fontWeight:500 }}>Bekor qilish</button>
          <button onClick={handleTpSave} disabled={tpSaving}
            style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 28px",borderRadius:"var(--radius)",border:"none",background:"var(--accent)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:tpSaving?0.7:1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {tpSaving?"Saqlanmoqda...":"Saqlash"}
          </button>
        </div>
      </div>
      {tpDraftWarning && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--warn)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--warn-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--warn)" }}>Texnologik jarayon qoralama holatida</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpDraftWarning}»</span> texnologik jarayon{" "}
              <span style={{ fontWeight:600,color:"var(--warn)" }}>qoralama</span> holatida saqlanadi.
              Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpDraftWarning(null)} disabled={tpSaving}>
                Bekor qilish
              </button>
              <button className="btn btn-primary" onClick={handleTpSaveConfirm} disabled={tpSaving}>
                {tpSaving?"Saqlanmoqda...":"Tushundim, saqlash"}
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
              else { setCnParsedTables(res.tables); setCnCreateTab("table"); if(!cnForm.title) setCnForm(f=>({...f,title:res.fileName.replace(/\.docx$/i,"")})); }
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
              Orqaga
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>Yangi me&apos;yoriy sarf</span>
          </div>
        </div>
        {/* Tab bar */}
        <div className="itm-card" style={{ display:"flex",alignItems:"center",gap:0,marginBottom:16,padding:"0 16px",flexShrink:0 }}>
          <button onClick={()=>setCnCreateTab("form")}
            style={{ padding:"12px 20px",fontSize:13,fontWeight:cnCreateTab==="form"?700:500,color:cnCreateTab==="form"?"var(--accent,#1a56db)":"var(--text2)",background:"none",border:"none",borderBottom:cnCreateTab==="form"?"2px solid var(--accent,#1a56db)":"2px solid transparent",cursor:"pointer",marginBottom:-1 }}>
            Forma
          </button>
          <button onClick={()=>cnParsedTables.length>0&&setCnCreateTab("table")}
            style={{ padding:"12px 20px",fontSize:13,fontWeight:cnCreateTab==="table"?700:500,color:cnCreateTab==="table"?"var(--accent,#1a56db)":cnParsedTables.length===0?"var(--text3)":"var(--text2)",background:"none",border:"none",borderBottom:cnCreateTab==="table"?"2px solid var(--accent,#1a56db)":"2px solid transparent",cursor:cnParsedTables.length>0?"pointer":"default",marginBottom:-1,display:"flex",alignItems:"center",gap:6 }}>
            Jadval ko&apos;rinishi
            {cnParsedTables.length>0&&<span style={{ fontSize:11,fontWeight:600,background:"var(--accent,#1a56db)",color:"#fff",borderRadius:20,padding:"1px 7px" }}>{cnDataCount}</span>}
          </button>
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setCnMode("list")} style={{ padding:"8px 18px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,fontWeight:500,cursor:"pointer" }}>Bekor qilish</button>
            <button onClick={handleCnSave} disabled={cnSaving}
              style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--accent,#1a56db)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:cnSaving?0.7:1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
              {cnSaving?"Saqlanmoqda...":"Saqlash"}
            </button>
          </div>
        </div>
        {cnCreateTab==="form"&&(
          <div className="itm-card" style={{ padding:28,flexShrink:0 }}>
            {cnSaveError&&<div style={{ padding:"10px 14px",borderRadius:8,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",fontSize:13,marginBottom:16 }}>{cnSaveError}</div>}
            <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
              {/* Nomi — full width */}
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:cnSubmitted&&!cnForm.title.trim()&&!cnFormFile?"var(--danger)":"var(--text2)" }}>
                  Nomi <span style={{ color:"var(--danger)" }}>*</span>
                </label>
                <input className="form-input" value={cnForm.title} onChange={e=>setCnForm(f=>({...f,title:e.target.value}))} placeholder="Avtomatik to'ldiriladi" style={{ borderColor:cnSubmitted&&!cnForm.title.trim()&&!cnFormFile?"var(--danger)":undefined }}/>
              </div>
              {/* Izoh + Fayl — two columns */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch" }}>
                <div style={{ display:"flex",flexDirection:"column" }}>
                  <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>Izoh</label>
                  <textarea className="form-input" value={cnForm.notes} onChange={e=>setCnForm(f=>({...f,notes:e.target.value}))} placeholder="Qo'shimcha izoh (ixtiyoriy)" style={{ resize:"none",flex:1,minHeight:130 }}/>
                </div>
                <div style={{ display:"flex",flexDirection:"column" }}>
                  <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--text2)" }}>
                    DOCX fayl <span style={{ color:"var(--danger)" }}>*</span>
                    <span style={{ fontWeight:400,color:"var(--text3)",marginLeft:6 }}>(me&apos;yoriy sarf jadvali)</span>
                  </label>
                  <label htmlFor="cn-file-docx" style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",border:`2px dashed ${cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"}`,borderRadius:10,padding:"20px 16px",background:"var(--bg1)",transition:"border-color 0.15s",textAlign:"center",minHeight:130 }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor=cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {cnFormFile?(
                      <>
                        <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>{cnFormFile.name}</span>
                        <span style={{ fontSize:11,color:"var(--text3)" }}>{(cnFormFile.size/1024).toFixed(0)} KB — o&apos;zgartirish uchun bosing</span>
                        <button onClick={e=>{ e.preventDefault(); setCnFormFile(null); setCnParsedTables([]); setCnCreateTab("form"); if(cnFormFileRef.current) cnFormFileRef.current.value=""; }} style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 8px",color:"var(--text3)",fontSize:11,textDecoration:"underline" }}>Olib tashlash</button>
                      </>
                    ):(
                      <>
                        <span style={{ fontSize:13,fontWeight:600,color:"var(--accent)" }}>Fayl tanlash</span>
                        <span style={{ fontSize:11,color:"var(--text3)" }}>Faylni tanlash uchun bosing</span>
                      </>
                    )}
                    <input id="cn-file-docx" ref={cnFormFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleCnFormFileChange}/>
                  </label>
                  {cnSubmitted&&cnParsedTables.length===0&&!cnParseLoading&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>Fayl yuklash shart</div>}
                  {cnParseError&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:6 }}>{cnParseError}</div>}
                  {cnParsedTables.length>0&&(
                    <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ fontSize:12,color:"var(--text2)" }}>{cnDataCount} ta yozuv topildi</span>
                      <button onClick={()=>setCnCreateTab("table")} style={{ fontSize:12,color:"var(--accent,#1a56db)",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline" }}>Jadvalga o&apos;tish →</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {cnCreateTab==="table"&&(
          <div className="itm-card" style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:"1px solid var(--border)",flexShrink:0,flexWrap:"wrap" }}>
              <span style={{ fontSize:12,color:"var(--text3)" }}>{cnParsedTables.length} ta jadval · {cnDataCount} ta yozuv</span>
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
                {cnShowPhotos?<ImageIcon size={12}/>:<ImageOff size={12}/>} {cnShowPhotos?"Yashirish":"Fotolar"}
              </button>
            </div>
            <div style={{ flex:1,overflowX:"auto",overflowY:"auto" }}>
              <CollapsibleItemsTable rows={cnCurrentRows} showPhotos={cnShowPhotos}
                onUpdateRow={(flatIdx,updated)=>{ setCnParsedTables(prev=>{ const next=[...prev]; const tab={...next[cnActiveTab],rows:[...next[cnActiveTab].rows]}; tab.rows[flatIdx]={...tab.rows[flatIdx],...updated}; next[cnActiveTab]=tab; return next; }); }}
                onDeleteRow={(flatIdx)=>{ setCnParsedTables(prev=>{ const next=[...prev]; const tab={...next[cnActiveTab],rows:[...next[cnActiveTab].rows]}; tab.rows.splice(flatIdx,1); next[cnActiveTab]=tab; return next; }); }}
              />
            </div>
          </div>
        )}
      </div>
      {cnDraftWarning && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--warn)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--warn-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--warn)" }}>Me&apos;yoriy sarf qoralama holatida</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnDraftWarning}»</span> me&apos;yoriy sarf{" "}
              <span style={{ fontWeight:600,color:"var(--warn)" }}>qoralama</span> holatida saqlanadi.
              Keyinchalik jadvaldan tasdiqlash tugmasi orqali tasdiqlab olishingiz mumkin.
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setCnDraftWarning(null)} disabled={cnSaving}>
                Bekor qilish
              </button>
              <button className="btn btn-primary" onClick={handleCnSaveConfirm} disabled={cnSaving}>
                {cnSaving?"Saqlanmoqda...":"Tushundim, saqlash"}
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
              Orqaga
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:17,color:"var(--text1)" }}>Texnologik jarayon</span>
            <TpBadge status={tpSelected.status}/>
          </div>
          {canApprove&&(
            <button onClick={()=>setTpApproveTarget({id:tpSelected.id,title:tpSelected.title})} disabled={tpApproving}
              style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"7px 16px",borderRadius:"var(--radius)",border:"1px solid rgba(15,123,69,0.3)",background:"var(--success-dim)",color:"var(--success)",fontSize:13,fontWeight:600,cursor:"pointer",opacity:tpApproving?0.6:1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {tpApproving?"Tasdiqlanmoqda...":"Tasdiqlash"}
            </button>
          )}
        </div>

        {/* Main info card */}
        <div className="itm-card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>Asosiy ma&apos;lumotlar</span>
          </div>
          <div style={{ padding:"18px 20px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px 24px" }}>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>Shartnoma</div>
              <div style={{ fontSize:14,fontWeight:700,color:"var(--accent)" }}>{tpSelected.contractNo}</div>
            </div>
            <div style={{ gridColumn:"span 2" }}>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>Nomi</div>
              <div style={{ fontSize:14,fontWeight:600,color:"var(--text1)" }}>{tpSelected.title}</div>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:6,fontWeight:500 }}>Holat</div>
              <TpBadge status={tpSelected.status}/>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>Yaratilgan sana</div>
              <div style={{ fontSize:13,color:"var(--text1)" }}>{fmt(tpSelected.createdAt)}</div>
            </div>
            {tpSelected.approvedByFullName&&(
              <div>
                <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>Tasdiqlagan</div>
                <div style={{ fontSize:13,color:"var(--text1)" }}>{tpSelected.approvedByFullName}</div>
              </div>
            )}
            {tpSelected.approvedAt&&(
              <div>
                <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4,fontWeight:500 }}>Tasdiqlangan sana</div>
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
              <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>Izoh</span>
            </div>
            <div style={{ padding:"14px 20px",fontSize:13,color:"var(--text1)",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{tpSelected.notes}</div>
          </div>
        )}

        {/* Files card */}
        {tpDetailFiles.length>0&&(
          <div className="itm-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>Fayllar</span>
              <span style={{ fontSize:11,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"1px 8px",color:"var(--text3)" }}>{tpDetailFiles.length} ta</span>
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
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> texnologik jarayonni{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>Bekor qilish</button>
              <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {tpApproving?"Tasdiqlanmoqda...":"Ha, tasdiqlash"}
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
            Orqaga
          </button>
        </div>
        <div className="itm-card" style={{ marginBottom:16,flexShrink:0,overflow:"hidden" }}>
          <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
            <span style={{ fontWeight:600,fontSize:13,color:"var(--text1)" }}>Asosiy ma&apos;lumotlar</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",alignItems:"center" }}>
              {cnDetailFiles.map(f=>(
                <a key={f.id} href={`/api/costnorms/${cnSelected.id}/files/${f.id}`} download={f.fileName}
                  style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text1)",fontSize:12,textDecoration:"none",cursor:"pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {f.fileName}
                </a>
              ))}
              <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim)":"var(--bg2)",color:cnShowPhotos?"var(--accent)":"var(--text2)",fontSize:12,cursor:"pointer" }}>
                {cnShowPhotos?<ImageIcon size={12}/>:<ImageOff size={12}/>} {cnShowPhotos?"Fotolarni yashirish":"Fotolarni ko'rsatish"}
              </button>
            </div>
          </div>
          <div style={{ padding:"14px 20px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px 24px" }}>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Shartnoma</div>
              <div style={{ fontWeight:700,fontSize:15,color:"var(--accent)" }}>{cnSelected.contractNo}</div>
            </div>
            <div style={{ gridColumn:"span 2" }}>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Nomi</div>
              <div style={{ fontWeight:600,fontSize:14,color:"var(--text1)" }}>{cnSelected.title}</div>
            </div>
            <div>
              <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
              <CnBadge status={cnSelected.status}/>
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
          <div style={{ flex:1,overflowX:"auto",overflowY:"auto" }}>
            <CollapsibleItemsTable rows={cnDetailRows} showPhotos={cnShowPhotos}/>
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
            Orqaga
          </button>
          <button onClick={handleCnEditSave} disabled={cnEditSaving}
            style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--accent,#1a56db)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:cnEditSaving?0.7:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            {cnEditSaving?"Saqlanmoqda...":"Saqlash"}
          </button>
        </div>
        <div className="itm-card" style={{ padding:20,marginBottom:16,flexShrink:0 }}>
          {cnEditSaveError&&<div style={{ padding:"10px 14px",borderRadius:8,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",fontSize:13,marginBottom:16 }}>{cnEditSaveError}</div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16 }}>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Nomi</label>
              <input className="form-input" value={cnEditForm.title} onChange={e=>setCnEditForm(f=>({...f,title:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Izoh</label>
              <input className="form-input" value={cnEditForm.notes} onChange={e=>setCnEditForm(f=>({...f,notes:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Fayl almashtirish (ixtiyoriy)</label>
              <input ref={cnEditFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleEditCnFileChange}/>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",padding:"0 10px",height:40,boxSizing:"border-box" }}>
                <button onClick={()=>cnEditFileRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"transparent",color:"var(--text2)",fontSize:12,cursor:"pointer",transition:"border-color 0.14s,color 0.14s",flexShrink:0 }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
                  <Upload size={13}/> Fayl tanlash
                </button>
                {cnEditNewFile&&<span style={{ fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{cnEditNewFile.name}</span>}
                {!cnEditNewFile&&cnEditFiles.length>0&&<span style={{ fontSize:11,color:"var(--text3)",flex:1 }}>{cnEditFiles.length} ta fayl</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="itm-card" style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
            <span style={{ fontSize:12,color:"var(--text3)" }}>{cnEditItems.filter(r=>!r.isSection).length} ta yozuv</span>
            <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"0 10px",height:28,borderRadius:"var(--radius)",border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim)":"var(--bg2)",color:cnShowPhotos?"var(--accent)":"var(--text2)",fontSize:11,cursor:"pointer" }}>
              {cnShowPhotos?<ImageIcon size={11}/>:<ImageOff size={11}/>} {cnShowPhotos?"Fotolar yashirish":"Fotolar"}
            </button>
          </div>
          <div style={{ flex:1,overflowX:"auto",overflowY:"auto" }}>
            <CollapsibleItemsTable rows={cnEditItems} showPhotos={cnShowPhotos}
              onUpdateRow={(flatIdx,updated)=>{ setCnEditItems(prev=>{ const next=[...prev]; next[flatIdx]={...next[flatIdx],...updated}; return next; }); }}
              onDeleteRow={(flatIdx)=>{ setCnEditItems(prev=>prev.filter((_,i)=>i!==flatIdx)); }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main view: contracts table + detail page ─────────────────────────────────

  const selectedItem = readinessItems.find(i => i.contractId === selectedContractId) ?? null;
  const filteredItems = !tpSearch.trim()
    ? readinessItems
    : readinessItems.filter(i => i.contractNo.toLowerCase().includes(tpSearch.trim().toLowerCase()));

  // ── Detail full-page view ──────────────────────────────────────────────────

  if (selectedItem) {
    const closeDetail = () => { setSelectedContractId(null); setTpInlineEditing(false); };
    const drawingApproved = selectedItem.drawing?.status === DrawingStatus.Approved;
    const tpEffective = selectedItem.tp?.status !== ProcessStatus.Pending ? selectedItem.tp : null;
    const cnEffective = selectedItem.cn && selectedItem.cn.items.length > 0 ? selectedItem.cn : null;
    const drawingDone = drawingApproved;
    const tpDone = tpEffective && (tpEffective.status === ProcessStatus.Approved || tpEffective.status === ProcessStatus.Completed);
    const cnDone = cnEffective && cnEffective.status === DrawingStatus.Approved;
    return (
      <>
      <div style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={closeDetail}
            style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Orqaga
          </button>
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
                <div style={{ fontSize:12,fontWeight:700,color: drawingDone ? "var(--success)" : selectedItem.drawing ? "#1a56db" : "var(--text3)" }}>Texnik chizma</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!selectedItem.drawing ? "Yaratilmagan" : drawingDone ? "Tasdiqlangan" : "Tasdiqlanmagan"}
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
                <div style={{ fontSize:12,fontWeight:700,color: tpDone ? "var(--success)" : tpEffective ? "#1a56db" : "var(--text3)" }}>Texnologik jarayon</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!tpEffective ? "Yaratilmagan" : tpDone ? "Tasdiqlangan" : "Kutilmoqda"}
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
                <div style={{ fontSize:12,fontWeight:700,color: cnDone ? "var(--success)" : cnEffective ? "#1a56db" : "var(--text3)" }}>Me&apos;yoriy sarf</div>
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                  {!cnEffective ? "Yaratilmagan" : cnDone ? "Tasdiqlangan" : "Kutilmoqda"}
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
                <span style={{ fontWeight:700,fontSize:13,color:"var(--text1)" }}>Texnologik jarayon</span>
              </div>
              {tpEffective&&!tpInlineEditing&&drawingApproved&&(
                <div style={{ display:"flex",gap:4 }}>
                  {tpEffective.status===ProcessStatus.InProgress&&(
                    <button onClick={()=>setTpApproveTarget({id:tpEffective.id,title:tpEffective.title})} disabled={tpApproving}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:tpApproving?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {tpApproving?"...":"Tasdiqlash"}
                    </button>
                  )}
                  <button onClick={()=>openTpDetail(tpEffective)}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#e8f0fe",border:"1px solid #a4c0f4",color:"#1a56db",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ko&apos;rish
                  </button>
                  <button onClick={()=>{ setTpSelected(tpEffective); setTpEditForm({title:tpEffective.title,notes:tpEffective.notes||""}); setTpEditNewFile(null); setTpInlineEditing(true); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Tahrirlash
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {/* Bloklash banneri */}
              {!drawingApproved&&(
                <div style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:8,background:"#fef9c3",border:"1px solid #fde047",marginBottom:tpEffective?12:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" style={{ flexShrink:0,marginTop:1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <div style={{ fontSize:12,fontWeight:700,color:"#854d0e",marginBottom:2 }}>Texnik chizma tasdiqlanmagan</div>
                    <div style={{ fontSize:12,color:"#92400e",lineHeight:1.5 }}>
                      Texnologik jarayon bilan ishlash uchun <strong>texnik chizma tasdiqlanishi</strong>{" "}kerak. Texnik chizmalar bo&apos;limiga o&apos;ting va chizmaning tasdiqlanishini kuting.
                    </div>
                  </div>
                </div>
              )}
              {!tpEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>Texnologik jarayon yaratilmagan</div>
                  {drawingApproved&&(
                  <button onClick={()=>openTpCreate(selectedItem.contractId)} className="btn-create-accent"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",transition:"border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                    onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor="var(--accent)";b.style.boxShadow="0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)";b.style.background="var(--accent-dim)";b.style.color="var(--accent)"}}
                    onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor="var(--border)";b.style.boxShadow="";b.style.background="var(--bg3)";b.style.color="var(--text2)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Jarayon yaratish
                  </button>
                  )}
                </div>
              ):tpInlineEditing?(
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>Nomi</label>
                    <input className="form-input" value={tpEditForm.title} onChange={e=>setTpEditForm(f=>({...f,title:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>Izoh</label>
                    <textarea className="form-input" value={tpEditForm.notes} onChange={e=>setTpEditForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ resize:"none" }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>Fayl (yangilash uchun)</label>
                    <input ref={tpEditFileRef} type="file" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) setTpEditNewFile(f); }}/>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <button type="button" onClick={()=>tpEditFileRef.current?.click()}
                        style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer",transition:"border-color 0.14s,color 0.14s" }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
                        <Upload size={12}/> Fayl tanlash
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
                      style={{ padding:"6px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer" }}>Bekor qilish</button>
                    <button onClick={async()=>{ await handleTpEditSave(); setTpInlineEditing(false); }} disabled={tpEditSaving}
                      style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 16px",borderRadius:"var(--radius)",border:"none",background:"var(--accent)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:tpEditSaving?0.7:1 }}>
                      {tpEditSaving?"Saqlanmoqda...":"Saqlash"}
                    </button>
                  </div>
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Nomi</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={tpEffective.title}>{tpEffective.title}</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
                    <TpBadge status={tpEffective.status}/>
                  </div>
                  {tpEffective.notes&&(
                    <div style={{ width:"100%",marginTop:2 }}>
                      <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Izoh</div>
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
                <span style={{ fontWeight:700,fontSize:13,color:"var(--text1)" }}>Me&apos;yoriy sarf</span>
              </div>
              {cnEffective&&(
                <div style={{ display:"flex",gap:4 }}>
                  {cnEffective.status===DrawingStatus.InProgress&&(
                    <button onClick={()=>handleCnApprove(cnEffective)} disabled={cnApproving}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:cnApproving?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {cnApproving?"...":"Tasdiqlash"}
                    </button>
                  )}
                  <button onClick={()=>openCnDetail(cnEffective)}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#e8f0fe",border:"1px solid #a4c0f4",color:"#1a56db",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ko&apos;rish
                  </button>
                  <button onClick={()=>openCnEdit(cnEffective)}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Tahrirlash
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {!cnEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>Me&apos;yoriy sarf yaratilmagan</div>
                  <button onClick={()=>openCnCreate(selectedItem.contractId)} className="btn-create-accent"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",transition:"border-color 0.2s,box-shadow 0.2s,background 0.2s,color 0.2s" }}
                    onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor="var(--accent)";b.style.boxShadow="0 0 0 2px var(--accent-mid),0 0 8px rgba(26,110,235,0.35)";b.style.background="var(--accent-dim)";b.style.color="var(--accent)"}}
                    onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor="var(--border)";b.style.boxShadow="";b.style.background="var(--bg3)";b.style.color="var(--text2)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Me&apos;yoriy sarf yaratish
                  </button>
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Nomi</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={cnEffective!.title}>{cnEffective!.title}</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
                    <CnBadge status={cnEffective!.status}/>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
      {tpApproveTarget && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> texnologik jarayonni{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>Bekor qilish</button>
              <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {tpApproving?"Tasdiqlanmoqda...":"Ha, tasdiqlash"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {cnApproveTarget && createPortal(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
              <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnApproveTarget.title}»</span> me&apos;yoriy sarfni{" "}
              <span style={{ fontWeight:600,color:"var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setCnApproveTarget(null)} disabled={cnApproving}>Bekor qilish</button>
              <button className="btn btn-primary" onClick={handleCnApproveConfirm} disabled={cnApproving}
                style={{ background:"var(--success)",borderColor:"var(--success)" }}>
                {cnApproving?"Tasdiqlanmoqda...":"Ha, tasdiqlash"}
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
    <div className="page-transition" style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>

      {/* ── Toolbar ── */}
      <div className="itm-card" style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",flexWrap:"wrap" }}>
        <div className="search-wrap" style={{ flex:1,minWidth:180,maxWidth:"none" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Shartnoma raqami bo'yicha qidirish..." value={tpSearch} onChange={e=>setTpSearch(e.target.value)}/>
        </div>
        <button className="btn-icon" onClick={()=>{ loadTp(); loadCn(); loadContracts(); loadDrawings(); }} title="Yangilash" style={{ background:"var(--accent-dim)",borderColor:"var(--accent)",color:"var(--accent)",width:36,height:36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>

      {/* ── Contracts table ── */}
      <div className="itm-card" style={{ flex:1, overflow:"hidden" }}>
        {(tpLoading||cnListLoading)?(
          <div style={{ padding:40,textAlign:"center",color:"var(--text2)" }}>Yuklanmoqda...</div>
        ):readinessItems.length===0?(
          <div style={{ padding:40,textAlign:"center",color:"var(--text2)" }}>Ma&apos;lumot topilmadi</div>
        ):(
          <div style={{ overflowX:"auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width:52,textAlign:"center",borderRight:"2px solid var(--border)",color:"var(--text1)",textTransform:"none" }}>T/r</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Shartnoma №</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Texnik chizma</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Texnologik jarayon</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Me&apos;yoriy sarf</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Umumiy holat</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length===0?(
                  <tr><td colSpan={6} style={{ textAlign:"center",color:"var(--text2)",padding:32 }}>Ma&apos;lumot topilmadi</td></tr>
                ):filteredItems.map((item,i)=>{
                  const drawingOk=item.drawing?.status===DrawingStatus.Approved;
                  const tpEffective=item.tp?.status!==ProcessStatus.Pending?item.tp:null;
                  const cnEffective=item.cn&&item.cn.items.length>0?item.cn:null;
                  const tpOk=tpEffective&&(tpEffective.status===ProcessStatus.Approved||tpEffective.status===ProcessStatus.Completed);
                  const cnOk=cnEffective&&cnEffective.status===DrawingStatus.Approved;
                  const nothingStarted=!item.drawing&&!tpEffective&&!cnEffective;
                  return (
                    <tr key={item.contractId}
                      onClick={()=>{ if(!drawingOk){ setDrawingWarningNo(item.contractNo); } else { setSelectedContractId(item.contractId); setTpInlineEditing(false); } }}
                      style={{ cursor:"pointer",transition:"background 0.12s" }}>
                      <td style={{ textAlign:"center",borderRight:"2px solid var(--border)",padding:"0 8px",fontSize:13 }}>{String(i+1).padStart(2,"0")}</td>
                      <td style={{ textAlign:"center",fontSize:13,color:"var(--text1)",fontFamily:"var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</td>
                      <td style={{ textAlign:"center" }}>
                        {!item.drawing?(
                          <span style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>Yaratilmagan</span>
                        ):drawingOk?(
                          <span style={{ display:"inline-flex",alignItems:"center",fontSize:12,fontWeight:600,color:"var(--success)",background:"var(--success-dim)",borderRadius:20,padding:"2px 10px",border:"1px solid rgba(15,123,69,0.2)" }}>
                            Tasdiqlangan
                          </span>
                        ):(
                          <span style={{ fontSize:11,fontWeight:600,color:"#ca8a04",background:"#fef9c3",borderRadius:20,padding:"2px 10px",border:"1px solid #fde047",display:"inline-block" }}>Tasdiqlanmagan</span>
                        )}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {tpEffective?<TpBadge status={tpEffective.status}/>:<span style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>Yaratilmagan</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {cnEffective?<CnBadge status={cnEffective.status}/>:<span style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>Yaratilmagan</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {tpOk&&cnOk?(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--purple)",background:"var(--purple-dim)",borderRadius:20,padding:"2px 10px",border:"1px solid rgba(109,74,173,0.2)",display:"inline-block" }}>Yakunlangan</span>
                        ):nothingStarted?(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--text3)",background:"var(--bg3)",borderRadius:20,padding:"2px 10px",border:"1px solid var(--border)",display:"inline-block",fontStyle:"italic" }}>Boshlanmagan</span>
                        ):(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--text2)",background:"var(--bg3)",borderRadius:20,padding:"2px 10px",border:"1px solid var(--border)",display:"inline-block" }}>Jarayonda</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
              <div style={{ fontSize:14,fontWeight:700,color:"#854d0e",marginBottom:6 }}>Texnik chizma tasdiqlanmagan</div>
              <div style={{ fontSize:13,color:"#92400e",lineHeight:1.6 }}>
                Texnologik jarayon bilan ishlash uchun <strong>texnik chizma tasdiqlanishi</strong>{" "}kerak. Texnik chizmalar bo&apos;limiga o&apos;ting va chizmaning tasdiqlanishini kuting.
              </div>
              <button
                onClick={()=>setDrawingWarningNo(null)}
                style={{ marginTop:16,padding:"6px 18px",background:"#ca8a04",color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer" }}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>

    {/* TP approve confirm modal */}
    {tpApproveTarget && createPortal(
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
            <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
          </div>
          <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
            <span style={{ fontWeight:600,color:"var(--text)" }}>«{tpApproveTarget.title}»</span> texnologik jarayonni{" "}
            <span style={{ fontWeight:600,color:"var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <button className="btn btn-outline" onClick={()=>setTpApproveTarget(null)} disabled={tpApproving}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={handleTpApproveConfirm} disabled={tpApproving}
              style={{ background:"var(--success)",borderColor:"var(--success)" }}>
              {tpApproving?"Tasdiqlanmoqda...":"Ha, tasdiqlash"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* TP & CN approve confirm modals */}
    {cnApproveTarget && createPortal(
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:28,width:400,maxWidth:"95vw" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
            <div style={{ width:38,height:38,borderRadius:8,background:"var(--success-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="20" height="20" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Tasdiqlashni tasdiqlaysizmi?</div>
          </div>
          <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.65,margin:"0 0 20px" }}>
            <span style={{ fontWeight:600,color:"var(--text)" }}>«{cnApproveTarget.title}»</span> me&apos;yoriy sarfni{" "}
            <span style={{ fontWeight:600,color:"var(--success)" }}>tasdiqlangan</span> holatiga o&apos;tkazmoqchimisiz?
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <button className="btn btn-outline" onClick={()=>setCnApproveTarget(null)} disabled={cnApproving}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={handleCnApproveConfirm} disabled={cnApproving}
              style={{ background:"var(--success)",borderColor:"var(--success)" }}>
              {cnApproving?"Tasdiqlanmoqda...":"Ha, tasdiqlash"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
