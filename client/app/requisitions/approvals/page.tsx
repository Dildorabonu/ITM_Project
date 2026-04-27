"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  requisitionService,
  RequisitionStatus,
  RequisitionSource,
  type RequisitionResponse,
} from "@/lib/userService";
import { fmtDate, fmtDateTime } from "../_types";
import { RequisitionStatusBadge } from "../_components/StatusBadge";
import { RequisitionDrawer } from "../_components/RequisitionDrawer";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

// ─── Source filter ─────────────────────────────────────────────────────────────

type SourceFilter = "all" | "warehouse" | "purchase" | "main";

const SOURCE_TABS: { id: SourceFilter; label: string }[] = [
  { id: "all",       label: "Barchasi" },
  { id: "main",      label: "Asosiy"    },
  { id: "warehouse", label: "Ombordan"  },
  { id: "purchase",  label: "Sotib olish" },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RequisitionApprovalsPage() {
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canApprove = hasPermission("Requisitions.Approve");

  const [list, setList] = useState<RequisitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [drawerReq, setDrawerReq] = useState<RequisitionResponse | null>(null);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await requisitionService.getAll(RequisitionStatus.PendingApproval);
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = list.length;
    const warehouse = list.filter(r => r.source === RequisitionSource.Warehouse).length;
    const purchase  = list.filter(r => r.source === RequisitionSource.Purchase).length;
    const main      = list.filter(r => r.source == null).length;

    const oldestDate = list.length > 0
      ? list.reduce((min, r) => {
          const t = new Date(r.createdAt).getTime();
          return t < min ? t : min;
        }, Infinity)
      : null;
    const oldestDays = oldestDate != null
      ? Math.max(0, Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24)))
      : null;

    return { pending, warehouse, purchase, main, oldestDays };
  }, [list]);

  // ─── Filtering ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = list;
    if (sourceFilter === "warehouse") res = res.filter(r => r.source === RequisitionSource.Warehouse);
    else if (sourceFilter === "purchase") res = res.filter(r => r.source === RequisitionSource.Purchase);
    else if (sourceFilter === "main") res = res.filter(r => r.source == null);

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        r.requisitionNo.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        (r.contractNo ?? "").toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.createdByName.toLowerCase().includes(q)
      );
    }

    return res.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [list, search, sourceFilter]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!approveId) return;
    setActing(true);
    try {
      await requisitionService.approve(approveId);
      showToast("Talabnoma tasdiqlandi", "success");
      setApproveId(null);
      setDrawerReq(null);
      await load();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActing(true);
    try {
      await requisitionService.reject(rejectId, rejectReason.trim());
      showToast("Talabnoma rad etildi", "success");
      setRejectId(null);
      setRejectReason("");
      setDrawerReq(null);
      await load();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  // ─── No permission ───────────────────────────────────────────────────────────
  if (!canApprove) {
    return (
      <div className="page-transition" style={{ padding: 24 }}>
        <div className="itm-card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--text3)" }}>
            Bu sahifani ko'rish uchun ruxsat yo'q
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* ─── Header row ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="font-head-itm" style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", margin: 0 }}>
            Tasdiqlash
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: "4px 0 0 0" }}>
            Tasdiq kutayotgan talabnomalar — eng eskisidan boshlab
          </p>
        </div>
        <button
          onClick={() => router.push("/requisitions")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius)", border: "1.5px solid var(--border)",
            background: "var(--bg3)", color: "var(--text2)", cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Barcha talabnomalar
        </button>
      </div>

      {/* ─── Stats row ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <StatCard
          delay={0}
          label="Tasdiq kutmoqda"
          value={stats.pending}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          accent="var(--warn)"
          accentBg="var(--warn-dim)"
        />
        <StatCard
          delay={1}
          label="Asosiy"
          value={stats.main}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>}
          accent="var(--accent)"
          accentBg="var(--accent-dim)"
        />
        <StatCard
          delay={2}
          label="Ombordan"
          value={stats.warehouse}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
          accent="var(--success)"
          accentBg="var(--success-dim)"
        />
        <StatCard
          delay={3}
          label="Sotib olishga"
          value={stats.purchase}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
          accent="var(--purple)"
          accentBg="var(--purple-dim)"
        />
      </div>

      {/* ─── Toolbar ─────────────────────────────────────────────────── */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 240 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Raqam, maqsad, shartnoma, bo'lim, yaratuvchi"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "inline-flex", padding: 3, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)" }}>
          {SOURCE_TABS.map(tab => {
            const active = sourceFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSourceFilter(tab.id)}
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: "calc(var(--radius) - 2px)", border: "none",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text2)",
                  cursor: "pointer", transition: "background 0.15s, color 0.15s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── List ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="itm-card" style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>
          Yuklanmoqda…
        </div>
      ) : filtered.length === 0 ? (
        <div className="itm-card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: "50%", background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Tasdiq kutayotgan talabnomalar yo&apos;q</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
            {search || sourceFilter !== "all"
              ? "Filtrga mos keladigan talabnoma topilmadi"
              : "Hozircha hammasi ko'rib chiqilgan"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r, i) => (
            <ApprovalCard
              key={r.id}
              req={r}
              fadeIdx={Math.min(i, 4)}
              onView={() => setDrawerReq(r)}
              onApprove={() => setApproveId(r.id)}
              onReject={() => { setRejectId(r.id); setRejectReason(""); }}
            />
          ))}
        </div>
      )}

      {/* ─── Approve confirm ────────────────────────────────────────── */}
      <ConfirmModal
        open={!!approveId}
        title="Talabnomani tasdiqlash"
        message="Tasdiqlangach, talabnoma bo'yicha keyingi qadamga (ombordan olish yoki sotib olish) o'tiladi. Davom etasizmi?"
        loading={acting}
        onConfirm={handleApprove}
        onCancel={() => setApproveId(null)}
      />

      {/* ─── Reject modal ───────────────────────────────────────────── */}
      {rejectId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => !acting && setRejectId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", borderRadius: "var(--radius2)", padding: 28, width: 440, maxWidth: "90vw", boxShadow: "var(--shadow2)", border: "1.5px solid var(--border)" }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text)" }}>Rad etish sababi</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>Yaratuvchiga sabab ko&apos;rsatiladi</div>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Sababni kiriting…"
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
                fontSize: 13, resize: "vertical", boxSizing: "border-box",
                background: "var(--bg3)", color: "var(--text)",
                fontFamily: "var(--font-inter)",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setRejectId(null)}
                disabled={acting}
                style={{ flex: 1, padding: "10px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: acting ? "not-allowed" : "pointer", fontWeight: 600, color: "var(--text2)", fontSize: 13 }}
              >
                Bekor
              </button>
              <button
                disabled={!rejectReason.trim() || acting}
                onClick={handleReject}
                style={{
                  flex: 1, padding: "10px", background: "var(--danger)", color: "#fff",
                  border: "none", borderRadius: "var(--radius)",
                  cursor: !rejectReason.trim() || acting ? "not-allowed" : "pointer",
                  fontWeight: 600, fontSize: 13,
                  opacity: !rejectReason.trim() || acting ? 0.6 : 1,
                }}
              >
                {acting ? "…" : "Rad etish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail drawer ──────────────────────────────────────────── */}
      {drawerReq && (
        <RequisitionDrawer
          req={drawerReq}
          onClose={() => setDrawerReq(null)}
          onUpdate={updated => {
            // If status changed (no longer PendingApproval), drop from list
            if (updated.status !== RequisitionStatus.PendingApproval) {
              setDrawerReq(null);
              setList(prev => prev.filter(r => r.id !== updated.id));
            } else {
              setDrawerReq(updated);
              setList(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
          }}
        />
      )}
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent, accentBg, delay }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  delay: number;
}) {
  return (
    <div
      className={`itm-card nd-fadein-${delay}`}
      style={{ padding: 16, position: "relative", overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "var(--radius)",
          background: accentBg, color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
          color: "var(--text3)",
        }}>
          {label}
        </div>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700, color: "var(--text)",
        fontFamily: "var(--font-mono)", lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── ApprovalCard ──────────────────────────────────────────────────────────────

function ApprovalCard({ req, fadeIdx, onView, onApprove, onReject }: {
  req: RequisitionResponse;
  fadeIdx: number;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ageDays = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const ageColor = ageDays >= 3 ? "var(--danger)" : ageDays >= 1 ? "var(--warn)" : "var(--text3)";

  const sourceColor =
    req.source === RequisitionSource.Warehouse ? "var(--success)" :
    req.source === RequisitionSource.Purchase  ? "var(--purple)" :
    "var(--accent)";
  const sourceBg =
    req.source === RequisitionSource.Warehouse ? "var(--success-dim)" :
    req.source === RequisitionSource.Purchase  ? "var(--purple-dim)" :
    "var(--accent-dim)";
  const sourceLabel = req.sourceLabel ?? "Asosiy";

  return (
    <div
      className={`itm-card nd-fadein-${fadeIdx}`}
      style={{ padding: 16, transition: "border-color 0.15s, transform 0.15s", cursor: "pointer" }}
      onClick={onView}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        {/* Left: id, source, meta */}
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14,
              color: "var(--text)",
            }}>
              {req.requisitionNo}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
              background: sourceBg, color: sourceColor,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {sourceLabel}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>· {req.typeLabel}</span>
          </div>

          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {req.purpose}
          </div>

          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text3)", flexWrap: "wrap" }}>
            <Meta icon="user"      text={req.createdByName} />
            {(req.contractNo ?? req.departmentName) && (
              <Meta icon="briefcase" text={req.contractNo ?? req.departmentName ?? ""} />
            )}
            <Meta icon="package"   text={`${req.items.length} ta material`} />
            <Meta icon="calendar"  text={fmtDate(req.createdAt)} />
            <span style={{ color: ageColor, fontWeight: 600 }}>
              {ageDays === 0 ? "bugun" : `${ageDays} kun oldin`}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
        >
          <button
            onClick={onReject}
            title="Rad etish"
            style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 600,
              background: "var(--danger-dim)", color: "var(--danger)",
              border: "1px solid rgba(217,48,37,0.25)", borderRadius: "var(--radius)",
              cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--danger)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--danger-dim)"; e.currentTarget.style.color = "var(--danger)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Rad etish
          </button>
          <button
            onClick={onApprove}
            title="Tasdiqlash"
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: "var(--success)", color: "#fff",
              border: "none", borderRadius: "var(--radius)",
              cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,123,69,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meta inline item ──────────────────────────────────────────────────────────

function Meta({ icon, text }: { icon: "user" | "briefcase" | "package" | "calendar"; text: string }) {
  const path =
    icon === "user"      ? <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> :
    icon === "briefcase" ? <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></> :
    icon === "package"   ? <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/></> :
                            <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{path}</svg>
      {text}
    </span>
  );
}
