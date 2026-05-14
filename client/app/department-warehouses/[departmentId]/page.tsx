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
import { CheckSelect } from "@/app/_components/CheckSelect";

const UNIT_FILTER_OPTIONS = (Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(k => ({
  id: String(k),
  name: PRODUCT_UNIT_LABELS[k],
}));

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
  [DepartmentType.Omborxona]: {
    color: "var(--success)", bg: "var(--success-dim)", border: "rgba(15,123,69,0.35)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
        <path d="M3 13h18" />
        <path d="M9 21V13" /><path d="M15 21V13" />
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
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Compact page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {canViewAll && (
          <Link
            href="/department-warehouses"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", background: "var(--bg3)",
              border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
              fontWeight: 600, fontSize: 13, color: "var(--text2)",
              flexShrink: 0, transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Orqaga
          </Link>
        )}
        <div
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, borderRadius: "var(--radius)",
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
            flexShrink: 0,
          }}
        >
          {badge.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", color: badge.color, textTransform: "uppercase", marginBottom: 2 }}>
            {department ? DEPARTMENT_TYPE_LABELS[deptType] : "Bo'lim ombori"}
          </div>
          <div className="font-head-itm" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            {department?.name ?? "Bo'lim ombori"}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: mahsulot nomi yoki invoice..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <CheckSelect
          value={filterUnit}
          onChange={setFilterUnit}
          options={UNIT_FILTER_OPTIONS}
          placeholder="Barcha birliklar"
          style={{ width: 200 }}
        />
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Mahsulot nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Invoice raqami</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Soni</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>O&apos;lchov</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Tavsif</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Tushgan sana</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                      {search || filterUnit
                        ? "Filtrga mos mahsulot topilmadi"
                        : "Bu omborda hali mahsulot yo'q"}
                    </td>
                  </tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ textAlign: "center" }}>{p.name}</td>
                    <td style={{ textAlign: "center", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{p.invoiceNumber || "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{fmtNum(p.quantity)}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{PRODUCT_UNIT_LABELS[p.unit] ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.description ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{fmtDateTime(p.createdAt)}</td>
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
