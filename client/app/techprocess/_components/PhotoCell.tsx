"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function PhotoCell({ src }: { src: string|null }) {
  const [open, setOpen] = useState(false);
  if (!src) return <span style={{ color:"var(--text3)",fontSize:12 }}>—</span>;
  return (
    <>
      <img src={src} alt="foto" onClick={()=>setOpen(true)}
        style={{ width:40,height:40,objectFit:"cover",borderRadius:4,cursor:"pointer",border:"1px solid var(--border)" }} />
      {open && createPortal(
        <div onClick={()=>setOpen(false)}
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(2px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <img src={src} alt="foto" style={{ maxWidth:"90vw",maxHeight:"90vh",borderRadius:8 }} />
        </div>,
        document.body
      )}
    </>
  );
}
