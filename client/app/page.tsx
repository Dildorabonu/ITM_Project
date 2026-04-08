"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import {
  type PagedResult,
  type UserResponse,
  type DepartmentResponse,
  type ContractResponse,
  ContractStatus,
  CONTRACT_STATUS_LABELS,
} from "@/lib/userService";

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

/* ───── Icons ───── */

function WaveIcon() {
  return (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
      <path d="M7 11.5V7a5 5 0 0 1 10 0v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v4a4.5 4.5 0 0 0 9 0v-4c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v4a7.5 7.5 0 0 1-15 0v-4z" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="7" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
function ArrowRightIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>;
}
function UsersSmIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function DeptSmIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>;
}
function ContractSmIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function RoleSmIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function BellSmIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}
function TrendUpIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}
function CalendarIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function PieChartIcon() {
  return <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>;
}
function ActivityIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}

/* ───── Animated Background (floating orbs) ───── */

function AnimatedBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;

    const orbs = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 80 + Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      hue: [210, 230, 250, 190, 270, 220][i],
      alpha: 0.04 + Math.random() * 0.03,
    }));

    function resize() {
      w = canvas!.offsetWidth;
      h = canvas!.offsetHeight;
      canvas!.width = w * 0.5;
      canvas!.height = h * 0.5;
      ctx!.scale(0.5, 0.5);
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const o of orbs) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -0.1 || o.x > 1.1) o.vx *= -1;
        if (o.y < -0.1 || o.y > 1.1) o.vy *= -1;

        const grd = ctx!.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r);
        grd.addColorStop(0, `hsla(${o.hue}, 80%, 60%, ${o.alpha})`);
        grd.addColorStop(1, `hsla(${o.hue}, 80%, 60%, 0)`);
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(o.x * w, o.y * h, o.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="nd-animated-bg" />;
}

/* ───── Animated Counter Hook ───── */

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(ease * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return val;
}

/* ───── Progress Ring ───── */

function ProgressRing({ value, max, label, color, size = 90 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="nd-ring-item">
      <svg width={size} height={size} className="nd-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" className={`nd-ring-progress ${color}`}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="nd-ring-center">
        <span className="nd-ring-pct">{pct}%</span>
      </div>
      <div className="nd-ring-label">{label}</div>
    </div>
  );
}

