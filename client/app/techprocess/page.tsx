"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useDraft } from "@/lib/useDraft";
import { Upload, X, Image as ImageIcon, ImageOff, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import {
  techProcessService,
  contractService,
  costNormService,
  ProcessStatus,
  DrawingStatus,
  ContractStatus,
  PROCESS_STATUS_LABELS,
  DRAWING_STATUS_LABELS,
  type TechProcessResponse,
  type TechProcessCreatePayload,
  type ContractResponse,
  type CostNormResponse,
  type CostNormItemResponse,
  type AttachmentResponse,
} from "@/lib/userService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialRow {
  no: string; name: string; unit: string;
  readyQty: string; wasteQty: string; totalQty: string;
  photoRaw: string; photoSemi: string; importType: string;
  isSection: boolean; sectionName: string;
}
interface ParsedTable { title: string; rows: MaterialRow[]; }
type ColField = "no"|"name"|"unit"|"readyQty"|"wasteQty"|"totalQty"|"photoRaw"|"photoSemi"|"importType";
type TpMode = "list" | "detail" | "edit";
type CnMode = "list" | "create" | "detail" | "edit";

// ─── DOCX Column definitions ──────────────────────────────────────────────────

const REQUIRED_COLS: { field: ColField; label: string; test: (t: string) => boolean }[] = [
  { field: "no",        label: "№ т/р",              test: t => t.includes("№") },
  { field: "name",      label: "Ҳом-ашё номи",        test: t => t.includes("номи") },
  { field: "unit",      label: "Ўлчов бирлиги",       test: t => t.includes("лчов") },
  { field: "readyQty",  label: "Тайёр маҳсулот",      test: t => t.includes("тайёр") && !t.includes("ярим") },
  { field: "wasteQty",  label: "Ҳом-ашё чиқиндиси",   test: t => t.includes("иқинди") },
  { field: "totalQty",  label: "Умумий ҳом-ашё сарфи", test: t => t.includes("мумий") },
  { field: "importType",label: "Импорт / Местный",    test: t => t.includes("импорт") },
];
const OPTIONAL_COLS: { field: ColField; test: (t: string) => boolean }[] = [
  { field: "photoRaw",  test: t => t.includes("хом") && !t.includes("иқинди") && !t.includes("номи") },
  { field: "photoSemi", test: t => t.includes("ярим") },
];

function buildColMap(thead: Element): { colMap: Partial<Record<ColField,number>>; error: string|null } {
  const rows = Array.from(thead.querySelectorAll("tr"));
  if (!rows.length) return { colMap: {}, error: "Header qatori topilmadi" };
  const MAX = 12;
  const grid: (string|null)[][] = Array.from({ length: rows.length }, () => Array(MAX).fill(null));
  for (let ri = 0; ri < rows.length; ri++) {
    const cells = Array.from(rows[ri].querySelectorAll("td, th"));
    let ci = 0;
    for (const cell of cells) {
      while (ci < MAX && grid[ri][ci] !== null) ci++;
      if (ci >= MAX) break;
      const cs = Math.max(1, parseInt(cell.getAttribute("colspan")||"1"));
      const rs = Math.max(1, parseInt(cell.getAttribute("rowspan")||"1"));
      const text = (cell.textContent?.trim()||"").toLowerCase();
      for (let r = ri; r < Math.min(ri+rs,rows.length); r++)
        for (let c = ci; c < Math.min(ci+cs,MAX); c++)
          if (grid[r][c]===null) grid[r][c]=text;
      ci += cs;
    }
  }
  const lastRow = grid[rows.length-1];
  const colMap: Partial<Record<ColField,number>> = {};
  const missing: string[] = [];
  for (const { field,label,test } of REQUIRED_COLS) {
    const idx = lastRow.findIndex(t => t!==null && test(t));
    if (idx===-1) missing.push(label); else colMap[field]=idx;
  }
  if (missing.length>0) return { colMap, error: `Fayl shablonga mos emas. Ustunlar topilmadi: ${missing.join(", ")}` };
  for (const { field,test } of OPTIONAL_COLS) {
    const idx = lastRow.findIndex(t => t!==null && test(t));
    if (idx!==-1) colMap[field]=idx;
  }
  return { colMap, error: null };
}

function parseMainTables(html: string): { tables: ParsedTable[]; error: string|null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const results: ParsedTable[] = [];
  let idx = 0;
  for (const table of tables) {
    const thead = table.querySelector("thead");
    if (!thead || !(thead.textContent||"").includes("лчов")) continue;
    const { colMap, error } = buildColMap(thead);
    if (error) return { tables: [], error };
    idx++;
    const rows: MaterialRow[] = [];
    for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(tr.querySelectorAll("td, th"));
      if (cells.some(td=>parseInt(td.getAttribute("colspan")||"1")>=5)) {
        const text = tr.textContent?.trim()||"";
        if (text) rows.push({ isSection:true, sectionName:text, no:"",name:"",unit:"",readyQty:"",wasteQty:"",totalQty:"",photoRaw:"",photoSemi:"",importType:"" });
        continue;
      }
      if (cells.length<3) continue;
      const gt = (i: number) => cells[i]?.textContent?.trim()||"";
      const gp = (i: number) => cells[i]?.querySelector("img")?.getAttribute("src")||"";
      const name = colMap.name!==undefined ? gt(colMap.name) : "";
      if (!name) continue;
      rows.push({
        isSection:false, sectionName:"",
        no: colMap.no!==undefined?gt(colMap.no):"",
        name,
        unit:       colMap.unit!==undefined      ?gt(colMap.unit):"",
        readyQty:   colMap.readyQty!==undefined  ?gt(colMap.readyQty):"",
        wasteQty:   colMap.wasteQty!==undefined  ?gt(colMap.wasteQty):"",
        totalQty:   colMap.totalQty!==undefined  ?gt(colMap.totalQty):"",
        photoRaw:   colMap.photoRaw!==undefined  ?gp(colMap.photoRaw):"",
        photoSemi:  colMap.photoSemi!==undefined ?gp(colMap.photoSemi):"",
        importType: colMap.importType!==undefined?gt(colMap.importType):"",
      });
    }
    if (rows.length>0) results.push({ title:`Jadval ${idx}`, rows });
  }
  return { tables: results, error: null };
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const TP_STATUS_STYLE: Record<ProcessStatus,{bg:string;color:string;border:string}> = {
  [ProcessStatus.Pending]:    { bg:"var(--bg3)",        color:"var(--text2)",  border:"var(--border)" },
  [ProcessStatus.InProgress]: { bg:"#e8f0fe",           color:"#1a56db",       border:"#a4c0f4" },
  [ProcessStatus.Approved]:   { bg:"var(--success-dim)",color:"var(--success)",border:"rgba(15,123,69,0.2)" },
  [ProcessStatus.Rejected]:   { bg:"var(--danger-dim)", color:"var(--danger)", border:"var(--danger)" },
  [ProcessStatus.Completed]:  { bg:"var(--purple-dim)", color:"var(--purple)", border:"rgba(109,74,173,0.2)" },
};

function TpBadge({ status }: { status: ProcessStatus }) {
  const s = TP_STATUS_STYLE[status];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:s.bg,color:s.color,border:`1px solid ${s.border}` }}>
      {PROCESS_STATUS_LABELS[status]}
    </span>
  );
}

