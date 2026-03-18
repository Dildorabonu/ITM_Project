"use client";

import Link from "next/link";

const contracts = [
  { id: "SH-2025-047", date: "02.06.2025", name: "Metall Konstruktsiya × 500",  client: "Toshmetov Zavodi", deadline: "31.08.2025", status: "s-warn",   statusLabel: "Tekshiruv",       priority: "p-high", priorityLabel: "Yuqori", selected: true },
  { id: "SH-2025-046", date: "28.05.2025", name: "Plastik Qoplama × 1 200",     client: "UzTexnik LLC",    deadline: "15.07.2025", status: "s-ok",     statusLabel: "Tasdiqlandi",     priority: "p-mid",  priorityLabel: "O'rta" },
  { id: "SH-2025-045", date: "20.05.2025", name: "Kimyoviy Eritma × 200 l",     client: "AlmaZavod JSC",   deadline: "30.06.2025", status: "s-blue",   statusLabel: "Ishlab chiqarish",priority: "p-mid",  priorityLabel: "O'rta" },
  { id: "SH-2025-044", date: "10.05.2025", name: "Yog'och Buyum × 300",         client: "NovoProm OOO",    deadline: "31.05.2025", status: "s-gray",   statusLabel: "Yakunlandi",      priority: "p-low",  priorityLabel: "Past" },
  { id: "SH-2025-043", date: "05.05.2025", name: "Elektr Kabeli × 5 000 m",     client: "EnergoTex",       deadline: "20.08.2025", status: "s-blue",   statusLabel: "Ishlab chiqarish",priority: "p-high", priorityLabel: "Yuqori" },
];

export default function ContractsPage() {
  return (
    <>
      <div className="page-header">
        <div className="ph-title">Shartnomalar</div>
        <div className="search-wrap" style={{ maxWidth: 300 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Qidirish..." />
        </div>
        <select className="form-select" style={{ width: 150 }}>
          <option>Barcha holat</option>
          <option>Tekshiruv</option>
          <option>Tasdiqlandi</option>
          <option>Ishlab chiqarish</option>
        </select>
        <Link href="/techprocess" className="btn btn-primary" style={{ marginLeft: "auto", textDecoration: "none" }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yangi Shartnoma
        </Link>
      </div>

      <div className="contracts-grid">
        {contracts.map(c => (
          <Link key={c.id} href="/techprocess" style={{ textDecoration: "none" }}>
            <div className={`contract-card${c.selected ? " selected" : ""}`}>
              <div className="contract-id">{c.id} · {c.date}</div>
              <div className="contract-name">{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
                Mijoz: <b>{c.client}</b> · Muddat: {c.deadline}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`status ${c.status}`}>{c.statusLabel}</span>
                <span className={`prio ${c.priority}`}><span className="prio-dot" />{c.priorityLabel}</span>
              </div>
            </div>
          </Link>
        ))}

        {/* Add new card */}
        <div className="contract-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, color: "var(--text3)", cursor: "pointer" }}>
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span className="mono" style={{ letterSpacing: 1 }}>YANGI QO&apos;SHISH</span>
        </div>
      </div>
    </>
  );
}
