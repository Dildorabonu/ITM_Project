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
import { approveWithPdf } from "../_utils/approveWithPdf";
import { useT } from "@/lib/i18n";

// ─── Source filter ─────────────────────────────────────────────────────────────

type SourceFilter = "all" | "warehouse" | "purchase";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RequisitionApprovalsPage() {
  const router = useRouter();
  const t = useT();
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

    const oldestDate = list.length > 0
      ? list.reduce((min, r) => {
          const t = new Date(r.createdAt).getTime();
          return t < min ? t : min;
        }, Infinity)
      : null;
    const oldestDays = oldestDate != null
      ? Math.max(0, Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24)))
      : null;

    return { pending, warehouse, purchase, oldestDays };
  }, [list]);

  // ─── Filtering ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = list;
    if (sourceFilter === "warehouse") res = res.filter(r => r.source === RequisitionSource.Warehouse);
    else if (sourceFilter === "purchase") res = res.filter(r => r.source === RequisitionSource.Purchase);

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
      const { pdfUploaded } = await approveWithPdf(approveId);
      showToast(
        pdfUploaded ? t("Talabnoma tasdiqlandi") : t("Talabnoma tasdiqlandi (PDF yaratilmadi)"),
        pdfUploaded ? "success" : t("Ogohlantirish"),
      );
      setApproveId(null);
      setDrawerReq(null);
      await load();
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActing(true);
    try {
      await requisitionService.reject(rejectId, rejectReason.trim());
      showToast(t("Talabnoma rad etildi"), "success");
      setRejectId(null);
      setRejectReason("");
      setDrawerReq(null);
      await load();
    } catch {
      showToast(t("Xatolik yuz berdi"), "error");
    } finally { setActing(false); }
  };

  // ─── No permission ───────────────────────────────────────────────────────────
  if (!canApprove) {
    return (
      <div className="page-transition" style={{ padding: 24 }}>
        <div className="itm-card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--text3)" }}>
            {t("Bu sahifani ko'rish uchun ruxsat yo'q")}
          </div>
        </div>
      </div>
    );
  }

  const queueAge =
    stats.oldestDays == null ? null :
    stats.oldestDays >= 3 ? { color: "var(--danger)",  bg: "var(--danger-dim)" } :
    stats.oldestDays >= 1 ? { color: "var(--warn)",    bg: "var(--warn-dim)"   } :
                            { color: "var(--text2)",   bg: "var(--bg3)"        };

  return (
    <div className="page-transition">
      <style>{`
        .appr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
        @media (max-width: 860px) { .appr-grid { grid-template-columns: 1fr; } }
        .appr-tile:hover { border-color: var(--border2); }
        .appr-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .appr-rail { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; transform: scaleX(0); transform-origin: left; transition: transform 0.22s ease; }
        .appr-tile[data-active="true"] .appr-rail { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) { .appr-rail { transition: none; } }
      `}</style>

      {/* ─── Header row: back + queue age ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <button
          onClick={() => router.push("/requisitions")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 13px", fontSize: 13, fontWeight: 600,
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
          {t("Barcha talabnomalar")}
        </button>

        {queueAge && (
          <span
            style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 999,
              background: queueAge.bg, color: queueAge.color,
              fontSize: 12, fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t("Eng eski")}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {stats.oldestDays === 0 ? t("bugun") : `${stats.oldestDays} ${t("kun")}`}
            </span>
          </span>
        )}
      </div>

      {/* ─── Queue filter tiles ──────────────────────────────────────── */}
      <div className="appr-grid">
        <FilterTile
          delay={0}
          label={t("Tasdiq kutmoqda")}
          value={stats.pending}
          active={sourceFilter === "all"}
          onSelect={() => setSourceFilter("all")}
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          accent="var(--warn)"
          accentBg="var(--warn-dim)"
        />
        <FilterTile
          delay={1}
          label={t("Ombordan")}
          value={stats.warehouse}
          active={sourceFilter === "warehouse"}
          onSelect={() => setSourceFilter("warehouse")}
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
          accent="var(--success)"
          accentBg="var(--success-dim)"
        />
        <FilterTile
          delay={2}
          label={t("Sotib olishga")}
          value={stats.purchase}
          active={sourceFilter === "purchase"}
          onSelect={() => setSourceFilter("purchase")}
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
          accent="var(--purple)"
          accentBg="var(--purple-dim)"
        />
      </div>

      {/* ─── Toolbar ─────────────────────────────────────────────────── */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 12px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 240 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder={t("Raqam, maqsad, shartnoma, bo'lim, yaratuvchi")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={search ? { paddingRight: 34 } : undefined}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={t("Tozalash")}
              title={t("Tozalash")}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%", border: "none",
                background: "var(--surface2)", color: "var(--text3)", cursor: "pointer",
                padding: 0,
              }}
            >
              {/* inline reset: `.search-wrap svg` pins descendant svgs to the left edge */}
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                style={{ position: "static", left: "auto", top: "auto", transform: "none", width: 11, height: 11, color: "inherit" }}
              >
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        {filtered.length !== list.length && (
          <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>
            {t("Ko'rsatilmoqda")}{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text2)" }}>
              {filtered.length}
            </span>
          </span>
        )}
      </div>

      {/* ─── List ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="itm-card" style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>
          {t("Yuklanmoqda…")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="itm-card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: "50%", background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{t("Tasdiq kutayotgan talabnomalar yo'q")}</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
            {search || sourceFilter !== "all"
              ? t("Filtrga mos keladigan talabnoma topilmadi")
              : t("Hozircha hammasi ko'rib chiqilgan")}
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
        title={t("Talabnomani tasdiqlash")}
        message={t("Tasdiqlangach, talabnoma bo'yicha keyingi qadamga (ombordan olish yoki sotib olish) o'tiladi. Davom etasizmi?")}
        variant="primary"
        confirmLabel={t("Tasdiqlash")}
        loadingLabel={t("Tasdiqlanmoqda...")}
        loading={acting}
        onConfirm={handleApprove}
        onCancel={() => setApproveId(null)}
      />

      {/* ─── Reject modal ───────────────────────────────────────────── */}
      {rejectId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => !acting && setRejectId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", borderRadius: "var(--radius2)", padding: 28, width: 440, maxWidth: "90vw", boxShadow: "var(--shadow2)", border: "1.5px solid var(--border)" }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text)" }}>{t("Rad etish sababi")}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>{t("Yaratuvchiga sabab ko'rsatiladi")}</div>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder={t("Sababni kiriting…")}
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
                {t("Bekor")}
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
                {acting ? "…" : t("Rad etish")}
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