const CN_STATUS_STYLE: Record<DrawingStatus,{bg:string;color:string;border:string}> = {
  [DrawingStatus.Draft]:    { bg:"var(--bg3)",         color:"var(--text2)",  border:"var(--border)" },
  [DrawingStatus.Approved]: { bg:"var(--success-dim)", color:"var(--success)",border:"rgba(15,123,69,0.2)" },
};

function CnBadge({ status }: { status: DrawingStatus }) {
  const s = CN_STATUS_STYLE[status] ?? CN_STATUS_STYLE[DrawingStatus.Draft];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:s.bg,color:s.color,border:`1px solid ${s.border}` }}>
      {DRAWING_STATUS_LABELS[status] ?? "Noma'lum"}
    </span>
  );
}

function fmt(d: string) {
  if (!d) return "—";
  const [y,m,day] = d.slice(0,10).split("-");
  if (!y||!m||!day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

// ─── Photo cell ───────────────────────────────────────────────────────────────

function PhotoCell({ src }: { src: string|null }) {
  const [open, setOpen] = useState(false);
  if (!src) return <span style={{ color:"var(--text3)",fontSize:12 }}>—</span>;
  return (
    <>
      <img src={src} alt="foto" onClick={()=>setOpen(true)}
        style={{ width:40,height:40,objectFit:"cover",borderRadius:4,cursor:"pointer",border:"1px solid var(--border)" }} />
      {open && (
        <div onClick={()=>setOpen(false)}
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(2px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <img src={src} alt="foto" style={{ maxWidth:"90vw",maxHeight:"90vh",borderRadius:8 }} />
        </div>
      )}
    </>
  );
}

// ─── Collapsible material table ───────────────────────────────────────────────

type NormRow = {
  isSection:boolean; sectionName:string|null; name:string|null; unit:string|null;
  readyQty:string|null; wasteQty:string|null; totalQty:string|null;
  photoRaw:string|null; photoSemi:string|null; importType:string|null;
};

function normalizeRow(r: MaterialRow|CostNormItemResponse): NormRow {
  if ("no" in r && typeof (r as MaterialRow).no==="string" && !("sortOrder" in r)) {
    const mr=r as MaterialRow;
    return { isSection:mr.isSection,sectionName:mr.sectionName||mr.name||null,name:mr.name||null,unit:mr.unit||null,readyQty:mr.readyQty||null,wasteQty:mr.wasteQty||null,totalQty:mr.totalQty||null,photoRaw:mr.photoRaw||null,photoSemi:mr.photoSemi||null,importType:mr.importType||null };
  }
  const ir=r as CostNormItemResponse;
  return { isSection:ir.isSection,sectionName:ir.sectionName,name:ir.name,unit:ir.unit,readyQty:ir.readyQty,wasteQty:ir.wasteQty,totalQty:ir.totalQty,photoRaw:ir.photoRaw,photoSemi:ir.photoSemi,importType:ir.importType };
}

function CollapsibleItemsTable({ rows,showPhotos,onUpdateRow,onDeleteRow }: { rows:(MaterialRow|CostNormItemResponse)[]; showPhotos:boolean; onUpdateRow?:(fi:number,u:Partial<MaterialRow>)=>void; onDeleteRow?:(fi:number)=>void }) {
  const editable = !!onUpdateRow;
  const normalized = useMemo(()=>rows.map(normalizeRow),[rows]);
  const [editingIdx,setEditingIdx] = useState<number|null>(null);
  const [editDraft,setEditDraft] = useState<Partial<NormRow>>({});

  const sections = useMemo(()=>{
    const groups: { sectionIdx:number; sectionName:string; items:{row:NormRow;flatIdx:number}[] }[] = [];
    let current = { sectionIdx:0, sectionName:"", items:[] as {row:NormRow;flatIdx:number}[] };
    let sectionIdx=0;
    for (let fi=0; fi<normalized.length; fi++) {
      const row=normalized[fi];
      if (row.isSection) {
        if (current.items.length>0||current.sectionName) groups.push(current);
        sectionIdx++;
        current={sectionIdx,sectionName:row.sectionName||"",items:[]};
      } else { current.items.push({row,flatIdx:fi}); }
    }
    groups.push(current);
    return groups;
  },[normalized]);

  const [collapsed,setCollapsed]=useState<Set<number>>(new Set());
  const toggleSection=(idx:number)=>setCollapsed(prev=>{ const next=new Set(prev); next.has(idx)?next.delete(idx):next.add(idx); return next; });
  const collapseAll=()=>setCollapsed(new Set(sections.map(s=>s.sectionIdx)));
  const expandAll=()=>setCollapsed(new Set());
  const allCollapsed=collapsed.size===sections.filter(s=>s.sectionName).length;
  const colCount=(showPhotos?9:7)+(editable?1:0);
  let globalRowIdx=0;

  return (
    <div>
      {sections.some(s=>s.sectionName)&&(
        <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"6px 14px",borderBottom:"1px solid var(--border)",gap:6 }}>
          <button onClick={allCollapsed?expandAll:collapseAll}
            style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--text2)",fontSize:11,cursor:"pointer" }}>
            {allCollapsed?<ChevronsUpDown size={11}/>:<ChevronsDownUp size={11}/>}
            {allCollapsed?"Barchani ochish":"Barchani yig'ish"}
          </button>
        </div>
      )}
      <table className="itm-table" style={{ width:"100%",tableLayout:"auto" }}>
        <thead>
          <tr>
            <th style={{ width:42,textAlign:"center",borderRight:"2px solid var(--border)",color:"var(--text1)",textTransform:"none",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>T/r</th>
            <th style={{ color:"var(--text1)",textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Материал номи</th>
            <th style={{ color:"var(--text1)",textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Ўлчов</th>
            <th style={{ textAlign:"center",color:"var(--text1)",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Тайёр маҳсулот</th>
            <th style={{ textAlign:"center",color:"var(--text1)",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Чиқинди</th>
            <th style={{ textAlign:"center",color:"var(--text1)",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Умумий сарф</th>
            {showPhotos&&<><th style={{ color:"var(--text1)",textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Хом-ашё</th><th style={{ color:"var(--text1)",textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Ярим тайёр</th></>}
            <th style={{ color:"var(--text1)",textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Манба</th>
            {editable&&<th style={{ whiteSpace:"nowrap",textAlign:"center",borderLeft:"2px solid var(--border)",color:"var(--text1)",position:"sticky",top:0,zIndex:2,background:"var(--bg2)" }}>Amal</th>}
          </tr>
        </thead>
        <tbody>
          {sections.map(section=>{
            const isCollapsed=collapsed.has(section.sectionIdx);
            const hasSection=!!section.sectionName;
            return (
              <React.Fragment key={`s-${section.sectionIdx}`}>
                {hasSection&&(
                  <tr onClick={()=>toggleSection(section.sectionIdx)} style={{ cursor:"pointer",userSelect:"none" }}>
                    <td colSpan={colCount} style={{ padding:"9px 14px",background:"var(--bg2)",fontWeight:700,fontSize:12,color:"var(--text1)",borderTop:"2px solid var(--border)",borderBottom:isCollapsed?"2px solid var(--border)":"1px solid var(--border)",letterSpacing:0.3 }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:7 }}>
                        {isCollapsed?<ChevronRight size={13} style={{ color:"var(--text3)",flexShrink:0 }}/>:<ChevronDown size={13} style={{ color:"var(--text3)",flexShrink:0 }}/>}
                        {section.sectionName}
                        <span style={{ marginLeft:4,fontWeight:400,fontSize:11,color:"var(--text3)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"1px 7px" }}>{section.items.length} та</span>
                      </span>
                    </td>
                  </tr>
                )}
                {!isCollapsed&&section.items.map(({row,flatIdx},ri)=>{
                  globalRowIdx++;
                  const rowNum=globalRowIdx;
                  const isEditing=editingIdx===flatIdx;
                  return (
                    <tr key={`${section.sectionIdx}-${ri}`} style={isEditing?{background:"var(--accent-dim)"}:undefined}>
                      <td style={{ textAlign:"center",borderRight:"2px solid var(--border)",minWidth:40,padding:"0 4px",color:"var(--text1)",fontSize:12 }}>{String(rowNum).padStart(2,"0")}</td>
                      {isEditing?(
                        <>
                          <td><input className="form-input" placeholder="Nomi" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.name??row.name??""} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))}/></td>
                          <td><input className="form-input" placeholder="Birlik" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.unit??row.unit??""} onChange={e=>setEditDraft(d=>({...d,unit:e.target.value}))}/></td>
                          <td><input className="form-input" placeholder="Tayyor" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.readyQty??row.readyQty??""} onChange={e=>setEditDraft(d=>({...d,readyQty:e.target.value}))}/></td>
                          <td><input className="form-input" placeholder="Chiqindi" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.wasteQty??row.wasteQty??""} onChange={e=>setEditDraft(d=>({...d,wasteQty:e.target.value}))}/></td>
                          <td><input className="form-input" placeholder="Umumiy" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.totalQty??row.totalQty??""} onChange={e=>setEditDraft(d=>({...d,totalQty:e.target.value}))}/></td>
                          {showPhotos&&<><td style={{ padding:"6px 12px" }}><PhotoCell src={row.photoRaw}/></td><td style={{ padding:"6px 12px" }}><PhotoCell src={row.photoSemi}/></td></>}
                          <td><input className="form-input" placeholder="Manba" style={{ width:"100%",padding:"4px 8px",fontSize:13 }} value={editDraft.importType??row.importType??""} onChange={e=>setEditDraft(d=>({...d,importType:e.target.value}))}/></td>
                          <td style={{ borderLeft:"2px solid var(--border)",textAlign:"center" }}>
                            <div style={{ display:"flex",gap:4,justifyContent:"center" }}>
                              <button onClick={()=>{ if(onUpdateRow) onUpdateRow(flatIdx,{name:(editDraft.name??row.name)||"",unit:(editDraft.unit??row.unit)||"",readyQty:(editDraft.readyQty??row.readyQty)||"",wasteQty:(editDraft.wasteQty??row.wasteQty)||"",totalQty:(editDraft.totalQty??row.totalQty)||"",importType:(editDraft.importType??row.importType)||""} as Partial<MaterialRow>); setEditingIdx(null); setEditDraft({}); }}
                                style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#22c55e22",border:"1px solid #22c55e44",color:"#22c55e",cursor:"pointer" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Saqlash
                              </button>
                              <button onClick={()=>{ setEditingIdx(null); setEditDraft({}); }}
                                style={{ display:"inline-flex",alignItems:"center",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>✕</button>
                            </div>
                          </td>
                        </>
                      ):(
                        <>
                          <td style={{ textAlign:"center",color:"var(--text1)",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={row.name??""}>{row.name||"—"}</td>
                          <td style={{ textAlign:"center",color:"var(--text1)" }}>{row.unit||"—"}</td>
                          <td style={{ textAlign:"center",color:"var(--text1)",fontFamily:"Inter,sans-serif" }}>{row.readyQty||"—"}</td>
                          <td style={{ textAlign:"center",color:"var(--text1)",fontFamily:"Inter,sans-serif" }}>{row.wasteQty||"—"}</td>
                          <td style={{ textAlign:"center",color:"var(--text1)",fontFamily:"Inter,sans-serif" }}>{row.totalQty||"—"}</td>
                          {showPhotos&&<><td style={{ padding:"6px 12px" }}><PhotoCell src={row.photoRaw}/></td><td style={{ padding:"6px 12px" }}><PhotoCell src={row.photoSemi}/></td></>}
                          <td style={{ textAlign:"center" }}>
                            {row.importType?(
                              <span style={{ display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,
                                background:row.importType.toLowerCase().includes("местный")||row.importType.toLowerCase().includes("локал")?"#e6f4ea":"#e8f0fe",
                                color:row.importType.toLowerCase().includes("местный")||row.importType.toLowerCase().includes("локал")?"#1e7e34":"#1a56db",
                                border:`1px solid ${row.importType.toLowerCase().includes("местный")||row.importType.toLowerCase().includes("локал")?"#a8d5b5":"#a4c0f4"}`,
                              }}>{row.importType}</span>
                            ):"—"}
                          </td>
                          {editable&&(
                            <td style={{ borderLeft:"2px solid var(--border)",textAlign:"center" }}>
                              <div style={{ display:"flex",gap:4,justifyContent:"center" }}>
                                <button onClick={()=>{ setEditingIdx(flatIdx); setEditDraft({}); }}
                                  style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#3b82f622",border:"1px solid #3b82f644",color:"#3b82f6",cursor:"pointer" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  Tahrir
                                </button>
                                <button onClick={()=>{ if(onDeleteRow) onDeleteRow(flatIdx); }}
                                  style={{ display:"inline-flex",alignItems:"center",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",cursor:"pointer" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          {rows.filter(r=>!r.isSection).length===0&&(
            <tr><td colSpan={colCount} style={{ textAlign:"center",color:"var(--text2)",padding:32 }}>Ma&apos;lumot topilmadi</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── File parsing overlay ─────────────────────────────────────────────────────

const kf = `
@keyframes overlayFadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes overlayFadeOut{0%{opacity:1}100%{opacity:0}}
@keyframes spinRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes pulseCore{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(59,130,246,0.3)}50%{transform:scale(1.08);box-shadow:0 0 30px 8px rgba(59,130,246,0.15)}}
@keyframes textFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes dataStreamLine{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
`;

function FileParsingOverlay({ dataReady,onComplete }: { dataReady:boolean; onComplete:()=>void }) {
  const [progress,setProgress]=useState(0);
  const [phase,setPhase]=useState(0);
  const [fadeOut,setFadeOut]=useState(false);
  const startRef=useRef(Date.now());
  const phaseTexts=["Fayl o'qilmoqda…","Ma'lumotlar tahlil qilinmoqda…","Jadvallar ajratilmoqda…","Tugatilmoqda…"];

  useEffect(()=>{
    const interval=setInterval(()=>{
      const elapsed=Date.now()-startRef.current;
      const base=Math.min(75,elapsed/30);
      setProgress(prev=>{
        if(prev>=99.5) return 99.5;
        return Math.max(prev,base);
      });
      setPhase(Math.floor(Math.min(elapsed/800,3)));
    },50);
    return ()=>clearInterval(interval);
  },[]);

  useEffect(()=>{
    if(!dataReady) return;
    setProgress(100);
    const t=setTimeout(()=>{ setFadeOut(true); setTimeout(onComplete,350); },400);
    return ()=>clearTimeout(t);
  },[dataReady,onComplete]);

  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(15,20,35,0.85)",backdropFilter:"blur(8px)",animation:fadeOut?"overlayFadeOut 0.35s ease forwards":"overlayFadeIn 0.3s ease" }}>
      <style>{kf}</style>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:0 }}>
        <div style={{ position:"relative",width:120,height:120,marginBottom:28 }}>
          <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(59,130,246,0.08)" }}/>
          <div style={{ position:"absolute",inset:4,borderRadius:"50%",border:"2.5px solid transparent",borderTopColor:"#3b82f6",borderRightColor:"#6366f1",animation:"spinRing 1.2s linear infinite" }}/>
          <div style={{ position:"absolute",inset:16,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#6366f1",animation:"spinRing 0.8s linear infinite reverse" }}/>
          <div style={{ position:"absolute",inset:28,borderRadius:"50%",background:"linear-gradient(135deg,#1e3a5f,#1e2a4a)",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulseCore 2s ease-in-out infinite" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
        </div>
        <div style={{ width:200,height:3,marginBottom:20,position:"relative",overflow:"hidden",borderRadius:2,background:"rgba(99,152,255,0.1)" }}>
          <div style={{ position:"absolute",top:0,left:0,width:"40%",height:"100%",background:"linear-gradient(90deg,transparent,#3b82f6,transparent)",animation:"dataStreamLine 1.5s ease-in-out infinite" }}/>
        </div>
        <div key={phase} style={{ fontSize:15,fontWeight:500,color:"#e2e8f0",letterSpacing:0.3,animation:"textFadeUp 0.4s ease-out",marginBottom:8 }}>{phaseTexts[phase]}</div>
        <div style={{ fontSize:12,color:"rgba(148,163,184,0.8)",marginBottom:24 }}>Biroz kutib turing</div>
        <div style={{ width:260,height:4,borderRadius:2,background:"rgba(51,65,85,0.6)",overflow:"hidden" }}>
          <div style={{ height:"100%",borderRadius:2,width:`${progress}%`,background:"linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)",transition:"width 0.1s linear",boxShadow:"0 0 12px rgba(99,102,241,0.4)" }}/>
        </div>
        <div style={{ fontSize:11,color:"rgba(148,163,184,0.6)",marginTop:10,fontFamily:"Inter,monospace",letterSpacing:1 }}>{Math.round(progress)}%</div>
      </div>
    </div>
  );
}

// ─── Contract Readiness Panel ─────────────────────────────────────────────────

interface ContractReadinessItem {
  contractId: string;
  contractNo: string;
  tp: TechProcessResponse | null;
  cn: CostNormResponse | null;
}

function ContractReadinessPanel({
  items, onSendToWarehouse, sending,
}: {
  items: ContractReadinessItem[];
  onSendToWarehouse: (tpId: string) => void;
  sending: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const ready = items.filter(i =>
    i.tp && (i.tp.status === ProcessStatus.Approved || i.tp.status === ProcessStatus.Completed) &&
    i.cn && i.cn.status === DrawingStatus.Approved
  );
  const inProgress = items.filter(i => !ready.includes(i));

  return (
    <div className="itm-card" style={{ marginBottom: 16, overflow: "hidden", border: "1.5px solid var(--border)" }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", borderBottom: collapsed ? "none" : "1.5px solid var(--border)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: ready.length > 0 ? "var(--success-dim)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ready.length > 0 ? "var(--success)" : "var(--accent)"} strokeWidth="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text1)" }}>Shartnomalar holati</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
              {ready.length > 0
                ? `${ready.length} ta shartnoma keyingi bosqichga o'tishga tayyor`
                : `${items.length} ta shartnoma jarayonda`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ready.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: "var(--success)", color: "#fff", borderRadius: 20, padding: "2px 10px" }}>
              {ready.length} tayyor
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(item => {
            const tpOk = item.tp && (item.tp.status === ProcessStatus.Approved || item.tp.status === ProcessStatus.Completed);
            const cnOk = item.cn && item.cn.status === DrawingStatus.Approved;
            const tpEffective = item.tp?.status !== ProcessStatus.Pending ? item.tp : null;
            const cnEffective = item.cn?.status !== DrawingStatus.Draft ? item.cn : null;
            const bothReady = tpOk && cnOk;

            return (
              <div key={item.contractId} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                borderRadius: 8, border: `1.5px solid ${bothReady ? "rgba(15,123,69,0.25)" : "var(--border)"}`,
                background: bothReady ? "rgba(15,123,69,0.04)" : "var(--bg2)",
                flexWrap: "wrap",
              }}>
                {/* Contract No */}
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Shartnoma</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</div>
                </div>

                {/* Tech Process status */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>
                    Texnologik jarayon
                  </div>
                  {tpEffective ? (
                    <TpBadge status={tpEffective.status} />
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>Yaratilmagan</span>
                  )}
                </div>

                {/* Arrow */}
                <div style={{ color: "var(--border)", fontSize: 16, flexShrink: 0 }}>→</div>

                {/* Cost Norm status */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Me&apos;yoriy sarf
                  </div>
                  {cnEffective ? (
                    <CnBadge status={cnEffective.status} />
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>Yaratilmagan</span>
                  )}
                </div>

                {/* Action */}
                <div style={{ flexShrink: 0, minWidth: 160, textAlign: "right" }}>
                  {bothReady ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--purple)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Yakunlangan
                    </span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: tpOk && cnOk ? "var(--success)" : "var(--warning,#f59e0b)", flexShrink: 0 }}/>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>
                        {!tpEffective && !cnEffective ? "Hujjatlar yaratilmagan" :
                         !tpOk && !cnOk ? "Ikkalasi ham tasdiqlanmagan" :
                         !tpOk ? "Tex jarayon tasdiqlanmagan" :
                         "Me'yoriy sarf tasdiqlanmagan"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechProductionPage() {
  const [activeTab, setActiveTab] = useState<"tp"|"cn">("tp");

  // ── Tech Process state ─────────────────────────────────────────────────────
  const [tpList, setTpList] = useState<TechProcessResponse[]>([]);
  const [tpFiltered, setTpFiltered] = useState<TechProcessResponse[]>([]);
  const [tpLoading, setTpLoading] = useState(true);
  const [tpError, setTpError] = useState("");
  const [tpSearch, setTpSearch] = useState("");
  const [tpFilterStatus, setTpFilterStatus] = useState("");

  // TP detail / edit
  const [tpMode, setTpMode] = useState<TpMode>("list");
  const [tpSelected, setTpSelected] = useState<TechProcessResponse | null>(null);
  const [tpEditForm, setTpEditForm] = useState({ title:"", notes:"" });
  const [tpEditSaving, setTpEditSaving] = useState(false);

  // TP create form
  const [tpShowForm, setTpShowForm] = useState(false);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [tpForm, setTpForm] = useState({ contractId:"", title:"", notes:"" });
  const [tpSubmitted, setTpSubmitted] = useState(false);
  const [tpSaving, setTpSaving] = useState(false);
  const [tpFormError, setTpFormError] = useState("");
  const [finalFile, setFinalFile] = useState<File|null>(null);
  const [tpFileError, setTpFileError] = useState("");

  const [tpDetailFiles, setTpDetailFiles] = useState<AttachmentResponse[]>([]);

  // TP actions
  const [tpApproving, setTpApproving] = useState(false);
  const [tpApprovingId, setTpApprovingId] = useState<string|null>(null);
  const [tpSendingWarehouse, setTpSendingWarehouse] = useState<string|null>(null);
  const [tpDeleteId, setTpDeleteId] = useState<string|null>(null);
  const [tpDeleting, setTpDeleting] = useState(false);

  useDraft("draft_techprocess", tpShowForm, tpForm, (d)=>{ setTpForm(d); setTpShowForm(true); });

  // ── Cost Norm state ────────────────────────────────────────────────────────
  const [cnMode, setCnMode] = useState<CnMode>("list");
  const [cnShowPhotos, setCnShowPhotos] = useState(false);
  const [cnSearch, setCnSearch] = useState("");
  const [cnList, setCnList] = useState<CostNormResponse[]>([]);
  const [cnListLoading, setCnListLoading] = useState(true);
  const [cnSelected, setCnSelected] = useState<CostNormResponse|null>(null);
  const [cnActiveTab, setCnActiveTab] = useState(0);
  const [cnDetailFiles, setCnDetailFiles] = useState<AttachmentResponse[]>([]);
  const [cnDetailItems, setCnDetailItems] = useState<CostNormItemResponse[]>([]);
  const [cnForm, setCnForm] = useState({ contractId:"", title:"", notes:"" });
  const [cnContractsLoading, setCnContractsLoading] = useState(false);
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

  useDraft("draft_costnorm", cnMode==="create", cnForm, (d)=>{ setCnForm(d); setCnMode("create"); contractService.getAll().then(setContracts).catch(()=>{}); });

  // ── Contract readiness ─────────────────────────────────────────────────────
  const readinessItems = useMemo<ContractReadinessItem[]>(()=>{
    const map = new Map<string, ContractReadinessItem>();
    for (const tp of tpList) {
      if (!map.has(tp.contractId)) map.set(tp.contractId, { contractId:tp.contractId, contractNo:tp.contractNo, tp:null, cn:null });
      const entry = map.get(tp.contractId)!;
      if (!entry.tp || tp.status > entry.tp.status) entry.tp = tp;
    }
    for (const cn of cnList) {
      if (!map.has(cn.contractId)) map.set(cn.contractId, { contractId:cn.contractId, contractNo:cn.contractNo, tp:null, cn:null });
      map.get(cn.contractId)!.cn = cn;
    }
    return Array.from(map.values()).sort((a,b)=>a.contractNo.localeCompare(b.contractNo));
  },[tpList, cnList]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadTp = async () => {
    try { setTpLoading(true); setTpError(""); const data=await techProcessService.getAll(); setTpList(data); }
    catch { setTpError("Ma'lumotlarni yuklashda xatolik."); }
    finally { setTpLoading(false); }
  };

  const loadCn = useCallback(async()=>{ setCnListLoading(true); const d=await costNormService.getAll(); setCnList(d); setCnListLoading(false); },[]);

  useEffect(()=>{ loadTp(); loadCn(); },[loadCn]);

  useEffect(()=>{
    const q=tpSearch.toLowerCase();
    setTpFiltered(tpList.filter(t=>{
      const ms=!q||t.title.toLowerCase().includes(q)||t.contractNo.toLowerCase().includes(q);
      const ms2=tpFilterStatus===""||t.status===Number(tpFilterStatus);
      return ms&&ms2;
    }));
  },[tpSearch,tpFilterStatus,tpList]);

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

  const openTpEdit = (tp: TechProcessResponse) => {
    setTpEditForm({ title: tp.title, notes: tp.notes||"" });
    setTpMode("edit");
  };

  const handleTpEditSave = async () => {
    if(!tpSelected) return;
    setTpEditSaving(true);
    try {
      await techProcessService.update(tpSelected.id, { title: tpEditForm.title, notes: tpEditForm.notes||null });
      await tpRefreshSelected(tpSelected.id);
    } catch {} finally { setTpEditSaving(false); }
  };

  const handleTpApprove = async () => {
    if(!tpSelected) return; setTpApproving(true);
    try { await techProcessService.approve(tpSelected.id); await tpRefreshSelected(tpSelected.id); }
    finally { setTpApproving(false); }
  };

  const handleTpApproveRow = async (id: string) => {
    setTpApprovingId(id);
    try { await techProcessService.approve(id); const fresh=await techProcessService.getById(id); setTpList(prev=>prev.map(t=>t.id===id?fresh:t)); }
    finally { setTpApprovingId(null); }
  };

  const handleSendToWarehouse = async (tpId: string) => {
    setTpSendingWarehouse(tpId);
    try { await techProcessService.sendToWarehouse(tpId); await tpRefreshSelected(tpId); await loadTp(); }
    finally { setTpSendingWarehouse(null); }
  };

  const handleTpDelete = async () => {
    if(!tpDeleteId) return; setTpDeleting(true);
    try { await techProcessService.delete(tpDeleteId); setTpList(prev=>prev.filter(t=>t.id!==tpDeleteId)); if(tpSelected?.id===tpDeleteId) { setTpSelected(null); } setTpInlineEditing(false); setTpDeleteId(null); }
    finally { setTpDeleting(false); }
  };

  // ── TP Create ──────────────────────────────────────────────────────────────

  const openTpCreate = async (prefilledContractId?: string) => {
    setTpForm({contractId:prefilledContractId||"",title:"",notes:""}); setTpSubmitted(false); setTpFormError(""); setFinalFile(null); setTpFileError("");
    window.history.pushState({showForm:true},"");
    setTpShowForm(true);
  };

  const handleTpSave = async () => {
    setTpSubmitted(true); setTpFileError("");
    if(!tpForm.contractId||!tpForm.title.trim()) return;
    if(!finalFile) { setTpFileError("Texnologik jarayon faylini yuklang."); return; }
    setTpSaving(true); setTpFormError("");
    try {
      const dto: TechProcessCreatePayload = { contractId:tpForm.contractId, title:tpForm.title.trim(), notes:tpForm.notes||null };
      const newId = await techProcessService.create(dto);
      await techProcessService.uploadFile(newId,finalFile);
      const fresh = await techProcessService.getById(newId);
      setTpList(prev=>[fresh,...prev]);
      setTpShowForm(false);
    } catch(e: unknown) {
      const msg=(e as {response?:{data?:{errors?:string[]}}})?.response?.data?.errors?.[0];
      setTpFormError(msg??"Saqlashda xatolik yuz berdi.");
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
    setCnContractsLoading(true);
    try { const l=await contractService.getAll(); setContracts(l); } catch { setContracts([]); } finally { setCnContractsLoading(false); }
  }

  async function handleCnSave() {
    setCnSubmitted(true);
    if(!cnForm.contractId||cnParsedTables.length===0) return;
    setCnSaving(true); setCnSaveError(null);
    try {
      const allRows=cnParsedTables.flatMap(t=>t.rows);
      const items=allRows.map((row,idx)=>({ isSection:row.isSection,sectionName:row.isSection?row.sectionName:null,no:row.no||null,name:row.name||null,unit:row.unit||null,readyQty:row.readyQty||null,wasteQty:row.wasteQty||null,totalQty:row.totalQty||null,photoRaw:row.photoRaw||null,photoSemi:row.photoSemi||null,importType:row.importType||null,sortOrder:idx }));
      const newId=await costNormService.create({contractId:cnForm.contractId,title:cnForm.title||cnFormFile?.name?.replace(/\.docx$/i,"")||"Me'yoriy sarf",notes:cnForm.notes||null,items});
      if(cnFormFile&&newId) await costNormService.uploadFile(newId,cnFormFile);
      await loadCn(); setCnMode("list");
    } catch { setCnSaveError("Saqlashda xatolik yuz berdi"); }
    finally { setCnSaving(false); }
  }

  async function handleCnApprove(id: string) {
    setCnApprovingId(id);
    try { await costNormService.approve(id); setCnList(prev=>prev.map(n=>n.id===id?{...n,status:DrawingStatus.Approved}:n)); if(cnSelected?.id===id) setCnSelected(n=>n?{...n,status:DrawingStatus.Approved}:n); }
    finally { setCnApprovingId(null); }
  }

  function openCnDetail(norm: CostNormResponse) {
    setCnSelected(norm); setCnActiveTab(0); setCnSearch(""); setCnShowPhotos(false); setCnDetailFiles([]); setCnDetailItems([...norm.items].sort((a,b)=>a.sortOrder-b.sortOrder));
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

  async function handleCnDelete(id: string) {
    if(!confirm("Bu yozuvni o'chirmoqchimisiz?")) return;
    await costNormService.delete(id); await loadCn();
  }

  // ── CN computed ────────────────────────────────────────────────────────────

  const cnDetailTables = useMemo(()=>cnSelected?[{title:cnSelected.title,rows:cnDetailItems}]:[],[cnSelected,cnDetailItems]);
  const cnDetailRows = cnDetailTables[cnActiveTab]?.rows??[];
  const cnDataCount = cnParsedTables[cnActiveTab]?.rows.filter(r=>!r.isSection).length??0;
  const cnCurrentRows = cnParsedTables[cnActiveTab]?.rows??[];

  const cnFilteredList = useMemo(()=>{
    if(!cnSearch.trim()) return cnList;
    const q=cnSearch.toLowerCase();
    return cnList.filter(n=>n.contractNo.toLowerCase().includes(q)||n.title.toLowerCase().includes(q));
  },[cnList,cnSearch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // TP: full-page create form
  if (tpShowForm) {
    return (
      <div style={{ display:"flex",flexDirection:"column",gap:24 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={()=>setTpShowForm(false)} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:"4px 0",fontSize:13,fontWeight:500 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Orqaga
            </button>
            <span style={{ color:"var(--border)" }}>|</span>
            <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>Yangi texnologik jarayon</span>
          </div>
          <button onClick={()=>setTpShowForm(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:6,borderRadius:6,display:"flex",alignItems:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="itm-card" style={{ padding:28 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {/* Sarlavha — full width */}
            <div>
              <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:tpSubmitted&&!tpForm.title.trim()?"var(--danger)":"var(--text2)" }}>Sarlavha <span style={{ color:"var(--danger)" }}>*</span></label>
              <input className="form-input" value={tpForm.title} onChange={e=>setTpForm(f=>({...f,title:e.target.value}))} placeholder="Sarlavha kiriting" style={tpSubmitted&&!tpForm.title.trim()?{borderColor:"var(--danger)"}:undefined}/>
              {tpSubmitted&&!tpForm.title.trim()&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>Sarlavha kiritish shart</div>}
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
                  <input id="tp-file-final" type="file" style={{ display:"none" }} onChange={e=>{ setFinalFile(e.target.files?.[0]??null); setTpFileError(""); }}/>
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
    );
  }

  // CN: full-page create form
  if (cnMode === "create") {
    return (
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
          <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>Yangi me&apos;yoriy sarf</span>
          <button onClick={()=>setCnMode("list")} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:6,borderRadius:6,display:"flex",alignItems:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
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
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:cnSubmitted&&!cnForm.contractId?"var(--danger)":"var(--text2)" }}>Shartnoma <span style={{ color:"var(--danger)" }}>*</span></label>
                <select className="form-input" value={cnForm.contractId} onChange={e=>setCnForm(f=>({...f,contractId:e.target.value}))} style={{ width:"100%",cursor:"pointer",...(cnSubmitted&&!cnForm.contractId?{borderColor:"var(--danger)"}:{}) }}>
                  <option value="">{cnContractsLoading?"Yuklanmoqda...":"— Shartnomani tanlang —"}</option>
                  {contracts.map(c=><option key={c.id} value={c.id}>{c.contractNo}</option>)}
                </select>
                {cnSubmitted&&!cnForm.contractId&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>Shartnoma tanlash shart</div>}
              </div>
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>Sarlavha</label>
                <input className="form-input" value={cnForm.title} onChange={e=>setCnForm(f=>({...f,title:e.target.value}))} placeholder="Avtomatik to'ldiriladi"/>
              </div>
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:"var(--text2)" }}>Izoh</label>
                <textarea className="form-input" value={cnForm.notes} onChange={e=>setCnForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ resize:"none" }}/>
              </div>
              <div>
                <label style={{ fontSize:13,fontWeight:600,display:"block",marginBottom:6,color:cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--text2)" }}>
                  DOCX fayl <span style={{ color:"var(--danger)" }}>*</span>
                  <span style={{ fontWeight:400,color:"var(--text3)",marginLeft:6 }}>(me'yoriy sarf jadvali)</span>
                </label>
                <input ref={cnFormFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleCnFormFileChange}/>
                {cnFormFile?(
                  <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--success)",background:"var(--success-dim)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize:13,color:"var(--text1)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{cnFormFile.name}</span>
                    <span style={{ fontSize:12,color:"var(--text3)" }}>{(cnFormFile.size/1024).toFixed(0)} KB</span>
                    <button onClick={()=>{ setCnFormFile(null); setCnParsedTables([]); setCnCreateTab("form"); if(cnFormFileRef.current) cnFormFileRef.current.value=""; }} style={{ background:"none",border:"none",cursor:"pointer",padding:2,color:"var(--text3)",display:"flex" }}><X size={14}/></button>
                  </div>
                ):(
                  <button onClick={()=>cnFormFileRef.current?.click()}
                    style={{ width:"100%",padding:"22px 0",borderRadius:"var(--radius)",border:`1.5px dashed ${cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"}`,background:"var(--bg2)",cursor:"pointer",color:cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--text2)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--border)"; e.currentTarget.style.color=cnSubmitted&&cnParsedTables.length===0?"var(--danger)":"var(--text2)"; }}>
                    <Upload size={15}/> Fayl tanlang yoki bu yerga tashlang
                  </button>
                )}
                {cnSubmitted&&cnParsedTables.length===0&&!cnParseLoading&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:4 }}>Fayl yuklash shart</div>}
                {cnParseError&&<div style={{ color:"var(--danger)",fontSize:12,marginTop:6 }}>{cnParseError}</div>}
                {cnParsedTables.length>0&&(
                  <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>{cnDataCount} ta yozuv topildi</span>
                    <button onClick={()=>setCnCreateTab("table")} style={{ fontSize:12,color:"var(--accent,#1a56db)",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline" }}>Jadvalga o'tish →</button>
                  </div>
                )}
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
    );
  }

  // CN: detail view
  if (tpMode === "detail" && tpSelected) {
    return (
      <div style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0,flexWrap:"wrap",gap:8 }}>
          <button onClick={()=>{ setTpMode("list"); setTpSelected(null); }} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:13,padding:"6px 10px",borderRadius:6,fontWeight:500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Orqaga
          </button>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {tpSelected.status===ProcessStatus.Pending&&(
              <button onClick={async()=>{ await techProcessService.approve(tpSelected.id); const fresh=await techProcessService.getById(tpSelected.id); setTpSelected(fresh); setTpList(prev=>prev.map(t=>t.id===tpSelected.id?fresh:t)); }}
                style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:"var(--radius)",border:"1.5px solid var(--success)",background:"var(--success-dim)",color:"var(--success)",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Tasdiqlash
              </button>
            )}
            <button onClick={()=>{ setTpEditForm({title:tpSelected.title,notes:tpSelected.notes||""}); setTpMode("edit"); }}
              style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Tahrirlash
            </button>
          </div>
        </div>
        <div className="itm-card" style={{ padding:"14px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0,flexWrap:"wrap" }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Shartnoma</div>
            <div style={{ fontWeight:700,fontSize:15,color:"var(--accent)" }}>{tpSelected.contractNo}</div>
          </div>
          <div style={{ flex:2,minWidth:0 }}>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sarlavha</div>
            <div style={{ fontWeight:600,fontSize:14,color:"var(--text1)" }}>{tpSelected.title}</div>
          </div>
          <div>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
            <TpBadge status={tpSelected.status}/>
          </div>
          <div>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sana</div>
            <div style={{ fontSize:13,color:"var(--text2)",whiteSpace:"nowrap" }}>{fmt(tpSelected.createdAt)}</div>
          </div>
          {tpDetailFiles.length>0&&(
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",width:"100%" }}>
              {tpDetailFiles.map(f=>(
                <button key={f.id} onClick={()=>techProcessService.downloadFile(tpSelected.id,f.id,f.fileName)}
                  style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text1)",fontSize:12,cursor:"pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {f.fileName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (cnMode === "detail" && cnSelected) {
    return (
      <div style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0,flexWrap:"wrap",gap:8 }}>
          <button onClick={()=>{ setCnMode("list"); setCnSelected(null); }} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:13,padding:"6px 10px",borderRadius:6,fontWeight:500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Orqaga
          </button>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {cnSelected.status===DrawingStatus.Draft&&(
              <button onClick={()=>handleCnApprove(cnSelected.id)} disabled={cnApprovingId===cnSelected.id}
                style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:"var(--radius)",border:"1.5px solid var(--success)",background:"var(--success-dim)",color:"var(--success)",fontSize:13,fontWeight:600,cursor:"pointer",opacity:cnApprovingId===cnSelected.id?0.7:1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {cnApprovingId===cnSelected.id?"Tasdiqlanmoqda...":"Tasdiqlash"}
              </button>
            )}
            <button onClick={()=>openCnEdit(cnSelected)}
              style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Tahrirlash
            </button>
          </div>
        </div>
        <div className="itm-card" style={{ padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:16,flexShrink:0,flexWrap:"wrap" }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Shartnoma</div>
            <div style={{ fontWeight:700,fontSize:15,color:"var(--accent)" }}>{cnSelected.contractNo}</div>
          </div>
          <div style={{ flex:2,minWidth:0 }}>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sarlavha</div>
            <div style={{ fontWeight:600,fontSize:14,color:"var(--text1)" }}>{cnSelected.title}</div>
          </div>
          <div>
            <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
            <CnBadge status={cnSelected.status}/>
          </div>
          {cnDetailFiles.length>0&&(
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {cnDetailFiles.map(f=>(
                <a key={f.id} href={`/api/costnorms/${cnSelected.id}/files/${f.id}`} download={f.fileName}
                  style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text1)",fontSize:12,textDecoration:"none",cursor:"pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {f.fileName}
                </a>
              ))}
            </div>
          )}
          <button onClick={()=>setCnShowPhotos(p=>!p)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:cnShowPhotos?"var(--accent-dim)":"var(--bg2)",color:cnShowPhotos?"var(--accent)":"var(--text2)",fontSize:12,cursor:"pointer" }}>
            {cnShowPhotos?<ImageIcon size={12}/>:<ImageOff size={12}/>} {cnShowPhotos?"Fotolarni yashirish":"Fotolarni ko'rsatish"}
          </button>
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
          <button onClick={()=>{ setCnMode("list"); setCnEditingNorm(null); }} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:13,padding:"6px 10px",borderRadius:6,fontWeight:500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Bekor qilish
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
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Sarlavha</label>
              <input className="form-input" value={cnEditForm.title} onChange={e=>setCnEditForm(f=>({...f,title:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Izoh</label>
              <input className="form-input" value={cnEditForm.notes} onChange={e=>setCnEditForm(f=>({...f,notes:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:5,color:"var(--text2)" }}>Fayl almashtirish (ixtiyoriy)</label>
              <input ref={cnEditFileRef} type="file" accept=".docx" style={{ display:"none" }} onChange={handleEditCnFileChange}/>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <button onClick={()=>cnEditFileRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer" }}>
                  <Upload size={13}/> Fayl tanlash
                </button>
                {cnEditNewFile&&<span style={{ fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150 }}>{cnEditNewFile.name}</span>}
                {!cnEditNewFile&&cnEditFiles.length>0&&<span style={{ fontSize:11,color:"var(--text3)" }}>{cnEditFiles.length} ta fayl</span>}
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
    const tpEffective = selectedItem.tp?.status !== ProcessStatus.Pending ? selectedItem.tp : null;
    const cnEffective = selectedItem.cn?.status !== DrawingStatus.Draft ? selectedItem.cn : null;
    const tpDone = tpEffective && (tpEffective.status === ProcessStatus.Approved || tpEffective.status === ProcessStatus.Completed);
    const cnDone = cnEffective && cnEffective.status === DrawingStatus.Approved;
    const warehouseDone = tpEffective?.status === ProcessStatus.Completed;
    return (
      <div style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={closeDetail}
            style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--bg3)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",padding:"7px 14px",color:"var(--text2)",fontSize:13,fontWeight:500 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Orqaga
          </button>
          <span style={{ fontWeight:700,fontSize:18,color:"var(--text1)" }}>Shartnoma {selectedItem.contractNo}</span>
        </div>

        {/* ── Workflow pipeline ── */}
        <div className="itm-card" style={{ padding:"14px 20px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:0 }}>
            {/* Step 1 */}
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

            {/* Arrow 1→2 */}
            <div style={{ flex:"0 0 40px",display:"flex",alignItems:"center",justifyContent:"center",paddingBottom:24 }}>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <line x1="0" y1="6" x2="18" y2="6" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
                <polyline points="14,2 20,6 14,10" fill="none" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2"/>
              </svg>
            </div>

            {/* Step 2 */}
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
              {tpEffective&&!tpInlineEditing&&(
                <div style={{ display:"flex",gap:4 }}>
                  {tpEffective.status===ProcessStatus.InProgress&&(
                    <button onClick={async()=>{ setTpApprovingId(tpEffective.id); try { await techProcessService.approve(tpEffective.id); await loadTp(); } finally { setTpApprovingId(null); } }} disabled={tpApprovingId===tpEffective.id}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:tpApprovingId===tpEffective.id?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {tpApprovingId===tpEffective.id?"...":"Tasdiqlash"}
                    </button>
                  )}
                  <button onClick={()=>openTpDetail(tpEffective)}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"#e8f0fe",border:"1px solid #a4c0f4",color:"#1a56db",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ko&apos;rish
                  </button>
                  <button onClick={()=>{ setTpSelected(tpEffective); setTpEditForm({title:tpEffective.title,notes:tpEffective.notes||""}); setTpInlineEditing(true); }}
                    style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Tahrirlash
                  </button>
                  <button onClick={()=>setTpDeleteId(tpEffective.id)}
                    style={{ display:"inline-flex",alignItems:"center",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {!tpEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>Texnologik jarayon yaratilmagan</div>
                  <button onClick={()=>openTpCreate(selectedItem.contractId)}
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Jarayon yaratish
                  </button>
                </div>
              ):tpInlineEditing?(
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>Sarlavha</label>
                    <input className="form-input" value={tpEditForm.title} onChange={e=>setTpEditForm(f=>({...f,title:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,display:"block",marginBottom:4,color:"var(--text2)" }}>Izoh</label>
                    <textarea className="form-input" value={tpEditForm.notes} onChange={e=>setTpEditForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ resize:"none" }}/>
                  </div>
                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
                    <button onClick={()=>setTpInlineEditing(false)}
                      style={{ padding:"6px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:12,cursor:"pointer" }}>Bekor</button>
                    <button onClick={async()=>{ await handleTpEditSave(); setTpInlineEditing(false); }} disabled={tpEditSaving}
                      style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 16px",borderRadius:"var(--radius)",border:"none",background:"var(--accent)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:tpEditSaving?0.7:1 }}>
                      {tpEditSaving?"Saqlanmoqda...":"Saqlash"}
                    </button>
                  </div>
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sarlavha</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={tpEffective.title}>{tpEffective.title}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
                    <TpBadge status={tpEffective.status}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sana</div>
                    <div style={{ fontSize:13,color:"var(--text2)",whiteSpace:"nowrap" }}>{fmt(tpEffective.createdAt)}</div>
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
                  {cnEffective.status===DrawingStatus.Draft&&(
                    <button onClick={()=>handleCnApprove(cnEffective.id)} disabled={cnApprovingId===cnEffective.id}
                      style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--success-dim)",border:"1px solid rgba(15,123,69,0.2)",color:"var(--success)",cursor:"pointer",opacity:cnApprovingId===cnEffective.id?0.6:1 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {cnApprovingId===cnEffective.id?"...":"Tasdiqlash"}
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
                  <button onClick={()=>handleCnDelete(cnEffective.id)}
                    style={{ display:"inline-flex",alignItems:"center",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,background:"var(--danger-dim)",border:"1px solid var(--danger)44",color:"var(--danger)",cursor:"pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:"14px 16px" }}>
              {!cnEffective?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ fontSize:13,color:"var(--text3)",marginBottom:12 }}>Me&apos;yoriy sarf yaratilmagan</div>
                  <button onClick={()=>openCnCreate(selectedItem.contractId)}
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 14px",fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Me&apos;yoriy sarf yaratish
                  </button>
                </div>
              ):(
                <div style={{ display:"flex",flexWrap:"wrap",gap:16 }}>
                  <div style={{ flex:"1 1 auto",minWidth:0 }}>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sarlavha</div>
                    <div style={{ fontSize:13,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={selectedItem.cn.title}>{selectedItem.cn.title}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Holat</div>
                    <CnBadge status={selectedItem.cn.status}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Materiallar</div>
                    <span style={{ fontSize:12,fontWeight:600,color:"var(--text2)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 8px",display:"inline-block" }}>
                      {selectedItem.cn.items.filter(r=>!r.isSection).length} та
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:2 }}>Sana</div>
                    <div style={{ fontSize:13,color:"var(--text2)",whiteSpace:"nowrap" }}>{fmt(selectedItem.cn.createdAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── TP Delete confirm ── */}
        {tpDeleteId&&(
          <div className="modal-overlay" onClick={()=>setTpDeleteId(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:380 }}>
              <div className="modal-header" style={{ borderBottom:"1px solid var(--border)" }}>O&apos;chirish tasdiqi</div>
              <div style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:14,color:"var(--text1)",marginBottom:20 }}>Bu texnologik jarayonni o&apos;chirmoqchimisiz?</div>
                <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                  <button onClick={()=>setTpDeleteId(null)} style={{ padding:"8px 20px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,cursor:"pointer" }}>Bekor</button>
                  <button onClick={handleTpDelete} disabled={tpDeleting} style={{ padding:"8px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--danger)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                    {tpDeleting?"O'chirilmoqda...":"O'chirish"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",flex:1,gap:16 }}>

      {/* ── Toolbar ── */}
      <div className="itm-card" style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",flexWrap:"wrap" }}>
        <div className="search-wrap" style={{ flex:1,minWidth:180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Shartnoma raqami bo'yicha qidirish..." value={tpSearch} onChange={e=>setTpSearch(e.target.value)}/>
        </div>
        <button className="btn-icon" onClick={()=>{ loadTp(); loadCn(); }} title="Yangilash" style={{ background:"var(--accent-dim)",borderColor:"var(--accent)",color:"var(--accent)",width:36,height:36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
        <button onClick={()=>openCnCreate()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",fontSize:13,fontWeight:600,borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yangi me&apos;yor
        </button>
      </div>

      {/* ── Contracts table ── */}
      <div className="itm-card" style={{ overflow:"hidden" }}>
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
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Texnologik jarayon</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Me&apos;yoriy sarf</th>
                  <th style={{ textAlign:"center",color:"var(--text1)" }}>Umumiy holat</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length===0?(
                  <tr><td colSpan={5} style={{ textAlign:"center",color:"var(--text2)",padding:32 }}>Ma&apos;lumot topilmadi</td></tr>
                ):filteredItems.map((item,i)=>{
                  const tpOk=item.tp&&(item.tp.status===ProcessStatus.Approved||item.tp.status===ProcessStatus.Completed);
                  const cnOk=item.cn&&item.cn.status===DrawingStatus.Approved;
                  const isSelected=selectedContractId===item.contractId;
                  return (
                    <tr key={item.contractId}
                      onClick={()=>{ setSelectedContractId(item.contractId); setTpInlineEditing(false); }}
                      style={{ cursor:"pointer",transition:"background 0.12s" }}>
                      <td style={{ textAlign:"center",borderRight:"2px solid var(--border)",padding:"0 8px",fontSize:13 }}>{String(i+1).padStart(2,"0")}</td>
                      <td style={{ textAlign:"center",fontWeight:700,color:"var(--accent)",fontFamily:"var(--font-inter,Inter,sans-serif)" }}>{item.contractNo}</td>
                      <td style={{ textAlign:"center" }}>
                        {item.tp?<TpBadge status={item.tp.status}/>:<span style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>Yaratilmagan</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {item.cn?<CnBadge status={item.cn.status}/>:<span style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>Yaratilmagan</span>}
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {tpOk&&cnOk?(
                          <span style={{ fontSize:11,fontWeight:600,color:"var(--purple)",background:"var(--purple-dim)",borderRadius:20,padding:"2px 10px",border:"1px solid rgba(109,74,173,0.2)",display:"inline-block" }}>Yakunlangan</span>
                        ):(
                          <span style={{ fontSize:11,color:"var(--text3)" }}>Jarayonda</span>
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

      {/* ── TP Delete confirm ── */}
      {tpDeleteId&&(
        <div className="modal-overlay" onClick={()=>setTpDeleteId(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:380 }}>
            <div className="modal-header" style={{ borderBottom:"1px solid var(--border)" }}>O&apos;chirish tasdiqi</div>
            <div style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:14,color:"var(--text1)",marginBottom:20 }}>Bu texnologik jarayonni o&apos;chirmoqchimisiz?</div>
              <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                <button onClick={()=>setTpDeleteId(null)} style={{ padding:"8px 20px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",fontSize:13,cursor:"pointer" }}>Bekor</button>
                <button onClick={handleTpDelete} disabled={tpDeleting} style={{ padding:"8px 20px",borderRadius:"var(--radius)",border:"none",background:"var(--danger)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                  {tpDeleting?"O'chirilmoqda...":"O'chirish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
