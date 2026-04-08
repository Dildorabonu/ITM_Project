"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { ContractStatus, Priority } from "@/lib/userService";

type Notif = {
  id: string;
  type: "blue" | "warn" | "danger" | "green";
  title: string;
  body: string;
  contractId: string | null;
  isRead: boolean;
  createdAt: string;
};

type ContractDetail = {
  id: string;
  contractNo: string;
  productType: string;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  priority: Priority;
  contractParty: string;
  status: ContractStatus;
  notes: string | null;
  createdByFullName: string | null;
  createdAt: string;
  departments: { id: string; name: string }[];
  assignedUsers: { userId: string; fullName: string; role: string }[];
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

const statusLabels: Record<number, string> = {
  [ContractStatus.Draft]: "Shartnoma yaratilindi",
  [ContractStatus.DrawingPending]: "Chizmasi tayyorlanmoqda",
  [ContractStatus.TechProcessing]: "Tex jarayon tayyorlanmoqda",
  [ContractStatus.WarehouseCheck]: "Ombor tekshiruvi",
  [ContractStatus.InProduction]: "Ishlab chiqarish jarayonida",
  [ContractStatus.Completed]: "Yakunlandi",
  [ContractStatus.Cancelled]: "Bekor qilindi",
  [ContractStatus.TechProcessApproved]: "Tex jarayon tasdiqlandi",
};

const priorityLabels: Record<number, string> = {
  [Priority.Low]: "Past",
  [Priority.Medium]: "O'rta",
  [Priority.High]: "Yuqori",
  [Priority.Urgent]: "Shoshilinch",
};

const priorityColors: Record<number, string> = {
  [Priority.Low]: "var(--text3)",
  [Priority.Medium]: "var(--accent)",
  [Priority.High]: "#e67e22",
  [Priority.Urgent]: "var(--danger)",
};

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

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = UZ_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month} ${year}-yil, ${hh}:${mm}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notif | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
          contractId: n.contractId || null,
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
    setContractDetail(null);

    if (n.contractId) {
      setContractLoading(true);
      try {
        const res = await api.get(`/api/contract/${n.contractId}`);
        setContractDetail(res.data.result || null);
      } catch {
        setContractDetail(null);
      } finally {
        setContractLoading(false);
      }
    }

    if (!n.isRead) {
      try {
        await api.put(`/api/notification/${n.id}/read`);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
        window.dispatchEvent(new Event("notif-read"));
      } catch { /* ignore */ }
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/api/notification/read-all");
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new Event("notif-read"));
    } catch { /* ignore */ }
  };

  const deleteNotif = async (id: string) => {
    setDeleteError(null);
    try {
      await api.delete(`/api/notification/${id}`);
      setNotifs(prev => {
        const updated = prev.filter(n => n.id !== id);
        window.dispatchEvent(new Event("notif-read"));
        return updated;
      });
      if (selected?.id === id) { setSelected(null); setContractDetail(null); }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.errors?.[0] || err?.message || "O'chirishda xatolik yuz berdi";
      setDeleteError(msg);
      setTimeout(() => setDeleteError(null), 4000);
      if (status === 404) {
        // Notification allaqachon o'chirilgan bo'lishi mumkin - listni yangilaymiz
        await fetchNotifs();
      }
    }
  };

  const visible = filter === "unread" ? notifs.filter(n => !n.isRead) : notifs;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  const infoRow = (label: string, value: string, color?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: color || "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  );

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Yuklanmoqda...</div>;
  }

  return (
    <div className="page-transition">
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

      {deleteError && (
        <div style={{
          background: "var(--danger)", color: "#fff", padding: "10px 16px",
          borderRadius: "var(--radius)", marginBottom: 12, fontSize: 13, fontWeight: 500,
        }}>
          {deleteError}
        </div>
      )}

      {visible.length === 0 ? (
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
        <div className="modal-overlay" onClick={() => { setSelected(null); setContractDetail(null); }}>
          <div
            className="modal-box"
            style={{ width: 560, maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: borderColor[selected.type] }}>
              <span>{typeIcon[selected.type]} {typeLabel[selected.type]}</span>
              <button className="modal-close" onClick={() => { setSelected(null); setContractDetail(null); }}>✕</button>
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

              {/* ── Contract Detail ── */}
              {selected.contractId && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Shartnoma ma&apos;lumotlari</div>
                  {contractLoading ? (
                    <div style={{ textAlign: "center", padding: 20, opacity: 0.5, fontSize: 13 }}>Yuklanmoqda...</div>
                  ) : contractDetail ? (
                    <div style={{
                      background: "var(--bg3, var(--surface2))", borderRadius: "var(--radius)",
                      border: "1px solid var(--border)", padding: "14px 16px",
                    }}>
                      {infoRow("Shartnoma raqami", contractDetail.contractNo)}
                      {infoRow("Shartnoma tomoni", contractDetail.contractParty)}
                      {infoRow("Mahsulot turi", contractDetail.productType)}
                      {infoRow("Miqdori", `${contractDetail.quantity} ${contractDetail.unit}`)}
                      {infoRow("Holati", statusLabels[contractDetail.status] || String(contractDetail.status))}
                      {infoRow("Muhimlik darajasi", priorityLabels[contractDetail.priority] || String(contractDetail.priority), priorityColors[contractDetail.priority])}
                      {infoRow("Boshlanish sanasi", formatDate(contractDetail.startDate))}
                      {infoRow("Tugash sanasi (Deadline)", formatDate(contractDetail.endDate))}
                      {infoRow("Yaratgan", contractDetail.createdByFullName || "—")}
                      {infoRow("Yaratilgan sana", formatFullDate(contractDetail.createdAt))}
                      {contractDetail.departments.length > 0 && infoRow("Bo'limlar", contractDetail.departments.map(d => d.name).join(", "))}
                      {contractDetail.assignedUsers.length > 0 && (
                        <div style={{ paddingTop: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>Tayinlangan xodimlar</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {contractDetail.assignedUsers.map(u => (
                              <span key={u.userId} style={{
                                fontSize: 12, padding: "3px 10px", borderRadius: 12,
                                background: "var(--accent-dim, rgba(59,130,246,0.1))", color: "var(--accent)",
                                fontWeight: 500,
                              }}>
                                {u.fullName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {contractDetail.notes && (
                        <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>Izoh</span>
                          <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4, lineHeight: 1.5 }}>{contractDetail.notes}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      textAlign: "center", padding: 16, opacity: 0.5, fontSize: 13,
                      background: "var(--bg3, var(--surface2))", borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                    }}>
                      Shartnoma topilmadi yoki o&apos;chirilgan
                    </div>
                  )}
                </div>
              )}

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
              <button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setContractDetail(null); }}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