/* ───── Helpers ───── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Xayrli tun";
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Hozir";
  if (diffMin < 60) return `${diffMin} daq. oldin`;
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Bugun · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Kecha · ${time}`;
  return `${d.toLocaleDateString("uz-UZ")} · ${time}`;
}

type Notif = { id: string; type: "blue" | "warn" | "danger" | "green"; title: string; body: string; isRead: boolean; createdAt: string };
const typeMap: Record<number, "blue" | "warn" | "danger" | "green"> = { 0: "blue", 1: "warn", 2: "danger", 3: "green" };

/* ───── Page ───── */

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const canViewUsers = hasPermission("Users.View");
  const canViewDepts = hasPermission("Departments.View");
  const canViewContracts = hasPermission("Contracts.View") || hasPermission("Contracts.ViewAll");
  const canViewRoles = hasPermission("Roles.View");

  const [loading, setLoading] = useState(true);
  const [usersData, setUsersData] = useState<PagedResult<UserResponse> | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      try {
        const promises: Promise<unknown>[] = [];
        const keys: string[] = [];

        if (canViewUsers)     { promises.push(userService.getAll(1, 1));       keys.push("users"); }
        if (canViewDepts)     { promises.push(departmentService.getAllFull());  keys.push("depts"); }
        if (canViewContracts) { promises.push(contractService.getAll());       keys.push("contracts"); }
        if (canViewRoles)     { promises.push(roleService.getAll());           keys.push("roles"); }

        promises.push(api.get("/api/notification").then(r => r.data?.result ?? []).catch(() => []));
        keys.push("notifs");

        const results = await Promise.allSettled(promises);
        results.forEach((res, i) => {
          if (res.status !== "fulfilled") return;
          switch (keys[i]) {
            case "users":     setUsersData(res.value as PagedResult<UserResponse>); break;
            case "depts":     setDepartments(res.value as DepartmentResponse[]); break;
            case "contracts": setContracts(res.value as ContractResponse[]); break;
            case "roles":     setRoles(res.value as { id: string; name: string }[]); break;
            case "notifs": {
              const raw = res.value as any[];
              setNotifs(raw.slice(0, 5).map((n: any) => ({
                id: n.id, type: typeMap[n.type] ?? "blue",
                title: n.title, body: n.body, isRead: n.isRead, createdAt: n.createdAt,
              })));
              break;
            }
          }
        });
      } catch { /* handled */ }
      setLoading(false);
    };
    load();
  }, [accessToken, canViewUsers, canViewDepts, canViewContracts, canViewRoles]);

  /* ── Computed ── */
  const totalUsers = usersData?.totalCount ?? 0;
  const activeDepts = departments.filter(d => d.isActive).length;
  const totalEmployees = departments.reduce((s, d) => s + (d.employeeCount || 0), 0);
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.status !== ContractStatus.Completed && c.status !== ContractStatus.Cancelled).length;
  const completedContracts = contracts.filter(c => c.status === ContractStatus.Completed).length;
  const totalRoles = roles.length;

  // Animated counters
  const animUsers = useCountUp(totalUsers);
  const animDepts = useCountUp(activeDepts);
  const animContracts = useCountUp(activeContracts);
  const animRoles = useCountUp(totalRoles);

  // Top departments by employee count
  const topDepts = useMemo(() =>
    departments
      .filter(d => d.isActive && (d.employeeCount || 0) > 0)
      .sort((a, b) => (b.employeeCount || 0) - (a.employeeCount || 0))
      .slice(0, 5),
    [departments]
  );
  const maxEmp = topDepts.length > 0 ? (topDepts[0].employeeCount || 1) : 1;

  // Contract pipeline
  const pipeline = useMemo(() => {
    const statusCounts: Record<number, number> = {};
    contracts.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
    return [
      { label: CONTRACT_STATUS_LABELS[ContractStatus.Draft] || "Qoralama", value: statusCounts[ContractStatus.Draft] || 0, color: "var(--text3)", cls: "pc-gray" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.DrawingPending] || "Chizma kutilmoqda", value: statusCounts[ContractStatus.DrawingPending] || 0, color: "var(--warn)", cls: "pc-warn" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.TechProcessing] || "Tex jarayon", value: statusCounts[ContractStatus.TechProcessing] || 0, color: "var(--accent)", cls: "pc-accent" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.WarehouseCheck] || "Ombor tekshiruvi", value: statusCounts[ContractStatus.WarehouseCheck] || 0, color: "var(--purple)", cls: "pc-purple" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.InProduction] || "Ishlab chiqarishda", value: statusCounts[ContractStatus.InProduction] || 0, color: "#4a90d9", cls: "pc-blue" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.Completed] || "Yakunlandi", value: statusCounts[ContractStatus.Completed] || 0, color: "var(--success)", cls: "pc-success" },
      { label: CONTRACT_STATUS_LABELS[ContractStatus.Cancelled] || "Bekor qilindi", value: statusCounts[ContractStatus.Cancelled] || 0, color: "var(--danger)", cls: "pc-danger" },
    ].filter(s => s.value > 0);
  }, [contracts]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  const firstName = user?.firstName || user?.login || "";
  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="nd-loading">
        <div className="nd-loading-inner">
          <div className="nd-spinner" />
          Yuklanmoqda...
        </div>
      </div>
    );
  }

  return (
    <div className="nd-wrapper page-transition">
      {/* ═══ Animated Background ═══ */}
      <AnimatedBg />

      {/* ═══ Welcome Hero ═══ */}
      <div className="nd-hero">
        <div className="nd-hero-aurora" />
        <div className="nd-hero-content">
          <div className="nd-hero-greeting">
            <span className="nd-hero-wave"><WaveIcon /></span>
            <span>{greeting},</span>
          </div>
          <h1 className="nd-hero-name">{firstName}</h1>
          <p className="nd-hero-sub">Bugungi ish jadvali va tashkilot holati</p>
        </div>
        <div className="nd-hero-right">
          <div className="nd-hero-date">
            <CalendarIcon />
            <span>{dateStr}</span>
          </div>
          {user?.role && (
            <div className="nd-hero-role">{user.role}</div>
          )}
        </div>
        <div className="nd-hero-shape nd-hero-shape-1" />
        <div className="nd-hero-shape nd-hero-shape-2" />
        <div className="nd-hero-shape nd-hero-shape-3" />
      </div>

      {/* ═══ Stats Row ═══ */}
      <div className="nd-stats-row">
        {canViewUsers && (
          <div className="nd-stat-card nd-glow-hover" onClick={() => router.push("/users")}>
            <div className="nd-stat-icon ic-accent"><UsersSmIcon /></div>
            <div className="nd-stat-info">
              <span className="nd-stat-label">Foydalanuvchilar</span>
              <span className="nd-stat-value">{animUsers}</span>
            </div>
            <div className="nd-stat-badge sb-accent">{totalEmployees} xodim</div>
            <div className="nd-card-shine" />
          </div>
        )}
        {canViewDepts && (
          <div className="nd-stat-card nd-glow-hover" onClick={() => router.push("/departments")}>
            <div className="nd-stat-icon ic-warn"><DeptSmIcon /></div>
            <div className="nd-stat-info">
              <span className="nd-stat-label">Faol bo&apos;limlar</span>
              <span className="nd-stat-value">{animDepts}</span>
            </div>
            <div className="nd-stat-badge sb-warn">{departments.length} jami</div>
            <div className="nd-card-shine" />
          </div>
        )}
        {canViewContracts && (
          <div className="nd-stat-card nd-glow-hover" onClick={() => router.push("/contracts")}>
            <div className="nd-stat-icon ic-success"><ContractSmIcon /></div>
            <div className="nd-stat-info">
              <span className="nd-stat-label">Faol shartnomalar</span>
              <span className="nd-stat-value">{animContracts}</span>
            </div>
            <div className="nd-stat-badge sb-success">
              <TrendUpIcon /> {totalContracts > 0 ? Math.round((completedContracts / totalContracts) * 100) : 0}% yakunlangan
            </div>
            <div className="nd-card-shine" />
          </div>
        )}
        {canViewRoles && (
          <div className="nd-stat-card nd-glow-hover" onClick={() => router.push("/roles")}>
            <div className="nd-stat-icon ic-purple"><RoleSmIcon /></div>
            <div className="nd-stat-info">
              <span className="nd-stat-label">Rollar</span>
              <span className="nd-stat-value">{animRoles}</span>
            </div>
            <div className="nd-stat-badge sb-purple">Tizim rollari</div>
            <div className="nd-card-shine" />
          </div>
        )}
      </div>

      {/* ═══ Main Grid ═══ */}
      <div className="nd-main-grid">
        {/* Left: Ish jarayoni (Work Progress) */}
        <div className="nd-section nd-glow-hover">
          <div className="nd-section-header">
            <ActivityIcon />
            <span>Ish jarayoni</span>
          </div>

          {/* Progress Rings */}
          {canViewContracts && (
            <div className="nd-rings-row">
              <ProgressRing value={completedContracts} max={totalContracts} label="Yakunlangan" color="ring-success" />
              <ProgressRing value={activeContracts} max={totalContracts} label="Faol" color="ring-accent" />
              <ProgressRing
                value={contracts.filter(c => c.status === ContractStatus.InProduction).length}
                max={totalContracts}
                label="Ishlab chiq."
                color="ring-purple"
              />
            </div>
          )}

          {/* Top departments bar chart */}
          {canViewDepts && topDepts.length > 0 && (
            <div className="nd-dept-bars">
              <div className="nd-dept-bars-title">Top bo&apos;limlar</div>
              {topDepts.map((d, i) => (
                <div key={d.id} className="nd-dept-bar-row">
                  <span className="nd-dept-bar-name">{d.name}</span>
                  <div className="nd-dept-bar-track">
                    <div
                      className={`nd-dept-bar-fill bar-delay-${i}`}
                      style={{ "--bar-w": `${((d.employeeCount || 0) / maxEmp) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="nd-dept-bar-val">{d.employeeCount}</span>
                </div>
              ))}
            </div>
          )}

          {!canViewContracts && !canViewDepts && (
            <div className="nd-empty">
              <ActivityIcon />
              <span>Ma&apos;lumotlar mavjud emas</span>
            </div>
          )}
        </div>

        {/* Right: Notifications Feed */}
        <div className="nd-section nd-glow-hover">
          <div className="nd-section-header">
            <BellSmIcon />
            <span>So&apos;nggi bildirishnomalar</span>
            <button type="button" className="nd-section-link" onClick={() => router.push("/notifications")}>
              Barchasini ko&apos;rish <ArrowRightIcon />
            </button>
          </div>
          <div className="nd-notif-feed">
            {notifs.length === 0 ? (
              <div className="nd-empty">
                <BellSmIcon />
                <span>Yangi bildirishnomalar yo&apos;q</span>
              </div>
            ) : (
              notifs.map((n, i) => (
                <div key={n.id} className={`nd-notif-item nd-fadein-${i} ${n.isRead ? "" : "unread"}`}>
                  <div className={`nd-notif-dot nd-dot-${n.type}`} />
                  <div className="nd-notif-content">
                    <div className="nd-notif-title">{n.title}</div>
                    <div className="nd-notif-body">{n.body}</div>
                    <div className="nd-notif-time">{formatTs(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Bottom: Contract Pipeline ═══ */}
      {canViewContracts && pipeline.length > 0 && (
        <div className="nd-pipeline-section nd-glow-hover">
          <div className="nd-section-header">
            <PieChartIcon />
            <span>Shartnomalar pipeline</span>
            <button type="button" className="nd-section-link" onClick={() => router.push("/contracts")}>
              Batafsil <ArrowRightIcon />
            </button>
          </div>
          <div className="nd-pipeline-body">
            <div className="nd-pipeline-steps">
              {pipeline.map((step, i) => (
                <div key={i} className="nd-pipeline-step nd-pipeline-fadein" data-delay={i}>
                  <div className={`nd-pipeline-count ${step.cls}`}>
                    {step.value}
                  </div>
                  <div className="nd-pipeline-label">{step.label}</div>
                  {i < pipeline.length - 1 && (
                    <div className="nd-pipeline-arrow">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="nd-pipeline-chart">
              <DonutChart segments={pipeline} size={140} thickness={22} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
