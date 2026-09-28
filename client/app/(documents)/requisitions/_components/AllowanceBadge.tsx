"use client";

import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

export function AllowanceBadge({ percent }: { percent?: number | null }) {
  const t = useT();
  if (!percent) return null;

  return (
    <span
      title={t("Miqdorlarga me'yoriy sarfdan tashqari zaxira qo'shilgan")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px",
        background: "var(--warn-dim)", color: "var(--warn)", border: "1px solid var(--warn)",
        borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)" }}>+{fmtDecimal(percent)}%</span>
      {t("zaxira")}
    </span>
  );
}
