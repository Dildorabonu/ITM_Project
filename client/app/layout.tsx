"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Roboto_Mono, Roboto_Condensed, Roboto } from "next/font/google";
import "./globals.css";
import { useAuthStore } from "@/lib/store/authStore";

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const robotoCondensed = Roboto_Condensed({
  variable: "--font-head",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const roboto = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

type NavItem = { name: string; href: string; icon: string; badge?: number; badgeWarn?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Asosiy",
    items: [
      { name: "Dashboard",        href: "/",              icon: "grid" },
      { name: "Bildirishnomalar", href: "/notifications", icon: "bell", badge: 4 },
    ],
  },
  {
    label: "Shartnomalar",
    items: [
      { name: "Shartnomalar",  href: "/contracts",   icon: "file", badge: 2, badgeWarn: true },
      { name: "Tex Protsess",  href: "/techprocess", icon: "activity" },
    ],
  },
  {
    label: "Omborxona",
    items: [
      { name: "Mahsulotlar",       href: "/warehouse", icon: "home" },
      { name: "Deficit Tekshiruv", href: "/deficit",   icon: "alert-circle", badge: 3 },
    ],
  },
  {
    label: "Vazifalar",
    items: [
      { name: "Kunlik Vazifalar", href: "/tasks", icon: "check-square" },
    ],
  },
  {
    label: "Tizim",
    items: [
      { name: "Foydalanuvchilar",   href: "/users",       icon: "users" },
      { name: "Rollar", href: "/roles",       icon: "shield" },
      { name: "Bo'limlar",          href: "/departments", icon: "briefcase" },
    ],
  },
];

function NavIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (type === "grid")         return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  if (type === "bell")         return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (type === "file")         return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
  if (type === "activity")     return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>;
  if (type === "home")         return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>;
  if (type === "alert-circle") return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  if (type === "check-square") return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (type === "users")        return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === "shield")       return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (type === "briefcase")    return <svg className={cls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
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
  const initials = user?.login
    ? user.login.slice(0, 2).toUpperCase()
    : "??";

  return (
    <html lang="uz" className={`${robotoMono.variable} ${robotoCondensed.variable} ${roboto.variable}`}>
      <body className="font-body-itm" style={
        isLoginPage
          ? { background: "var(--bg)", color: "var(--text)" }
          : { display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", color: "var(--text)" }
      }>
      {isLoginPage ? children : !hasHydrated ? null : !accessToken ? null : (<>

        {/* ===== SIDEBAR ===== */}
        <aside style={{
          width: 248, minWidth: 248,
          background: "var(--sidebar-bg)",
          display: "flex", flexDirection: "column",
          overflowY: "auto", overflowX: "hidden",
          boxShadow: "2px 0 16px rgba(0,0,0,0.18)",
        }}>
          {/* Logo */}
          <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid var(--sidebar-border)" }}>
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
                <div className="font-head-itm" style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#fff", lineHeight: 1 }}>OMBORPRO</div>
                <div className="font-mono-itm" style={{ fontSize: 9, color: "var(--sidebar-text2)", letterSpacing: 1.5, marginTop: 3 }}>KORXONA TIZIMI</div>
              </div>
            </div>
          </div>

          {/* User */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--sidebar-border)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg,#1a6eeb,#0d3e9e)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0,
              border: "2px solid rgba(26,110,235,0.4)",
            }} className="font-head-itm">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e8f0fa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.login || "—"}
              </div>
              <div className="font-mono-itm" style={{ fontSize: 10, color: "#6ab0ff", letterSpacing: 0.5 }}>
                {user?.role || ""}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Chiqish"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--sidebar-text2)", padding: 4, borderRadius: 4,
                display: "flex", alignItems: "center", flexShrink: 0,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#e05252"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--sidebar-text2)"; }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Live strip */}
          <div style={{
            background: "rgba(26,110,235,0.12)", borderBottom: "1px solid var(--sidebar-border)",
            padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
            overflow: "hidden",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: "#4da6ff", flexShrink: 0,
              animation: "pulse 1.6s infinite",
            }} />
            <div className="font-mono-itm" style={{ fontSize: 10, color: "#6ab0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Sexga: M4 bolt yetib keldi · 11:42
            </div>
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }`}</style>

          {/* Nav */}
          <nav style={{ padding: "10px 0", flex: 1 }}>
            {navGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 2 }}>
                <div className="font-mono-itm" style={{ fontSize: 9, letterSpacing: 2, color: "var(--sidebar-text2)", padding: "8px 20px 4px", textTransform: "uppercase" }}>
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 20px",
                      color: isActive ? "#7dbfff" : "var(--sidebar-text)",
                      background: isActive ? "var(--sidebar-active)" : "transparent",
                      textDecoration: "none", fontSize: 13, fontWeight: 500,
                      position: "relative", transition: "all 0.14s",
                      borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)"; (e.currentTarget as HTMLElement).style.color = "#e8f0fa"; } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; } }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.75 }}>
                        <NavIcon type={item.icon} />
                      </span>
                      {item.name}
                      {item.badge && (
                        <span style={{
                          marginLeft: "auto", minWidth: 19, height: 19, borderRadius: 9,
                          background: item.badgeWarn ? "var(--warn)" : "var(--danger)",
                          color: "#fff", fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                          fontFamily: "var(--font-mono)",
                        }}>{item.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* ===== MAIN ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Topbar */}
          <div style={{
            height: 58, minHeight: 58,
            background: "var(--bg2)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "0 26px", gap: 14,
            boxShadow: "var(--shadow)",
          }}>
            <div className="font-head-itm" style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5, color: "var(--text)", textTransform: "uppercase" }}>
              {pageTitle}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <div className="search-wrap">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="search-input" placeholder="Qidirish..." />
              </div>
              <Link href="/notifications" className="btn btn-ghost" title="Bildirishnomalar" style={{ textDecoration: "none" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </Link>
            </div>
          </div>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
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
                  <div className="font-mono-itm" style={{ fontSize: 11, color: "#6ab0ff", letterSpacing: 1.5 }}>
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
