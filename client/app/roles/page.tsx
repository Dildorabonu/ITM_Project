"use client";

import { useEffect, useState, useCallback } from "react";
import { useDraft } from "@/lib/useDraft";
import {
  roleService,
  permissionService,
  type RoleResponse,
  type PermissionModuleResponse,
  type RoleCreatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import RoleFormView from "./components/RoleFormView";
import RoleViewDrawer from "./components/RoleViewDrawer";
import DeactivateModal from "./components/DeactivateModal";
import ActivateModal from "./components/ActivateModal";
import RoleTable from "./components/RoleTable";

export default function RolesPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const showToast = useToastStore(s => s.show);
  const canCreate = hasPermission("Roles.Create");
  const canUpdate = hasPermission("Roles.Update");
  const canDelete = hasPermission("Roles.Delete");

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionModuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // View drawer
  const [viewRole, setViewRole] = useState<RoleResponse | null>(null);
  const [viewPerms, setViewPerms] = useState<Set<string>>(new Set());
  const [viewPermsLoading, setViewPermsLoading] = useState(false);
  const [expandedViewModules, setExpandedViewModules] = useState<Set<string>>(new Set());

  // Edit / Create
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleResponse | null>(null);
  const [roleForm, setRoleForm] = useState<RoleCreatePayload>({ name: "", description: "" });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [expandedEditModules, setExpandedEditModules] = useState<Set<string>>(new Set());
  const [roleSaving, setRoleSaving] = useState(false);
  const [permsLoading, setPermsLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Activate
  const [activateConfirmId, setActivateConfirmId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // Delete / Deactivate
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPermissions = permissions.reduce((sum, m) => sum + m.actions.length, 0);

  useDraft(
    "draft_roles",
    showRoleModal,
    { roleForm, editRole },
    (d) => {
      setRoleForm(d.roleForm);
      if (d.editRole) {
        setEditRole(d.editRole);
        setShowRoleModal(true);
        setPermsLoading(true);
        roleService.getPermissions(d.editRole.id)
          .then(ids => setSelectedPerms(new Set(ids)))
          .finally(() => setPermsLoading(false));
      } else {
        setShowRoleModal(true);
      }
    },
  );

  const loadRoles = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const data = await roleService.getPaged(p, PAGE_SIZE, search.trim() ? { search: search.trim() } : {});
      setRoles(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setRoles([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  // Reload when page or search changes (debounce search)
  useEffect(() => {
    const t = setTimeout(() => { loadRoles(page); }, search ? 250 : 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  // Permissions only need to be fetched once
  useEffect(() => {
    permissionService.getAll().then(setPermissions).catch(() => setPermissions([]));
  }, []);

  /* ---------- View ---------- */
  const openViewRole = async (r: RoleResponse) => {
    setViewRole(r);
    setExpandedViewModules(new Set());
    setViewPerms(new Set());
    setViewPermsLoading(true);
    try {
      const ids = await roleService.getPermissions(r.id);
      setViewPerms(new Set(ids));
    } finally {
      setViewPermsLoading(false);
    }
  };

  const toggleViewModule = (mod: string) => {
    setExpandedViewModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  /* ---------- Edit / Create ---------- */
  const openAddRole = () => {
    setEditRole(null);
    setRoleForm({ name: "", description: "" });
    setSelectedPerms(new Set());
    setExpandedEditModules(new Set());
    setFormSubmitted(false);
    setShowRoleModal(true);
  };

  const openEditRole = async (r: RoleResponse) => {
    setEditRole(r);
    setRoleForm({ name: r.name, description: r.description ?? "" });
    setSelectedPerms(new Set());
    setExpandedEditModules(new Set());
    setFormSubmitted(false);
    setShowRoleModal(true);
    setPermsLoading(true);
    try {
      const ids = await roleService.getPermissions(r.id);
      setSelectedPerms(new Set(ids));
    } finally {
      setPermsLoading(false);
    }
  };

  const togglePerm = (actionId: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId); else next.add(actionId);
      return next;
    });
  };

  const toggleAllModule = (mod: PermissionModuleResponse) => {
    const allSelected = mod.actions.every(a => selectedPerms.has(a.id));
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (allSelected) {
        mod.actions.forEach(a => next.delete(a.id));
      } else {
        mod.actions.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  const toggleEditModule = (mod: string) => {
    setExpandedEditModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const saveRole = async () => {
    setFormSubmitted(true);
    if (!roleForm.name.trim()) return;
    setRoleSaving(true);
    try {
      let roleId = editRole?.id;
      if (editRole) {
        await roleService.update(editRole.id, roleForm);
      } else {
        roleId = await roleService.create(roleForm);
      }
      if (roleId) {
        await roleService.setPermissions(roleId, Array.from(selectedPerms));
      }
      setShowRoleModal(false);
      await loadRoles(page);
      showToast(editRole ? "Rol muvaffaqiyatli tahrirlandi!" : "Rol muvaffaqiyatli yaratildi!");
    } catch {
      showToast("Rolni saqlashda xatolik yuz berdi.", "Xatolik");
    } finally {
      setRoleSaving(false);
    }
  };

  /* ---------- Delete / Deactivate ---------- */
  const deleteRole = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await roleService.delete(deleteConfirmId);
      setDeleteConfirmId(null);
      await loadRoles(page);
      showToast("Rol muvaffaqiyatli noaktiv qilindi!");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } };
      const msg = axiosErr?.response?.data?.errors?.[0] ?? "Xatolik yuz berdi.";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const activateRole = async () => {
    if (!activateConfirmId) return;
    setActivating(true);
    try {
      await roleService.update(activateConfirmId, { isActive: true });
      setActivateConfirmId(null);
      await loadRoles(page);
      showToast("Rol muvaffaqiyatli aktiv qilindi!");
    } catch {
      showToast("Rolni aktiv qilishda xatolik yuz berdi.", "Xatolik");
    } finally {
      setActivating(false);
    }
  };

  if (showRoleModal) {
    return (
      <div className="page-transition">
        <RoleFormView
          editRole={editRole}
          roleForm={roleForm}
          setRoleForm={setRoleForm}
          selectedPerms={selectedPerms}
          expandedEditModules={expandedEditModules}
          permissions={permissions}
          permsLoading={permsLoading}
          totalPermissions={totalPermissions}
          formSubmitted={formSubmitted}
          roleSaving={roleSaving}
          togglePerm={togglePerm}
          toggleAllModule={toggleAllModule}
          toggleEditModule={toggleEditModule}
          saveRole={saveRole}
          onClose={() => setShowRoleModal(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <RoleTable
          loading={loading}
          roles={roles}
          search={search}
          setSearch={setSearch}
          fetchAll={() => loadRoles(page)}
          page={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          totalCount={totalCount}
          setPage={setPage}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          openAddRole={openAddRole}
          openViewRole={openViewRole}
          openEditRole={openEditRole}
          setActivateConfirmId={setActivateConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          setDeleteError={setDeleteError}
        />
      </div>

      {activateConfirmId && (
        <ActivateModal
          activating={activating}
          onConfirm={activateRole}
          onClose={() => setActivateConfirmId(null)}
        />
      )}

      {deleteConfirmId && (
        <DeactivateModal
          deleteError={deleteError}
          deleting={deleting}
          onConfirm={deleteRole}
          onClose={() => { setDeleteConfirmId(null); setDeleteError(null); }}
        />
      )}

      {viewRole && (
        <RoleViewDrawer
          viewRole={viewRole}
          viewPerms={viewPerms}
          viewPermsLoading={viewPermsLoading}
          permissions={permissions}
          expandedViewModules={expandedViewModules}
          toggleViewModule={toggleViewModule}
          onClose={() => setViewRole(null)}
        />
      )}
    </>
  );
}
