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
import { CheckSelect } from "@/app/_components/CheckSelect";

const TYPE_FILTER_OPTIONS = [
  { id: String(DepartmentType.IshlabChiqarish), name: DEPARTMENT_TYPE_LABELS[DepartmentType.IshlabChiqarish] },
  { id: String(DepartmentType.Bolim),           name: DEPARTMENT_TYPE_LABELS[DepartmentType.Bolim] },
  { id: String(DepartmentType.Boshqaruv),       name: DEPARTMENT_TYPE_LABELS[DepartmentType.Boshqaruv] },
];

// Build a stable color map for the full department set so that every visible
// tile receives a hue exactly 137.508° (golden angle) away from its neighbours.
// Hash-based mapping looks random in theory but suffers from the birthday
// paradox in practice — with only ~23 IDs spread over 360° clusters appear.
// Index-based golden-angle assignment guarantees maximum perceptual spacing.
function buildColorMap(ids: string[], theme: "dark" | "light") {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, { bg: string; soft: string }>();
  sorted.forEach((id, i) => {
    const hue = (i * 137.508) % 360;
    map.set(id, theme === "dark"
      ? {
          bg: `oklch(88% 0.075 ${hue})`,  // airy pastel — bottom-right
          soft: `oklch(93% 0.06 ${hue})`, // slightly lighter top-left
        }
      : {
          bg: `oklch(90% 0.07 ${hue})`,   // airy pastel — bottom-right
          soft: `oklch(94% 0.055 ${hue})`, // slightly lighter top-left
        });
  });
  return map;
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ theme?: "dark" | "light" }>).detail;
      if (detail?.theme === "dark" || detail?.theme === "light") {
        setTheme(detail.theme);
      }
    };
    window.addEventListener("appearance-theme", onChange);
    return () => window.removeEventListener("appearance-theme", onChange);
  }, []);

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

  // Stable color map keyed on the full department set — filtering/searching
  // never reshuffles hues, but adding/removing departments rebalances them.
  const colorMap = useMemo(
    () => buildColorMap(summaries.map(s => s.departmentId), theme),
    [summaries, theme],
  );

  const isDark = theme === "dark";

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
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Bo'lim qidirish..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <CheckSelect
          value={filterType}
          onChange={setFilterType}
          options={TYPE_FILTER_OPTIONS}
          placeholder="Barcha turlar"
          style={{ width: 200 }}
        />
      </div>

      {/* Tile grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-[16px] aspect-[5/4.8] animate-pulse bg-[--surface2]" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((s, i) => {
            const color = colorMap.get(s.departmentId)!;
            const isEmpty = s.productCount === 0;

            const emptyBg = "linear-gradient(135deg, #eef0f3 0%, #dfe2e8 100%)";
            const cardShadow = isDark
              ? "shadow-[0_6px_18px_rgba(0,0,0,0.32)] hover:shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
              : "shadow-[0_4px_14px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_32px_rgba(15,23,42,0.16)]";
            const badgeClass = "inline-flex items-center justify-center font-mono text-[12px] font-semibold text-white bg-[#6b7280] px-3.5 h-[28px] min-w-[36px] rounded-full";
            const titleClass = "font-head-itm text-[17px] font-bold text-[#1f2430] leading-snug tracking-tight";
            return (
              <Link
                key={s.departmentId}
                href={`/department-warehouses/${s.departmentId}`}
                className={`nd-fadein-${Math.min(i, 4)} group relative overflow-hidden
                            block rounded-[16px] aspect-[5/4.8]
                            ${cardShadow}
                            transition-all duration-300 ease-out cursor-pointer
                            hover:-translate-y-1`}
                style={{
                  background: isEmpty
                    ? emptyBg
                    : `linear-gradient(135deg, ${color.soft} 0%, ${color.bg} 100%)`,
                }}
              >
                {/* Badge — top-right, has its own offset */}
                <span className={`${badgeClass} absolute top-[18px] right-[16px]`}>
                  {isEmpty ? "0" : fmtCompact(s.totalQuantity)}
                </span>

                {/* Title — fixed 2-line area anchored to bottom; text starts at top so 1- and 2-line names align */}
                <h3
                  className={`${titleClass} absolute bottom-[16px] left-[16px] right-[16px] h-[48px] flex items-start`}
                  title={s.departmentName}
                >
                  <span className="line-clamp-2 [word-break:break-word]">
                    {s.departmentName}
                  </span>
                </h3>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
