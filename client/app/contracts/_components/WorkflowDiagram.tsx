import { ContractStatus, ContractProductStatus, type ContractProductResponse } from "@/lib/userService";
import {
  WORKFLOW_STEPS, STEP_COLORS,
  PRODUCT_WORKFLOW_STEPS, PRODUCT_STEP_COLORS,
} from "../_types";

interface Props {
  status: ContractStatus;
  products?: ContractProductResponse[];
}

// Top diagram = contract aggregate. When products are present, each one renders
// its own compact progress row below so users can see which item is at which
// stage instead of guessing from the contract-level rollup.
export function WorkflowDiagram({ status, products }: Props) {
  const visibleProducts = (products ?? []).filter(p => p.status !== ContractProductStatus.Cancelled);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>

      <ContractWorkflowRow status={status} products={visibleProducts} />

      {visibleProducts.length > 0 && (
        <div style={{ marginTop: 18, borderTop: "1px dashed var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Mahsulotlar bo&apos;yicha bosqichlar
          </div>
          {visibleProducts.map((p, i) => (
            <ProductWorkflowRow key={p.id} index={i + 1} name={p.productType} status={p.status} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractWorkflowRow({ status, products }: { status: ContractStatus; products: ContractProductResponse[] }) {
  // currentIdx = the contract's derived stage (backend = earliest active product).
  // For multi-product contracts the connecting line still fills to the FURTHEST
  // reached stage so users see overall forward motion; the "active" ring stays
  // on the bottleneck step where the slowest product is parked.
  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.status === status);
  const stageIdx = (s: ContractProductStatus) =>
    PRODUCT_WORKFLOW_STEPS.findIndex(step => step.status === s);
  const maxStageIdx = products.length > 0
    ? Math.max(...products.map(p => stageIdx(p.status)))
    : currentIdx;
  const fillIdx = Math.max(currentIdx, maxStageIdx);

  const summary = products.length > 1
    ? `${products.length} mahsulot · ${PRODUCT_WORKFLOW_STEPS
        .map(step => ({ count: products.filter(p => p.status === step.status).length, label: step.shortLabel }))
        .filter(x => x.count > 0)
        .map(x => `${x.count} ta ${x.label}`)
        .join(", ")}`
    : (WORKFLOW_STEPS[currentIdx]?.label ?? "—");

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: 16,
        left: `${50 / WORKFLOW_STEPS.length}%`,
        right: `${50 / WORKFLOW_STEPS.length}%`,
        height: 2, background: "var(--border)", zIndex: 0,
      }} />
      {fillIdx > 0 && (
        <div style={{
          position: "absolute", top: 16,
          left: `${50 / WORKFLOW_STEPS.length}%`,
          width: `${fillIdx * 100 / WORKFLOW_STEPS.length}%`,
          height: 2, background: STEP_COLORS[status].active, zIndex: 0, transition: "width 0.4s",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        {WORKFLOW_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isReached = idx <= maxStageIdx;
          const col = STEP_COLORS[step.status];
          const productsHere = products.filter(p => stageIdx(p.status) === idx);
          return (
            <div key={step.status} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: isReached ? col.active : "var(--bg3)",
                border: `2px solid ${isReached ? col.active : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isActive ? `0 0 0 4px ${col.active}33` : "none",
                transition: "all 0.3s",
              }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col.text} strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isReached ? col.text : "var(--text3)" }}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                color: isActive ? col.active : isReached ? "var(--text2)" : "var(--text3)",
                maxWidth: 72,
              }}>
                {step.shortLabel}
              </span>
              {products.length > 1 && productsHere.length > 0 && (
                <div style={{ display: "flex", gap: 3, alignItems: "center", marginTop: 2 }}>
                  {productsHere.slice(0, 4).map(p => (
                    <div key={p.id} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: col.active,
                    }} />
                  ))}
                  {productsHere.length > 4 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: col.active, fontFamily: "var(--font-mono)" }}>
                      +{productsHere.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 14, padding: "8px 14px", borderRadius: 8,
        background: `${STEP_COLORS[status].active}14`,
        border: `1.5px solid ${STEP_COLORS[status].active}44`,
        fontSize: 13, fontWeight: 600, color: STEP_COLORS[status].active,
        textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {summary}
      </div>
    </div>
  );
}

function ProductWorkflowRow({ index, name, status }: { index: number; name: string; status: ContractProductStatus }) {
  const currentIdx = PRODUCT_WORKFLOW_STEPS.findIndex(s => s.status === status);
  const col = PRODUCT_STEP_COLORS[status];
  const stageLabel = PRODUCT_WORKFLOW_STEPS[currentIdx]?.shortLabel ?? "—";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: 10, alignItems: "center",
      padding: "8px 12px", borderRadius: 10,
      background: "var(--bg3)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: "var(--accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700,
        }}>{index}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name || "—"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {PRODUCT_WORKFLOW_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            const dotCol = PRODUCT_STEP_COLORS[step.status];
            return (
              <div key={step.status} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: isDone || isActive ? dotCol.active : "var(--bg2)",
                  border: `1.5px solid ${isDone || isActive ? dotCol.active : "var(--border)"}`,
                  boxShadow: isActive ? `0 0 0 3px ${dotCol.active}33` : "none",
                  transition: "all 0.2s",
                }} />
                {idx < PRODUCT_WORKFLOW_STEPS.length - 1 && (
                  <div style={{
                    width: 14, height: 1.5,
                    background: isDone ? dotCol.active : "var(--border)",
                    transition: "background 0.2s",
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 999,
          background: `${col.active}14`, color: col.active,
          border: `1px solid ${col.active}44`,
          whiteSpace: "nowrap",
        }}>
          {stageLabel}
        </span>
      </div>
    </div>
  );
}
