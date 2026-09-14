import { ContractStatus, ContractProductStatus, ContractType, CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/userService";
import { STATUS_STYLE, CONTRACT_TYPE_STYLE } from "../_types";
import { useT } from "@/lib/i18n";

interface StatusBadgeProps {
  status: ContractStatus;
  // When provided, the badge groups products by their per-product stage so
  // mixed contracts surface every stage instead of hiding behind the earliest.
  products?: { status: ContractProductStatus }[];
}

// Non-uniform progress weights: drawing/tech are prep, production is the bulk
// of the work. Reaching production gives a big jump (10 → 50) so the bar
// reflects that "we're now in the heart of manufacturing".
const STAGE_PROGRESS: Record<ContractProductStatus, number> = {
  [ContractProductStatus.DrawingPending]: 0,
  [ContractProductStatus.TechProcessing]: 10,
  [ContractProductStatus.InProduction]:   50,
  [ContractProductStatus.Completed]:      100,
  [ContractProductStatus.Cancelled]:      0,
};

export function StatusBadge({ status, products }: StatusBadgeProps) {
  const t = useT();
  // Cancelled is a terminal lifecycle state — render the contract-level pill
  // unchanged; product distribution doesn't apply.
  if (status === ContractStatus.Cancelled) {
    const s = STATUS_STYLE[status];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 10px", borderRadius: 999,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {t(CONTRACT_STATUS_LABELS[status])}
      </span>
    );
  }

  const active = (products ?? []).filter(p => p.status !== ContractProductStatus.Cancelled);
  const percent = active.length === 0
    ? 0
    : Math.round(
        active.reduce((sum, p) => sum + STAGE_PROGRESS[p.status], 0) / active.length
      );

  // Bu badge endi bosqichni emas, umumiy progressni ko'rsatadi — shuning uchun
  // bosqich ranglari o'rniga progress shkalasi: boshlanmagan kulrang, past
  // qismi sariq (ogohlantirish), yarmidan oshgani accent, tugagani yashil.
  const style =
    percent >= 100 ? { bg: "var(--success-dim)", color: "var(--success)", border: "var(--success)" } :
    percent >= 50  ? { bg: "var(--accent-dim)",  color: "var(--accent)",  border: "var(--accent)"  } :
    percent > 0    ? { bg: "var(--warn-dim)",    color: "var(--warn)",    border: "var(--warn)"    } :
                     { bg: "var(--surface2)",    color: "var(--text3)",   border: "var(--border2)" };

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "3px 10px", borderRadius: 999,
      background: style.bg, border: `1px solid ${style.border}`,
      width: 150, maxWidth: "100%",
    }}>
      <div style={{
        flex: 1, height: 5, borderRadius: 999,
        background: `color-mix(in srgb, ${style.color} 16%, transparent)`, overflow: "hidden",
      }}>
        <div style={{
          width: `${percent}%`, height: "100%",
          background: style.color, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
        color: style.color, flexShrink: 0, minWidth: 30, textAlign: "right",
      }}>
        {percent}%
      </span>
    </div>
  );
}

export function ContractTypeBadge({ contractType }: { contractType: ContractType }) {
  const t = useT();
  const s = CONTRACT_TYPE_STYLE[contractType];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {t(CONTRACT_TYPE_LABELS[contractType])}
    </span>
  );
}
