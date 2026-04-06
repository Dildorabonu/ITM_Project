"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS_UZ = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const DAYS_UZ   = ["Du","Se","Ch","Pa","Ju","Sh","Ya"];

export function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}.${m}.${y}`;
}

export function isoToDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

export function maskDate(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  let day = digits.slice(0, 2);
  if (digits.length >= 2 && parseInt(day, 10) > 31) day = "31";
  if (digits.length < 2) return day;
  let month = digits.slice(2, 4);
  if (digits.length >= 4 && parseInt(month, 10) > 12) month = "12";
  if (digits.length < 4) return `${day}.${month}`;
  return `${day}.${month}.${digits.slice(4)}`;
}

export function displayToIso(disp: string): string {
  const parts = disp.split(".");
  if (parts.length !== 3 || parts[2].length !== 4) return "";
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function DatePickerField({ value, displayValue, onDisplayChange, onDateSelect, hasError }: {
  value: string;
  displayValue: string;
  onDisplayChange: (d: string) => void;
  onDateSelect: (iso: string) => void;
  hasError?: boolean;
}) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const initYear  = value ? parseInt(value.slice(0,4))   : today.getFullYear();
  const initMonth = value ? parseInt(value.slice(5,7))-1 : today.getMonth();
  const [open, setOpen]           = useState(false);
  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) { setViewYear(parseInt(value.slice(0,4))); setViewMonth(parseInt(value.slice(5,7))-1); }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const prevMonth = () => viewMonth === 0  ? (setViewMonth(11), setViewYear(y=>y-1)) : setViewMonth(m=>m-1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0),  setViewYear(y=>y+1)) : setViewMonth(m=>m+1);

  const firstDayAdj = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDayAdj).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  const pickDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onDateSelect(iso);
    onDisplayChange(isoToDisplayDate(iso));
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
        <input className="form-input" type="text" value={displayValue} placeholder="kun.oy.yil"
          onChange={e => { const m = maskDate(e.target.value); onDisplayChange(m); const iso = displayToIso(m); if (iso) onDateSelect(iso); }}
          style={{ ...(hasError ? {borderColor:"var(--danger)"} : {}), paddingRight:38, width:"100%" }}
        />
        <button type="button" onClick={()=>setOpen(o=>!o)} style={{
          position:"absolute", right:8, background:"none", border:"none", cursor:"pointer",
          padding:3, borderRadius:5, color: open ? "var(--accent)" : "var(--text3)",
          display:"flex", alignItems:"center", transition:"color 0.15s",
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:9999,
          background:"var(--surface)", border:"1.5px solid var(--border)",
          borderRadius:12, boxShadow:"0 12px 40px rgba(0,0,0,0.13)", width:272, padding:"14px 12px 10px",
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <button type="button" onClick={prevMonth} style={{ background:"var(--surface2)", border:"none", cursor:"pointer", width:28, height:28, borderRadius:7, color:"var(--text2)", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <span style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{MONTHS_UZ[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ background:"var(--surface2)", border:"none", cursor:"pointer", width:28, height:28, borderRadius:7, color:"var(--text2)", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
            {DAYS_UZ.map(d => <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:600, color:"var(--text3)", padding:"2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i}/>;
              const iso = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const sel = iso === value, tdy = iso === todayIso;
              return (
                <button key={i} type="button" onClick={()=>pickDay(day)} style={{
                  background: sel ? "var(--accent)" : "none",
                  color: sel ? "#fff" : tdy ? "var(--accent)" : "var(--text)",
                  border: tdy && !sel ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                  borderRadius:7, fontSize:13, fontWeight: sel||tdy ? 600 : 400,
                  cursor:"pointer", padding:"5px 2px", textAlign:"center", transition:"background 0.1s",
                }}
                  onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="var(--accent-dim)";}}
                  onMouseLeave={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="none";}}
                >{day}</button>
              );
            })}
          </div>
          <div style={{ borderTop:"1px solid var(--border)", marginTop:10, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
            <button type="button" onClick={()=>{onDateSelect("");onDisplayChange("");setOpen(false);}}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"var(--text3)", padding:"2px 6px", borderRadius:5 }}>
              Tozalash
            </button>
            <button type="button" onClick={()=>{ setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); pickDay(today.getDate()); }}
              style={{ background:"var(--accent-dim)", border:"none", cursor:"pointer", fontSize:12, color:"var(--accent)", fontWeight:600, padding:"2px 10px", borderRadius:5 }}>
              Bugun
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
