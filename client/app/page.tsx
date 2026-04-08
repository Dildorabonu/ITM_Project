"use client";

import Link from "next/link";
import { useState } from "react";

const contracts = [
  { id: "SH-2025-047", client: "Toshmetov Zavodi", product: "Metall konstruktsiya", status: "s-warn", statusLabel: "Tekshiruv" },
  { id: "SH-2025-046", client: "UzTexnik LLC",    product: "Plastik qoplama",      status: "s-ok",   statusLabel: "Tasdiqlandi" },
  { id: "SH-2025-045", client: "AlmaZavod JSC",   product: "Kimyoviy eritma",      status: "s-blue", statusLabel: "Ishlab chiqarish" },
  { id: "SH-2025-044", client: "NovoProm OOO",    product: "Yog'och buyum",        status: "s-gray", statusLabel: "Yakunlandi" },
];

type TaskId = "dt1" | "dt2" | "dt3" | "dt4" | "dt5";
const initialTasks: { id: TaskId; name: string; priority: string; pClass: string; time: string; done: boolean }[] = [
  { id: "dt1", name: "Ombor inventarizatsiyasi (A sektor)",  priority: "Yuqori", pClass: "p-high", time: "09:00", done: true },
  { id: "dt2", name: "SH-045 mahsulot tekshiruvi",           priority: "O'rta",  pClass: "p-mid",  time: "10:30", done: true },
  { id: "dt3", name: "Yetkazib beruvchi bilan muzokaralar",  priority: "Yuqori", pClass: "p-high", time: "14:00", done: false },
  { id: "dt4", name: "Hisobot tuzish — iyun oyi",            priority: "Past",   pClass: "p-low",  time: "16:00", done: false },
  { id: "dt5", name: "Bug'alteriyaga hujjat topshirish",     priority: "O'rta",  pClass: "p-mid",  time: "17:00", done: false },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState(initialTasks);

  const toggle = (id: TaskId) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  return (
    <>
      {/* Welcome banner */}
      <div className="blue-header">
        <div className="font-head-itm" style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase", marginBottom: 4 }}>
          18 Mart 2026, Chorshanba
        </div>
        <div className="font-head-itm" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>
          Xush kelibsiz, Akbar! 👋
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
          Bugun 18 ta vazifa, 3 ta deficit holatlar mavjud.
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <Link href="/contracts" style={{ textDecoration: "none" }}>
          <div className="stat-card blue">
            <div className="stat-label">Faol shartnomalar</div>
            <div className="stat-value">24</div>
            <div className="stat-meta">Jami 31 ta shartnoma</div>
            <div className="stat-delta up">↑ 3 bu oy</div>
          </div>
        </Link>
        <Link href="/deficit" style={{ textDecoration: "none" }}>
          <div className="stat-card warn">
            <div className="stat-label">Deficit holatlar</div>
            <div className="stat-value">7</div>
            <div className="stat-meta">3 ta ta&apos;minot kutilmoqda</div>
            <div className="stat-delta dn">↑ 2 yangi</div>
          </div>
        </Link>
        <Link href="/tasks" style={{ textDecoration: "none" }}>
          <div className="stat-card green">
            <div className="stat-label">Bugungi vazifalar</div>
            <div className="stat-value">18</div>
            <div className="stat-meta">12 ta bajarildi</div>
            <div className="stat-delta up">67% ijro</div>
          </div>
        </Link>
        <Link href="/contracts" style={{ textDecoration: "none" }}>
          <div className="stat-card danger">
            <div className="stat-label">Muddati o&apos;tgan</div>
            <div className="stat-value">3</div>
            <div className="stat-meta">Shoshillinch ko&apos;rib chiqish</div>
            <div className="stat-delta dn">Diqqat talab</div>
          </div>
        </Link>
      </div>

      {/* Two cols */}
      <div className="two-col">
        {/* Recent contracts */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            </div>
            <span className="itm-card-title">So&apos;nggi Shartnomalar</span>
            <Link href="/contracts" className="itm-card-link">BARCHASI →</Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr><th>Raqam</th><th>Mijoz</th><th>Mahsulot</th><th>Holat</th></tr>
              </thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{ color: "var(--accent)" }}>{c.id}</td>
                    <td>{c.client}</td>
                    <td>{c.product}</td>
                    <td><span className={`status ${c.status}`}>{c.statusLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's tasks */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <span className="itm-card-title">Bugungi Vazifalar</span>
            <Link href="/tasks" className="itm-card-link">BARCHASI →</Link>
          </div>
          <div>
            {tasks.map(t => (
              <div key={t.id} className={`task-item${t.done ? " done" : ""}`}>
                <div
                  className={`chk${t.done ? " checked" : ""}`}
                  onClick={() => toggle(t.id as TaskId)}
                />
                <span className="task-name">{t.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`prio ${t.pClass}`}><span className="prio-dot" />{t.priority}</span>
                  <span className="task-time">{t.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-blue">
            <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <span className="itm-card-title">Oxirgi Bildirishnomalar</span>
          <Link href="/notifications" className="itm-card-link">BARCHASI →</Link>
        </div>
        <div className="itm-card-body">
          <div className="notif-list">
            <div className="notif-item unread">
              <div className="notif-dot nd-blue" />
              <div>
                <div className="notif-title">📦 Yig&apos;ish sexiga: M4×20 bolt yetib keldi</div>
                <div className="notif-body">2 500 ta M4×20 bolt qabul qilindi. SH-2025-047 uchun yetarli.</div>
                <div className="notif-ts">Bugun · 11:42</div>
              </div>
            </div>
            <div className="notif-item ni-warn">
              <div className="notif-dot nd-warn" />
              <div>
                <div className="notif-title">⚠️ Ishlab chiqarish: Qora metall list kritik</div>
                <div className="notif-body">Qora metall list 200 kg ga tushdi. Darhol zakaz bering.</div>
                <div className="notif-ts">Bugun · 09:15</div>
              </div>
            </div>
            <div className="notif-item">
              <div className="notif-dot nd-green" />
              <div>
                <div className="notif-title">✅ SH-2025-044 yakunlandi</div>
                <div className="notif-body">NovoProm OOO shartnomasi muvaffaqiyatli yakunlandi.</div>
                <div className="notif-ts">Kecha · 17:30</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
