"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  productService,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type DepartmentWarehouseSummary,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

// Saturated tile palette — deterministic per department
const TILE_PALETTE: { bg: string; soft: string }[] = [
  { bg: "#5E84C9", soft: "#88A6DA" }, // blue
  { bg: "#4FB1F2", soft: "#85C7F5" }, // sky
  { bg: "#E7A06B", soft: "#EEB892" }, // peach
  { bg: "#8198BD", soft: "#A2B3CF" }, // slate
  { bg: "#67BB66", soft: "#8FCC8E" }, // green
  { bg: "#DD7F7F", soft: "#E8A2A2" }, // coral
  { bg: "#62BFA1", soft: "#8DD2B9" }, // mint
  { bg: "#C16464", soft: "#D08C8C" }, // red
  { bg: "#4DB6A6", soft: "#7BC8BC" }, // teal
  { bg: "#B6B561", soft: "#CCCB8B" }, // olive
  { bg: "#A571C3", soft: "#BC95D2" }, // purple
  { bg: "#E6964F", soft: "#EEB07A" }, // amber
  { bg: "#6F7DB8", soft: "#9099C9" }, // indigo
  { bg: "#D67AB3", soft: "#E2A1C8" }, // pink
];

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}

function getTileColor(id: string) {
  return TILE_PALETTE[hashStr(id) % TILE_PALETTE.length];
}

// 12 distinct outline icons — industrial / warehouse themed
const TILE_ICONS: React.ReactNode[] = [
  // 0 — boxes stacked
  <g key="boxes" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="8" height="9" rx="0.5" />
    <rect x="13" y="11" width="8" height="9" rx="0.5" />
    <rect x="8" y="3" width="8" height="8" rx="0.5" />
    <path d="M7 11v3M15 11v3M12 3v3" />
  </g>,
  // 1 — factory
  <g key="factory" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V10l5 3V8l5 3V8l5 3v10z" />
    <path d="M3 21h18M7 17v2M11 17v2M15 17v2M19 17v2" />
    <path d="M16 5l1-2h2l1 2" />
  </g>,
  // 2 — gears
  <g key="gears" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="3" />
    <path d="M9 3v2M9 13v2M3 9h2M13 9h2M5 5l1.5 1.5M11.5 11.5L13 13M5 13l1.5-1.5M11.5 6.5L13 5" />
    <circle cx="16" cy="16" r="2.5" />
    <path d="M16 12v1.5M16 18.5V20M12 16h1.5M18.5 16H20" />
  </g>,
  // 3 — conveyor
  <g key="conveyor" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="14" width="18" height="5" rx="2.5" />
    <circle cx="7" cy="16.5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
    <circle cx="17" cy="16.5" r="0.6" fill="currentColor" />
    <rect x="6" y="7" width="6" height="5" rx="0.5" />
    <rect x="14" y="5" width="5" height="7" rx="0.5" />
  </g>,
  // 4 — robot arm
  <g key="arm" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="18" width="18" height="3" rx="0.5" />
    <path d="M7 18v-4l5-5 4 3" />
    <circle cx="7" cy="14" r="1.4" />
    <circle cx="12" cy="9" r="1.4" />
    <path d="M16 12l3-3 2 2-3 3z" />
  </g>,
  // 5 — beaker
  <g key="beaker" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 18l-5-9V3" />
    <path d="M8 3h8" />
    <path d="M7 14h10" />
  </g>,
  // 6 — chip
  <g key="chip" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="1" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </g>,
  // 7 — shield
  <g key="shield" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 4v5c0 4.5-3.4 8.5-8 9.5C7.4 20.5 4 16.5 4 12V7l8-4z" />
    <path d="M9 12l2 2 4-4" />
  </g>,
  // 8 — server stack
  <g key="server" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="6" rx="1" />
    <rect x="3" y="14" width="18" height="6" rx="1" />
    <path d="M6 7h.01M6 17h.01M10 7h6M10 17h6" />
  </g>,
  // 9 — truck
  <g key="truck" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="11" height="9" rx="1" />
    <path d="M13 10h4l3 3v3h-7z" />
    <circle cx="6.5" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </g>,
  // 10 — wrench
  <g key="wrench" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.2 2.2-2.4-2.4z" />
  </g>,
  // 11 — clipboard
  <g key="clipboard" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="14" height="16" rx="1.5" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 15h6M9 18h4" />
  </g>,
];

