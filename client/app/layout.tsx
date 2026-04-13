"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Roboto_Mono, Inter } from "next/font/google";
import "./globals.css";
import { useAuthStore } from "@/lib/store/authStore";
import { api } from "@/lib/api";
import ToastContainer from "@/app/_components/ToastContainer";

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

type NavItem = { name: string; href: string; icon: string; badge?: number; badgeWarn?: boolean; permission?: string | string[] };
type NavGroup = { label: string; icon: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Asosiy",
    icon: "layout",
    items: [
      { name: "Dashboard",        href: "/",              icon: "grid" },
      { name: "Bildirishnomalar", href: "/notifications", icon: "bell" },
    ],
  },
  {
    label: "Shartnomalar",
    icon: "file-text",
    items: [
      { name: "Shartnomalar",  href: "/contracts",   icon: "file",      permission: ["Contracts.View", "Contracts.ViewAll"] },
      { name: "Tex jarayon & Normalar", href: "/techprocess", icon: "activity", permission: ["TechProcess.View", "TechProcess.ViewAll", "CostNorm.View", "CostNorm.ViewAll"] },
    ],
  },
  {
    label: "Texnik chizmalar",
    icon: "file-text",
    items: [
      { name: "Texnik chizmalar", href: "/technicaldrawings", icon: "file", permission: ["TechnicalDrawings.View", "TechnicalDrawings.ViewAll"] },
    ],
  },
  {
    label: "Omborxona",
    icon: "package",
    items: [
      { name: "Mahsulotlar",        href: "/products",      icon: "shopping-bag", permission: "Products.View" },
      { name: "Talabnomalar",       href: "/requisitions",  icon: "clipboard",    permission: ["Requisitions.View", "Requisitions.ViewAll"] },
      { name: "Ombor tekshiruvi",   href: "/warehouse",     icon: "package" },
      { name: "Tuzilma",            href: "/departments",   icon: "briefcase",    permission: "Departments.View" },
    ],
  },
  {
    label: "Vazifalar",
    icon: "clipboard",
    items: [
      { name: "Vazifalar", href: "/tasks", icon: "check-square", permission: ["Tasks.View", "Tasks.ViewAll"] },
    ],
  },
  {
    label: "Tizim",
    icon: "settings",
    items: [
      { name: "Foydalanuvchilar",   href: "/users",       icon: "users",   permission: "Users.View" },
      { name: "Rollar",             href: "/roles",       icon: "shield",  permission: "Roles.View" },
      { name: "Tashqi ko'rinish",   href: "/appearance",  icon: "palette" },
    ],
  },
];

function LogoEmblem({ size = 22, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg
      className={spin ? "logo-spin-svg" : undefined}
      width={size} height={size} viewBox="0 0 32 32"
      fill="none" strokeLinecap="round" strokeLinejoin="round"
    >
      {/* Top face */}
      <polygon
        points="16,3 28,9.5 16,16 4,9.5"
        fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4"
      />
      {/* Left face */}
      <polygon
        points="4,9.5 4,20.5 16,27 16,16"
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4"
      />
      {/* Right face */}
      <polygon
        points="28,9.5 28,20.5 16,27 16,16"
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"
      />
      {/* Shelf line on left face */}
      <line x1="4" y1="15" x2="16" y2="21" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
      {/* Shelf line on right face */}
      <line x1="28" y1="15" x2="16" y2="21" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
    </svg>
  );
}

function NavIcon({ type, size = 16, strokeWidth = 2, color }: { type: string; size?: number; strokeWidth?: number; color?: string }) {
  const cls = "flex-shrink-0";
  const s = { stroke: color ?? "currentColor" } as React.SVGProps<SVGSVGElement>;
  if (type === "grid")         return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  if (type === "bell")         return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (type === "file")         return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
  if (type === "activity")     return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>;
  if (type === "check-square") return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (type === "users")        return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === "shield")       return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (type === "briefcase")    return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
  if (type === "layout")       return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
  if (type === "file-text")    return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>;
  if (type === "package")      return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (type === "clipboard")    return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
  if (type === "palette")      return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2 0-.54-.21-1.03-.54-1.4-.32-.36-.52-.85-.52-1.36 0-1.1.9-2 2-2h2.35C19.9 15.24 22 13.24 22 11c0-4.97-4.48-9-10-9z"/><circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
  if (type === "settings")     return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (type === "shopping-bag") return <svg className={cls} width={size} height={size} fill="none" {...s} strokeWidth={strokeWidth} viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
  return null;
}

