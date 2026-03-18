"use client";

import { useState } from "react";

type Notif = {
  id: string; type: "blue" | "warn" | "danger" | "green";
  title: string; body: string; ts: string; from: string; unread: boolean;
};

const initial: Notif[] = [
  { id: "ni1", type: "blue",   title: "📦 Yig'ish sexiga: M4×20 bolt yetib keldi",          body: "2 500 ta M4×20 bolt \"Metiz Toshkent\" yetkazib beruvchidan qabul qilindi. SH-2025-047 shartnomasi uchun yetarli.",   ts: "Bugun · 11:42", from: "Ombor xizmati",          unread: true },
  { id: "ni2", type: "warn",   title: "⚠️ Ishlab chiqarish: Qora metall list kritik",        body: "Qora metall list 2mm miqdori 200 kg ga tushdi (min: 500 kg). SH-2025-047 uchun 850 kg kerak. Darhol zakaz bering.", ts: "Bugun · 09:15", from: "Tizim avtomatik",         unread: true },
  { id: "ni3", type: "danger", title: "🚨 Barcha bo'limlar: Gruntovka R-7 zaxirasi kam",     body: "Gruntovka R-7 80 litr qoldi. Ishlab chiqarish, Yig'ish va Boyash bo'limlari ta'sirlangan.",                         ts: "Bugun · 08:30", from: "Ombor menejeri",         unread: true },
  { id: "ni4", type: "blue",   title: "📋 Tex protsess tasdiqlash kutilmoqda",               body: "SH-2025-047 uchun tex protsess tuzildi. Bo'lim boshlig'i tasdiqini kuting.",                                        ts: "Bugun · 08:00", from: "Ishlab chiqarish bo'limi",unread: true },
  { id: "ni5", type: "green",  title: "✅ SH-2025-044 muvaffaqiyatli yakunlandi",            body: "NovoProm OOO bilan 300 ta yog'och buyum shartnomasi yakunlandi. Hujjatlar bug'alteriyaga topshirildi.",             ts: "Kecha · 17:30", from: "Bo'lim boshlig'i",        unread: false },
  { id: "ni6", type: "warn",   title: "⏰ SH-2025-043 — 65 kun qoldi",                      body: "EnergoTex uchun 5 000 m elektr kabeli shartnomasi muddati 20 Avgust 2025. Jadval tekshirilsin.",                    ts: "30.05.2025 · 10:00", from: "Tizim",               unread: false },
];

const dotColor: Record<string, string> = { blue: "nd-blue", warn: "nd-warn", danger: "nd-danger", green: "nd-green" };
const itemClass: Record<string, string> = { warn: "ni-warn", danger: "ni-danger", blue: "", green: "" };

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));

  const markAllRead = () =>
    setNotifs(prev => prev.map(n => ({ ...n, unread: false })));

  const visible = filter === "unread" ? notifs.filter(n => n.unread) : notifs;
  const unreadCount = notifs.filter(n => n.unread).length;

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Bildirishnomalar</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter("all")}
          >
            Barchasi ({notifs.length})
          </button>
          <button
            className={`btn btn-sm ${filter === "unread" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter("unread")}
          >
            O&apos;qilmagan ({unreadCount})
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={markAllRead}>
          Barchasini o&apos;qilgan qilish
        </button>
      </div>

      <div className="notif-list">
        {visible.map(n => (
          <div key={n.id} className={`notif-item ${n.unread ? "unread" : ""} ${itemClass[n.type]}`}>
            <div className={`notif-dot ${dotColor[n.type]}`} />
            <div style={{ flex: 1 }}>
              <div className="notif-title">{n.title}</div>
              <div className="notif-body">{n.body}</div>
              <div className="notif-ts">{n.ts} · {n.from}</div>
            </div>
            {n.unread && (
              <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                ✓ O&apos;qildi
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
