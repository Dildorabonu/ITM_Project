"use client";

import { useState } from "react";

type Dept = { num: string; name: string; head: string; count: number; status: string; statusLabel: string };

const initial: Dept[] = [
  { num: "01", name: "Ishlab chiqarish", head: "Akbar Karimov",  count: 8, status: "s-ok",   statusLabel: "Aktiv" },
  { num: "02", name: "Yig'ish sexi",     head: "Nilufar Rahimova",count: 6, status: "s-ok",   statusLabel: "Aktiv" },
  { num: "03", name: "Ombor",            head: "Jasur Umarov",   count: 4, status: "s-ok",   statusLabel: "Aktiv" },
  { num: "04", name: "Sifat nazorat",    head: "—",              count: 3, status: "s-warn",  statusLabel: "Boshligsiz" },
  { num: "05", name: "Boshqaruv",        head: "Sarvar Mirzayev",count: 2, status: "s-ok",   statusLabel: "Aktiv" },
];

export default function DepartmentsPage() {
  const [depts] = useState(initial);

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Bo&apos;limlar</div>
        <div className="search-wrap" style={{ maxWidth: 260 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Qidirish..." />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yangi Bo&apos;lim
        </button>
      </div>

      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-blue">
            <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          </div>
          <span className="itm-card-title">Bo&apos;limlar Ro&apos;yxati</span>
          <span className="itm-card-subtitle">{depts.length} ta bo&apos;lim</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr><th>#</th><th>Bo&apos;lim nomi</th><th>Bo&apos;lim boshlig&apos;i</th><th>Xodimlar</th><th>Holat</th><th>Amal</th></tr>
            </thead>
            <tbody>
              {depts.map(d => (
                <tr key={d.num}>
                  <td className="mono" style={{ color: "var(--text3)", fontSize: 11 }}>{d.num}</td>
                  <td><strong>{d.name}</strong></td>
                  <td style={{ color: "var(--text2)" }}>{d.head}</td>
                  <td className="mono" style={{ color: "var(--text3)", fontSize: 12 }}>{d.count}</td>
                  <td><span className={`status ${d.status}`}>{d.statusLabel}</span></td>
                  <td><button className="btn btn-sm btn-outline">Tahrirlash</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