function applyAppearanceAccent(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dk = (f: number) => `#${[r,g,b].map(v=>Math.round(v*f).toString(16).padStart(2,"0")).join("")}`;
  const lt = (f: number) => `#${[r,g,b].map(v=>Math.round(v+(255-v)*f).toString(16).padStart(2,"0")).join("")}`;
  const el = document.documentElement;
  el.style.setProperty("--accent", hex);
  el.style.setProperty("--accent2", dk(0.82));
  el.style.setProperty("--accent3", dk(0.62));
  el.style.setProperty("--accent-light", lt(0.5));
  el.style.setProperty("--accent-dim", `rgba(${r},${g},${b},0.08)`);
  el.style.setProperty("--accent-mid", `rgba(${r},${g},${b},0.15)`);
  const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
  el.style.setProperty("--sidebar-hover", `rgba(${r},${g},${b},${isDark ? 0.12 : 0.06})`);
  el.style.setProperty("--sidebar-active", `rgba(${r},${g},${b},${isDark ? 0.18 : 0.10})`);
  el.style.setProperty("--profile-text", isDark ? lt(0.5) : dk(0.62));
  el.style.setProperty("--profile-text2", isDark ? hex : dk(0.82));
  el.style.setProperty("--profile-avatar-bg", `linear-gradient(135deg, rgba(${r},${g},${b},0.12) 0%, rgba(${r},${g},${b},0.22) 50%, rgba(${r},${g},${b},0.14) 100%)`);
}

function applyAppearanceRadius(value: string) {
  const map: Record<string, [string, string]> = {
    small: ["3px", "6px"], medium: ["6px", "10px"], large: ["10px", "16px"],
  };
  const [r, r2] = map[value] ?? map.medium;
  document.documentElement.style.setProperty("--radius", r);
  document.documentElement.style.setProperty("--radius2", r2);
}

function applyAppearanceFont(family: string, scale: number) {
  document.body.style.fontSize = `${14 * (scale / 100)}px`;
  document.body.style.fontFamily = `'${family}', ${family}, sans-serif`;
}

// Sahifalar API ga ulangan bo'lsa shu ro'yxatga qo'shiladi
const readyRoutes = new Set(["/users", "/roles", "/login", "/departments", "/products", "/warehouse", "/contracts", "/techprocess", "/technicaldrawings", "/appearance", "/tasks", "/notifications", "/requisitions"]);
const readyPrefixes = ["/requisitions/", "/contracts/", "/techprocess/", "/technicaldrawings/", "/requisitions/print"];

