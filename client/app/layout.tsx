"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Roboto_Mono, Inter } from "next/font/google";
import "./globals.css";
import { useAuthStore } from "@/lib/store/authStore";

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

type NavItem = { name: string; href: string; icon: string; badge?: number; badgeWarn?: boolean };
type NavGroup = { label: string; icon: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Asosiy",
    icon: "layout",
    items: [
      { name: "Dashboard",        href: "/",              icon: "grid" },
      { name: "Bildirishnomalar", href: "/notifications", icon: "bell", badge: 4 },
    ],
  },
  {
    label: "Shartnomalar",
    icon: "file-text",
    items: [
      { name: "Shartnomalar",  href: "/contracts",   icon: "file", badge: 2, badgeWarn: true },
      { name: "Tex Protsess",  href: "/techprocess", icon: "activity" },
    ],
  },
  {
    label: "Omborxona",
    icon: "package",
    items: [
      { name: "Mahsulotlar",       href: "/warehouse", icon: "home" },
      { name: "Deficit Tekshiruv", href: "/deficit",   icon: "alert-circle", badge: 3 },
    ],
  },
  {
    label: "Vazifalar",
    icon: "clipboard",
    items: [
      { name: "Kunlik Vazifalar", href: "/tasks", icon: "check-square" },
    ],
  },
  {
    label: "Tizim",
    icon: "settings",
    items: [
      { name: "Foydalanuvchilar",   href: "/users",       icon: "users" },
      { name: "Rollar", href: "/roles",       icon: "shield" },
      { name: "Bo'limlar",          href: "/departments", icon: "briefcase" },
    ],
  },
];

function NavIcon({ type, size = 16 }: { type: string; size?: number }) {
  const cls = "flex-shrink-0";
  if (type === "grid")         return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  if (type === "bell")         return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (type === "file")         return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
  if (type === "activity")     return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>;
  if (type === "home")         return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>;
  if (type === "alert-circle") return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  if (type === "check-square") return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (type === "users")        return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === "shield")       return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (type === "briefcase")    return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
  if (type === "layout")       return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
  if (type === "file-text")    return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>;
  if (type === "package")      return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (type === "clipboard")    return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
  if (type === "settings")     return <svg className={cls} width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  return null;
}

// Sahifalar API ga ulangan bo'lsa shu ro'yxatga qo'shiladi
const readyRoutes = new Set(["/users", "/roles", "/login"]);

