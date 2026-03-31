"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { contractService, ContractResponse, ContractStatus, Priority, PRIORITY_LABELS } from "@/lib/userService";

const STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:     "s-gray",
  [ContractStatus.Active]:    "s-blue",
  [ContractStatus.Completed]: "s-green",
  [ContractStatus.Cancelled]: "s-danger",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:     "Qoralama",
  [ContractStatus.Active]:    "Faol",
  [ContractStatus.Completed]: "Yakunlandi",
  [ContractStatus.Cancelled]: "Bekor qilindi",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.Low]:    "s-gray",
  [Priority.Medium]: "s-warn",
  [Priority.High]:   "s-danger",
  [Priority.Urgent]: "s-danger",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ContractCard({ contract }: { contract: ContractResponse }) {
  return (
    <div
      className="itm-card"
      style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
    >
      <div className="itm-card-header" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
            #{contract.contractNo}
          </div>
          <div className="itm-card-title" style={{ fontSize: 15 }}>
            {contract.contractParty}
          </div>
        </div>
        <span className={`status ${STATUS_COLORS[contract.status]}`}>
          {STATUS_LABELS[contract.status]}
        </span>
      </div>

      <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Mahsulot */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Mahsulot</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{contract.productType}</span>
        </div>

        {/* Miqdor */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Ishlab chiqarish</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            {contract.quantity.toLocaleString()} {contract.unit}
          </span>
        </div>

        {/* Ustuvorlik */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Ustuvorlik</span>
          <span className={`status ${PRIORITY_COLORS[contract.priority]}`} style={{ fontSize: 11 }}>
            {PRIORITY_LABELS[contract.priority]}
          </span>
        </div>

        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

        {/* Sanalar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Imzolangan</span>
            <span className="mono" style={{ fontSize: 12 }}>{formatDate(contract.startDate)}</span>
          </div>
          <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Tugash muddati</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--danger)" }}>{formatDate(contract.endDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission("Tasks.View")) return;
    contractService.getMyProductionTasks().then(data => {
      setContracts(data);
      setLoading(false);
    });
  }, [hasPermission]);

  if (!hasPermission("Tasks.View")) {
    return (
      <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
        Bu sahifaga kirish huquqingiz yo&apos;q.
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Vazifalar</div>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          Sizga biriktirilgan ishlab chiqarish shartnomalar
        </span>
      </div>

      {loading ? (
        <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
          Yuklanmoqda...
        </div>
      ) : contracts.length === 0 ? (
        <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
          <svg width="40" height="40" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
            <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M5 4h2v2h10V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
            <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <div>Sizga biriktirilgan shartnoma topilmadi.</div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 14,
          }}
        >
          {contracts.map(c => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </>
  );
}
