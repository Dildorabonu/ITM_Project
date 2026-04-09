import { RequisitionStatus, REQUISITION_STATUS_LABELS, STATUS_STYLE } from "../_types";

interface Props {
  status: RequisitionStatus;
  small?: boolean;
}

export function RequisitionStatusBadge({ status, small }: Props) {
  const s = STATUS_STYLE[status] ?? { bg: "var(--bg3)", color: "var(--text2)", border: "var(--border)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "2px 8px" : "3px 10px",
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>
      {REQUISITION_STATUS_LABELS[status] ?? status}
    </span>
  );
}
