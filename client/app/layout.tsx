"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { 
  LayoutDashboard, 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Settings, 
  UserCircle,
  Bell,
  Plus
} from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Boshqaruv paneli", href: "/", icon: <LayoutDashboard size={20} /> },
    { name: "Bo'limlar", href: "/departments", icon: <Layers size={20} /> },
    { name: "Vazifalar", href: "/tasks", icon: <CheckSquare size={20} /> },
    { name: "Omborxona", href: "/inventory", icon: <Package size={20} /> },
    { name: "Hisobotlar", href: "/reports", icon: <BarChart3 size={20} /> },
    { name: "Sozlamalar", href: "/settings", icon: <Settings size={20} /> },
  ];

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-slate-50 flex h-screen overflow-hidden text-slate-900">

        {/* --- SIDEBAR --- */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
          {/* Logo Area */}
          <div className="p-8 border-b border-slate-100">
            <h1 className="text-2xl font-black tracking-tighter text-blue-600 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">ITM</div>
              <span>PROJECT</span>
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-3 mb-4">Asosiy Menyu</p>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? "bg-blue-50 text-blue-600 font-semibold" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className={`${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-6 border-t border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
              <UserCircle className="text-slate-400" size={32} />
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">Tizim Direktori</p>
                <p className="text-xs text-slate-500 truncate italic leading-tight">Administrator Huquqi</p>
              </div>
            </div>
          </div>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* HEADER */}
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {navItems.find(item => item.href === pathname)?.name || "Ishlab Chiqarishning Umumiy Ko'rinishi"}
              </h2>
              <p className="text-xs text-slate-400 font-medium">Xush kelibsiz, ishlab chiqarish oqimini kuzatib boring.</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                {pathname.startsWith("/inventory/") && pathname !== "/inventory" && (
                  <button 
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors flex items-center justify-center border border-transparent hover:border-green-100"
                    title="Yangi qo'shish"
                  >
                    <Plus size={22} className="stroke-[2.5px]" />
                  </button>
                )}
                <button className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                  <Bell size={22} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-700">Mart 2026</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Holati: Jonli</span>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
            <div className="p-10 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
          
        </div>

      </body>
    </html>
  );
}