// ─── FilterTile ────────────────────────────────────────────────────────────────
// Counts and the source filter are the same three buckets, so one control does both.

function FilterTile({ label, value, icon, accent, accentBg, delay, active, onSelect }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  delay: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      data-active={active}
      className={`itm-card appr-tile nd-fadein-${delay}`}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "11px 14px", position: "relative",
        font: "inherit", textAlign: "left", cursor: "pointer",
        borderColor: active ? accent : undefined,
        background: active ? accentBg : undefined,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: "var(--radius)", flexShrink: 0,
        background: active ? "var(--surface)" : accentBg, color: accent,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em",
        color: active ? accent : "var(--text3)", lineHeight: 1.3,
      }}>
        {label}
      </span>
      <span style={{
        marginLeft: "auto", fontSize: 22, fontWeight: 700, lineHeight: 1,
        fontFamily: "var(--font-mono)", color: active ? accent : "var(--text)",
      }}>
        {value}
      </span>
      <span className="appr-rail" style={{ background: accent }} />
    </button>
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
  const t = useT();
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
  const sourceLabel = req.sourceLabel ?? t("Asosiy");

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
            <Meta icon="package"   text={`${req.items.length} ${t("ta material")}`} />
            <Meta icon="calendar"  text={fmtDate(req.createdAt)} />
            <span style={{ color: ageColor, fontWeight: 600 }}>
              {ageDays === 0 ? t("bugun") : `${ageDays} ${t("kun oldin")}`}
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
            title={t("Rad etish")}
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
            {t("Rad etish")}
          </button>
          <button
            onClick={onApprove}
            title={t("Tasdiqlash")}
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
            {t("Tasdiqlash")}
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
