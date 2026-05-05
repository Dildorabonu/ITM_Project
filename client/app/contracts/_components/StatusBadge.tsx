import { ContractStatus, ContractProductStatus, Priority, CONTRACT_STATUS_LABELS, PRIORITY_LABELS, type ContractProductResponse } from "@/lib/userService";
import { STATUS_STYLE, PRIORITY_STYLE } from "../_types";

interface StatusBadgeProps {
  status: ContractStatus;
  // Optional product list lets the badge show how many products have already
  // reached the contract's current stage (e.g. "Tex jarayon · 2/3").
  products?: ContractProductResponse[];
}

export function StatusBadge({ status, products }: StatusBadgeProps) {
  const s = STATUS_STYLE[status];

  let counter: string | null = null;
  if (products && products.length > 0) {
    const active = products.filter(p => p.status !== ContractProductStatus.Cancelled);
    const total = active.length;
    if (total > 0) {
      const matching = active.filter(p => (p.status as number) >= (status as number)).length;
      counter = `${matching}/${total}`;
    }
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px",
      borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      maxWidth: "100%", overflow: "hidden",
    }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {CONTRACT_STATUS_LABELS[status]}
      </span>
      {counter && (
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
          padding: "1px 6px", borderRadius: 999,
          background: `${s.color}1f`, color: s.color, flexShrink: 0,
        }}>
          {counter}
        </span>
      )}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
