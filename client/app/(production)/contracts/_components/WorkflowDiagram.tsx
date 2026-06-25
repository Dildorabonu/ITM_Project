import { ContractStatus, ContractProductStatus, StageStatus, StageType, type ProductStage, type ContractProductResponse } from "@/lib/userService";
import {
  WORKFLOW_STEPS, STEP_COLORS,
  PRODUCT_WORKFLOW_STEPS,
  STAGE_TYPE_META,
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
            <ProductWorkflowRow key={p.id} index={i + 1} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// Canonical stage order for the contract aggregate: every product starts from
// the same chosen workflow, but we union by orderIndex to stay correct even if
// a product later overrides its own stage set.
function buildStageSequence(products: ContractProductResponse[]): StageType[] {
  const minOrder = new Map<StageType, number>();
  for (const p of products)
    for (const s of p.stages ?? []) {
      const cur = minOrder.get(s.stageType);
      if (cur === undefined || s.orderIndex < cur) minOrder.set(s.stageType, s.orderIndex);
    }
  return [...minOrder.entries()].sort((a, b) => a[1] - b[1]).map(([st]) => st);
}

// Contract aggregate stepper, driven by the contract's ACTUAL chosen stage order
// (e.g. Me'yor → Chizma → Tex jarayon → Vazifalar) instead of the fixed legacy
// status flow. The first not-yet-finished stage is the one that "lights up".
function ContractWorkflowRow({ status, products }: { status: ContractStatus; products: ContractProductResponse[] }) {
  const seq = buildStageSequence(products);

  // Legacy contracts created before dynamic stages carry no stage rows — fall
  // back to the fixed status stepper.
  if (seq.length === 0) return <LegacyContractWorkflowRow status={status} products={products} />;

  // Aggregate each stage across all products: Done only when every product that
  // includes it is Done; "active" (the bottleneck) when any product is on it.
  const aggOf = (st: StageType): StageStatus => {
    const rows = products
      .map(p => (p.stages ?? []).find(s => s.stageType === st))
      .filter((s): s is ProductStage => !!s);
    if (rows.length === 0) return StageStatus.Done;
    if (rows.every(s => s.status === StageStatus.Done)) return StageStatus.Done;
    if (rows.some(s => s.status === StageStatus.InProgress)) return StageStatus.InProgress;
    return StageStatus.Pending;
  };

  const aggs = seq.map(aggOf);
  const firstUnfinished = aggs.findIndex(a => a !== StageStatus.Done);
  const allDone = firstUnfinished < 0;
  const activeIdx = allDone ? seq.length : firstUnfinished;
  const activeColor = allDone ? "#1a56db" : STAGE_TYPE_META[seq[activeIdx]].active;

  const summary = allDone
    ? "Barcha bosqichlar yakunlandi"
    : products.length > 1
      ? `${products.length} mahsulot · ${seq
          .map(st => ({ count: products.filter(p => p.currentStage === st).length, label: STAGE_TYPE_META[st].shortLabel }))
          .filter(x => x.count > 0)
          .map(x => `${x.count} ta ${x.label}`)
          .join(", ")}`
      : STAGE_TYPE_META[seq[activeIdx]].label;

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: 16,
        left: `${50 / seq.length}%`,
        right: `${50 / seq.length}%`,
        height: 2, background: "var(--border)", zIndex: 0,
      }} />
      {activeIdx > 0 && (
        <div style={{
          position: "absolute", top: 16,
          left: `${50 / seq.length}%`,
          width: `${activeIdx * 100 / seq.length}%`,
          height: 2, background: activeColor, zIndex: 0, transition: "width 0.4s",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        {seq.map((st, idx) => {
          const meta = STAGE_TYPE_META[st];
          const isDone = idx < activeIdx;
          const isActive = idx === activeIdx;
          const isReached = idx <= activeIdx;
          const productsHere = products.filter(p => p.currentStage === st);
          return (
            <div key={st} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: isReached ? meta.active : "var(--bg3)",
                border: `2px solid ${isReached ? meta.active : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isActive ? `0 0 0 4px ${meta.active}33` : "none",
                transition: "all 0.3s",
              }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.text} strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isReached ? meta.text : "var(--text3)" }}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                color: isActive ? meta.active : isReached ? "var(--text2)" : "var(--text3)",
                maxWidth: 72,
              }}>
                {meta.shortLabel}
              </span>
              {products.length > 1 && productsHere.length > 0 && (
                <div style={{ display: "flex", gap: 3, alignItems: "center", marginTop: 2 }}>
                  {productsHere.slice(0, 4).map(p => (
                    <div key={p.id} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: meta.active,
                    }} />
                  ))}
                  {productsHere.length > 4 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: meta.active, fontFamily: "var(--font-mono)" }}>
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
        background: `${activeColor}14`,
        border: `1.5px solid ${activeColor}44`,
        fontSize: 13, fontWeight: 600, color: activeColor,
        textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {summary}
      </div>
    </div>
  );
}

function LegacyContractWorkflowRow({ status, products }: { status: ContractStatus; products: ContractProductResponse[] }) {
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

// Renders the product's OWN dynamic stage list (which may differ per product —
// e.g. a "Chizmasiz" workflow has no Drawing stage). Each enabled stage is a dot;
// done = filled, in-progress = ringed. Falls back to the status badge if a legacy
// product has no stage rows yet.
function ProductWorkflowRow({ index, product }: { index: number; product: ContractProductResponse }) {
  const name = product.productType;
  const stages = [...(product.stages ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  const allDone = stages.length > 0 && stages.every(s => s.status === StageStatus.Done);
  const current = stages.find(s => s.status === StageStatus.InProgress);
  const currentMeta = current ? STAGE_TYPE_META[current.stageType] : null;
  const stageLabel = allDone ? "Yakunlandi" : currentMeta?.shortLabel ?? "—";
  const labelCol = allDone ? "#1a56db" : currentMeta?.active ?? "#64748b";

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
          {stages.map((s, idx) => {
            const meta = STAGE_TYPE_META[s.stageType];
            const isDone = s.status === StageStatus.Done;
            const isActive = s.status === StageStatus.InProgress;
            const filled = isDone || isActive;
            return (
              <div key={s.stageType} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div title={meta.label} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: filled ? meta.active : "var(--bg2)",
                  border: `1.5px solid ${filled ? meta.active : "var(--border)"}`,
                  boxShadow: isActive ? `0 0 0 3px ${meta.active}33` : "none",
                  transition: "all 0.2s",
                }} />
                {idx < stages.length - 1 && (
                  <div style={{
                    width: 14, height: 1.5,
                    background: isDone ? meta.active : "var(--border)",
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
          background: `${labelCol}14`, color: labelCol,
          border: `1px solid ${labelCol}44`,
          whiteSpace: "nowrap",
        }}>
          {stageLabel}
        </span>
      </div>
    </div>
  );
}
