import { RequisitionStatus, RequisitionSource } from "@/lib/userService";
import { WORKFLOW_STEPS, STEP_COLORS, getWorkflowIndex, getFinalStepInfo } from "../_types";

interface Props {
  status: RequisitionStatus;
  source?: RequisitionSource;
}

export function WorkflowDiagram({ status, source }: Props) {
  // Off-path terminal states
  if (status === RequisitionStatus.Rejected) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
        <div style={{
          padding: "14px 18px", borderRadius: 8,
          background: "var(--danger-dim)",
          border: "1.5px solid rgba(217,48,37,0.3)",
          fontSize: 13, fontWeight: 600, color: "var(--danger)",
          textAlign: "center",
        }}>
          Talabnoma rad etilgan
        </div>
      </div>
    );
  }

  if (status === RequisitionStatus.Split) {
    const splitSteps = [
      { color: STEP_COLORS[RequisitionStatus.Draft].active,                 shortLabel: "Yaratildi" },
      { color: STEP_COLORS[RequisitionStatus.PendingWarehouseCheck].active, shortLabel: "Tekshiruvda" },
      { color: STEP_COLORS[RequisitionStatus.WarehouseChecked].active,      shortLabel: "Tekshirildi" },
    ];
    const splitColor = "#7c3aed";
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
        <div style={{ position: "relative" }}>
          {/* connector line */}
          <div style={{
            position: "absolute", top: 16,
            left: `${50 / 4}%`,
            right: `${50 / 4}%`,
            height: 2, background: "var(--border)", zIndex: 0,
          }} />
          {/* filled connector up to split step */}
          <div style={{
            position: "absolute", top: 16,
            left: `${50 / 4}%`,
            width: `${75}%`,
            height: 2, background: splitColor, zIndex: 0,
          }} />
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            {splitSteps.map((step, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: step.color,
                  border: `2px solid ${step.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, textAlign: "center", lineHeight: 1.3, color: "var(--text2)", maxWidth: 80 }}>
                  {step.shortLabel}
                </span>
              </div>
            ))}
            {/* Split step (active) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: splitColor,
                border: `2px solid ${splitColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 0 4px ${splitColor}33`,
                transition: "all 0.3s",
              }}>
                {/* Y-shaped fork (split) icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="13" />
                  <circle cx="6" cy="18" r="2.5" />
                  <circle cx="18" cy="6" r="2.5" />
                  <path d="M6 13c0 4 4 5 8 5" opacity="0.55" />
                  <path d="M6 13c0-4 4-5 8-5" />
                </svg>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.3, color: splitColor, maxWidth: 80 }}>
                Bo&apos;lingan
              </span>
            </div>
          </div>
          {/* current step description */}
          <div style={{
            marginTop: 14, padding: "8px 14px", borderRadius: 8,
            background: `${splitColor}14`,
            border: `1.5px solid ${splitColor}44`,
            fontSize: 13, fontWeight: 600, color: splitColor,
            textAlign: "center",
          }}>
            Bo&apos;lib yuborilgan — ichki talabnomalarni ko&apos;ring
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = getWorkflowIndex(status);
  const finalInfo = getFinalStepInfo(source);

  const colorForStep = (idx: number) => {
    const step = WORKFLOW_STEPS[idx];
    if (step.key === "final") return finalInfo.color;
    return STEP_COLORS[step.key].active;
  };

  const labelForStep = (idx: number) => {
    const step = WORKFLOW_STEPS[idx];
    return step.key === "final" ? finalInfo.shortLabel : step.shortLabel;
  };

  const fullLabelForStep = (idx: number) => {
    const step = WORKFLOW_STEPS[idx];
    return step.key === "final" ? finalInfo.label : step.label;
  };

  const currentColor = currentIdx >= 0 ? colorForStep(currentIdx) : "var(--border)";

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
            height: 2, background: currentColor, zIndex: 0, transition: "width 0.4s",
          }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          {WORKFLOW_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            const stepColor = colorForStep(idx);
            const textColor = step.key === "final" ? "#fff" : STEP_COLORS[step.key].text;
            return (
              <div key={String(step.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isDone || isActive ? stepColor : "var(--bg3)",
                  border: `2px solid ${isDone || isActive ? stepColor : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isActive ? `0 0 0 4px ${stepColor}33` : "none",
                  transition: "all 0.3s",
                }}>
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? textColor : "var(--text3)" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                  color: isActive ? stepColor : isDone ? "var(--text2)" : "var(--text3)",
                  maxWidth: 80,
                }}>
                  {labelForStep(idx)}
                </span>
              </div>
            );
          })}
        </div>
        {/* current step description */}
        {currentIdx >= 0 && (
          <div style={{
            marginTop: 14, padding: "8px 14px", borderRadius: 8,
            background: `${currentColor}14`,
            border: `1.5px solid ${currentColor}44`,
            fontSize: 13, fontWeight: 600, color: currentColor,
            textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {fullLabelForStep(currentIdx)}
          </div>
        )}
      </div>
    </div>
  );
}
