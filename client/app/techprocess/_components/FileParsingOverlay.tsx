"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const kf = `
@keyframes overlayFadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes overlayFadeOut{0%{opacity:1}100%{opacity:0}}
@keyframes spinRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes pulseCore{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(59,130,246,0.3)}50%{transform:scale(1.08);box-shadow:0 0 30px 8px rgba(59,130,246,0.15)}}
@keyframes textFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes dataStreamLine{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
`;

export function FileParsingOverlay({ dataReady,onComplete }: { dataReady:boolean; onComplete:()=>void }) {
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

  return createPortal(
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
  , document.body);
}
