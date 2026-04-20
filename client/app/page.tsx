"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import {
  type PagedResult,
  type UserResponse,
  type DepartmentResponse,
  type ContractResponse,
  ContractStatus,
  DepartmentType,
  userService,
  departmentService,
  contractService,
  roleService,
} from "@/lib/userService";

/* ───── Icons (SVG) ───── */

function SunIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.9" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function SunsetIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M17 18a5 5 0 1 0-10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="currentColor" opacity="0.15" />
      <line x1="12" y1="9" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SunriseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M17 18a5 5 0 1 0-10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="currentColor" opacity="0.15" />
      <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="8 6 12 2 16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
function TrendUpIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}
function CalendarIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function ActivityIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function ClockIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function AlertTriangleIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function BarChart2Icon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function CheckCircleIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function LayersIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>;
}
function CheckSmIcon() {
  return <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>;
}
function XSmIcon() {
  return <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
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
      const ease = 1 - Math.pow(1 - t, 3);
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

function getGreeting(): { text: string; icon: "sunrise" | "sun" | "sunset" | "moon" } {
  const h = new Date().getHours();
  if (h < 6)  return { text: "Xayrli tun",  icon: "moon" };
  if (h < 12) return { text: "Xayrli tong", icon: "sunrise" };
  if (h < 18) return { text: "Xayrli kun",  icon: "sun" };
  return { text: "Xayrli kech", icon: "sunset" };
}

const UZ_MONTHS = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentyabr","oktyabr","noyabr","dekabr"];
const UZ_MONTHS_SHORT = ["yan","fev","mar","apr","may","iyn","iyl","avg","sen","okt","noy","dek"];
const UZ_WEEKDAYS = ["yakshanba","dushanba","seshanba","chorshanba","payshanba","juma","shanba"];

function formatUzDate(d: Date, format: "full" | "short" | "numeric" = "full"): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.getMonth();
  const year = d.getFullYear();
  if (format === "numeric") return `${day}.${String(month + 1).padStart(2, "0")}.${year}`;
  if (format === "short") return `${day}-${UZ_MONTHS_SHORT[month]} ${year}`;
  return `${d.getDate()}-${UZ_MONTHS[month]} ${year}-yil, ${UZ_WEEKDAYS[d.getDay()]}`;
}

