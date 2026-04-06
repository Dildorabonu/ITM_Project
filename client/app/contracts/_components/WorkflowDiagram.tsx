import { ContractStatus } from "@/lib/userService";
import { WORKFLOW_STEPS, STEP_COLORS } from "../_types";

export function WorkflowDiagram({ status }: { status: ContractStatus }) {
  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.status === status);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
      <div style={{ position: "relative" }}>
        {/* connector line */}
        <div style={{
          position: "absolute", top: 16,
          left: `${50 / WORKFLOW_STEPS.length}%`,
          right: `${50 / WORKFLOW_STEPS.length}%`,
          height: 2, background: "var(--border)", zIndex: 0,
        }} />
        {/* filled connector up to current step */}
        {currentIdx > 0 && (
          <div style={{
            position: "absolute", top: 16,
            left: `${50 / WORKFLOW_STEPS.length}%`,
            width: `${currentIdx * 100 / WORKFLOW_STEPS.length}%`,
            height: 2, background: STEP_COLORS[status].active, zIndex: 0, transition: "width 0.4s",
          }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          {WORKFLOW_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            const col = STEP_COLORS[step.status];
            return (
              <div key={step.status} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isDone || isActive ? col.active : "var(--bg3)",
                  border: `2px solid ${isDone || isActive ? col.active : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isActive ? `0 0 0 4px ${col.active}33` : "none",
                  transition: "all 0.3s",
                }}>
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col.text} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? col.text : "var(--text3)" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                  color: isActive ? col.active : isDone ? "var(--text2)" : "var(--text3)",
                  maxWidth: 72,
                }}>
                  {step.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
        {/* current step description */}
        <div style={{
          marginTop: 14, padding: "8px 14px", borderRadius: 8,
          background: `${STEP_COLORS[status].active}14`,
          border: `1.5px solid ${STEP_COLORS[status].active}44`,
          fontSize: 13, fontWeight: 600, color: STEP_COLORS[status].active,
          textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {WORKFLOW_STEPS[currentIdx]?.label}
        </div>
      </div>
    </div>
  );
}
