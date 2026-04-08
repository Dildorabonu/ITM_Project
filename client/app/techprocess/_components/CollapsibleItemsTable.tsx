"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { type CostNormItemResponse } from "@/lib/userService";
import { type MaterialRow } from "../_types";
import { PhotoCell } from "./PhotoCell";

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

export function CollapsibleItemsTable({ rows,showPhotos,onUpdateRow,onDeleteRow }: { rows:(MaterialRow|CostNormItemResponse)[]; showPhotos:boolean; onUpdateRow?:(fi:number,u:Partial<MaterialRow>)=>void; onDeleteRow?:(fi:number)=>void }) {
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
