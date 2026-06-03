import { RequisitionStatus, RequisitionSource, type RequisitionChildSummary } from "@/lib/userService";
import { WORKFLOW_STEPS, STEP_COLORS, getWorkflowIndex, getFinalStepInfo } from "../_types";

interface Props {
  status: RequisitionStatus;
  source?: RequisitionSource;
  splitChildren?: RequisitionChildSummary[];
}

export function WorkflowDiagram({ status, source, splitChildren }: Props) {
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
    return <SplitDiagram splitChildren={splitChildren} />;
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

// ─── Split (fork) diagram ─────────────────────────────────────────────────────

function SplitDiagram({
  splitChildren,
}: {
  splitChildren?: RequisitionChildSummary[];
}) {
  const purchase = splitChildren?.find(c => c.source === RequisitionSource.Purchase);
  const warehouse = splitChildren?.find(c => c.source === RequisitionSource.Warehouse);

  const draftColor    = STEP_COLORS[RequisitionStatus.Draft].active;
  const checkInColor  = STEP_COLORS[RequisitionStatus.PendingWarehouseCheck].active;
  const checkedColor  = STEP_COLORS[RequisitionStatus.WarehouseChecked].active;
  const forkColor     = "#7c3aed";
  const purchaseColor = "#1a6eeb";
  const warehouseColor = "#0f7b45";

  // y-coordinates for circle centers (px)
  const TOP_Y    = 40;
  const MID_Y    = 110;
  const BOTTOM_Y = 180;
  const HEIGHT   = 220;

  // x-coordinates for circle centers (% of container width)
  const X = { p1: 8, p2: 22, p3: 36, fork: 50, c1: 67, c2: 90 };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
      <div style={{ position: "relative", height: HEIGHT }}>
        {/* === Background connectors === */}
        {/* Main parent path: step 1 → 2 → 3 */}
        <div style={{ position: "absolute", left: `${X.p1}%`, width: `${X.p3 - X.p1}%`, top: MID_Y - 1, height: 2, background: checkedColor, zIndex: 0 }} />
        {/* Step 3 → fork center */}
        <div style={{ position: "absolute", left: `${X.p3}%`, width: `${X.fork - X.p3}%`, top: MID_Y - 1, height: 2, background: forkColor, zIndex: 0 }} />
        {/* Vertical fork: top branch ↑ bottom branch ↓ */}
        <div style={{ position: "absolute", left: `calc(${X.fork}% - 1px)`, top: TOP_Y, width: 2, height: BOTTOM_Y - TOP_Y, background: forkColor, zIndex: 0 }} />
        {/* Top branch horizontals */}
        <div style={{ position: "absolute", left: `${X.fork}%`, width: `${X.c1 - X.fork}%`, top: TOP_Y - 1, height: 2, background: forkColor, zIndex: 0 }} />
        <div style={{ position: "absolute", left: `${X.c1}%`, width: `${X.c2 - X.c1}%`, top: TOP_Y - 1, height: 2,
          background: getBranchLineColor(purchase, purchaseColor), zIndex: 0 }} />
        {/* Bottom branch horizontals */}
        <div style={{ position: "absolute", left: `${X.fork}%`, width: `${X.c1 - X.fork}%`, top: BOTTOM_Y - 1, height: 2, background: forkColor, zIndex: 0 }} />
        <div style={{ position: "absolute", left: `${X.c1}%`, width: `${X.c2 - X.c1}%`, top: BOTTOM_Y - 1, height: 2,
          background: getBranchLineColor(warehouse, warehouseColor), zIndex: 0 }} />

        {/* === Steps === */}
        {/* Parent steps (all done) */}
        <DoneStep x={`${X.p1}%`} y={MID_Y} color={draftColor}    label="Yaratildi" />
        <DoneStep x={`${X.p2}%`} y={MID_Y} color={checkInColor}  label="Tekshiruvda" />
        <DoneStep x={`${X.p3}%`} y={MID_Y} color={checkedColor}  label="Tekshirildi" />

        {/* Fork node */}
        <ForkNode x={`${X.fork}%`} y={MID_Y} color={forkColor} />

        {/* Top branch (Purchase / Sotib olishga) */}
        {purchase ? (
          <BranchPair
            child={purchase}
            yCenter={TOP_Y}
            xApprove={X.c1}
            xFinal={X.c2}
            finalColor={purchaseColor}
            finalLabel="Sotib olishga"
            stepNumber={4}
          />
        ) : (
          <PendingBranch yCenter={TOP_Y} xApprove={X.c1} xFinal={X.c2} finalColor={purchaseColor} finalLabel="Sotib olishga" />
        )}

        {/* Bottom branch (Warehouse / Ombordan olishga) */}
        {warehouse ? (
          <BranchPair
            child={warehouse}
            yCenter={BOTTOM_Y}
            xApprove={X.c1}
            xFinal={X.c2}
            finalColor={warehouseColor}
            finalLabel="Ombordan olishga"
            stepNumber={4}
          />
        ) : (
          <PendingBranch yCenter={BOTTOM_Y} xApprove={X.c1} xFinal={X.c2} finalColor={warehouseColor} finalLabel="Ombordan olishga" />
        )}
      </div>

      {/* Bottom banner */}
      <div style={{
        marginTop: 4, padding: "8px 14px", borderRadius: 8,
        background: `${forkColor}14`,
        border: `1.5px solid ${forkColor}44`,
        fontSize: 13, fontWeight: 600, color: forkColor,
        textAlign: "center",
      }}>
        Bo&apos;lib yuborilgan — har bir yo&apos;nalish alohida tasdiqlash bosqichidan o&apos;tadi
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBranchLineColor(child: RequisitionChildSummary | undefined, finalColor: string): string {
  if (!child) return "var(--border)";
  if (child.status === RequisitionStatus.ReadyForWarehouseRelease || child.status === RequisitionStatus.ReadyForPurchase) return finalColor;
  return "var(--border)";
}

// ─── Step components ─────────────────────────────────────────────────────────

function DoneStep({ x, y, color, label }: { x: string; y: number; color: string; label: string }) {
  return (
    <PositionedStep x={x} y={y} label={label} labelColor="var(--text2)" labelWeight={500}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: color, border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </PositionedStep>
  );
}

function ForkNode({ x, y, color }: { x: string; y: number; color: string }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y - 8,
      transform: "translateX(-50%)",
      width: 16, height: 16, borderRadius: "50%",
      background: color, border: `2px solid ${color}`,
      boxShadow: `0 0 0 4px ${color}22`,
      zIndex: 1,
    }} />
  );
}