const pageTitles: Record<string, string> = {
  "/":              "Dashboard",
  "/notifications": "Bildirishnomalar",
  "/contracts":     "Shartnomalar",
  "/techprocess":   "Tex jarayon & Normalar",
  "/technicaldrawings": "Texnik chizmalar",
  "/warehouse":     "Ombor Zaxirasi",
  "/tasks":         "Vazifalar",
  "/users":         "Foydalanuvchilar",
  "/roles":         "Rollar",
  "/departments":   "Tuzilma",
  "/products":      "Mahsulotlar",
  "/appearance":    "Tashqi ko'rinish",
  "/requisitions":        "Talabnomalar",
  "/requisitions/print":  "Talabnoma",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = pageTitles[pathname] || "OmborPro";

  const user = useAuthStore((s) => s.user);
  const logoutAction = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [notifCount, setNotifCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState<{ id: string; title: string; body: string; createdAt: string }[]>([]);

  const fetchUnreadNotifs = useCallback(async () => {
    try {
      const res = await api.get("/api/notification");
      const all = res.data.result || [];
      const unread = all.filter((n: any) => !n.isRead);
      setNotifCount(unread.length);
      setUnreadNotifs(
        unread.map((n: any) => ({
          id: n.id, title: n.title, body: n.body, createdAt: n.createdAt,
        }))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    fetchUnreadNotifs();
    const interval = setInterval(fetchUnreadNotifs, 30000);
    window.addEventListener("notif-read", fetchUnreadNotifs);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notif-read", fetchUnreadNotifs);
    };
  }, [accessToken, fetchUnreadNotifs]);

  const visibleNavGroups = navGroups.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (!item.permission) return true;
        const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
        return perms.some((p) => hasPermission(p));
      })
  })).filter((group) => group.items.length > 0);

  const isLoginPage = pathname === "/login";

  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [hasScroll, setHasScroll] = useState(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(30);
  const navRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const didDrag = useRef(false);

  const updateScrollState = () => {
    const el = navRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight > clientHeight + 1;
    setHasScroll(scrollable);
    if (scrollable) {
      const h = Math.max(clientHeight / scrollHeight * 100, 12);
      const t = scrollTop / (scrollHeight - clientHeight) * (100 - h);
      setThumbHeight(h);
      setThumbTop(t);
    }
  };

  const scrollNav = (dir: "up" | "down") => {
    navRef.current?.scrollBy({ top: dir === "up" ? -80 : 80, behavior: "smooth" });
  };

  const onThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nav = navRef.current;
    const track = trackRef.current;
    if (!nav || !track) return;
    dragState.current = { startY: e.clientY, startScrollTop: nav.scrollTop };
    const trackHeight = track.clientHeight;
    const scrollRange = nav.scrollHeight - nav.clientHeight;
    const thumbHeightPx = (nav.clientHeight / nav.scrollHeight) * trackHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      didDrag.current = true;
      const maxThumbTop = trackHeight - thumbHeightPx;
      const delta = (ev.clientY - dragState.current.startY) / maxThumbTop * scrollRange;
      nav.scrollTop = dragState.current.startScrollTop + delta;
    };

    const onMouseUp = () => {
      dragState.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // click eventini bloklash uchun qisqa kutish
      setTimeout(() => { didDrag.current = false; }, 0);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => { updateScrollState(); }, [sidebarCollapsed, collapsedGroups]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);

    // Apply saved accent color
    const savedAccent = localStorage.getItem("appearance_accent");
    if (savedAccent) applyAppearanceAccent(savedAccent);

    // Apply saved border radius
    const savedRadius = localStorage.getItem("appearance_radius");
    if (savedRadius) applyAppearanceRadius(savedRadius);

    // Apply saved font/scale
    const savedFont = localStorage.getItem("appearance_font");
    const savedScale = localStorage.getItem("appearance_scale");
    if (savedFont || savedScale) {
      applyAppearanceFont(savedFont ?? "Inter", Number(savedScale ?? 100));
    }

    // Listen for theme changes from appearance page
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.theme === "dark") setDarkMode(true);
      else if (detail?.theme === "light") setDarkMode(false);
    };
    window.addEventListener("appearance-theme", onThemeChange);
    return () => window.removeEventListener("appearance-theme", onThemeChange);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    const savedAccent = localStorage.getItem("appearance_accent");
    if (savedAccent) applyAppearanceAccent(savedAccent);
  }, [darkMode]);

  const themeVars = darkMode ? {
    "--bg": "#0d1117", "--bg2": "#161b22", "--bg3": "#1c2333",
    "--surface": "#161b22", "--surface2": "#1c2333",
    "--border": "#30363d", "--border2": "#3d4a5a",
    "--text": "#e6edf3", "--text2": "#8b949e", "--text3": "#5a6a7a",
    "--sidebar-bg": "#0d1117", "--sidebar-text": "#e6edf3", "--sidebar-text2": "#8b949e",
    "--sidebar-border": "#30363d",
    "--warn-dim": "rgba(224,123,0,0.15)", "--danger-dim": "rgba(217,48,37,0.15)",
    "--success-dim": "rgba(15,123,69,0.15)", "--purple-dim": "rgba(109,74,173,0.15)",
    "--shadow": "0 2px 12px rgba(0,0,0,0.4)", "--shadow2": "0 4px 24px rgba(0,0,0,0.5)",
    "--profile-text": "var(--accent-light)", "--profile-text2": "var(--accent)",
    "--profile-avatar-bg": "linear-gradient(135deg,var(--accent-dim) 0%,var(--accent-mid) 50%,var(--accent-dim) 100%)",
  } as React.CSSProperties : {} as React.CSSProperties;
  const toggleGroup = (label: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoginPage && !accessToken) {
      router.replace("/login");
    }
  }, [hasHydrated, isLoginPage, accessToken, router]);

  async function handleLogout() {
    await logoutAction();
    router.replace("/login");
  }

  // Get user initials for avatar
  const initials = user?.firstName && user?.lastName
    ? (user.firstName[0] + user.lastName[0]).toUpperCase()
    : user?.login
      ? user.login.slice(0, 2).toUpperCase()
      : "??";

  return (
    <html lang="uz" className={`${robotoMono.variable} ${inter.variable}${darkMode ? " dark" : ""}`} suppressHydrationWarning>
      <body className="font-body-itm" style={{
        ...themeVars,
        transition: "background 0.3s ease, color 0.3s ease",
        ...(isLoginPage
          ? { background: "var(--bg)", color: "var(--text)" }
          : { height: "100vh", overflow: "hidden", background: "var(--bg)", color: "var(--text)" }),
      }}>
      {isLoginPage ? children : !hasHydrated ? null : !accessToken ? null : (<div id="app-root" style={{ display: "flex", width: "100%", height: "100%" }}>

        {/* ===== SIDEBAR ===== */}
        <aside style={{
          width: sidebarCollapsed ? 64 : 320, minWidth: sidebarCollapsed ? 64 : 320,
          background: "var(--sidebar-bg)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "2px 0 16px rgba(0,0,0,0.18)",
          border: "1px solid var(--border)",
          transition: "width 0.25s ease, min-width 0.25s ease",
        }}>
          {/* Logo */}
          <div style={{ padding: "10px 20px", height: 58, boxSizing: "border-box", borderBottom: "1px solid var(--sidebar-border)", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
            {sidebarCollapsed ? (
              <div className="logo-icon-box" style={{
                width: 42, height: 42, borderRadius: 0,
                background: "radial-gradient(circle at 38% 32%, var(--accent-light) 0%, var(--accent) 40%, var(--accent3) 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                clipPath: "polygon(50% 0%, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%)",
                margin: "0 auto",
              }}>
                <LogoEmblem size={24} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className="logo-icon-box" style={{
                  width: 42, height: 42, borderRadius: 0,
                  background: "radial-gradient(circle at 38% 32%, var(--accent-light) 0%, var(--accent) 40%, var(--accent3) 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  clipPath: "polygon(50% 0%, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%)",
                }}>
                  <LogoEmblem size={24} />
                </div>
                <div>
                  <div className="font-head-itm ombor-text" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>FACTORY</div>
                  <div className="font-body-itm" style={{ fontSize: 10, color: "var(--sidebar-text2)", letterSpacing: 4, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-light)", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>SYSTEM</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes navItemIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
            .nav-item .nav-border { clip-path: inset(50% 0); transition: clip-path 0.3s ease; background: var(--accent); }
            .nav-item:hover .nav-border { clip-path: inset(0% 0); }
            @keyframes logoPulse {
              0%,100% { filter: drop-shadow(0 0 3px rgba(26,110,235,0.45)); }
              50% { filter: drop-shadow(0 0 10px rgba(26,110,235,0.85)); }
            }
            @keyframes omborShimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            @keyframes dotPulse {
              0%,100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
            .logo-icon-box { animation: logoPulse 2.8s ease-in-out infinite; }
            .ombor-text {
              background: linear-gradient(90deg, var(--accent) 0%, var(--accent3) 30%, #ffffff 48%, #ffffff 52%, var(--accent3) 70%, var(--accent) 100%);
              background-size: 200% auto;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: omborShimmer 2.5s linear infinite;
            }
            .live-dot { animation: dotPulse 1.6s ease-in-out infinite; }
            @keyframes logoSpin {
              0%   { transform: rotate(0deg); }
              18%  { transform: rotate(108deg); }
              22%  { transform: rotate(96deg); }
              40%  { transform: rotate(200deg); }
              44%  { transform: rotate(190deg); }
              62%  { transform: rotate(288deg); }
              66%  { transform: rotate(278deg); }
              88%  { transform: rotate(370deg); }
              92%  { transform: rotate(360deg); }
              100% { transform: rotate(360deg); }
            }
            .logo-spin-svg { animation: logoSpin 5s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: center; }
            @keyframes iconMorph {
              0%   { transform: rotate(-200deg) scale(0.1); opacity: 0; filter: blur(6px); }
              65%  { transform: rotate(15deg) scale(1.25); opacity: 1; filter: blur(0); }
              100% { transform: rotate(0deg) scale(1); opacity: 1; filter: blur(0); }
            }
            @keyframes btnGlow {
              0%   { box-shadow: 0 0 0 0 var(--glow-color, rgba(251,191,36,0.7)); }
              60%  { box-shadow: 0 0 0 7px rgba(0,0,0,0); }
              100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
            }
            .theme-icon-morph { animation: iconMorph 0.48s cubic-bezier(0.34,1.56,0.64,1) both; display: flex; }
            .theme-btn-sun  { border-color: var(--accent-light) !important; color: var(--accent-light) !important; --glow-color: var(--accent-mid); animation: btnGlow 0.5s ease-out; }
            .theme-btn-moon { border-color: var(--accent) !important; color: var(--accent) !important; --glow-color: var(--accent-mid); animation: btnGlow 0.5s ease-out; }
          `}</style>

          {/* Nav scroll wrapper */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Nav */}
          <nav ref={navRef} onScroll={updateScrollState} style={{ padding: "16px 0", flex: 1, overflowY: "scroll", overflowX: "hidden", scrollbarWidth: "none" }}>
            {visibleNavGroups.map((group) => {
              const isCollapsed = !!collapsedGroups[group.label];
              return (
                <div key={group.label} style={{ marginBottom: 10 }}>
                  <div
                    className="nav-item"
                    onClick={() => !sidebarCollapsed && toggleGroup(group.label)}
                    style={{
                      fontSize: 14, letterSpacing: sidebarCollapsed ? 0 : 0.5, color: "var(--sidebar-text)", fontWeight: 700,
                      padding: sidebarCollapsed ? "8px 0" : "8px 12px 4px", textTransform: "none",
                      display: "flex", alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "space-between",
                      cursor: sidebarCollapsed ? "default" : "pointer", userSelect: "none",
                      margin: "0 8px", borderRadius: 8, position: "relative",
                    }}
                    onMouseEnter={e => { if (!sidebarCollapsed) (e.currentTarget as HTMLElement).style.background = "linear-gradient(to right, transparent 6px, var(--sidebar-hover) 6px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {!sidebarCollapsed && <span className="nav-border" style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 3 }} />}
                    {sidebarCollapsed ? (
                      <span title={group.label} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <NavIcon type={group.icon} size={21} />
                      </span>
                    ) : (
                      <>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <NavIcon type={group.icon} size={21} />
                          {group.label}
                        </span>
                        <svg
                          width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                          style={{ transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", flexShrink: 0 }}
                        >
                          <polyline points="6,9 12,15 18,9"/>
                        </svg>
                      </>
                    )}
                  </div>
                  {!sidebarCollapsed && !isCollapsed && group.items.map((item, idx) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} className="nav-item" style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px 9px 32px",
                        color: isActive ? "var(--accent)" : "var(--sidebar-text)",
                        background: isActive ? "linear-gradient(to right, transparent 22px, var(--sidebar-active) 22px)" : "transparent",
                        textDecoration: "none", fontSize: 14, fontWeight: 400,
                        whiteSpace: "nowrap", overflow: "hidden",
                        position: "relative", transition: "all 0.14s",
                        margin: "0 8px", borderRadius: 8,
                        animation: "navItemIn 0.2s ease both",
                        animationDelay: `${idx * 60}ms`,
                      }}
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "linear-gradient(to right, transparent 22px, var(--sidebar-hover) 22px)"; } }}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
                      >
                        <span className="nav-border" style={{ position: "absolute", left: 22, top: 0, bottom: 0, width: 3 }} />
                        <span style={{ opacity: isActive ? 1 : 0.75 }}>
                          <NavIcon type={item.icon} strokeWidth={2.5} color={isActive ? "var(--accent)" : "var(--sidebar-text)"} />
                        </span>
                        {item.name}
                        {item.badge && (
                          <span style={{
                            marginLeft: "auto", minWidth: 19, height: 19, borderRadius: 9,
                            background: item.badgeWarn ? "var(--warn)" : "var(--danger)",
                            color: "#fff", fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                            fontFamily: "var(--font-mono)",
                          }}>{item.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Custom scrollbar */}
          {hasScroll && (
            <div style={{ width: 8, display: "flex", flexDirection: "column", flexShrink: 0, padding: "2px 0" }}>
              {/* Up arrow */}
              <button
                onClick={() => scrollNav("up")}
                style={{
                  height: 16, flexShrink: 0, border: "none", background: "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-mid)", padding: 0,
                  borderRadius: "3px 3px 0 0",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent-mid)"; }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="4,1 7,7 1,7"/></svg>
              </button>

              {/* Track */}
              <div
                ref={trackRef}
                style={{ flex: 1, position: "relative", background: "var(--accent-dim)", borderRadius: 3, cursor: "pointer" }}
                onClick={(e) => {
                  if (didDrag.current) return;
                  const el = navRef.current;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const ratio = (e.clientY - rect.top) / rect.height;
                  if (el) el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
                }}
              >
                <div
                  ref={thumbRef}
                  onMouseDown={onThumbMouseDown}
                  style={{
                    position: "absolute", left: 0, right: 0,
                    top: `${thumbTop}%`, height: `${thumbHeight}%`,
                    background: "var(--accent-mid)", borderRadius: 3,
                    cursor: "grab",
                  }}
                />
              </div>

              {/* Down arrow */}
              <button
                onClick={() => scrollNav("down")}
                style={{
                  height: 16, flexShrink: 0, border: "none", background: "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-mid)", padding: 0,
                  borderRadius: "0 0 3px 3px",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent-mid)"; }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="4,7 7,1 1,1"/></svg>
              </button>
            </div>
          )}
          </div>

          {/* Collapse toggle */}
          <div style={{ borderTop: "1px solid var(--sidebar-border)", padding: "10px 8px" }}>
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              style={{
                width: "100%", padding: "8px 12px",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--accent)", fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start", gap: 7,
                borderRadius: 8, transition: "background 0.15s, color 0.15s",
                textTransform: "none", letterSpacing: 0.5,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              {sidebarCollapsed ? (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, minWidth: 22 }}>
                  <polyline points="13,17 18,12 13,7"/>
                  <polyline points="6,17 11,12 6,7"/>
                </svg>
              ) : (
                <>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, minWidth: 22 }}>
                    <polyline points="11,17 6,12 11,7"/>
                    <polyline points="18,17 13,12 18,7"/>
                  </svg>
                  <span>Yig&apos;ish</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Topbar */}
          <div style={{
            height: 58, minHeight: 58,
            background: "var(--bg2)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "0 26px", gap: 14,
            boxShadow: "var(--shadow)",
          }}>
            <div className="font-head-itm" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "var(--text)", textTransform: "uppercase" }}>
              {pageTitle}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Profile card */}
              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setProfileOpen((p) => !p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 6,
                    background: "var(--profile-avatar-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 15, color: "var(--profile-text)", flexShrink: 0,
                    letterSpacing: 1,
                  }} className="font-head-itm">
                    {initials}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--profile-text)", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.login || "—"}
                    </div>
                    <div className="font-body-itm" style={{ fontSize: 12, color: "var(--profile-text2)", letterSpacing: 0.5, lineHeight: 1.2 }}>
                      {user?.role || ""}
                    </div>
                  </div>
                  <svg
                    width="14" height="14" fill="none" stroke="#1a5abf" strokeWidth="2" viewBox="0 0 24 24"
                    style={{ flexShrink: 0, transition: "transform 0.2s", transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)", stroke: "var(--profile-text2)" }}
                  >
                    <polyline points="6,9 12,15 18,9"/>
                  </svg>
                </div>

                {/* Dropdown */}
                {profileOpen && (
                  <>
                    <div
                      onClick={() => setProfileOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 99 }}
                    />
                    <div style={{
                      position: "absolute", top: "calc(100% + 10px)", right: 0,
                      background: "var(--bg2)", border: "1px solid var(--border)",
                      borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      minWidth: 150, zIndex: 100, overflow: "hidden",
                    }}>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: "100%", padding: "10px 16px",
                          background: "none", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 8,
                          color: "#e05252", fontSize: 14, fontWeight: 500,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(224,82,82,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16,17 21,12 16,7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Chiqish
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div style={{ width: 1, height: 28, background: "var(--border2)", flexShrink: 0 }} />
              {/* Dark mode toggle */}
              <div style={{ position: "relative" }} className="theme-toggle-wrap">
                <button
                  onClick={() => setDarkMode((v) => !v)}
                  className={darkMode ? "theme-btn-sun" : "theme-btn-moon"}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "none", border: "1.5px solid",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "border-color 0.3s, color 0.3s",
                  }}
                >
                  <span key={darkMode ? "sun" : "moon"} className="theme-icon-morph">
                    {darkMode ? (
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ) : (
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    )}
                  </span>
                </button>
                <div className="theme-tooltip" style={{
                  background: darkMode ? "#ffffff" : "#1a2332",
                  color: darkMode ? "#1a2332" : "#ffffff",
                }}>
                  {darkMode ? "Kunduzgi rejimga o'tkazish" : "Tungi rejimga o'tkazish"}
                </div>
              </div>
              {/* Notification bell */}
              <div style={{ position: "relative" }}>
                <button
                  className={darkMode ? "theme-btn-sun" : "theme-btn-moon"}
                  onClick={() => { setBellOpen(v => !v); if (!bellOpen) fetchUnreadNotifs(); }}
                  style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "none", border: "1.5px solid", flexShrink: 0, transition: "border-color 0.3s, color 0.3s", cursor: "pointer" }}
                >
                  <NavIcon type="bell" size={17} strokeWidth={2} color="currentColor" />
                  {notifCount > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -5,
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: "var(--danger)", color: "#fff",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 4px", lineHeight: 1,
                      fontFamily: "var(--font-mono)",
                      boxShadow: "0 0 0 2px var(--bg2)",
                    }}>
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <>
                    <div onClick={() => setBellOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 10px)", right: 0,
                      background: "var(--bg2)", border: "1px solid var(--border)",
                      borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      width: 320, zIndex: 100, overflow: "hidden",
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>O&apos;qilmagan xabarlar</span>
                        <span style={{ fontSize: 12, fontWeight: 700, background: "var(--danger)", color: "#fff", borderRadius: 9, padding: "1px 8px", fontFamily: "var(--font-mono)" }}>
                          {unreadNotifs.length}
                        </span>
                      </div>
                      {unreadNotifs.length === 0 ? (
                        <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "var(--text3)" }}>
                          O&apos;qilmagan xabar yo&apos;q
                        </div>
                      ) : (
                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                          {unreadNotifs.map(n => (
                            <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", cursor: "default" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                              <div style={{ fontSize: 12, color: "var(--text2)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                        <Link href="/notifications" onClick={() => setBellOpen(false)} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                          Barchasini ko&apos;rish →
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, position: "relative", minHeight: "100%" }}>
              {children}
              {!readyRoutes.has(pathname) && !readyPrefixes.some(p => pathname.startsWith(p)) && (
                <div style={{
                  position: "absolute", inset: 0,
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  background: "rgba(10,15,28,0.55)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 14, zIndex: 10, borderRadius: 8,
                }}>
                  <svg width="48" height="48" fill="none" stroke="#4da6ff" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.85 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                  <div className="font-head-itm" style={{ fontSize: 26, fontWeight: 800, color: "#e8f0fa", letterSpacing: 3, textTransform: "uppercase" }}>
                    Tez kunda
                  </div>
                  <div className="font-body-itm" style={{ fontSize: 11, color: "#6ab0ff", letterSpacing: 1.5 }}>
                    Bu bo&apos;lim hozircha ishlab chiqilmoqda
                  </div>
                </div>
              )}
            </div>
          </main>

        </div>
      </div>)}
      <ToastContainer />
      </body>
    </html>
  );
}
