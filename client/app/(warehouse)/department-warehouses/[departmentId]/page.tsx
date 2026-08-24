"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  productService,
  PRODUCT_UNIT_LABELS,
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  type DepartmentWarehouseDetail,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { UNIT_FILTER_OPTIONS, fmtNum, fmtDateTime } from "../_types";
import { TYPE_BADGE } from "../_components/typeBadge";
import { useT } from "@/lib/i18n";

export default function DepartmentWarehouseDetailPage() {
  const t = useT();
  const params = useParams<{ departmentId: string }>();
  const router = useRouter();
  const departmentId = params?.departmentId;

  const hasPermission = useAuthStore(s => s.hasPermission);
  const user = useAuthStore(s => s.user);
  const hasHydrated = useAuthStore(s => s._hasHydrated);

  const canViewAll = hasPermission("Products.ViewAll");
  const isOwnDept = !!user?.departmentId && user.departmentId === departmentId;
  const isAuthorized = canViewAll || isOwnDept;

  const [detail, setDetail] = useState<DepartmentWarehouseDetail | null>(null);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!departmentId) return;
    if (!isAuthorized) return;

    let active = true;
    (async () => {
      setLoading(true);
      const data = await productService.getByDepartment(departmentId).catch(() => null);
      if (!active) return;
      setDetail(data);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [hasHydrated, departmentId, isAuthorized]);

  const filtered = useMemo(() => {
    const products = detail?.products ?? [];
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (filterUnit !== "" && p.unit !== Number(filterUnit)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.invoiceNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [detail, search, filterUnit]);

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
          <h2 className="font-head-itm text-lg font-bold text-[--text]">{t("Ruxsat yo'q")}</h2>
          <p className="text-sm text-[--text3] mt-2">
            {t("Sizda boshqa bo'lim omborini ko'rish uchun ruxsat yo'q. Faqat o'zingizning bo'lim omboringizni ko'ra olasiz.")}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-5 px-4 py-2 bg-[--accent] text-white text-sm font-semibold
                       rounded-[--radius] hover:bg-[--accent2] active:scale-[0.97]
                       transition-all duration-150 cursor-pointer"
          >
            {t("Orqaga")}
          </button>
        </div>
      </div>
    );
  }

  const deptType = detail?.departmentType ?? DepartmentType.Bolim;
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
            {t("Orqaga")}
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
            {detail ? DEPARTMENT_TYPE_LABELS[deptType] : t("Bo'lim ombori")}
          </div>
          <div className="font-head-itm" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            {detail?.departmentName || t("Bo'lim ombori")}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Qidirish: mahsulot nomi yoki invoice...")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <CheckSelect
          value={filterUnit}
          onChange={setFilterUnit}
          options={UNIT_FILTER_OPTIONS}
          placeholder={t("Barcha birliklar")}
          style={{ width: 200 }}
        />
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Mahsulot nomi")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Invoice raqami")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Soni")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("O'lchov")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Tavsif")}</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{t("Tushgan sana")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                      {search || filterUnit
                        ? t("Filtrga mos mahsulot topilmadi")
                        : t("Bu omborda hali mahsulot yo'q")}
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