function getTileIcon(id: string) {
  return TILE_ICONS[hashStr(id + "·icon") % TILE_ICONS.length];
}

const TYPE_LABEL_COLOR: Record<DepartmentType, string> = {
  [DepartmentType.IshlabChiqarish]: "var(--warn)",
  [DepartmentType.Bolim]: "var(--accent)",
  [DepartmentType.Boshqaruv]: "var(--purple)",
};

function fmtNum(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString("uz-UZ");
  return n.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("uz-UZ");
}

export default function DepartmentWarehousesPage() {
  const router = useRouter();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const user = useAuthStore(s => s.user);
  const hasHydrated = useAuthStore(s => s._hasHydrated);

  const canViewAll = hasPermission("Products.ViewAll");

  const [summaries, setSummaries] = useState<DepartmentWarehouseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!canViewAll && user?.departmentId) {
      router.replace(`/department-warehouses/${user.departmentId}`);
    }
  }, [hasHydrated, canViewAll, user?.departmentId, router]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!canViewAll) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await productService.getDepartmentSummaries();
        if (active) setSummaries(data);
      } catch {
        if (active) {
          setSummaries([]);
          setError("Bo'lim omborlari ro'yxatini yuklashda xatolik yuz berdi.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [hasHydrated, canViewAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter(s => {
      if (filterType !== "" && s.departmentType !== Number(filterType)) return false;
      if (q && !s.departmentName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [summaries, search, filterType]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, s) => {
      acc.products += s.productCount;
      acc.qty += s.totalQuantity;
      return acc;
    }, { products: 0, qty: 0 });
  }, [filtered]);

  if (!hasHydrated || (!canViewAll && user?.departmentId)) {
    return (
      <div className="page-transition min-h-screen flex items-center justify-center">
        <div className="nd-spinner" />
      </div>
    );
  }

  if (!canViewAll && !user?.departmentId) {
    return (
      <div className="page-transition min-h-screen p-6">
        <div className="bg-[--surface] border border-[--border] rounded-[--radius2] p-8 text-center max-w-md mx-auto mt-12">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[--danger-dim] text-[--danger] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h2 className="font-head-itm text-lg font-bold text-[--text]">Bo&apos;limga bog&apos;lanmagan</h2>
          <p className="text-sm text-[--text3] mt-2">
            Sizning hisobingiz biror bo&apos;limga ulanmaganligi uchun bo&apos;lim omborini ko&apos;ra olmaysiz.
            Iltimos, administrator bilan bog&apos;laning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition min-h-screen px-6 py-6">
      {/* Compact header */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-[--accent]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[--text3]">
              Ombor / Bo&apos;limlar
            </span>
          </div>
          <h1 className="font-head-itm text-[30px] font-bold text-[--text] tracking-tight leading-none">
            Bo&apos;lim Omborlari
          </h1>
          <p className="text-[13px] text-[--text3] mt-3 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono font-semibold text-[--text2]">{fmtNum(filtered.length)}</span>
              bo&apos;lim
            </span>
            <span className="text-[--border2]">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono font-semibold text-[--text2]">{fmtNum(totals.products)}</span>
              mahsulot turi
            </span>
            <span className="text-[--border2]">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono font-semibold text-[--text2]">{fmtNum(totals.qty)}</span>
              birlik
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text3] pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bo'lim qidirish..."
              className="w-64 bg-[--surface] border border-[--border] rounded-[--radius]
                         pl-10 pr-3 py-2.5 text-sm text-[--text] placeholder:text-[--text3]
                         focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent-dim]
                         transition-colors duration-150"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[--surface] border border-[--border] rounded-[--radius]
                       px-3.5 py-2.5 text-sm text-[--text] min-w-[160px]
                       focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent-dim]
                       transition-colors duration-150 cursor-pointer"
          >
            <option value="">Barcha turlar</option>
            <option value={DepartmentType.IshlabChiqarish}>Ishlab chiqarish</option>
            <option value={DepartmentType.Bolim}>Bo&apos;lim</option>
            <option value={DepartmentType.Boshqaruv}>Boshqaruv</option>
          </select>
        </div>
      </div>

      {/* Tile grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-[20px] aspect-[5/3.5] animate-pulse bg-[--surface2]" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[--danger-dim] text-[--danger] border border-[--danger] rounded-[--radius] p-4 text-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[--surface] border border-[--border] rounded-[--radius2] p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[--surface2] flex items-center justify-center text-[--text3]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <p className="font-head-itm text-base font-semibold text-[--text]">
            {search || filterType ? "Filtrga mos bo'lim topilmadi" : "Hozircha bo'limlar yo'q"}
          </p>
          <p className="text-sm text-[--text3] mt-1">
            {search || filterType
              ? "Qidiruv yoki filter shartlarini o'zgartirib ko'ring."
              : "Bo'lim omborlari paydo bo'lganda shu yerda ko'rinadi."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((s, i) => {
            const color = getTileColor(s.departmentId);
            const icon = getTileIcon(s.departmentId);
            const isEmpty = s.productCount === 0;
            const typeLabel = DEPARTMENT_TYPE_LABELS[s.departmentType as DepartmentType] ?? "—";

            return (
              <Link
                key={s.departmentId}
                href={`/department-warehouses/${s.departmentId}`}
                className={`nd-fadein-${Math.min(i, 4)} group relative overflow-hidden
                            flex flex-col rounded-[20px] aspect-[5/3.5]
                            shadow-[0_6px_18px_rgba(0,0,0,0.32)]
                            transition-all duration-300 ease-out cursor-pointer
                            hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(0,0,0,0.45)]`}
                style={{
                  background: isEmpty
                    ? "linear-gradient(135deg, #3a3f4a 0%, #2c303a 100%)"
                    : `linear-gradient(135deg, ${color.soft} 0%, ${color.bg} 65%, ${color.bg} 100%)`,
                }}
              >
                {/* Soft highlight behind icon (top-left) */}
                <span
                  className="absolute -top-14 -left-14 w-52 h-52 rounded-full opacity-35 pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 60%)" }}
                />

                {/* Top row: icon (with halo) + quantity badge */}
                <div className="relative px-5 pt-5">
                  <span className="relative inline-flex items-center justify-center">
                    <svg
                      width="56" height="56" viewBox="0 0 24 24"
                      className="relative text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                    >
                      {icon}
                    </svg>
                  </span>
                  <span
                    className="absolute top-5 right-5 inline-flex items-center justify-center whitespace-nowrap min-w-[52px] h-[36px] px-4 rounded-full
                               bg-[rgba(15,18,25,0.78)] backdrop-blur-md text-white text-[14px] leading-none
                               font-mono font-bold tracking-tight
                               ring-[3px] ring-white/30 shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
                  >
                    {isEmpty ? "0" : fmtCompact(s.totalQuantity)}
                  </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Bottom content — title big, meta subtle */}
                <div className="relative px-6 pb-6">
                  <h3 className="font-head-itm text-[22px] font-bold text-white leading-[1.15]
                                 line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)] mb-2.5">
                    {s.departmentName}
                  </h3>

                  <div className="flex items-center justify-between text-[12px] text-white/85">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: isEmpty
                            ? "rgba(255,255,255,0.5)"
                            : TYPE_LABEL_COLOR[s.departmentType as DepartmentType] ?? "white",
                        }}
                      />
                      <span className="font-semibold uppercase tracking-[0.12em] text-white/85">
                        {typeLabel}
                      </span>
                      <span className="text-white/40">·</span>
                      <span className="font-mono">
                        {isEmpty ? "bo'sh" : `${fmtNum(s.productCount)} tur`}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-white/95
                                     transition-transform duration-200 group-hover:translate-x-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
