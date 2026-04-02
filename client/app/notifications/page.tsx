"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";

type Notif = {
  id: string;
  type: "blue" | "warn" | "danger" | "green";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const typeMap: Record<number, "blue" | "warn" | "danger" | "green"> = {
  0: "blue",   // Info
  1: "warn",   // Warning
  2: "danger", // Alert
  3: "green",  // Task
};

const typeLabel: Record<string, string> = {
  blue: "Ma'lumot", warn: "Ogohlantirish", danger: "Muhim", green: "Vazifa",
};
const typeIcon: Record<string, string> = {
  blue: "📋", warn: "⚠️", danger: "🚨", green: "✅",
};

const dotColor: Record<string, string> = { blue: "nd-blue", warn: "nd-warn", danger: "nd-danger", green: "nd-green" };
const itemClass: Record<string, string> = { warn: "ni-warn", danger: "ni-danger", blue: "", green: "" };
const borderColor: Record<string, string> = { blue: "var(--accent)", warn: "var(--warn)", danger: "var(--danger)", green: "var(--success)" };

function formatTs(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Hozir";
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Bugun · ${time}`;
  if (isYesterday) return `Kecha · ${time}`;
  return `${d.toLocaleDateString("uz-UZ")} · ${time}`;
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notif | null>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.get("/api/notification");
      const data = res.data.result || [];
      setNotifs(
        data.map((n: any) => ({
          id: n.id,
          type: typeMap[n.type] ?? "blue",
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdAt: n.createdAt,
        }))
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const openDetail = async (n: Notif) => {
    setSelected(n);
    if (!n.isRead) {
      try {
        await api.put(`/api/notification/${n.id}/read`);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      } catch { /* ignore */ }
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/api/notification/read-all");
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const deleteNotif = async (id: string) => {
    try {
      await api.delete(`/api/notification/${id}`);
      setNotifs(prev => prev.filter(n => n.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* ignore */ }
  };

  const visible = filter === "unread" ? notifs.filter(n => !n.isRead) : notifs;
  const unreadCount = notifs.filter(n => !n.isRead).length;

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

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Yuklanmoqda...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
          {filter === "unread" ? "O'qilmagan bildirishnoma yo'q" : "Bildirishnomalar yo'q"}
        </div>
      ) : (
        <div className="notif-list">
          {visible.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.isRead ? "unread" : ""} ${itemClass[n.type]}`}
              style={{ cursor: "pointer" }}
              onClick={() => openDetail(n)}
            >
              <div className={`notif-dot ${dotColor[n.type]}`} />
              <div style={{ flex: 1 }}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="notif-ts">{formatTs(n.createdAt)}</div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                style={{ color: "var(--danger)", opacity: 0.7 }}
                title="O'chirish"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div
            className="modal-box"
            style={{ width: 520, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: borderColor[selected.type] }}>
              <span>{typeIcon[selected.type]} {typeLabel[selected.type]}</span>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Sarlavha</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{selected.title}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Batafsil</div>
                <div style={{
                  fontSize: 14, color: "var(--text2)", lineHeight: 1.6,
                  background: "var(--bg3, var(--surface2))", padding: "12px 14px",
                  borderRadius: "var(--radius)", border: "1px solid var(--border)",
                }}>
                  {selected.body}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Vaqt</div>
                  <div style={{ fontSize: 13, color: "var(--text2)" }}>{formatFullDate(selected.createdAt)}</div>
                </div>
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: selected.isRead ? "var(--surface2)" : "var(--accent-dim)",
                  color: selected.isRead ? "var(--text3)" : "var(--accent)",
                  fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {selected.isRead ? "O'qilgan" : "Yangi"}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setSelected(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
