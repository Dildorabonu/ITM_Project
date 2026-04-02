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
  DepartmentType,
  CONTRACT_STATUS_LABELS,
  PRIORITY_LABELS,
  DEPARTMENT_TYPE_LABELS,
  type ContractResponse,
  type ContractCreatePayload,
  type ContractUpdatePayload,
  type AttachmentResponse,
  type ContractUserResponse,
  type UserLookup,
  type ScanSource,
  type DepartmentResponse,
} from "@/lib/userService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractForm {
  contractNo: string;
  productType: string;
  quantity: string;
  unit: string;
  departmentIds: string[];
  startDate: string;
  endDate: string;
  priority: string;
  contractParty: string;
  notes: string;
}

const emptyForm: ContractForm = {
  contractNo: "", productType: "", quantity: "", unit: "",
  departmentIds: [], startDate: "", endDate: "",
  priority: String(Priority.Medium), contractParty: "", notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ContractStatus, { bg: string; color: string; border: string }> = {
  [ContractStatus.Draft]:           { bg: "var(--bg3)",        color: "var(--text2)",    border: "var(--border)" },
  [ContractStatus.DrawingPending]:  { bg: "#ede9fe",           color: "#6d28d9",         border: "#c4b5fd" },
  [ContractStatus.TechProcessing]:  { bg: "#fff7ed",           color: "#c2410c",         border: "#fdba74" },
  [ContractStatus.WarehouseCheck]:  { bg: "#fefce8",           color: "#a16207",         border: "#fde047" },
  [ContractStatus.InProduction]:    { bg: "#e6f4ea",           color: "#1e7e34",         border: "#a8d5b5" },
  [ContractStatus.Completed]:       { bg: "#e8f0fe",           color: "#1a56db",         border: "#a4c0f4" },
  [ContractStatus.Cancelled]:       { bg: "var(--danger-dim)", color: "var(--danger)",   border: "var(--danger)" },
};

const PRIORITY_STYLE: Record<Priority, { color: string }> = {
  [Priority.Low]:    { color: "var(--text2)" },
  [Priority.Medium]: { color: "#d97706" },
  [Priority.High]:   { color: "#dc2626" },
  [Priority.Urgent]: { color: "#7c3aed" },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const WORKFLOW_STEPS: { status: ContractStatus; label: string; shortLabel: string }[] = [
  { status: ContractStatus.Draft,          label: "Shartnoma yaratilindi",              shortLabel: "Yaratildi" },
  { status: ContractStatus.DrawingPending, label: "Chizmasi tayyorlanmoqda",             shortLabel: "Chizma" },
  { status: ContractStatus.TechProcessing, label: "Tex jarayon va me'yoriy sarf",        shortLabel: "Tex jarayon" },
  { status: ContractStatus.WarehouseCheck, label: "Ombor tekshiruviga uzatildi",         shortLabel: "Ombor" },
  { status: ContractStatus.InProduction,   label: "Ishlab chiqarish jarayoni boshlangan", shortLabel: "Ishlab chiqarish" },
  { status: ContractStatus.Completed,      label: "Yakunlandi",                          shortLabel: "Yakunlandi" },
];

const STEP_COLORS: Record<ContractStatus, { active: string; done: string; text: string }> = {
  [ContractStatus.Draft]:          { active: "#6b7280", done: "#6b7280", text: "#fff" },
  [ContractStatus.DrawingPending]: { active: "#7c3aed", done: "#7c3aed", text: "#fff" },
  [ContractStatus.TechProcessing]: { active: "#c2410c", done: "#c2410c", text: "#fff" },
  [ContractStatus.WarehouseCheck]: { active: "#a16207", done: "#a16207", text: "#fff" },
  [ContractStatus.InProduction]:   { active: "#1e7e34", done: "#1e7e34", text: "#fff" },
  [ContractStatus.Completed]:      { active: "#1a56db", done: "#1a56db", text: "#fff" },
  [ContractStatus.Cancelled]:      { active: "#dc2626", done: "#dc2626", text: "#fff" },
};

function WorkflowDiagram({ status }: { status: ContractStatus }) {
  const isCancelled = status === ContractStatus.Cancelled;
  const currentIdx = isCancelled ? -1 : WORKFLOW_STEPS.findIndex(s => s.status === status);

  if (isCancelled) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          background: "var(--danger-dim)", border: "1.5px solid var(--danger)",
          borderRadius: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--danger)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>Shartnoma bekor qilindi</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>Jarayon holati</div>
      <div style={{ position: "relative" }}>
        {/* connector line */}
        <div style={{
          position: "absolute", top: 16, left: 16, right: 16, height: 2,
          background: "var(--border)", zIndex: 0,
        }} />
        {/* filled connector up to current step */}
        {currentIdx > 0 && (
          <div style={{
            position: "absolute", top: 16, left: 16, height: 2,
            width: `calc(${(currentIdx / (WORKFLOW_STEPS.length - 1)) * 100}% - 16px)`,
            background: STEP_COLORS[status].active, zIndex: 0, transition: "width 0.4s",
          }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          {WORKFLOW_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            const col = STEP_COLORS[step.status];
            return (
              <div key={step.status} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isDone || isActive ? col.active : "var(--bg3)",
                  border: `2px solid ${isDone || isActive ? col.active : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isActive ? `0 0 0 4px ${col.active}33` : "none",
                  transition: "all 0.3s",
                }}>
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col.text} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? col.text : "var(--text3)" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                  color: isActive ? col.active : isDone ? "var(--text2)" : "var(--text3)",
                  maxWidth: 72,
                }}>
                  {step.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
        {/* current step description */}
        <div style={{
          marginTop: 14, padding: "8px 14px", borderRadius: 8,
          background: `${STEP_COLORS[status].active}14`,
          border: `1.5px solid ${STEP_COLORS[status].active}44`,
          fontSize: 13, fontWeight: 600, color: STEP_COLORS[status].active,
          textAlign: "center",
        }}>
          {WORKFLOW_STEPS[currentIdx]?.label}
        </div>
      </div>
    </div>
  );
}

function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

function isoToDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y.slice(-2)}`;
}


// ─── Department grouped select ────────────────────────────────────────────────

const TYPE_STYLE = {
  [DepartmentType.IshlabChiqarish]: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🏭" },
  [DepartmentType.Bolim]:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🏢" },
  [DepartmentType.Boshqaruv]:       { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", icon: "👔" },
};

function CustomGroupedMultiSelect({
  values = [], onChange, departments, placeholder, hasError,
}: {
  values: string[]; onChange: (v: string[]) => void;
  departments: DepartmentResponse[];
  placeholder: string; hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups = ([DepartmentType.IshlabChiqarish, DepartmentType.Bolim, DepartmentType.Boshqaruv] as const)
    .map(t => ({ type: t, items: departments.filter(d => d.type === t) }))
    .filter(g => g.items.length > 0);

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id]);
  };

  const selectedDepts = departments.filter(d => values.includes(d.id));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "var(--bg3)",
        border: `1.5px solid ${hasError ? "var(--danger)" : open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "9px 12px", minHeight: 40,
        fontSize: 14, cursor: "pointer", textAlign: "left",
        boxShadow: hasError ? "0 0 0 3px rgba(217,48,37,0.2)" : open ? "0 0 0 3px var(--accent-dim)" : "none",
        transition: "border-color 0.14s, box-shadow 0.14s",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
          {selectedDepts.length === 0 ? (
            <span style={{ color: "var(--text3)" }}>{placeholder}</span>
          ) : selectedDepts.map(d => {
            const ts = TYPE_STYLE[d.type];
            return (
              <span key={d.id} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
              }}>
                {ts.icon} {d.name}
                <span
                  onClick={e => { e.stopPropagation(); toggle(d.id); }}
                  style={{ cursor: "pointer", marginLeft: 2, lineHeight: 1, opacity: 0.7 }}
                >✕</span>
              </span>
            );
          })}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text3)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1.5px solid var(--border2)",
          borderRadius: "var(--radius2)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 200, maxHeight: 260, overflowY: "auto",
        }}>
          {groups.map((g, gi) => {
            const ts = TYPE_STYLE[g.type];
            return (
              <div key={g.type}>
                <div style={{
                  padding: "7px 12px 5px", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.7px", textTransform: "uppercase",
                  color: ts.color, background: ts.bg,
                  display: "flex", alignItems: "center", gap: 6,
                  borderTop: gi > 0 ? "1px solid var(--border)" : "none",
                  position: "sticky", top: 0,
                }}>
                  {ts.icon} {DEPARTMENT_TYPE_LABELS[g.type]}
                </div>
                {g.items.map(d => {
                  const checked = values.includes(d.id);
                  return (
                    <div key={d.id}
                      onClick={() => toggle(d.id)}
                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg3)"; }}
                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                      style={{
                        padding: "8px 16px 8px 20px", cursor: "pointer", fontSize: 13,
                        color: checked ? ts.color : "var(--text)",
                        background: checked ? ts.bg : "transparent",
                        fontWeight: checked ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                      {checked ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, color: ts.color }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : <span style={{ width: 11 }} />}
                      {d.name}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
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
  const [form, setForm]                 = useState<ContractForm>(emptyForm);
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
  const [uploading, setUploading]       = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Departments
  const [departments, setDepartments]   = useState<DepartmentResponse[]>([]);

  // TZ files
  const [drawerTzFiles, setDrawerTzFiles]     = useState<AttachmentResponse[]>([]);
  const [tzFilesLoading, setTzFilesLoading]   = useState(false);
  const [uploadingTz, setUploadingTz]         = useState(false);
  const [deletingTzFileId, setDeletingTzFileId] = useState<string | null>(null);

  // Users
  const [drawerUsers, setDrawerUsers]   = useState<ContractUserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAssign, setShowAssign]     = useState(false);
  const [allUsers, setAllUsers]         = useState<UserLookup[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assigning, setAssigning]       = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Scan modal
  const [showScanModal, setShowScanModal]   = useState(false);
  const [scanTarget, setScanTarget]         = useState<"contract" | "tz">("contract");
  const [scanSources, setScanSources]       = useState<ScanSource[]>([]);
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

  // ── Load files ────────────────────────────────────────────────────────────

  const openDrawer = async (c: ContractResponse) => {
    setViewContract(c);
    setDrawerFiles([]);
    setDrawerUsers([]);
    setDrawerTzFiles([]);
    setFilesLoading(true);
    setUsersLoading(true);
    setTzFilesLoading(true);
    try {
      const [files, users, tzFiles] = await Promise.all([
        contractService.getFiles(c.id),
        contractService.getUsers(c.id),
        contractService.getTzFiles(c.id),
      ]);
      setDrawerFiles(files);
      setDrawerUsers(users);
      setDrawerTzFiles(tzFiles);
    } finally {
      setFilesLoading(false);
      setUsersLoading(false);
      setTzFilesLoading(false);
    }
  };

  const openAssign = async () => {
    setAssignSearch("");
    setShowAssign(true);
    if (allUsers.length === 0) {
      const items = await userService.getLookup();
      setAllUsers(items);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (!viewContract) return;
    if (drawerUsers.some(u => u.userId === userId)) return;
    setAssigning(true);
    try {
      await contractService.assignUsers(viewContract.id, [{ userId, role: 0 }]);
      const users = await contractService.getUsers(viewContract.id);
      setDrawerUsers(users);
    } finally {
      setAssigning(false);
      setShowAssign(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!viewContract) return;
    setRemovingUserId(userId);
    try {
      await contractService.removeUser(viewContract.id, userId);
      setDrawerUsers(prev => prev.filter(u => u.userId !== userId));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleUpload = async (contractId: string, file: File) => {
    setUploading(true);
    try {
      const uploaded = await contractService.uploadFile(contractId, file);
      setDrawerFiles(prev => [uploaded, ...prev]);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (contractId: string, fileId: string) => {
    setDeletingFileId(fileId);
    try {
      await contractService.deleteFile(contractId, fileId);
      setDrawerFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleUploadTz = async (contractId: string, file: File) => {
    setUploadingTz(true);
    try {
      const uploaded = await contractService.uploadTzFile(contractId, file);
      setDrawerTzFiles(prev => [uploaded, ...prev]);
    } finally {
      setUploadingTz(false);
    }
  };

  const handleDeleteTzFile = async (contractId: string, fileId: string) => {
    setDeletingTzFileId(fileId);
    try {
      await contractService.deleteTzFile(contractId, fileId);
      setDrawerTzFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setDeletingTzFileId(null);
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
      await load();
      setShowForm(false);
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
    } catch {
      // stay open
    } finally {
      setDeleting(false);
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
    } catch {
      // stay open
    } finally {
      setChangingStatus(false);
    }
  };

  // ── Render: Form ──────────────────────────────────────────────────────────

  const fieldErr = (val: string) => submitted && !val.trim();
  const startDateErr = submitted && !form.startDate;
  const endDateErr = submitted && !form.endDate;
  const deptErr = submitted && form.departmentIds.length === 0;

  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
            {editTarget ? "Shartnomani tahrirlash" : "Yangi shartnoma"}
          </span>
        </div>

        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Shartnoma raqami */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.contractNo) ? "var(--danger)" : "var(--text2)" }}>
                Shartnoma raqami <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.contractNo}
                onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                placeholder="SH-2025-001"
                style={fieldErr(form.contractNo) ? { borderColor: "var(--danger)" } : undefined}
              />
              {fieldErr(form.contractNo) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Shartnoma raqamini kiriting</div>}
            </div>

            {/* Shartnoma tuzilgan tomon */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                Shartnoma tuzilgan tomon
              </label>
              <input className="form-input" value={form.contractParty}
                onChange={e => setForm(f => ({ ...f, contractParty: e.target.value }))}
                placeholder="Masalan: Ichki ishlar vazirligi, 3-sex, Texnologiya bo'limi..."
              />
            </div>

            {/* Boshlanish sanasi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: startDateErr ? "var(--danger)" : "var(--text2)" }}>
                Boshlanish sanasi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                style={startDateErr ? { borderColor: "var(--danger)" } : undefined}
              />
              {startDateErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Boshlanish sanasini tanlang</div>}
            </div>

            {/* Tugash sanasi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: endDateErr ? "var(--danger)" : "var(--text2)" }}>
                Tugash sanasi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                style={endDateErr ? { borderColor: "var(--danger)" } : undefined}
              />
              {endDateErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Tugash sanasini tanlang</div>}
            </div>

            {/* Mahsulot turi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Mahsulot turi</label>
              <input className="form-input" value={form.productType}
                onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}
                placeholder="Masalan: Detal, Konstruktsiya..."
              />
            </div>

            {/* Miqdor */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Miqdor</label>
              <input className="form-input" type="number" min="0" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>

            {/* O'lchov birligi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
              <select className="form-input" title="O'lchov birligi" value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                style={{ width: "100%", cursor: "pointer" }}>
                <option value="">— Tanlang —</option>
                <option value="Dona">Dona</option>
                <option value="Kilogramm">Kilogramm</option>
                <option value="Gramm">Gramm</option>
                <option value="Litr">Litr</option>
                <option value="Metr">Metr</option>
                <option value="KvMetr">Kv. Metr (m²)</option>
                <option value="KubMetr">Kub Metr (m³)</option>
                <option value="Quti">Quti</option>
                <option value="Paket">Paket</option>
                <option value="Toʻplam">To'plam</option>
              </select>
            </div>

            {/* Muhimlik */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Muhimlik</label>
              <select className="form-input" title="Muhimlik" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: "100%", cursor: "pointer" }}>
                {(Object.keys(PRIORITY_LABELS) as unknown as Priority[]).map(k => (
                  <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {/* Bo'limlar */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: deptErr ? "var(--danger)" : "var(--text2)" }}>
                Bo&apos;limlar <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <CustomGroupedMultiSelect
                values={form.departmentIds}
                onChange={v => setForm(f => ({ ...f, departmentIds: v }))}
                departments={departments}
                placeholder="— Bo'limlar tanlang (bir nechta) —"
                hasError={deptErr}
              />
              {deptErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Kamida bitta bo&apos;limni tanlang</div>}
            </div>

            {/* Izoh */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Izoh</label>
              <textarea className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Qo'shimcha izoh (ixtiyoriy)" rows={2} style={{ resize: "none" }} />
            </div>

            {/* Xodimlar - 3 ta toifa */}
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

              {([
                { label: "Ma'sul xodimlar",   list: formUsers,       setList: setFormUsers,       deptType: DepartmentType.IshlabChiqarish, color: "#c2410c", bg: "#fff7ed" },
                { label: "Ma'lumot uchun",    list: formSupervisors, setList: setFormSupervisors, deptType: DepartmentType.Bolim,   color: "#1d4ed8", bg: "#eff6ff" },
                { label: "Kuzatuvchilar",     list: formObservers,   setList: setFormObservers,   deptType: DepartmentType.Boshqaruv, color: "#6d28d9", bg: "#f5f3ff" },
              ] as const).map(({ label, list, setList, deptType, color, bg }, idx) => {
                const isOpen = openPickerIdx === idx;
                const poolByType = allUsers.filter(u => u.departmentType === deptType);
                const available = poolByType.filter(u => !list.some(x => x.id === u.id));
                return (
                  <div key={label}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 8 }}>
                      {label} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>(ixtiyoriy)</span>
                    </label>

                    <div ref={isOpen ? pickerRef : null} style={{ position: "relative" }}>
                      <button type="button"
                        onClick={() => setOpenPickerIdx(isOpen ? null : idx)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "9px 12px", background: "var(--bg1)", border: isOpen ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                          borderRadius: "var(--radius)", cursor: "pointer", fontSize: 13, color: available.length ? "var(--text2)" : "var(--text3)",
                        }}>
                        <span>Xodim tanlang</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                          background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10,
                          boxShadow: "0 6px 24px rgba(0,0,0,0.13)",
                          maxHeight: 260, overflow: "auto",
                        }}>
                          {allUsers.length === 0 ? (
                            <div style={{ padding: "14px 14px", fontSize: 13, color: "var(--text3)", textAlign: "center" }}>
                              Yuklanmoqda...
                            </div>
                          ) : poolByType.length === 0 ? (
                            <div style={{ padding: "14px 14px", fontSize: 13, color: "var(--text3)", textAlign: "center" }}>
                              Bu toifada xodim yo&apos;q
                            </div>
                          ) : available.length === 0 ? (
                            <div style={{ padding: "14px 14px", fontSize: 13, color: "var(--text3)", textAlign: "center" }}>
                              Barcha xodimlar tanlangan
                            </div>
                          ) : available.map(u => (
                            <button key={u.id} type="button"
                              onClick={() => { setList((prev: typeof list) => [...prev, u]); setOpenPickerIdx(null); }}
                              style={{
                                width: "100%", display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 14px", border: "none", background: "transparent",
                                cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--border)",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                background: "var(--accent-dim)", display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent)",
                              }}>
                                {u.firstName.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {u.firstName} {u.lastName}
                                </div>
                                {u.departmentName && (
                                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {u.departmentName}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {list.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {list.map(u => (
                          <div key={u.id} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: bg, border: `1.5px solid ${color}44`,
                            borderRadius: 20, padding: "4px 10px 4px 8px", fontSize: 12, color,
                          }}>
                            <span style={{ width: 20, height: 20, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {u.firstName.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</span>
                            <button type="button" onClick={() => setList((prev: typeof list) => prev.filter(x => x.id !== u.id))}
                              style={{ background: "none", border: "none", cursor: "pointer", color, padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.7 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shartnoma fayli */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                  Shartnoma fayli <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>(ixtiyoriy)</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                  padding: "16px", background: "var(--bg1)", transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "var(--border)";
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length) setPendingContractFiles(prev => [...prev, ...files]);
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Fayl tanlash yoki tashlash</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>PDF, Word, Excel — har qanday format</span>
                  <input type="file" multiple style={{ display: "none" }}
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) setPendingContractFiles(prev => [...prev, ...files]);
                      e.target.value = "";
                    }} />
                </label>
                <button type="button" onClick={() => openScanModal("contract")} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                  padding: "16px 20px", background: "var(--bg1)", transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <rect x="2" y="7" width="20" height="10" rx="2" />
                    <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                    <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" strokeLinecap="round" />
                    <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>Skaner qilish</span>
                  <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>Printerdan skanerlash</span>
                </button>
              </div>
              {pendingContractFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {pendingContractFiles.map((f, i) => (
                    <div key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--bg3)", border: "1.5px solid var(--border)",
                      borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "var(--text1)", maxWidth: 240,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button type="button" onClick={() => setPendingContractFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, lineHeight: 1, fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {editTarget && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>Mavjud fayllarni ko&apos;rish/boshqarish uchun shartnomani oching</div>
              )}
            </div>

            {/* TZ fayli */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                  TZ fayli <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>(texnik topshiriq, ixtiyoriy)</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
              <label style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                padding: "16px", background: "var(--bg1)", transition: "border-color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--border)";
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length) setPendingTzFiles(prev => [...prev, ...files]);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>TZ faylini tanlash yoki tashlash</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>PDF, Word, Excel — har qanday format</span>
                <input type="file" multiple style={{ display: "none" }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setPendingTzFiles(prev => [...prev, ...files]);
                    e.target.value = "";
                  }} />
              </label>
              <button type="button" onClick={() => openScanModal("tz")} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                padding: "16px 20px", background: "var(--bg1)", transition: "border-color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                  <rect x="2" y="7" width="20" height="10" rx="2" />
                  <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" strokeLinecap="round" />
                  <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>Skaner qilish</span>
                <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>Printerdan skanerlash</span>
              </button>
              </div>
              {pendingTzFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {pendingTzFiles.map((f, i) => (
                    <div key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--bg3)", border: "1.5px solid var(--border)",
                      borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "var(--text1)", maxWidth: 240,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button type="button" onClick={() => setPendingTzFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, lineHeight: 1, fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
            {formError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
          <button onClick={() => { setShowForm(false); setPendingContractFiles([]); setPendingTzFiles([]); setFormUsers([]); }}
            style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
            Bekor qilish
          </button>
          {(editTarget ? canUpdate : canCreate) && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? "Saqlanmoqda..." : editTarget ? "O'zgarishlarni saqlash" : "Shartnoma saqlash"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish (raqam)"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select className="form-input" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 160, cursor: "pointer", height: 36, padding: "0 10px" }}>
          <option value="">Barcha holat</option>
          {(Object.keys(CONTRACT_STATUS_LABELS) as unknown as ContractStatus[]).map(k => (
            <option key={k} value={k}>{CONTRACT_STATUS_LABELS[k]}</option>
          ))}
        </select>

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
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <button onClick={() => openDrawer(c)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-mono)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
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
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          <StatusBadge status={c.status} />
                        </button>
                      ) : (
                        <StatusBadge status={c.status} />
                      )}
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
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => { setViewContract(null); setDrawerFiles([]); setDrawerUsers([]); setDrawerTzFiles([]); setShowAssign(false); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 800, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
              padding: "28px 28px 32px", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "sticky", top: 0, background: "var(--bg2)", zIndex: 1, paddingBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Shartnoma tafsilotlari</span>
              <button onClick={() => { setViewContract(null); setDrawerFiles([]); setDrawerUsers([]); setDrawerTzFiles([]); setShowAssign(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <WorkflowDiagram status={viewContract.status} />

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma raqami</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "var(--font-mono)", wordBreak: "break-all", overflowWrap: "break-word" }}>{viewContract.contractNo}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holat</div>
                <StatusBadge status={viewContract.status} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Muhimlik</div>
                <PriorityBadge priority={viewContract.priority} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlanish sanasi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.startDate)}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugash sanasi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.endDate)}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratuvchi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{viewContract.createdByFullName ?? "—"}</div>
              </div>
              {viewContract.contractParty && (
                <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma tuzilgan tomon</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", wordBreak: "break-word" }}>{viewContract.contractParty}</div>
                </div>
              )}
              {viewContract.departments?.length > 0 && (
                <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Bo&apos;limlar</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {viewContract.departments.map(d => {
                      const ts = TYPE_STYLE[d.type as DepartmentType];
                      return (
                        <span key={d.id} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                          background: ts?.bg ?? "var(--bg3)", color: ts?.color ?? "var(--text1)",
                          border: `1px solid ${ts?.border ?? "var(--border)"}`,
                        }}>
                          {ts?.icon} {d.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {viewContract.notes && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
                <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewContract.notes}</div>
              </div>
            )}

            {/* ── Users ── */}
            <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4, marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Mas&apos;ul xodimlar</div>

              {usersLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>Yuklanmoqda...</div>
              ) : drawerUsers.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "14px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                  Hali xodim biriktirilmagan
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {drawerUsers.map(u => (
                    <div key={u.userId} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      border: "1.5px solid var(--border)", borderRadius: 8,
                      padding: "10px 12px", background: "var(--bg2)",
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "var(--accent)",
                      }}>
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fullName}</div>
                        {u.departmentName && <div style={{ fontSize: 11, color: "var(--text3)" }}>{u.departmentName}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Hujjatlar ── */}
            <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Hujjatlar</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ① Shartnoma fayli */}
                <div style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--bg3)", borderBottom: drawerFiles.length > 0 ? "1.5px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Shartnoma fayli</span>
                    </div>
                  </div>
                  {filesLoading ? (
                    <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
                  ) : drawerFiles.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>Fayl yuklanmagan</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {drawerFiles.map((f, i) => (
                        <div key={f.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                          </div>
                          <button title="Yuklab olish" onClick={() => contractService.downloadFile(viewContract.id, f.id, f.fileName)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ② Texnik topshiriq (TZ) */}
                <div style={{ border: "1.5px solid var(--accent-mid)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--accent-dim)", borderBottom: drawerTzFiles.length > 0 ? "1.5px solid var(--accent-mid)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Texnik topshiriq <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>(TZ)</span></span>
                    </div>
                  </div>
                  {tzFilesLoading ? (
                    <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 14px" }}>Yuklanmoqda...</div>
                  ) : drawerTzFiles.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text3)", padding: "12px 14px", fontStyle: "italic" }}>TZ yuklanmagan</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {drawerTzFiles.map((f, i) => (
                        <div key={f.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 14px", borderTop: i > 0 ? "1px solid var(--accent-mid)" : "none",
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{(f.fileSize / 1024).toFixed(1)} KB · {fmt(f.uploadedAt)}</div>
                          </div>
                          <button title="Yuklab olish" onClick={() => contractService.downloadTzFile(viewContract.id, f.id, f.fileName)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Status Change Modal ── */}
      {statusTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setStatusTarget(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Holat o&apos;zgartirish</div>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>
              <b>{statusTarget.contractNo}</b> — holat tanlang:
            </div>
            <select className="form-input" value={newStatus} onChange={e => setNewStatus(e.target.value)}
              style={{ width: "100%", cursor: "pointer" }}>
              {(Object.keys(CONTRACT_STATUS_LABELS) as unknown as ContractStatus[]).map(k => (
                <option key={k} value={k}>{CONTRACT_STATUS_LABELS[k]}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setStatusTarget(null)}
                style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
                Bekor
              </button>
              <button className="btn-primary" onClick={handleStatusChange} disabled={changingStatus}
                style={{ padding: "9px 20px", borderRadius: "var(--radius)" }}>
                {changingStatus ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan Modal ── */}
      {showScanModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { if (!scanning) setShowScanModal(false); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 14, padding: 28, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                    <rect x="2" y="7" width="20" height="10" rx="2" />
                    <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                    <circle cx="12" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
                    <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Hujjatni skanerlash</span>
              </div>
              <button onClick={() => { if (!scanning) setShowScanModal(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* Skanerlar ro'yxati */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Skaner tanlang</label>
              {scanSourcesLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", padding: "10px 0" }}>Skanerlar qidirilmoqda...</div>
              ) : scanSourcesError ? (
                <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "var(--danger-dim)", borderRadius: 8, border: "1px solid var(--danger)33" }}>
                  {scanSourcesError}
                </div>
              ) : scanSources.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text3)", padding: "10px 12px", background: "var(--bg3)", borderRadius: 8, border: "1.5px dashed var(--border)" }}>
                  Ulangan skaner topilmadi. Printer/skaner ulangan va yoniqligini tekshiring.
                </div>
              ) : (
                <select className="form-input" value={selectedSourceId}
                  onChange={e => setSelectedSourceId(e.target.value)}
                  style={{ width: "100%", cursor: "pointer" }}>
                  {scanSources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Sifat sozlamalari */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Rang rejimi</label>
                <select className="form-input" value={scanColorMode}
                  onChange={e => setScanColorMode(e.target.value)}
                  style={{ width: "100%", cursor: "pointer" }}>
                  <option value="color">Rangli</option>
                  <option value="gray">Kulrang (grayscale)</option>
                  <option value="bw">Qora-oq</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Sifat (DPI)</label>
                <select className="form-input" value={scanDpi}
                  onChange={e => setScanDpi(Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}>
                  <option value={100}>100 DPI (tez)</option>
                  <option value={150}>150 DPI</option>
                  <option value={200}>200 DPI (standart)</option>
                  <option value={300}>300 DPI (yuqori)</option>
                  <option value={600}>600 DPI (maksimal)</option>
                </select>
              </div>
            </div>

            {scanError && (
              <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "var(--danger-dim)", borderRadius: 8, border: "1px solid var(--danger)33" }}>
                {scanError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowScanModal(false)} disabled={scanning}
                style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
                Bekor
              </button>
              <button onClick={handleScanDocument}
                disabled={scanning || !selectedSourceId || scanSources.length === 0}
                style={{
                  padding: "9px 24px", background: scanning ? "var(--bg3)" : "var(--accent)",
                  border: "none", borderRadius: "var(--radius)", cursor: scanning || !selectedSourceId ? "not-allowed" : "pointer",
                  color: scanning ? "var(--text3)" : "#fff", fontSize: 13, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                {scanning ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Skanerlayapti...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="7" width="20" height="10" rx="2" />
                      <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                      <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                    </svg>
                    Skanerlash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Shartnomani o&apos;chirish</div>
            <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              Bu shartnoma o&apos;chiriladi. Amalni ortga qaytarib bo&apos;lmaydi.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)}
                style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
                Bekor
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: "9px 20px", background: "var(--danger)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