function getGreetingIcon(icon: string) {
  switch (icon) {
    case "sunrise": return <SunriseIcon />;
    case "sun":     return <SunIcon />;
    case "sunset":  return <SunsetIcon />;
    case "moon":    return <MoonIcon />;
    default:        return <SunIcon />;
  }
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineUrgency(days: number): "critical" | "warn" | "normal" | "passed" {
  if (days < 0) return "passed";
  if (days <= 3) return "critical";
  if (days <= 10) return "warn";
  return "normal";
}

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

        const results = await Promise.allSettled(promises);
        results.forEach((res, i) => {
          if (res.status !== "fulfilled") return;
          switch (keys[i]) {
            case "users":     setUsersData(res.value as PagedResult<UserResponse>); break;
            case "depts":     setDepartments(res.value as DepartmentResponse[]); break;
            case "contracts": setContracts(res.value as ContractResponse[]); break;
            case "roles":     setRoles(res.value as { id: string; name: string }[]); break;
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

  // Upcoming deadlines - active contracts sorted by endDate
  const upcomingDeadlines = useMemo(() =>
    contracts
      .filter(c => c.status !== ContractStatus.Completed && c.status !== ContractStatus.Cancelled)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 6),
    [contracts]
  );

  // Department activity - count active contracts per department
  const deptActivity = useMemo(() => {
    const map = new Map<string, { name: string; type: DepartmentType; count: number }>();
    contracts
      .filter(c => c.status === ContractStatus.InProduction || c.status === ContractStatus.TechProcessing || c.status === ContractStatus.WarehouseCheck)
      .forEach(c => {
        (c.departments || []).forEach(d => {
          const existing = map.get(d.id);
          if (existing) {
            existing.count++;
          } else {
            map.set(d.id, { name: d.name, type: d.type, count: 1 });
          }
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [contracts]);

  const maxDeptActivity = deptActivity.length > 0 ? deptActivity[0].count : 1;

  const today = new Date();
  const dateStr = formatUzDate(today, "full");
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
            <span className="nd-hero-icon-pulse">{getGreetingIcon(greeting.icon)}</span>
            <span>{greeting.text},</span>
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
          <div className="nd-stat-card nd-glow-hover nd-stagger-0" onClick={() => router.push("/users")}>
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
          <div className="nd-stat-card nd-glow-hover nd-stagger-1" onClick={() => router.push("/departments")}>
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
          <div className="nd-stat-card nd-glow-hover nd-stagger-2" onClick={() => router.push("/contracts")}>
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
          <div className="nd-stat-card nd-glow-hover nd-stagger-3" onClick={() => router.push("/roles")}>
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

      {/* ═══ Deadlines + Work Progress (side by side) ═══ */}
      <div className="nd-main-grid nd-duo-row">
        {/* Left: Deadline Tracker */}
        {canViewContracts && (
          <div className="nd-section nd-glow-hover">
            <div className="nd-section-header">
              <ClockIcon />
              <span>Yaqinlashayotgan deadlinelar</span>
              <button type="button" className="nd-section-link" onClick={() => router.push("/contracts")}>
                Barchasini ko&apos;rish <ArrowRightIcon />
              </button>
            </div>
            <div className="nd-deadline-list">
              {upcomingDeadlines.length === 0 ? (
                <div className="nd-empty">
                  <CheckCircleIcon />
                  <span>Yaqin deadline topilmadi</span>
                </div>
              ) : (
                upcomingDeadlines.map((c, i) => {
                  const days = daysUntil(c.endDate);
                  const urgency = deadlineUrgency(days);
                  const endDate = new Date(c.endDate);
                  return (
                    <div
                      key={c.id}
                      className={`nd-deadline-item nd-fadein-${Math.min(i, 4)} dl-${urgency}`}
                      onClick={() => router.push(`/contracts`)}
                    >
                      <div className="nd-deadline-left">
                        <div className={`nd-deadline-urgency-dot dl-dot-${urgency}`} />
                        <div className="nd-deadline-info">
                          <div className="nd-deadline-contract">{c.contractNo}</div>
                          <div className="nd-deadline-product">{c.productType} — {c.contractParty}</div>
                        </div>
                      </div>
                      <div className="nd-deadline-right">
                        <div className={`nd-deadline-days dl-days-${urgency}`}>
                          {urgency === "passed" ? (
                            <><AlertTriangleIcon /> {Math.abs(days)} kun o&apos;tgan</>
                          ) : days === 0 ? (
                            <><AlertTriangleIcon /> Bugun</>
                          ) : (
                            <>{days} kun qoldi</>
                          )}
                        </div>
                        <div className="nd-deadline-date">
                          {formatUzDate(endDate, "short")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right: Work Progress */}
        {canViewContracts && (
          <div className="nd-section nd-glow-hover">
            <div className="nd-section-header">
              <ActivityIcon />
              <span>Ish jarayoni</span>
            </div>
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

            {/* Quick stats */}
            <div className="nd-progress-stats">
              <div className="nd-progress-stat-item">
                <span className="nd-progress-stat-dot psd-success" />
                <span className="nd-progress-stat-label">Yakunlangan</span>
                <span className="nd-progress-stat-val">{completedContracts}</span>
              </div>
              <div className="nd-progress-stat-item">
                <span className="nd-progress-stat-dot psd-accent" />
                <span className="nd-progress-stat-label">Jarayonda</span>
                <span className="nd-progress-stat-val">{activeContracts}</span>
              </div>
              <div className="nd-progress-stat-item">
                <span className="nd-progress-stat-dot psd-danger" />
                <span className="nd-progress-stat-label">Bekor qilingan</span>
                <span className="nd-progress-stat-val">{contracts.filter(c => c.status === ContractStatus.Cancelled).length}</span>
              </div>
            </div>

            {/* Department activity (compact) */}
            {deptActivity.length > 0 && (
              <div className="nd-dept-compact">
                <div className="nd-dept-compact-title">
                  <BarChart2Icon />
                  <span>Bo&apos;limlar faolligi</span>
                </div>
                {deptActivity.slice(0, 4).map((d, i) => {
                  const pct = Math.round((d.count / maxDeptActivity) * 100);
                  const barCls = d.type === DepartmentType.IshlabChiqarish
                    ? "bar-accent"
                    : d.type === DepartmentType.Boshqaruv
                      ? "bar-purple"
                      : "bar-success";
                  return (
                    <div key={i} className="nd-activity-row">
                      <div className="nd-activity-name" title={d.name}>{d.name}</div>
                      <div className="nd-activity-bar-track">
                        <div
                          className={`nd-activity-bar-fill bar-delay-${i} ${barCls}`}
                          style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
                        />
                      </div>
                      <div className="nd-activity-count">{d.count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Production Pipeline Board ═══ */}
      {canViewContracts && (() => {
        const STAGES = [
          { status: ContractStatus.Draft, label: "Shartnoma", color: "stg-blue" },
          { status: ContractStatus.DrawingPending, label: "Chizma", color: "stg-indigo" },
          { status: ContractStatus.TechProcessing, label: "Tex. jarayon", color: "stg-violet" },
          { status: ContractStatus.WarehouseCheck, label: "Ombor", color: "stg-amber" },
          { status: ContractStatus.InProduction, label: "Ishlab chiq.", color: "stg-emerald" },
          { status: ContractStatus.Completed, label: "Yakunlandi", color: "stg-green" },
        ];
        const statusOrder = STAGES.map(s => s.status);
        const pipeContracts = contracts
          .filter(c => c.status !== ContractStatus.Cancelled && c.status !== ContractStatus.Completed)
          .slice(0, 8);

        if (pipeContracts.length === 0) return null;

        // Count per stage
        const stageCounts = STAGES.map(s =>
          contracts.filter(c => c.status === s.status).length
        );

        return (
          <div className="pm-wrapper">
            {/* Decorative bg */}
            <div className="pm-bg-grid" />
            <div className="pm-bg-glow pm-bg-glow-1" />
            <div className="pm-bg-glow pm-bg-glow-2" />

            {/* Header */}
            <div className="pm-header">
              <div className="pm-header-left">
                <div className="pm-header-icon"><LayersIcon /></div>
                <div>
                  <h2 className="pm-title">Ishlab chiqarish jarayoni</h2>
                  <p className="pm-subtitle">{pipeContracts.length} ta faol shartnoma</p>
                </div>
              </div>
              <button type="button" className="pm-view-all" onClick={() => router.push("/contracts")}>
                Barchasini ko&apos;rish <ArrowRightIcon />
              </button>
            </div>

            {/* Stage summary chips */}
            <div className="pm-stage-chips">
              {STAGES.map((s, i) => (
                <div key={i} className={`pm-chip ${s.color} ${stageCounts[i] > 0 ? "pm-chip-active" : ""}`}>
                  <span className="pm-chip-count">{stageCounts[i]}</span>
                  <span className="pm-chip-label">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Pipeline matrix table */}
            <div className="pm-table-scroll">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th className="pm-th pm-th-contract">Shartnoma</th>
                    {STAGES.map((s, i) => (
                      <th key={i} className={`pm-th pm-th-stage ${s.color}`}>
                        <span className="pm-th-text">{s.label}</span>
                      </th>
                    ))}
                    <th className="pm-th pm-th-progress">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeContracts.map((contract, ci) => {
                    const currentIdx = statusOrder.indexOf(contract.status);
                    const progressPct = Math.round((currentIdx / (STAGES.length - 1)) * 100);
                    return (
                      <tr key={contract.id} className={`pm-row pm-row-fadein-${Math.min(ci, 5)}`} onClick={() => router.push("/contracts")}>
                        <td className="pm-td pm-td-contract">
                          <div className="pm-contract-info">
                            <span className="pm-contract-no">{contract.contractNo}</span>
                            <span className="pm-contract-product">{contract.productType}</span>
                            <span className="pm-contract-party">{contract.contractParty}</span>
                          </div>
                        </td>
                        {STAGES.map((stage, si) => {
                          const isDone = si < currentIdx;
                          const isCurrent = si === currentIdx;
                          return (
                            <td key={si} className={`pm-td pm-td-cell ${isCurrent ? "pm-cell-current" : ""}`}>
                              {isDone && (
                                <div className={`pm-dot pm-dot-done ${stage.color}`}>
                                  <CheckSmIcon />
                                </div>
                              )}
                              {isCurrent && (
                                <div className={`pm-dot pm-dot-active ${stage.color}`}>
                                  <span className="pm-dot-pulse" />
                                  <span className="pm-dot-core" />
                                </div>
                              )}
                              {!isDone && !isCurrent && (
                                <div className="pm-dot pm-dot-pending" />
                              )}
                              {/* Connector line */}
                              {si > 0 && (
                                <div className={`pm-connector ${isDone ? "pm-conn-done" : isCurrent ? "pm-conn-current" : "pm-conn-pending"}`} />
                              )}
                            </td>
                          );
                        })}
                        <td className="pm-td pm-td-status">
                          <div className="pm-status-wrap">
                            <div className="pm-mini-bar">
                              <div className="pm-mini-fill" style={{ "--pm-pct": `${progressPct}%` } as React.CSSProperties} />
                            </div>
                            <span className="pm-pct-text">{progressPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
