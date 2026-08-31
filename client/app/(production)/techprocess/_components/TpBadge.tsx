import { ProcessStatus, PROCESS_STATUS_LABELS } from "@/lib/userService";
import { useT } from "@/lib/i18n";
import { TP_STATUS_STYLE } from "../_types";

export function TpBadge({ status }: { status: ProcessStatus }) {
  const t = useT();
  const s = TP_STATUS_STYLE[status];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:s.bg,color:s.color,border:`1px solid ${s.border}` }}>
      {t(PROCESS_STATUS_LABELS[status])}
    </span>
  );
}
