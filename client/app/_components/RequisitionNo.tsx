"use client";

import type { CSSProperties } from "react";
import { RequisitionSource } from "@/lib/userService";
import { REQUISITION_SOURCE_SHORT_LABEL, splitRequisitionNo } from "@/lib/requisitionNo";
import { useT } from "@/lib/i18n";

interface Props {
  no: string;
  /** Yonida allaqachon manba badge'i bo'lsa — suffiks takrorlanmaydi. */
  hideSourceTag?: boolean;
  style?: CSSProperties;
}

// Talabnoma raqamini ko'rsatadi: bo'lingan talabnomadagi "-W"/"-P" texnik suffiksi
// o'rniga foydalanuvchi tilidagi kichik yorliq chiqadi.
export function RequisitionNo({ no, hideSourceTag, style }: Props) {
  const t = useT();
  const { base, source } = splitRequisitionNo(no);
  const isWh = source === RequisitionSource.Warehouse;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, ...style }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{base}</span>
      {source !== null && !hideSourceTag && (
        <span style={{
          flexShrink: 0,
          padding: "1px 7px", borderRadius: 20,
          fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
          fontFamily: "var(--font-inter)",
          background: isWh ? "var(--success-dim)" : "var(--accent-dim)",
          color: isWh ? "var(--success)" : "var(--accent)",
          border: `1px solid ${isWh ? "rgba(15,123,69,0.25)" : "rgba(26,110,235,0.3)"}`,
          whiteSpace: "nowrap",
        }}>
          {t(REQUISITION_SOURCE_SHORT_LABEL[source])}
        </span>
      )}
    </span>
  );
}
