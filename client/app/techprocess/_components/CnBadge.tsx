import { DrawingStatus, DRAWING_STATUS_LABELS } from "@/lib/userService";
import { CN_STATUS_STYLE } from "../_types";

export function CnBadge({ status }: { status: DrawingStatus }) {
  const s = CN_STATUS_STYLE[status] ?? CN_STATUS_STYLE[DrawingStatus.Draft];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:s.bg,color:s.color,border:`1px solid ${s.border}` }}>
      {DRAWING_STATUS_LABELS[status] ?? "Noma'lum"}
    </span>
  );
}
