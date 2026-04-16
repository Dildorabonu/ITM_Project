"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDraft } from "@/lib/useDraft";
import {
  userService,
  roleService,
  departmentService,
  DepartmentType,
  type UserResponse,
  type RoleOption,
  type DepartmentOption,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { emptyForm, type UserForm } from "./_components/constants";
import { UserCreateView } from "./_components/UserCreateView";
import { UserEditView } from "./_components/UserEditView";
import { UserListView } from "./_components/UserListView";

function UsersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const editId = searchParams.get("id");

  const hasPermission = useAuthStore(s => s.hasPermission);
  const showToast = useToastStore(s => s.show);
  const canCreate = hasPermission("Users.Create");
  const canUpdate = hasPermission("Users.Update");
  const canDelete = hasPermission("Users.Delete");

  const animOffset = useRef(-(Date.now() % 1500) / 1000);

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [filtered, setFiltered] = useState<UserResponse[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DepartmentType | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [activateConfirmId, setActivateConfirmId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [confirmHead, setConfirmHead] = useState<{ headName: string } | null>(null);

  const showCreate = view === "create";
  const showEdit = view === "edit" && !!editId;
  const editTarget = users.find(u => u.id === editId) ?? null;

  useDraft(
    "draft_users",
    showCreate || showEdit,
    { form, editId: editId ?? null },
    (d) => {
      setForm(d.form);
      if (d.editId) {
        router.replace(`${pathname}?view=edit&id=${d.editId}`);
      } else {
        router.replace(`${pathname}?view=create`);
      }
    },
  );

  const load = async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const data = await userService.getAll(p);
      setUsers(data.items);
      setFiltered(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    roleService.getLookup().then(setRoles).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [page]);

  useEffect(() => {
    const q = search.toLowerCase();
    const deptIdsByType = typeFilter !== null
      ? new Set(departments.filter(d => d.type === typeFilter).map(d => d.id))
      : null;

    let list = users;
    if (deptIdsByType !== null) list = list.filter(u => u.departmentId !== null && deptIdsByType.has(u.departmentId));
    if (q) list = list.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.login.toLowerCase().includes(q) ||
      (u.roleName ?? "").toLowerCase().includes(q) ||
      (u.departmentName ?? "").toLowerCase().includes(q)
    );
    setFiltered(list);
  }, [search, typeFilter, users, departments]);

  const initializedEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (showEdit && editTarget && initializedEditIdRef.current !== editId) {
      initializedEditIdRef.current = editId;
      setFormSubmitted(false);
      setSaveError("");
      departmentService.getAll().then(setDepartments).catch(() => {});
      setForm({
        firstName: editTarget.firstName,
        lastName: editTarget.lastName,
        login: editTarget.login,
        password: "",
        roleId: editTarget.roleId ?? "",
        departmentId: editTarget.departmentId ?? "",
        isActive: editTarget.isActive,
        isHead: editTarget.isHead,
      });
    }
    if (!showEdit) {
      initializedEditIdRef.current = null;
    }
  }, [showEdit, editTarget, editId]);

  useEffect(() => {
    if (showCreate) {
      setForm(emptyForm);
      setFormSubmitted(false);
      setSaveError("");
      departmentService.getAll().then(setDepartments).catch(() => {});
    }
  }, [showCreate]);

  const openCreate = () => router.push(`${pathname}?view=create`);
  const openEdit = (u: UserResponse) => router.push(`${pathname}?view=edit&id=${u.id}`);

  const handleCancel = () => {
    setSaveError("");
    setConfirmHead(null);
    sessionStorage.removeItem("draft_users");
    router.push(pathname);
  };

  const handleIsHeadChange = (checked: boolean) => {
    if (!checked) { setForm(f => ({ ...f, isHead: false })); return; }
    const dept = departments.find(d => d.id === form.departmentId);
    const existingHead = dept?.headUserName;
    const currentUserIsHead = showEdit && editTarget?.isHead && editTarget?.departmentId === form.departmentId;
    if (existingHead && !currentUserIsHead) {
      setConfirmHead({ headName: existingHead });
    } else {
      setForm(f => ({ ...f, isHead: true }));
    }
  };

  const handleCreate = async () => {
    setFormSubmitted(true);
    if (!form.firstName || !form.lastName || !form.login || !form.password || !form.roleId || !form.departmentId) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: UserCreatePayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        login: form.login,
        password: form.password,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        isHead: form.isHead,
      };
      await userService.create(payload);
      sessionStorage.removeItem("draft_users");
      showToast("Foydalanuvchi muvaffaqiyatli yaratildi!");
      router.push(pathname);
      await load();
      departmentService.getAll().then(setDepartments).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setSaveError(msg || "Saqlashda xatolik yuz berdi.");
      showToast(msg || "Saqlashda xatolik yuz berdi.", "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setFormSubmitted(true);
    if (!form.roleId || !form.departmentId) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: UserUpdatePayload = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        login: form.login || undefined,
        password: form.password || undefined,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        isActive: form.isActive,
        isHead: form.isHead,
      };
      await userService.update(editTarget.id, payload);
      sessionStorage.removeItem("draft_users");
      showToast("Foydalanuvchi muvaffaqiyatli yangilandi!");
      router.push(pathname);
      await load();
      departmentService.getAll().then(setDepartments).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setSaveError(msg || "Saqlashda xatolik yuz berdi.");
      showToast(msg || "Saqlashda xatolik yuz berdi.", "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await userService.deactivate(deactivateId);
      setDeactivateId(null);
      showToast("Foydalanuvchi muvaffaqiyatli noaktiv qilindi!");
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setDeactivateError(msg || "Xatolik yuz berdi.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!activateConfirmId) return;
    setActivating(true);
    try {
      await userService.activate(activateConfirmId);
      setActivateConfirmId(null);
      showToast("Foydalanuvchi muvaffaqiyatli aktiv qilindi!");
      await load();
    } catch {
      showToast("Foydalanuvchini aktiv qilishda xatolik yuz berdi.", "Xatolik");
    } finally {
      setActivating(false);
    }
  };

  if (showEdit) {
    return (
      <UserEditView
        form={form}
        setForm={setForm}
        formSubmitted={formSubmitted}
        saving={saving}
        saveError={saveError}
        roles={roles}
        departments={departments}
        confirmHead={confirmHead}
        setConfirmHead={setConfirmHead}
        handleUpdate={handleUpdate}
        handleIsHeadChange={handleIsHeadChange}
        onCancel={handleCancel}
      />
    );
  }

  if (showCreate) {
    return (
      <UserCreateView
        form={form}
        setForm={setForm}
        formSubmitted={formSubmitted}
        saving={saving}
        saveError={saveError}
        roles={roles}
        departments={departments}
        confirmHead={confirmHead}
        setConfirmHead={setConfirmHead}
        handleCreate={handleCreate}
        handleIsHeadChange={handleIsHeadChange}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <UserListView
      filtered={filtered}
      users={users}
      departments={departments}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      loading={loading}
      error={error}
      search={search}
      setSearch={setSearch}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      deactivateId={deactivateId}
      setDeactivateId={setDeactivateId}
      deactivating={deactivating}
      deactivateError={deactivateError}
      handleDeactivate={handleDeactivate}
      activateConfirmId={activateConfirmId}
      setActivateConfirmId={setActivateConfirmId}
      activating={activating}
      handleActivate={handleActivate}
      onOpenCreate={openCreate}
      onOpenEdit={openEdit}
      onRefresh={() => load()}
      animOffset={animOffset.current}
      setPage={setPage}
    />
  );
}

export default function UsersPage() {
  return (
    <div className="page-transition" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Suspense>
        <UsersPageInner />
      </Suspense>
    </div>
  );
}
