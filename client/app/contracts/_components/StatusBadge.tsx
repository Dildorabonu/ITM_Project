import { ContractStatus, Priority, CONTRACT_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/userService";
import { STATUS_STYLE, PRIORITY_STYLE } from "../_types";

export function StatusBadge({ status }: { status: ContractStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      maxWidth: "100%", overflow: "hidden",
    }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {CONTRACT_STATUS_LABELS[status]}
      </span>
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
