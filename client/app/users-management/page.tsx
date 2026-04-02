"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  userService,
  roleService,
  departmentService,
  type UserResponse,
  type RoleOption,
  type DepartmentOption,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

/* ───── Icons ───── */

function SearchIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function EyeIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EditIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function ShieldIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}
function ChevLeftIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevRightIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>;
}

/* ───── Constants ───── */

const PAGE_SIZE = 10;

/* ───── Page ───── */

export default function UsersManagementPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch lookup data on mount
  useEffect(() => {
    if (!accessToken) return;

    const loadLookups = async () => {
      const [rolesRes, deptsRes] = await Promise.allSettled([
        roleService.getAll(),
        departmentService.getAll(),
      ]);
      if (rolesRes.status === "fulfilled") setRoles(rolesRes.value);
      if (deptsRes.status === "fulfilled") setDepartments(deptsRes.value);
    };
    loadLookups();
  }, [accessToken]);

  // Fetch users (paginated)
  useEffect(() => {
    if (!accessToken) return;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const res = await userService.getAll(currentPage, PAGE_SIZE);
        setUsers(res.items ?? []);
        setTotalCount(res.totalCount ?? 0);
      } catch {
        setUsers([]);
        setTotalCount(0);
      }
      setLoading(false);
    };
    loadUsers();
  }, [accessToken, currentPage]);

  // Client-side filtering (search, dept, role, status)
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        u.login.toLowerCase().includes(search.toLowerCase());
      const matchDept = !deptFilter || u.departmentId === deptFilter;
      const matchRole = !roleFilter || u.roleId === roleFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === "active" && u.isActive) ||
        (statusFilter === "inactive" && !u.isActive);
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [users, search, deptFilter, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Summary counts (from current page data + total)
  const activeOnPage = users.filter((u) => u.isActive).length;
  const inactiveOnPage = users.filter((u) => !u.isActive).length;

  function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function getRoleBadgeClass(roleName: string | null): string {
    if (!roleName) return "um-badge";
    const lower = roleName.toLowerCase();
    if (lower.includes("admin")) return "um-badge um-badge-admin";
    if (lower.includes("boshli") || lower.includes("director") || lower.includes("manager")) return "um-badge um-badge-manager";
    return "um-badge um-badge-worker";
  }

  if (loading && users.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--text3)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          Yuklanmoqda...
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title">Foydalanuvchilar boshqaruvi</h1>
          <p className="dash-subtitle">
            Ichki foydalanuvchilarni monitoring qilish va boshqarish
          </p>
        </div>
        <div className="dash-header-right">
          <button className="btn btn-primary" type="button" onClick={() => router.push("/users")}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Foydalanuvchi qo&apos;shish
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="um-summary-row">
        <div className="um-summary-card">
          <div className="um-summary-icon" style={{ background: "var(--accent-dim)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{totalCount}</span>
            <span className="um-summary-label">Jami foydalanuvchilar</span>
          </div>
        </div>
        <div className="um-summary-card">
          <div className="um-summary-icon" style={{ background: "var(--success-dim)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{activeOnPage}</span>
            <span className="um-summary-label">Faol (sahifada)</span>
          </div>
        </div>
        <div className="um-summary-card">
          <div className="um-summary-icon" style={{ background: "var(--surface2)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{inactiveOnPage}</span>
            <span className="um-summary-label">Nofaol (sahifada)</span>
          </div>
        </div>
        <div className="um-summary-card">
          <div className="um-summary-icon" style={{ background: "var(--purple-dim)" }}>
            <svg width="16" height="16" fill="none" stroke="var(--purple)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="um-summary-info">
            <span className="um-summary-value">{roles.length}</span>
            <span className="um-summary-label">Rollar soni</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="um-controls">
        <div className="um-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Ism yoki login bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="um-filter-select"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          aria-label="Bo'lim filtri"
        >
          <option value="">Bo&apos;lim: Barchasi</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className="um-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Rol filtri"
        >
          <option value="">Rol: Barchasi</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          className="um-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Holat filtri"
        >
          <option value="">Holat: Barchasi</option>
          <option value="active">Faol</option>
          <option value="inactive">Nofaol</option>
        </select>
      </div>

      {/* Table */}
      <div className="itm-card">
        <div className="um-table-wrap">
          <table className="itm-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", width: "18%" }}>F.I.SH</th>
                <th style={{ textAlign: "left", width: "16%" }}>Login</th>
                <th style={{ width: "14%" }}>Rol</th>
                <th style={{ width: "16%" }}>Bo&apos;lim</th>
                <th style={{ width: "10%" }}>Holat</th>
                <th style={{ width: "12%" }}>Yaratilgan</th>
                <th style={{ width: "14%" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td style={{ textAlign: "left", fontWeight: 500 }}>
                    {user.firstName} {user.lastName}
                    {user.isHead && (
                      <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Boshliq
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "left", color: "var(--text2)", fontSize: 13 }}>
                    {user.login}
                  </td>
                  <td>
                    <span className={getRoleBadgeClass(user.roleName)}>
                      {user.roleName || "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text2)" }}>
                    {user.departmentName || "—"}
                  </td>
                  <td>
                    <span className={`um-badge ${user.isActive ? "um-badge-active" : "um-badge-inactive"}`}>
                      {user.isActive ? "Faol" : "Nofaol"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="td-actions">
                    <div className="um-actions">
                      <button className="um-action-btn" title="Ko'rish" type="button">
                        <EyeIcon />
                      </button>
                      <button className="um-action-btn" title="Tahrirlash" type="button">
                        <EditIcon />
                      </button>
                      <button className="um-action-btn" title="Rolni o'zgartirish" type="button">
                        <ShieldIcon />
                      </button>
                      <button className="um-action-btn danger" title="O'chirish" type="button">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>
                    Foydalanuvchilar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="um-pagination">
          <span className="um-pagination-info">
            Jami {totalCount} ta foydalanuvchi · Sahifa {currentPage} / {totalPages}
          </span>
          <div className="um-pagination-btns">
            <button
              className="um-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              type="button"
              aria-label="Oldingi sahifa"
            >
              <ChevLeftIcon />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;
                return (
                  <span key={p} style={{ display: "contents" }}>
                    {showEllipsis && <span style={{ padding: "0 4px", color: "var(--text3)" }}>...</span>}
                    <button
                      className={`um-page-btn ${p === currentPage ? "active" : ""}`}
                      onClick={() => setCurrentPage(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
            <button
              className="um-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              type="button"
              aria-label="Keyingi sahifa"
            >
              <ChevRightIcon />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
