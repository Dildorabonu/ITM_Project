"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  productService,
  departmentService,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type ProductResponse,
  type DepartmentResponse,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

const TYPE_BADGE: Record<DepartmentType, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  [DepartmentType.IshlabChiqarish]: {
    color: "var(--warn)", bg: "var(--warn-dim)", border: "rgba(224,123,0,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20" />
        <path d="M4 20V10l5 3V8l5 3V6l5 3v11" />
        <path d="M8 20v-4" /><path d="M13 20v-4" /><path d="M18 20v-4" />
      </svg>
    ),
  },
  [DepartmentType.Bolim]: {
    color: "var(--accent)", bg: "var(--accent-dim)", border: "rgba(26,110,235,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="8" height="16" rx="1" />
        <rect x="13" y="9" width="8" height="11" rx="1" />
        <path d="M6 8h2M6 12h2M6 16h2M16 13h2M16 17h2" />
      </svg>
    ),
  },
  [DepartmentType.Boshqaruv]: {
    color: "var(--purple)", bg: "var(--purple-dim)", border: "rgba(124,58,237,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 4v5c0 4.5-3.4 8.5-8 9.5C7.4 20.5 4 16.5 4 12V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
};

function fmtNum(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString("uz-UZ");
  return n.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });
}

function fmtDateTime(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DepartmentWarehouseDetailPage() {
  const params = useParams<{ departmentId: string }>();
  const router = useRouter();
  const departmentId = params?.departmentId;

  const hasPermission = useAuthStore(s => s.hasPermission);
  const user = useAuthStore(s => s.user);
  const hasHydrated = useAuthStore(s => s._hasHydrated);

  const canViewAll = hasPermission("Products.ViewAll");
  const isOwnDept = !!user?.departmentId && user.departmentId === departmentId;
  const isAuthorized = canViewAll || isOwnDept;

  const [department, setDepartment] = useState<DepartmentResponse | null>(null);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!departmentId) return;
    if (!isAuthorized) return;

    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [dept, list] = await Promise.all([
          departmentService.getById(departmentId).catch(() => null),
          productService.getByDepartment(departmentId).catch(() => [] as ProductResponse[]),
        ]);
        if (!active) return;
        setDepartment(dept);
        setProducts(list);
      } catch {
        if (active) {
          setError("Bo'lim mahsulotlarini yuklashda xatolik yuz berdi.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [hasHydrated, departmentId, isAuthorized]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (filterUnit !== "" && p.unit !== Number(filterUnit)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.invoiceNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, filterUnit]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, p) => {
      acc.qty += p.quantity;
      return acc;
    }, { qty: 0 });
  }, [filtered]);

  if (!hasHydrated) {
    return (
      <div className="page-transition min-h-screen flex items-center justify-center">
        <div className="nd-spinner" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="page-transition min-h-screen p-6">
        <div className="bg-[--surface] border border-[--border] rounded-[--radius2] p-8 text-center max-w-md mx-auto mt-12">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[--danger-dim] text-[--danger] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h2 className="font-head-itm text-lg font-bold text-[--text]">Ruxsat yo&apos;q</h2>
          <p className="text-sm text-[--text3] mt-2">
            Sizda boshqa bo&apos;lim omborini ko&apos;rish uchun ruxsat yo&apos;q. Faqat o&apos;zingizning bo&apos;lim
            omboringizni ko&apos;ra olasiz.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-5 px-4 py-2 bg-[--accent] text-white text-sm font-semibold
                       rounded-[--radius] hover:bg-[--accent2] active:scale-[0.97]
                       transition-all duration-150 cursor-pointer"
          >
            Orqaga
          </button>
        </div>
      </div>
    );
  }

  const deptType = department?.type ?? DepartmentType.Bolim;
  const badge = TYPE_BADGE[deptType] ?? TYPE_BADGE[DepartmentType.Bolim];

  return (
    <div className="page-transition min-h-screen">
      {/* Breadcrumb */}
      {canViewAll && (
        <div className="mb-4 flex items-center gap-1.5 text-xs text-[--text3]">
          <Link href="/department-warehouses" className="hover:text-[--accent] transition-colors">
            Bo&apos;lim Omborlari
          </Link>
          <span>/</span>
          <span className="text-[--text2]">{department?.name ?? "..."}</span>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-[--radius2] flex items-center justify-center shrink-0"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
          >
            {badge.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1 h-3.5 rounded-full" style={{ background: badge.color }} />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: badge.color }}
              >
                {department ? DEPARTMENT_TYPE_LABELS[deptType] : "Bo'lim ombori"}
              </span>
            </div>
            <h1 className="font-head-itm text-[22px] font-bold text-[--text] tracking-tight leading-tight">
              {department?.name ?? "Bo'lim ombori"}
            </h1>
            <p className="text-sm text-[--text3] mt-0.5">
              Ombordan chiqarib berilgan mahsulotlar ro&apos;yxati
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--text3] pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish..."
              className="w-60 bg-[--surface] border border-[--border] rounded-[--radius]
                         pl-8 pr-3 py-2 text-sm text-[--text] placeholder:text-[--text3]
                         focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent-dim]
                         transition-colors duration-150"
            />
          </div>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="bg-[--surface] border border-[--border] rounded-[--radius]
                       px-3 py-2 text-sm text-[--text]
                       focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent-dim]
                       transition-colors duration-150 cursor-pointer"
          >
            <option value="">Barcha birliklar</option>
            {(Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(k => (
              <option key={k} value={k}>{PRODUCT_UNIT_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="relative bg-[--surface] border border-[--border] rounded-[--radius] p-4 overflow-hidden group hover:border-[--border2] transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[--text3] mb-1.5">
                Mahsulot turlari
              </p>
              <p className="text-[22px] font-bold font-mono text-[--text] leading-none">{fmtNum(filtered.length)}</p>
            </div>
            <div className="w-8 h-8 rounded-[--radius] bg-[--surface2] flex items-center justify-center text-[--accent]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--accent] opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="relative bg-[--surface] border border-[--border] rounded-[--radius] p-4 overflow-hidden group hover:border-[--border2] transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[--text3] mb-1.5">
                Jami miqdor
              </p>
              <p className="text-[22px] font-bold font-mono text-[--text] leading-none">{fmtNum(totals.qty)}</p>
            </div>
            <div className="w-8 h-8 rounded-[--radius] bg-[--surface2] flex items-center justify-center text-[--warn]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--warn] opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="relative bg-[--surface] border border-[--border] rounded-[--radius] p-4 overflow-hidden group hover:border-[--border2] transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[--text3] mb-1.5">
                Ko&apos;rinish rejimi
              </p>
              <p className="text-sm font-bold text-[--text] leading-none mt-1.5 inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: canViewAll ? "var(--accent)" : "var(--success)" }}
                />
                {canViewAll ? "Hammasini ko'rish" : "O'z bo'limim"}
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-[--radius] bg-[--surface2] flex items-center justify-center"
              style={{ color: canViewAll ? "var(--accent)" : "var(--success)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-100 transition-opacity"
            style={{ background: canViewAll ? "var(--accent)" : "var(--success)" }}
          />
        </div>
      </div>

      {/* Products table */}
      <div className="bg-[--surface] border border-[--border] rounded-[--radius2] overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="nd-spinner" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[--danger]">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[--surface2] flex items-center justify-center text-[--text3]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p className="font-head-itm text-base font-semibold text-[--text]">
              {search || filterUnit ? "Filtrga mos mahsulot topilmadi" : "Bu omborda hali mahsulot yo'q"}
            </p>
            <p className="text-sm text-[--text3] mt-1 max-w-md mx-auto">
              {search || filterUnit
                ? "Qidiruv yoki birlik filterini o'zgartirib ko'ring."
                : "Talabnoma orqali ombordan olganingizdan keyin mahsulotlar shu yerda ko'rinadi."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[--bg2]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[--text3] border-b border-[--border]">
                    Mahsulot
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[--text3] border-b border-[--border]">
                    Invoice №
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[--text3] border-b border-[--border]">
                    Miqdor
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[--text3] border-b border-[--border]">
                    Birlik
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[--text3] border-b border-[--border]">
                    Tushgan sana
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`nd-fadein-${Math.min(i, 4)} border-b border-[--border]
                                hover:bg-[--surface2] transition-colors duration-100`}
                  >
                    <td className="px-3 py-2.5 text-[--text]">
                      <div className="font-medium">{p.name}</div>
                      {p.description && (
                        <div className="text-[11px] text-[--text3] mt-0.5 line-clamp-1">{p.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-[--accent]">{p.invoiceNumber}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[--text]">
                      {fmtNum(p.quantity)}
                    </td>
                    <td className="px-3 py-2.5 text-[--text2]">
                      {PRODUCT_UNIT_LABELS[p.unit] ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[--text3] font-mono text-xs">
                      {fmtDateTime(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
