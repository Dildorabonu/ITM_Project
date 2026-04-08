"use client";

import { useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { useAuthStore } from "@/lib/store/authStore";
import {
  contractService,
  userService,
  scanService,
  departmentService,
  ContractStatus,
  Priority,
  type ContractResponse,
  type ContractCreatePayload,
  type ContractUpdatePayload,
  type AttachmentResponse,
  type ContractUserResponse,
  type UserLookup,
  type DepartmentResponse,
} from "@/lib/userService";

import {
  ContractForm as ContractFormType,
  emptyForm,
  STATUS_FILTER_OPTIONS,
  STATUS_CHANGE_OPTIONS,
} from "./_types";
import { isoToDisplayDate } from "./_components/DatePickerField";
import { StatusBadge, PriorityBadge } from "./_components/StatusBadge";
import { CustomSelect } from "./_components/CustomSelect";
import { ContractForm } from "./_components/ContractForm";
import { ContractDrawer } from "./_components/ContractDrawer";
import { ScanModal } from "./_components/ScanModal";
import { fmt } from "./_components/DatePickerField";
import { useToastStore } from "@/lib/store/toastStore";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

export default function ContractsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);
  const canCreate = hasPermission("Contracts.Create");
  const canUpdate = hasPermission("Contracts.Update");
  const canDelete = hasPermission("Contracts.Delete");

  const [contracts, setContracts]       = useState<ContractResponse[]>([]);
  const [filtered, setFiltered]         = useState<ContractResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  // Filters
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Form
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<ContractResponse | null>(null);
  const [form, setForm]                 = useState<ContractFormType>(emptyForm);
  const [startDateDisp, setStartDateDisp] = useState("");
  const [endDateDisp,   setEndDateDisp]   = useState("");
  const [submitted, setSubmitted]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState("");
  const [pendingContractFiles, setPendingContractFiles] = useState<File[]>([]);
  const [pendingTzFiles, setPendingTzFiles]             = useState<File[]>([]);
  const [formUsers, setFormUsers]             = useState<UserLookup[]>([]);
  const [formSupervisors, setFormSupervisors] = useState<UserLookup[]>([]);
  const [formObservers, setFormObservers]     = useState<UserLookup[]>([]);
  const [openPickerIdx, setOpenPickerIdx]     = useState<number | null>(null);
  const pickerRef                             = useRef<HTMLDivElement | null>(null);

  // View drawer
  const [viewContract, setViewContract] = useState<ContractResponse | null>(null);
  const [drawerFiles, setDrawerFiles]   = useState<AttachmentResponse[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Departments
  const [departments, setDepartments]   = useState<DepartmentResponse[]>([]);

  // TZ files
  const [drawerTzFiles, setDrawerTzFiles]   = useState<AttachmentResponse[]>([]);
  const [tzFilesLoading, setTzFilesLoading] = useState(false);

  // Users
  const [drawerUsers, setDrawerUsers]   = useState<ContractUserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [allUsers, setAllUsers]         = useState<UserLookup[]>([]);

  // Scan modal
  const [showScanModal, setShowScanModal]   = useState(false);
  const [scanTarget, setScanTarget]         = useState<"contract" | "tz">("contract");
  const [scanSources, setScanSources]       = useState<Parameters<typeof ScanModal>[0]["scanSources"]>([]);
  const [scanSourcesLoading, setScanSourcesLoading] = useState(false);
  const [scanSourcesError, setScanSourcesError]     = useState("");
  const [selectedSourceId, setSelectedSourceId]     = useState("");
  const [scanColorMode, setScanColorMode]   = useState("color");
  const [scanDpi, setScanDpi]               = useState(200);
  const [scanning, setScanning]             = useState(false);
  const [scanError, setScanError]           = useState("");

  // Delete confirm
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Deactivate confirm
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Activate confirm
  const [activateId, setActivateId]     = useState<string | null>(null);
  const [activating, setActivating]     = useState(false);

  // Status change
  const [statusTarget, setStatusTarget] = useState<ContractResponse | null>(null);
  const [newStatus, setNewStatus]       = useState<string>("");
  const [changingStatus, setChangingStatus] = useState(false);

  useDraft(
    "draft_contracts",
    showForm,
    { form, editTarget },
    (d) => { setForm(d.form); setEditTarget(d.editTarget); ensureDataLoaded().then(() => setShowForm(true)); },
  );

  // ── Load drawer ────────────────────────────────────────────────────────────

  const openDrawer = async (c: ContractResponse) => {
    setViewContract(c);
    setDrawerFiles([]);
    setDrawerUsers([]);
    setDrawerTzFiles([]);
    setFilesLoading(true);
    setUsersLoading(true);
    setTzFilesLoading(true);
    try {
      const [fresh, files, users, tzFiles] = await Promise.all([
        contractService.getById(c.id),
        contractService.getFiles(c.id),
        contractService.getUsers(c.id),
        contractService.getTzFiles(c.id),
      ]);
      setViewContract(fresh);
      setContracts(prev => prev.map(x => x.id === fresh.id ? fresh : x));
      setDrawerFiles(files);
      setDrawerUsers(users);
      setDrawerTzFiles(tzFiles);
    } finally {
      setFilesLoading(false);
      setUsersLoading(false);
      setTzFilesLoading(false);
    }
  };

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await contractService.getAll();
      setContracts(data);
    } catch (err) {
      setContracts([]);
      setError("Shartnomalarni yuklashda xatolik yuz berdi");
      console.error("Contracts load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    departmentService.getAllFull().then(d => setDepartments(d)).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      contracts.filter(c => {
        const matchSearch = !q || c.contractNo.toLowerCase().includes(q);
        const matchStatus = filterStatus === "" || c.status === Number(filterStatus);
        return matchSearch && matchStatus;
      })
    );
  }, [search, filterStatus, contracts]);

  useEffect(() => {
    if (openPickerIdx === null) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setOpenPickerIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPickerIdx]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => {
      setShowForm(false);
      setPendingContractFiles([]);
      setPendingTzFiles([]);
      setFormUsers([]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  // ── Form ──────────────────────────────────────────────────────────────────

  const ensureDataLoaded = async () => {
    await Promise.all([
      allUsers.length === 0 ? userService.getLookup().then(items => setAllUsers(items)) : Promise.resolve(),
      departments.length === 0 ? departmentService.getAllFull().then(d => setDepartments(d.filter(dep => dep.isActive))) : Promise.resolve(),
    ]);
  };

  const openCreate = async () => {
    setEditTarget(null);
    setForm(emptyForm);
    setStartDateDisp("");
    setEndDateDisp("");
    setSubmitted(false);
    setFormError("");
    setPendingContractFiles([]);
    setPendingTzFiles([]);
    setFormUsers([]);
    setFormSupervisors([]);
    setFormObservers([]);
    await ensureDataLoaded();
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const openEdit = async (c: ContractResponse) => {
    setEditTarget(c);
    setForm({
      contractNo:    c.contractNo,
      productType:   c.productType ?? "",
      quantity:      c.quantity ? String(c.quantity) : "",
      unit:          c.unit ?? "",
      departmentIds: c.departments?.map(d => d.id) ?? [],
      startDate:     c.startDate ? c.startDate.slice(0, 10) : "",
      endDate:       c.endDate ? c.endDate.slice(0, 10) : "",
      priority:      String(c.priority),
      contractParty: c.contractParty ?? "",
      notes:         c.notes ?? "",
    });
    setStartDateDisp(c.startDate ? isoToDisplayDate(c.startDate.slice(0, 10)) : "");
    setEndDateDisp(c.endDate ? isoToDisplayDate(c.endDate.slice(0, 10)) : "");
    setSubmitted(false);
    setFormError("");
    const [users, lookup, depts] = await Promise.all([
      contractService.getUsers(c.id),
      allUsers.length > 0 ? Promise.resolve(allUsers) : userService.getLookup(),
      departments.length > 0 ? Promise.resolve(departments) : departmentService.getAllFull().then(d => d.filter(dep => dep.isActive)),
    ]);
    if (lookup !== allUsers) setAllUsers(lookup);
    if (depts !== departments) setDepartments(depts);
    setFormUsers(lookup.filter((u: UserLookup) => users.some((cu: ContractUserResponse) => cu.userId === u.id && cu.role === 0)));
    setFormSupervisors(lookup.filter((u: UserLookup) => users.some((cu: ContractUserResponse) => cu.userId === u.id && cu.role === 1)));
    setFormObservers(lookup.filter((u: UserLookup) => users.some((cu: ContractUserResponse) => cu.userId === u.id && cu.role === 2)));
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const isValid = () =>
    form.contractNo.trim() && form.departmentIds.length > 0 &&
    form.startDate && form.endDate;

  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid()) return;
    const startDateIso = form.startDate;
    const endDateIso = form.endDate;
    if (!startDateIso || !endDateIso) return;
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        const dto: ContractUpdatePayload = {
          contractNo:    form.contractNo,
          productType:   form.productType || undefined,
          quantity:      form.quantity ? Number(form.quantity) : undefined,
          unit:          form.unit || undefined,
          departmentIds: form.departmentIds,
          startDate:     startDateIso,
          endDate:       endDateIso,
          priority:      Number(form.priority) as Priority,
          contractParty: form.contractParty || undefined,
          notes:         form.notes || null,
        };
        await contractService.update(editTarget.id, dto);
        // sync users by role
        const currentUsers = await contractService.getUsers(editTarget.id);
        const newUserMap = new Map<string, number>([
          ...formUsers.map(u => [u.id, 0] as [string, number]),
          ...formSupervisors.map(u => [u.id, 1] as [string, number]),
          ...formObservers.map(u => [u.id, 2] as [string, number]),
        ]);
        const toAdd = [...newUserMap.entries()]
          .filter(([id, role]) => { const ex = currentUsers.find(cu => cu.userId === id); return !ex || ex.role !== role; })
          .map(([userId, role]) => ({ userId, role }));
        const toRemove = currentUsers.filter(cu => !newUserMap.has(cu.userId)).map(cu => cu.userId);
        if (toAdd.length > 0) await contractService.assignUsers(editTarget.id, toAdd);
        for (const uid of toRemove) await contractService.removeUser(editTarget.id, uid);
      } else {
        const dto: ContractCreatePayload = {
          contractNo:    form.contractNo,
          productType:   form.productType || undefined,
          quantity:      form.quantity ? Number(form.quantity) : undefined,
          unit:          form.unit || undefined,
          departmentIds: form.departmentIds.length > 0 ? form.departmentIds : undefined,
          startDate:     startDateIso,
          endDate:       endDateIso,
          priority:      Number(form.priority) as Priority,
          contractParty: form.contractParty || undefined,
          notes:         form.notes || null,
        };
        const newId = await contractService.create(dto);
        if (newId) {
          await contractService.updateStatus(newId, ContractStatus.DrawingPending);
          const allNewUsers = [
            ...formUsers.map(u => ({ userId: u.id, role: 0 })),
            ...formSupervisors.map(u => ({ userId: u.id, role: 1 })),
            ...formObservers.map(u => ({ userId: u.id, role: 2 })),
          ];
          if (allNewUsers.length > 0)
            await contractService.assignUsers(newId, allNewUsers);
          for (const file of pendingContractFiles)
            await contractService.uploadFile(newId, file);
          for (const file of pendingTzFiles)
            await contractService.uploadTzFile(newId, file);
        }
        setPendingContractFiles([]);
        setPendingTzFiles([]);
      }
      const wasEditing = !!editTarget;
      await load();
      setShowForm(false);
      window.dispatchEvent(new Event("notif-read"));
      showToast(wasEditing ? "Shartnoma muvaffaqiyatli tahrirlandi!" : "Shartnoma muvaffaqiyatli yaratildi!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  // ── Scan ──────────────────────────────────────────────────────────────────

  const openScanModal = async (target: "contract" | "tz" = "contract") => {
    setScanTarget(target);
    setScanError("");
    setScanSourcesError("");
    setSelectedSourceId("");
    setScanColorMode("color");
    setScanDpi(200);
    setShowScanModal(true);
    setScanSourcesLoading(true);
    try {
      const sources = await scanService.getSources();
      setScanSources(sources);
      if (sources.length > 0) setSelectedSourceId(sources[0].id);
    } catch {
      setScanSourcesError("Skanerlar ro'yxatini olishda xatolik. WIA xizmati ishlayotganini tekshiring.");
    } finally {
      setScanSourcesLoading(false);
    }
  };

  const handleScanDocument = async () => {
    if (!selectedSourceId) return;
    setScanError("");
    setScanning(true);
    try {
      const file = await scanService.scan(selectedSourceId, scanColorMode, scanDpi);
      if (scanTarget === "tz") setPendingTzFiles(prev => [...prev, file]);
      else setPendingContractFiles(prev => [...prev, file]);
      setShowScanModal(false);
    } catch {
      setScanError("Skanerlashda xatolik yuz berdi. Skaner ulanganini va tayyor ekanini tekshiring.");
    } finally {
      setScanning(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await contractService.delete(deleteId);
      setContracts(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
      window.dispatchEvent(new Event("notif-read"));
      showToast("Shartnoma muvaffaqiyatli o'chirildi!");
    } catch {
      // stay open
    } finally {
      setDeleting(false);
    }
  };

  // ── Activate ──────────────────────────────────────────────────────────────

  const handleActivate = async () => {
    if (!activateId) return;
    setActivating(true);
    try {
      await contractService.activate(activateId);
      setContracts(prev => prev.map(c => c.id === activateId ? { ...c, isActive: true } : c));
      setActivateId(null);
      window.dispatchEvent(new Event("notif-read"));
      showToast("Shartnoma muvaffaqiyatli active qilindi!");
    } catch {
      // stay open
    } finally {
      setActivating(false);
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setDeactivating(true);
    try {
      await contractService.deactivate(deactivateId);
      setContracts(prev => prev.map(c => c.id === deactivateId ? { ...c, isActive: false } : c));
      setDeactivateId(null);
      window.dispatchEvent(new Event("notif-read"));
      showToast("Shartnoma muvaffaqiyatli noactive qilindi!");
    } catch {
      // stay open
    } finally {
      setDeactivating(false);
    }
  };

  // ── Status Change ─────────────────────────────────────────────────────────

  const handleStatusChange = async () => {
    if (!statusTarget || newStatus === "") return;
    setChangingStatus(true);
    try {
      await contractService.updateStatus(statusTarget.id, Number(newStatus) as ContractStatus);
      setContracts(prev =>
        prev.map(c => c.id === statusTarget.id ? { ...c, status: Number(newStatus) as ContractStatus } : c)
      );
      setStatusTarget(null);
      window.dispatchEvent(new Event("notif-read"));
    } catch {
      // stay open
    } finally {
      setChangingStatus(false);
    }
  };

  // ── Render: Form ──────────────────────────────────────────────────────────

  if (showForm) {
    return (
      <ContractForm
        form={form}
        setForm={setForm}
        editTarget={editTarget}
        startDateDisp={startDateDisp}
        setStartDateDisp={setStartDateDisp}
        endDateDisp={endDateDisp}
        setEndDateDisp={setEndDateDisp}
        submitted={submitted}
        saving={saving}
        formError={formError}
        pendingContractFiles={pendingContractFiles}
        setPendingContractFiles={setPendingContractFiles}
        pendingTzFiles={pendingTzFiles}
        setPendingTzFiles={setPendingTzFiles}
        formUsers={formUsers}
        setFormUsers={setFormUsers}
        formSupervisors={formSupervisors}
        setFormSupervisors={setFormSupervisors}
        formObservers={formObservers}
        setFormObservers={setFormObservers}
        openPickerIdx={openPickerIdx}
        setOpenPickerIdx={setOpenPickerIdx}
        pickerRef={pickerRef}
        allUsers={allUsers}
        departments={departments}
        handleSave={handleSave}
        openScanModal={openScanModal}
        onCancel={() => { setShowForm(false); setPendingContractFiles([]); setPendingTzFiles([]); setFormUsers([]); }}
        canCreate={canCreate}
        canUpdate={canUpdate}
      />
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish (raqam)"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={{ width: 210 }}>
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Barcha holat"
          />
        </div>

        <button className="btn-icon" onClick={load} title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        {canCreate && (
          <button className="btn-primary" onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yangi shartnoma
          </button>
        )}
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Raqam</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Muddat</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Muhimlik</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Holat</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Faollik</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <button onClick={() => openDrawer(c)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-inter)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                        {c.contractNo}
                      </button>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {fmt(c.startDate)} – {fmt(c.endDate)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><PriorityBadge priority={c.priority} /></td>
                    <td style={{ textAlign: "center", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {canUpdate ? (
                        <button onClick={() => { setStatusTarget(c); setNewStatus(String(c.status)); }}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", maxWidth: 140, display: "block", overflow: "hidden" }}>
                          <StatusBadge status={c.status} />
                        </button>
                      ) : (
                        <div style={{ maxWidth: 140, overflow: "hidden", display: "inline-block" }}>
                          <StatusBadge status={c.status} />
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "2px 10px",
                        borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: c.isActive ? "#dcfce7" : "var(--danger-dim)",
                        color: c.isActive ? "#16a34a" : "var(--danger)",
                        border: `1px solid ${c.isActive ? "#86efac" : "var(--danger)"}`,
                      }}>
                        {c.isActive ? "Faol" : "Nofaol"}
                      </span>
                    </td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" onClick={() => openDrawer(c)} title="Ko'rish"
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {canUpdate && (
                          <button className="btn-icon" onClick={() => openEdit(c)} title="Tahrirlash"
                            style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && c.isActive && (
                          <button className="btn-icon" onClick={() => setDeactivateId(c.id)} title="Noactive qilish"
                            style={{ color: "#d97706", borderColor: "#d9770633", background: "#fef3c7" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && !c.isActive && (
                          <button className="btn-icon" onClick={() => setActivateId(c.id)} title="Active qilish"
                            style={{ color: "#16a34a", borderColor: "#16a34a33", background: "#f0fdf4" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn-icon btn-icon-danger" onClick={() => setDeleteId(c.id)} title="O'chirish"
                            style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Drawer ── */}
      {viewContract && (
        <ContractDrawer
          viewContract={viewContract}
          onClose={() => { setViewContract(null); setDrawerFiles([]); setDrawerUsers([]); setDrawerTzFiles([]); }}
          drawerFiles={drawerFiles}
          drawerTzFiles={drawerTzFiles}
          drawerUsers={drawerUsers}
          filesLoading={filesLoading}
          tzFilesLoading={tzFilesLoading}
          usersLoading={usersLoading}
        />
      )}

      {/* ── Status Change Modal ── */}
      {statusTarget && (
        <div className="modal-overlay" onClick={() => setStatusTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
              <span>Holat o&apos;zgartirish</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>
                <b>{statusTarget.contractNo}</b> — holat tanlang:
              </div>
              <CustomSelect
                value={newStatus}
                onChange={setNewStatus}
                options={STATUS_CHANGE_OPTIONS}
                placeholder="— Holat tanlang —"
              />
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline" onClick={() => setStatusTarget(null)}>
                  Bekor qilish
                </button>
                <button className="btn btn-primary" onClick={handleStatusChange} disabled={changingStatus}>
                  {changingStatus ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan Modal ── */}
      {showScanModal && (
        <ScanModal
          scanSources={scanSources}
          scanSourcesLoading={scanSourcesLoading}
          scanSourcesError={scanSourcesError}
          selectedSourceId={selectedSourceId}
          setSelectedSourceId={setSelectedSourceId}
          scanColorMode={scanColorMode}
          setScanColorMode={setScanColorMode}
          scanDpi={scanDpi}
          setScanDpi={setScanDpi}
          scanning={scanning}
          scanError={scanError}
          handleScanDocument={handleScanDocument}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {/* ── Activate Confirm Modal ── */}
      {activateId && (
        <div className="modal-overlay" onClick={() => setActivateId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-header" style={{ color: "#16a34a", borderBottom: "1px solid var(--border)" }}>
              <span>Shartnomani active qilish</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                Bu shartnoma va unga bog&apos;liq barcha ma&apos;lumotlar qayta active holatga qaytadi.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline" onClick={() => setActivateId(null)}>
                  Bekor qilish
                </button>
                <button className="btn" style={{ background: "#16a34a", color: "#fff", border: "none" }}
                  onClick={handleActivate} disabled={activating}>
                  {activating ? "Bajarilmoqda..." : "Active qilish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirm Modal ── */}
      {deactivateId && (
        <div className="modal-overlay" onClick={() => setDeactivateId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-header" style={{ color: "#d97706", borderBottom: "1px solid var(--border)" }}>
              <span>Shartnomani noactive qilish</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                Bu shartnoma va unga bog&apos;liq barcha ma&apos;lumotlar (texjarayon, xarajat normalari, vazifalar va boshqalar) noactive bo&apos;lib qoladi.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline" onClick={() => setDeactivateId(null)}>
                  Bekor qilish
                </button>
                <button className="btn" style={{ background: "#d97706", color: "#fff", border: "none" }}
                  onClick={handleDeactivate} disabled={deactivating}>
                  {deactivating ? "Bajarilmoqda..." : "Noactive qilish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      <ConfirmModal
        open={!!deleteId}
        title="Shartnomani o'chirish"
        message="Bu shartnoma o'chiriladi. Bu amalni qaytarib bo'lmaydi."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

    </div>
  );
}