const pageTitles: Record<string, string> = {
  "/":              "Dashboard",
  "/notifications": "Bildirishnomalar",
  "/contracts":     "Shartnomalar",
  "/techprocess":   "Tex Protsess",
  "/warehouse":     "Ombor Zaxirasi",
  "/deficit":       "Deficit Tekshiruv",
  "/tasks":         "Kunlik Vazifalar",
  "/users":         "Foydalanuvchilar",
  "/roles":         "Rollar",
  "/departments":   "Bo'limlar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = pageTitles[pathname] || "OmborPro";

  const user = useAuthStore((s) => s.user);
  const logoutAction = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const isLoginPage = pathname === "/login";

  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const themeVars = darkMode ? {
    "--bg": "#0d1117", "--bg2": "#161b22", "--bg3": "#1c2333",
    "--surface": "#161b22", "--surface2": "#1c2333",
    "--border": "#30363d", "--border2": "#3d4a5a",
    "--text": "#e6edf3", "--text2": "#8b949e", "--text3": "#5a6a7a",
    "--sidebar-bg": "#0d1117", "--sidebar-text": "#e6edf3", "--sidebar-text2": "#8b949e",
    "--sidebar-border": "#30363d",
    "--sidebar-hover": "rgba(26,110,235,0.12)", "--sidebar-active": "rgba(26,110,235,0.18)",
    "--accent-dim": "rgba(26,110,235,0.15)", "--accent-mid": "rgba(26,110,235,0.25)",
    "--warn-dim": "rgba(224,123,0,0.15)", "--danger-dim": "rgba(217,48,37,0.15)",
    "--success-dim": "rgba(15,123,69,0.15)", "--purple-dim": "rgba(109,74,173,0.15)",
    "--shadow": "0 2px 12px rgba(0,0,0,0.4)", "--shadow2": "0 4px 24px rgba(0,0,0,0.5)",
    "--profile-text": "#93bbf5", "--profile-text2": "#5a9cf8",
    "--profile-avatar-bg": "linear-gradient(135deg,rgba(26,110,235,0.3) 0%,rgba(26,110,235,0.2) 50%,rgba(13,62,158,0.35) 100%)",
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
          : { display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", color: "var(--text)" }),
      }}>
      {isLoginPage ? children : !hasHydrated ? null : !accessToken ? null : (<>

        {/* ===== SIDEBAR ===== */}
        <aside style={{
          width: sidebarCollapsed ? 64 : 320, minWidth: sidebarCollapsed ? 64 : 320,
          background: "var(--sidebar-bg)",
          display: "flex", flexDirection: "column",
          overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable",
          boxShadow: "2px 0 16px rgba(0,0,0,0.18)",
          border: "1px solid var(--border)",
          transition: "width 0.25s ease, min-width 0.25s ease",
        }}>
          {/* Logo */}
          <div style={{ padding: "10px 20px", height: 58, boxSizing: "border-box", borderBottom: "1px solid var(--sidebar-border)", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
            {sidebarCollapsed ? (
              <div style={{
                width: 38, height: 38, background: "var(--accent)", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 0 0 3px rgba(26,110,235,0.3)", margin: "0 auto",
              }}>
                <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{
                  width: 38, height: 38, background: "var(--accent)", borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  boxShadow: "0 0 0 3px rgba(26,110,235,0.3)",
                }}>
                  <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </div>
                <div>
                  <div className="font-head-itm" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "var(--text)", lineHeight: 1 }}>OMBORPRO</div>
                  <div className="font-body-itm" style={{ fontSize: 12, color: "var(--sidebar-text2)", letterSpacing: 1.5, marginTop: 3 }}>KORXONA TIZIMI</div>
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes navItemIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
            .nav-item .nav-border { clip-path: inset(50% 0); transition: clip-path 0.3s ease; background: var(--accent); }
            .nav-item:hover .nav-border { clip-path: inset(0% 0); }
          `}</style>

          {/* Nav */}
          <nav style={{ padding: "16px 0", flex: 1 }}>
            {navGroups.map((group) => {
              const isCollapsed = !!collapsedGroups[group.label];
              return (
                <div key={group.label} style={{ marginBottom: 10 }}>
                  <div
                    className="nav-item"
                    onClick={() => !sidebarCollapsed && toggleGroup(group.label)}
                    style={{
                      fontSize: 16, letterSpacing: sidebarCollapsed ? 0 : 0.5, color: "var(--sidebar-text)", fontWeight: 700,
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
                        color: isActive ? "#1a6eeb" : "var(--sidebar-text)",
                        background: isActive ? "linear-gradient(to right, transparent 22px, var(--sidebar-active) 22px)" : "transparent",
                        textDecoration: "none", fontSize: 16, fontWeight: 400,
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
                          <NavIcon type={item.icon} />
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
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "none", border: "1.5px solid var(--border2)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text2)", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)"; }}
                >
                  {darkMode ? (
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                </button>
                <div className="theme-tooltip" style={{
                  background: darkMode ? "#ffffff" : "#1a2332",
                  color: darkMode ? "#1a2332" : "#ffffff",
                }}>
                  {darkMode ? "Kunduzgi rejimga o'tkazish" : "Tungi rejimga o'tkazish"}
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
              {children}
              {!readyRoutes.has(pathname) && (
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
      </>)}
      </body>
    </html>
  );
}
