"use client";

import { useState } from "react";

type Task = { id: string; name: string; dept: string; time: string; done: boolean };

const initHigh: Task[] = [
  { id: "t1", name: "SH-047 uchun bolt zakaz tasdiqlash",  dept: "Xarid bo'limi",   time: "09:00", done: false },
  { id: "t2", name: "Metall qabul qilish (A omboridan)",   dept: "Ombor",           time: "08:00", done: true },
  { id: "t3", name: "Yetkazib beruvchi bilan muzokaralar", dept: "Boshqaruv",       time: "14:00", done: false },
  { id: "t4", name: "SH-043 muddati tekshiruvi",           dept: "Ishlab chiqarish",time: "11:00", done: false },
];
const initMid: Task[] = [
  { id: "t5", name: "Ombor inventarizatsiyasi", dept: "", time: "09:30", done: true },
  { id: "t6", name: "OTK — SH-045 tekshiruv",  dept: "", time: "10:30", done: true },
  { id: "t7", name: "Iyun oyi hisoboti",        dept: "", time: "16:00", done: false },
];
const initLow: Task[] = [
  { id: "t8", name: "Bug'alteriyaga hujjat topshirish", dept: "", time: "17:00", done: false },
  { id: "t9", name: "Xona tozaligi nazorati",           dept: "", time: "17:30", done: false },
];

function TaskList({ tasks, onToggle, priority }: { tasks: Task[]; onToggle: (id: string) => void; priority: string }) {
  return (
    <div>
      {tasks.map(t => (
        <div key={t.id} className={`task-item${t.done ? " done" : ""}`}>
          <div className={`chk${t.done ? " checked" : ""}`} onClick={() => onToggle(t.id)} />
          <div style={{ flex: 1 }}>
            <div className="task-name">{t.name}</div>
            {t.dept && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{t.dept} · {t.time}</div>}
            {!t.dept && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{t.time}</div>}
          </div>
          <span className={`prio ${priority}`}><span className="prio-dot" />{priority === "p-high" ? "Yuqori" : priority === "p-mid" ? "O'rta" : "Past"}</span>
        </div>
      ))}
    </div>
  );
}

export default function TasksPage() {
  const [high, setHigh] = useState(initHigh);
  const [mid,  setMid]  = useState(initMid);
  const [low,  setLow]  = useState(initLow);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Task[]>>, id: string) =>
    setter(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const all = [...high, ...mid, ...low];
  const done = all.filter(t => t.done).length;
  const pct  = Math.round((done / all.length) * 100);

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Kunlik Vazifalar</div>
        <span className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>18 Mart 2026, Chorshanba</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 150 }}>
            <option>Barcha bo&apos;limlar</option>
            <option>Ishlab chiqarish</option>
            <option>Yig&apos;ish</option>
            <option>Ombor</option>
          </select>
          <button className="btn btn-primary">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Vazifa qo&apos;shish
          </button>
        </div>
      </div>

      <div className="two-col">
        {/* High priority */}
        <div className="itm-card">
          <div className="itm-card-header">
            <span className="status s-danger">Yuqori ustuvorlik</span>
            <span className="itm-card-subtitle">{high.length} ta</span>
          </div>
          <TaskList tasks={high} onToggle={id => toggle(setHigh, id)} priority="p-high" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Mid */}
          <div className="itm-card">
            <div className="itm-card-header">
              <span className="status s-warn">O&apos;rta ustuvorlik</span>
              <span className="itm-card-subtitle">{mid.length} ta</span>
            </div>
            <TaskList tasks={mid} onToggle={id => toggle(setMid, id)} priority="p-mid" />
          </div>
          {/* Low */}
          <div className="itm-card">
            <div className="itm-card-header">
              <span className="status s-gray">Past ustuvorlik</span>
              <span className="itm-card-subtitle">{low.length} ta</span>
            </div>
            <TaskList tasks={low} onToggle={id => toggle(setLow, id)} priority="p-low" />
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-green">
            <svg width="14" height="14" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <span className="itm-card-title">Kun Yakunlash</span>
          <span className="itm-card-subtitle">{done}/{all.length} bajarildi</span>
        </div>
        <div className="itm-card-body" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div className="progress-wrap" style={{ marginBottom: 6 }}>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill pf-blue" style={{ width: `${pct}%` }} />
              </div>
              <span className="progress-pct" style={{ color: "var(--accent)", fontWeight: 700 }}>{pct}%</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
              {done} ta bajarildi · {all.length - done} ta qoldi
            </div>
          </div>
          <button className="btn btn-primary">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
            Kun yakunlash
          </button>
        </div>
      </div>
    </>
  );
}
