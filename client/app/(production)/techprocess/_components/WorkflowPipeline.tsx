"use client";

import { computeGating, type ContractReadinessScope } from "../_types";

// 3-bosqichli jarayon konteksti: Texnik chizma → Texnologik jarayon → Me'yoriy
// sarf. Ham `/techprocess`, ham `/costnorm` detal ko'rinishida bir xil ko'rinadi —
// foydalanuvchi joriy bosqich umumiy oqimda qayerdaligini ko'rib turadi.
export function WorkflowPipeline({ scope }: { scope: ContractReadinessScope }) {
  const { drawingDone, tpDone, cnDone, tp: tpEffective, cn: cnEffective } = computeGating(scope);
  const hasDrawing = !!scope.drawing;

  return (
    <div className="itm-card" style={{ padding: "14px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>

        {/* Step 1: Texnik chizma */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: drawingDone ? "var(--success)" : hasDrawing ? "#e8f0fe" : "var(--bg3)",
            border: drawingDone ? "2px solid var(--success)" : hasDrawing ? "2px solid #1a56db" : "2px solid var(--border)",
          }}>
            {drawingDone
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={hasDrawing ? "#1a56db" : "var(--text3)"} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: drawingDone ? "var(--success)" : hasDrawing ? "#1a56db" : "var(--text3)" }}>Texnik chizma</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
              {!hasDrawing ? "Yaratilmagan" : drawingDone ? "Tasdiqlangan" : "Tasdiqlanmagan"}
            </div>
          </div>
        </div>

        {/* Arrow 1→2 */}
        <div style={{ flex: "0 0 40px", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
            <line x1="0" y1="6" x2="18" y2="6" stroke={drawingDone ? "var(--success)" : "var(--border)"} strokeWidth="2" />
            <polyline points="14,2 20,6 14,10" fill="none" stroke={drawingDone ? "var(--success)" : "var(--border)"} strokeWidth="2" />
          </svg>
        </div>

        {/* Step 2: Texnologik jarayon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: tpDone ? "var(--success)" : tpEffective ? "#e8f0fe" : "var(--bg3)",
            border: tpDone ? "2px solid var(--success)" : tpEffective ? "2px solid #1a56db" : "2px solid var(--border)",
          }}>
            {tpDone
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tpEffective ? "#1a56db" : "var(--text3)"} strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tpDone ? "var(--success)" : tpEffective ? "#1a56db" : "var(--text3)" }}>Texnologik jarayon</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
              {!tpEffective ? "Yaratilmagan" : tpDone ? "Tasdiqlangan" : "Kutilmoqda"}
            </div>
          </div>
        </div>

        {/* Arrow 2→3 */}
        <div style={{ flex: "0 0 40px", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
            <line x1="0" y1="6" x2="18" y2="6" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2" />
            <polyline points="14,2 20,6 14,10" fill="none" stroke={tpDone ? "var(--success)" : "var(--border)"} strokeWidth="2" />
          </svg>
        </div>

        {/* Step 3: Me'yoriy sarf */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: cnDone ? "var(--success)" : cnEffective ? "#e8f0fe" : "var(--bg3)",
            border: cnDone ? "2px solid var(--success)" : cnEffective ? "2px solid #1a56db" : "2px solid var(--border)",
          }}>
            {cnDone
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={cnEffective ? "#1a56db" : "var(--text3)"} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cnDone ? "var(--success)" : cnEffective ? "#1a56db" : "var(--text3)" }}>Me&apos;yoriy sarf</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
              {!cnEffective ? "Yaratilmagan" : cnDone ? "Tasdiqlangan" : "Kutilmoqda"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
