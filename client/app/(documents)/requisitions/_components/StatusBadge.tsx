import { RequisitionStatus, REQUISITION_STATUS_LABELS, STATUS_STYLE } from "../_types";

interface Props {
  status: RequisitionStatus;
  small?: boolean;
  completed?: boolean;
}

const COMPLETED_STYLE = { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" };

export function RequisitionStatusBadge({ status, small, completed }: Props) {
  const s = completed
    ? COMPLETED_STYLE
    : STATUS_STYLE[status] ?? { bg: "var(--bg3)", color: "var(--text2)", border: "var(--border)" };
  const label = completed ? "Yakunlangan" : REQUISITION_STATUS_LABELS[status] ?? status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: small ? "2px 8px" : "3px 10px",
      minWidth: small ? 150 : 160,
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}
