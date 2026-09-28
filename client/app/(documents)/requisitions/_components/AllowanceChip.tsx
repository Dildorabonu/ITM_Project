"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { requisitionAllowanceService } from "@/lib/requisitionAllowance";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";
import { AllowanceModal } from "./AllowanceModal";

export function AllowanceChip() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canEdit = hasPermission("RequisitionAllowance.Update");

  const [percent, setPercent] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const load = () =>
    requisitionAllowanceService.getAll()
      .then(rates => setPercent(rates[0]?.percent ?? 0))
      .catch(() => setPercent(null));

  useEffect(() => { load(); }, []);

  if (percent === null) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("Talabnoma zaxirasi")}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600,
          borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)",
          color: "var(--text2)", cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
        {t("Zaxira")}:
        <span style={{ fontFamily: "var(--font-mono)" }}>{fmtDecimal(percent)}%</span>
      </button>

      {open && createPortal(
        <AllowanceModal canEdit={canEdit} onClose={() => setOpen(false)} onSaved={load} />,
        document.body,
      )}
    </>
  );
}
