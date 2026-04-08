import { DrawingStatus, DRAWING_STATUS_LABELS } from "@/lib/userService";
import { STATUS_STYLE } from "../_types";

export function StatusBadge({ status }: { status: DrawingStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {DRAWING_STATUS_LABELS[status]}
    </span>
  );
}
