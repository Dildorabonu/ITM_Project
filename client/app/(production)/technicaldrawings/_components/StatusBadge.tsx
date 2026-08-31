import { DrawingStatus, DRAWING_STATUS_LABELS } from "@/lib/userService";
import { useT } from "@/lib/i18n";
import { STATUS_STYLE } from "../_types";

export function StatusBadge({ status, className }: { status: DrawingStatus; className?: string }) {
  const t = useT();
  const style = STATUS_STYLE[status];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 12px",
        minWidth: 120,
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {t(DRAWING_STATUS_LABELS[status])}
    </span>
  );
}