function ChildCircle({
  state, n, color,
}: {
  state: "pending" | "active" | "done" | "rejected";
  n: number;
  color: string;
}) {
  const filled = state === "active" || state === "done";
  const isRejected = state === "rejected";
  const bg = isRejected ? "#dc2626" : (filled ? color : "var(--bg3)");
  const borderColor = isRejected ? "#dc2626" : (filled ? color : "var(--border)");
  const shadow = state === "active"
    ? `0 0 0 4px ${color}33`
    : isRejected ? `0 0 0 4px #dc262633` : "none";

  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: bg, border: `2px solid ${borderColor}`,
      boxShadow: shadow,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.3s",
    }}>
      {state === "done" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : isRejected ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18"/>
          <line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, color: state === "active" ? "#fff" : "var(--text3)" }}>
          {n}
        </span>
      )}
    </div>
  );
}

function PositionedStep({
  x, y, label, labelColor, labelWeight, children,
}: {
  x: string; y: number; label: string; labelColor: string; labelWeight: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      position: "absolute", left: x, top: y - 16,
      transform: "translateX(-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      zIndex: 1,
    }}>
      {children}
      <span style={{
        fontSize: 10, fontWeight: labelWeight, textAlign: "center", lineHeight: 1.3,
        color: labelColor, maxWidth: 110, whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}

function BranchPair({
  child, yCenter, xApprove, xFinal, finalColor, finalLabel, stepNumber,
}: {
  child: RequisitionChildSummary;
  yCenter: number;
  xApprove: number;
  xFinal: number;
  finalColor: string;
  finalLabel: string;
  stepNumber: number;
}) {
  const approvalColor = STEP_COLORS[RequisitionStatus.PendingApproval].active;

  const isApproved = child.status === RequisitionStatus.ReadyForWarehouseRelease || child.status === RequisitionStatus.ReadyForPurchase;
  const isPending  = child.status === RequisitionStatus.PendingApproval;
  const isRejected = child.status === RequisitionStatus.Rejected;

  const approveState: "pending" | "active" | "done" | "rejected" =
    isApproved ? "done" :
    isPending  ? "active" :
    isRejected ? "rejected" :
    "pending";

  const finalState: "pending" | "active" | "done" | "rejected" =
    isApproved  ? "done" :
    "pending";

  const approveLabelColor =
    approveState === "active"   ? approvalColor :
    approveState === "rejected" ? "#dc2626" :
    approveState === "done"     ? "var(--text2)" : "var(--text3)";

  const finalLabelColor =
    finalState === "done"   ? finalColor :
    "var(--text3)";

  return (
    <>
      <PositionedStep
        x={`${xApprove}%`} y={yCenter}
        label="Tasdiqlash"
        labelColor={approveLabelColor}
        labelWeight={approveState === "active" || approveState === "rejected" ? 700 : 500}
      >
        <ChildCircle state={approveState} n={stepNumber} color={approvalColor} />
      </PositionedStep>

      <PositionedStep
        x={`${xFinal}%`} y={yCenter}
        label={finalLabel}
        labelColor={finalLabelColor}
        labelWeight={finalState === "done" ? 700 : 500}
      >
        <ChildCircle state={finalState} n={stepNumber + 1} color={finalColor} />
      </PositionedStep>
    </>
  );
}

function PendingBranch({
  yCenter, xApprove, xFinal, finalColor, finalLabel,
}: {
  yCenter: number; xApprove: number; xFinal: number; finalColor: string; finalLabel: string;
}) {
  const approvalColor = STEP_COLORS[RequisitionStatus.PendingApproval].active;
  return (
    <>
      <PositionedStep x={`${xApprove}%`} y={yCenter} label="Tasdiqlash" labelColor="var(--text3)" labelWeight={500}>
        <ChildCircle state="pending" n={4} color={approvalColor} />
      </PositionedStep>
      <PositionedStep x={`${xFinal}%`} y={yCenter} label={finalLabel} labelColor="var(--text3)" labelWeight={500}>
        <ChildCircle state="pending" n={5} color={finalColor} />
      </PositionedStep>
    </>
  );
}
