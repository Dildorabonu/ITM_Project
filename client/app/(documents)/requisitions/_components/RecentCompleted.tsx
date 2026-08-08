"use client";

import { useEffect, useState } from "react";
import { requisitionService, type RequisitionResponse } from "@/lib/userService";
import { fmtRelativeDays, isRequisitionCompleted, isRequisitionRejected } from "../_types";
import { RequisitionStatusBadge } from "./StatusBadge";
import { useT } from "@/lib/i18n";

const WINDOW_DAYS = 7;

interface Props {
  /** Qator bosilganda ochiladigan drawer. */
  onOpen: (req: RequisitionResponse) => void;
  /** Qiymati o'zgarganda blok qayta yuklanadi (asosiy ro'yxat yangilanishi bilan birga). */
  reloadKey: number;
}

export function RecentCompleted({ onOpen, reloadKey }: Props) {
  const t = useT();
  const [items, setItems] = useState<RequisitionResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    requisitionService.getRecentCompleted(WINDOW_DAYS).then(list => {
      if (!cancelled) setItems(list);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (items.length === 0) return null;

  return (
    <div className="itm-card" style={{ marginTop: 8, padding: "10px 14px 12px", flexShrink: 0 }}>
      <p style={{
        fontSize: 10, fontWeight: 600, color: "var(--text3)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        {t("Yaqinda yakunlangan")} · {WINDOW_DAYS} {t("kun")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(r => {
          const rel = fmtRelativeDays(r.completedAt);
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 8px", border: "none", background: "transparent",
                borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left",
                color: "var(--text2)", fontSize: 13, transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.requisitionNo}
              </span>
              <span style={{ flexShrink: 0 }}>
                <RequisitionStatusBadge status={r.status} completed={isRequisitionCompleted(r)} rejected={isRequisitionRejected(r)} small />
              </span>
              <span style={{
                flexShrink: 0, minWidth: 92, textAlign: "right",
                fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)",
              }}>
                {rel.today ? t("bugun") : `${rel.days} ${t("kun oldin")}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
