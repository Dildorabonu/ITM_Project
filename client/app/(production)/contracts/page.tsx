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
  ContractProductStatus,
  ContractDeactivationReason,
  ContractType,
  type ContractResponse,
  type ContractSummary,
  type ContractCreatePayload,
  type ContractUpdatePayload,
  type AttachmentResponse,
  type ContractUserResponse,
  type ContractProductPayload,
  type UserLookup,
  type DepartmentOption,
} from "@/lib/userService";

import {
  ContractForm as ContractFormType,
  emptyForm,
} from "./_types";
import { isoToDisplayDate } from "./_components/DatePickerField";
import { StatusBadge, ContractTypeBadge } from "./_components/StatusBadge";
import { ContractForm } from "./_components/ContractForm";
import { ContractDrawer } from "./_components/ContractDrawer";
import { PickupModal } from "./_components/PickupModal";
import { ScanModal } from "./_components/ScanModal";
import { fmt } from "./_components/DatePickerField";
import { useToastStore } from "@/lib/store/toastStore";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { useT } from "@/lib/i18n";

const DEACTIVATION_REASONS: { value: ContractDeactivationReason; label: string }[] = [
  { value: ContractDeactivationReason.CustomerCancelled,      label: "Buyurtmachi bekor qildi" },
  { value: ContractDeactivationReason.PaymentIssue,           label: "To'lov muammosi" },
  { value: ContractDeactivationReason.TechnicalInfeasibility, label: "Texnik jihatdan amalga oshirib bo'lmaydi" },
  { value: ContractDeactivationReason.MaterialUnavailable,    label: "Material yoki resurs yetishmasligi" },
  { value: ContractDeactivationReason.DeadlineExpired,        label: "Muddati o'tib ketdi" },
  { value: ContractDeactivationReason.Other,                  label: "Boshqa (qo'lda kiriting)" },
];

export default function ContractsPage() {
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);
  const canCreate = hasPermission("Contracts.Create");
  const canUpdate = hasPermission("Contracts.Update");

  const [contracts, setContracts]       = useState<ContractSummary[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  // Filters
  const [viewMode, setViewMode]           = useState<"active" | "archive">("active");
  // Arxiv ichidagi sub-tab: yakunlangan (Completed, faol) yoki bekor qilingan (noaktiv).
  const [archiveTab, setArchiveTab]       = useState<"completed" | "cancelled">("completed");
  const [search, setSearch]               = useState("");

  // Ustun sarlavhasi bo'yicha saralash: bosilganda asc → desc → o'chirilgan.
  type SortColumn = "contractNo" | "startDate" | "contractType" | "status";
  const [sortBy, setSortBy]     = useState<SortColumn | "">("");
  const [sortDesc, setSortDesc] = useState(false);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<ContractResponse | null>(null);
  const [form, setForm]                 = useState<ContractFormType>(emptyForm);
  const [startDateDisp, setStartDateDisp] = useState("");
  const [endDateDisp,   setEndDateDisp]   = useState("");
  const [submitted, setSubmitted]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [formError, setFormError]       = useState("");
  const [pendingContractFiles, setPendingContractFiles] = useState<File[]>([]);
  const [openPickerKey, setOpenPickerKey]     = useState<`${number}:${0 | 1 | 2}` | null>(null);
  const pickerRef                             = useRef<HTMLDivElement | null>(null);

  // View drawer
  const [viewContract, setViewContract] = useState<ContractResponse | null>(null);
  const [drawerFiles, setDrawerFiles]   = useState<AttachmentResponse[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Departments
  const [departments, setDepartments]   = useState<DepartmentOption[]>([]);

  // TZ files
  const [drawerTzFiles, setDrawerTzFiles]   = useState<AttachmentResponse[]>([]);
  const [tzFilesLoading, setTzFilesLoading] = useState(false);

  // Users
  const [drawerUsers, setDrawerUsers]   = useState<ContractUserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [allUsers, setAllUsers]         = useState<UserLookup[]>([]);

  // Scan modal
  type ScanTarget = { kind: "contract" } | { kind: "product-tz"; productIdx: number };
  const [showScanModal, setShowScanModal]   = useState(false);
  const [scanTarget, setScanTarget]         = useState<ScanTarget>({ kind: "contract" });
  const [scanSources, setScanSources]       = useState<Parameters<typeof ScanModal>[0]["scanSources"]>([]);
  const [scanSourcesLoading, setScanSourcesLoading] = useState(false);
  const [scanSourcesError, setScanSourcesError]     = useState("");
  const [selectedSourceId, setSelectedSourceId]     = useState("");
  const [scanColorMode, setScanColorMode]   = useState("color");
  const [scanDpi, setScanDpi]               = useState(200);
  const [scanning, setScanning]             = useState(false);
  const [scanError, setScanError]           = useState("");


  // Deactivate confirm
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState<ContractDeactivationReason>(ContractDeactivationReason.CustomerCancelled);
  const [deactivateNote, setDeactivateNote] = useState("");
  const [deactivateError, setDeactivateError] = useState("");

  // Activate confirm
  const [activateId, setActivateId]     = useState<string | null>(null);
  const [activating, setActivating]     = useState(false);

  // Mijozga topshirish (pickup) modali
  const [pickupContract, setPickupContract] = useState<ContractSummary | null>(null);
  const canShipments = hasPermission("Shipments.View") || hasPermission("Shipments.Create");

  // Mijoz to'liq olib ketmagan yakunlangan shartnomalar soni — arxiv tabidagi
  // qizil eslatma nuqtasi shu orqali ko'rsatiladi.
  const [pendingPickupCount, setPendingPickupCount] = useState(0);
  const loadPendingPickup = () => {
    contractService.getPendingPickupCount().then(setPendingPickupCount).catch(() => {});
  };

  useDraft(
    "draft_contracts",
    showForm && !editTarget,
    { form, editTarget },
    (d) => { if (!d.editTarget) { setForm(d.form); ensureDataLoaded().then(() => setShowForm(true)); } },
  );

  // ── Load drawer ────────────────────────────────────────────────────────────

  const openDrawer = async (c: ContractSummary) => {
    // Ro'yxat qatori yengil (`ContractSummary`) — drawer darhol shu ma'lumot bilan
    // ochiladi, to'liq shartnoma (izohlar, bo'limlar, biriktirilgan xodimlar)
    // yuklangach ustiga almashtiriladi.
    setViewContract({
      id: c.id,
      contractNo: c.contractNo,
      startDate: c.startDate,
      endDate: c.endDate,
      departments: c.departments ?? [],
      contractType: c.contractType,
      contractParty: c.contractParty,
      status: c.status,
      notes: null,
      isActive: c.isActive,
      createdByFullName: null,
      products: c.products.map(p => ({
        id: p.id,
        contractId: c.id,
        productCatalogId: null,
        productCode: null,
        productType: p.productType,
        quantity: p.quantity,
        unit: p.unit,
        catalogUnit: null,
        orderIndex: 0,
        notes: p.notes ?? null,
        status: p.status,
        departments: p.departments ?? [],
        assignedUsers: [],
      })),
    });
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
      // Ro'yxat qatorini yangilaymiz, lekin faqat ro'yxatda hisoblanadigan
      // topshirish miqdorlarini saqlab qolgan holda.
      setContracts(prev => prev.map(x => x.id === fresh.id
        ? {
            ...x,
            contractNo:    fresh.contractNo,
            contractParty: fresh.contractParty,
            startDate:     fresh.startDate,
            endDate:       fresh.endDate,
            contractType:  fresh.contractType,
            status:        fresh.status,
            isActive:      fresh.isActive,
            products:      fresh.products.map(p => ({
              id: p.id, productType: p.productType, quantity: p.quantity, unit: p.unit, status: p.status,
            })),
          }
        : x));
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

  // Uch xil ko'rinish:
  //  - Faol: faol va hali yakunlanmagan shartnomalar
  //  - Arxiv → Yakunlangan: Completed holatidagi faol shartnomalar
  //  - Arxiv → Bekor qilingan: noaktiv qilingan shartnomalar
  const isCompletedView = viewMode === "archive" && archiveTab === "completed";

  const load = async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const completedView = viewMode === "archive" && archiveTab === "completed";
      const data = await contractService.getPaged(p, PAGE_SIZE, {
        search:   search || undefined,
        status:   completedView ? ContractStatus.Completed : undefined,
        isActive: viewMode === "active" || completedView,
        excludeCompleted: viewMode === "active",
        sortBy: sortBy || undefined,
        sortDesc,
      });
      setContracts(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setContracts([]);
      setTotalPages(1);
      setTotalCount(0);
      setError(t("Shartnomalarni yuklashda xatolik yuz berdi"));
      console.error("Contracts load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [viewMode, archiveTab, search, sortBy, sortDesc]);

  // Reload when page or any filter changes (debounce search)
  useEffect(() => {
    const t = setTimeout(() => { load(page); }, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, viewMode, archiveTab, search, sortBy, sortDesc]);

  // Arxiv tabidagi topshirish eslatmasi — sahifa ochilganda va tab
  // almashganda yangilanadi (shartnoma yakunlanishi ham shu yerda ushlanadi).
  useEffect(() => {
    loadPendingPickup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, archiveTab]);

  useEffect(() => {
    departmentService.getAll().then(d => setDepartments(d)).catch(() => {});
  }, []);

  useEffect(() => {
    if (openPickerKey === null) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setOpenPickerKey(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPickerKey]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => {
      setShowForm(false);
      setPendingContractFiles([]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  // ── Form ──────────────────────────────────────────────────────────────────

  const ensureDataLoaded = async () => {
    await Promise.all([
      allUsers.length === 0 ? userService.getLookup().then(items => setAllUsers(items)) : Promise.resolve(),
      departments.length === 0 ? departmentService.getAll().then(d => setDepartments(d)) : Promise.resolve(),
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
    await ensureDataLoaded();
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const openEdit = async (summary: ContractSummary) => {
    sessionStorage.removeItem("draft_contracts");

    // Ro'yxat qatorida forma uchun kerakli hamma narsa yo'q (izoh, katalog kodi,
    // mahsulot bo'limlari va biriktirilgan xodimlar) — to'liq shartnoma faqat shu
    // yerda, foydalanuvchi "Tahrirlash"ni bosganda yuklanadi.
    const [c, lookup, depts] = await Promise.all([
      contractService.getById(summary.id),
      allUsers.length > 0 ? Promise.resolve(allUsers) : userService.getLookup(),
      departments.length > 0 ? Promise.resolve(departments) : departmentService.getAll(),
    ]);
    setEditTarget(c);
    if (lookup !== allUsers) setAllUsers(lookup);
    if (depts !== departments) setDepartments(depts);

    const lookupById = new Map(lookup.map(u => [u.id, u]));

    setForm({
      contractNo:    c.contractNo,
      startDate:     c.startDate ? c.startDate.slice(0, 10) : "",
      endDate:       c.endDate ? c.endDate.slice(0, 10) : "",
      contractType:  String(c.contractType),
      contractParty: c.contractParty ?? "",
      notes:         c.notes ?? "",
      products:      (c.products && c.products.length > 0)
        ? c.products.map(p => ({
            productCatalogId: p.productCatalogId ?? null,
            productCode: p.productCode ?? null,
            productType: p.productType ?? "",
            quantity:    p.quantity != null ? String(p.quantity) : "",
            catalogUnit: p.catalogUnit || null,
            unit:        p.catalogUnit || p.unit || "",
            notes:       p.notes ?? "",
            departmentIds: p.departments?.map(d => d.id) ?? [],
            responsibleUsers: (p.assignedUsers ?? []).filter(u => u.role === 0).map(u => lookupById.get(u.userId)).filter((u): u is UserLookup => !!u),
            supervisorUsers:  (p.assignedUsers ?? []).filter(u => u.role === 1).map(u => lookupById.get(u.userId)).filter((u): u is UserLookup => !!u),
            observerUsers:    (p.assignedUsers ?? []).filter(u => u.role === 2).map(u => lookupById.get(u.userId)).filter((u): u is UserLookup => !!u),
            pendingTzFiles: [],
          }))
        : [{ productCatalogId: null, productCode: null, productType: "", quantity: "", catalogUnit: null, unit: "", notes: "", departmentIds: [], responsibleUsers: [], supervisorUsers: [], observerUsers: [], pendingTzFiles: [] }],
    });
    setStartDateDisp(c.startDate ? isoToDisplayDate(c.startDate.slice(0, 10)) : "");
    setEndDateDisp(c.endDate ? isoToDisplayDate(c.endDate.slice(0, 10)) : "");
    setSubmitted(false);
    setFormError("");
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const isValid = () =>
    !!form.contractNo.trim() && !!form.startDate && !!form.endDate &&
    form.products.length > 0 &&
    form.products.every(p =>
      p.productType.trim() !== "" &&
      p.departmentIds.length > 0 &&
      p.quantity.trim() !== "" &&
      Number(p.quantity) > 0 &&
      p.unit.trim() !== ""
    );

  const buildProductsPayload = (): ContractProductPayload[] => form.products
    .filter(p => p.productType.trim())
    .map(p => ({
      productCatalogId: p.productCatalogId,
      productType:   p.productType.trim(),
      quantity:      p.quantity ? Number(p.quantity) : 0,
      unit:          p.unit || "",
      notes:         p.notes || null,
      departmentIds: p.departmentIds,
      users: [
        ...p.responsibleUsers.map(u => ({ userId: u.id, role: 0 })),
        ...p.supervisorUsers.map(u => ({ userId: u.id, role: 1 })),
        ...p.observerUsers.map(u => ({ userId: u.id, role: 2 })),
      ],
    }));

  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid()) return;
    const startDateIso = form.startDate;
    const endDateIso = form.endDate;
    if (!startDateIso || !endDateIso) return;
    setSaving(true);
    setFormError("");
    try {
      const productsPayload = buildProductsPayload();
      // Forms-with-products carry their own department lists; keep top-level
      // departmentIds empty so the backend mirrors the union from products.
      let result: { id: string; products: { id: string; orderIndex: number }[] };
      if (editTarget) {
        const dto: ContractUpdatePayload = {
          contractNo:    form.contractNo,
          startDate:     startDateIso,
          endDate:       endDateIso,
          contractType:  Number(form.contractType) as ContractType,
          contractParty: form.contractParty || undefined,
          notes:         form.notes || null,
          products:      productsPayload,
        };
        result = await contractService.update(editTarget.id, dto);
      } else {
        const dto: ContractCreatePayload = {
          contractNo:    form.contractNo,
          startDate:     startDateIso,
          endDate:       endDateIso,
          contractType:  Number(form.contractType) as ContractType,
          contractParty: form.contractParty || undefined,
          notes:         form.notes || null,
          products:      productsPayload.length > 0 ? productsPayload : undefined,
        };
        result = await contractService.create(dto);
        for (const file of pendingContractFiles)
          await contractService.uploadFile(result.id, file);
        setPendingContractFiles([]);
      }

      // Upload per-product TZ files. The backend returns products in OrderIndex
      // order, matching how we sent them; map by index.
      const sortedProducts = [...result.products].sort((a, b) => a.orderIndex - b.orderIndex);
      const formProductsWithType = form.products.filter(p => p.productType.trim());
      for (let i = 0; i < formProductsWithType.length && i < sortedProducts.length; i++) {
        const productId = sortedProducts[i].id;
        for (const file of formProductsWithType[i].pendingTzFiles)
          await contractService.uploadProductTzFile(result.id, productId, file);
      }

      const wasEditing = !!editTarget;
      await load();
      setShowForm(false);
      window.dispatchEvent(new Event("notif-read"));
      showToast(wasEditing ? t("Shartnoma muvaffaqiyatli tahrirlandi!") : t("Shartnoma muvaffaqiyatli yaratildi!"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setFormError(msg ?? t("Saqlashda xatolik yuz berdi."));
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    setSubmitted(true);
    if (!isValid()) return;
    setFormError("");
    setConfirmSaveOpen(true);
  };

  // ── Scan ──────────────────────────────────────────────────────────────────

  const openScanModal = async (target: ScanTarget = { kind: "contract" }) => {
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
      setScanSourcesError(t("Skanerlar ro'yxatini olishda xatolik. WIA xizmati ishlayotganini tekshiring."));
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
      if (scanTarget.kind === "product-tz") {
        const productIdx = scanTarget.productIdx;
        setForm(f => ({
          ...f,
          products: f.products.map((p, i) => i === productIdx ? { ...p, pendingTzFiles: [...p.pendingTzFiles, file] } : p),
        }));
      } else {
        setPendingContractFiles(prev => [...prev, file]);
      }
      setShowScanModal(false);
    } catch {
      setScanError(t("Skanerlashda xatolik yuz berdi. Skaner ulanganini va tayyor ekanini tekshiring."));
    } finally {
      setScanning(false);
    }
  };

  // ── Activate ──────────────────────────────────────────────────────────────

  const handleActivate = async () => {
    if (!activateId) return;
    setActivating(true);
    try {
      await contractService.activate(activateId);
      setActivateId(null);
      window.dispatchEvent(new Event("notif-read"));
      showToast(t("Shartnoma muvaffaqiyatli active qilindi!"));
      await load();
    } catch {
      // stay open
    } finally {
      setActivating(false);
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────

  const closeDeactivate = () => {
    setDeactivateId(null);
    setDeactivateReason(ContractDeactivationReason.CustomerCancelled);
    setDeactivateNote("");
    setDeactivateError("");
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const trimmed = deactivateNote.trim();
    if (deactivateReason === ContractDeactivationReason.Other && !trimmed) {
      setDeactivateError(t("Iltimos, sababni qo'lda yozib qoldiring."));
      return;
    }
    setDeactivateError("");
    setDeactivating(true);
    try {
      await contractService.deactivate(deactivateId, deactivateReason, trimmed);
      closeDeactivate();
      window.dispatchEvent(new Event("notif-read"));
      showToast(t("Shartnoma muvaffaqiyatli noactive qilindi!"));
      await load();
    } catch {
      // stay open
    } finally {
      setDeactivating(false);
    }
  };

  // ── Render: Form ──────────────────────────────────────────────────────────

  if (showForm) {
    return (
      <>
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
          openPickerKey={openPickerKey}
          setOpenPickerKey={setOpenPickerKey}
          pickerRef={pickerRef}
          allUsers={allUsers}
          departments={departments}
          handleSave={requestSave}
          openScanModal={openScanModal}
          onCancel={() => { setShowForm(false); setPendingContractFiles([]); }}
          canCreate={canCreate}
          canUpdate={canUpdate}
        />
        <ConfirmModal
          open={confirmSaveOpen}
          variant="warn"
          title={t("Shartnomani saqlash")}
          message={
            editTarget
              ? t("Shartnomadagi o'zgarishlarni saqlashni tasdiqlaysizmi?")
              : t("Yangi shartnoma yaratilsinmi? Maydonlarni qaytadan tekshirib chiqing.")
          }
          confirmLabel={t("Saqlash")}
          loadingLabel={t("Saqlanmoqda...")}
          loading={saving}
          onConfirm={async () => { await handleSave(); setConfirmSaveOpen(false); }}
          onCancel={() => { if (!saving) setConfirmSaveOpen(false); }}
        />
      </>
    );
  }

  // ── Sorting helpers ───────────────────────────────────────────────────────

  const toggleSort = (col: SortColumn) => {
    if (sortBy !== col) { setSortBy(col); setSortDesc(false); }
    else if (!sortDesc) setSortDesc(true);
    else { setSortBy(""); setSortDesc(false); }
  };

  // Bosiladigan ustun sarlavhasi: faol saralashda accent rang + yo'nalish strelkasi.
  const sortableTh = (label: string, col: SortColumn, extraStyle?: React.CSSProperties) => {
    const active = sortBy === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        title={t("Saralash")}
        style={{
          textAlign: "center", background: "var(--bg2)", cursor: "pointer", userSelect: "none",
          color: active ? "var(--accent)" : "var(--text1)",
          ...extraStyle,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {label}
          {active ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transition: "transform 0.15s", transform: sortDesc ? "rotate(180deg)" : "none", flexShrink: 0 }}>
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ opacity: 0.35, flexShrink: 0 }}>
              <polyline points="8 9 12 5 16 9" /><polyline points="8 15 12 19 16 15" />
            </svg>
          )}
        </span>
      </th>
    );
  };

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        {/* Faol / Arxiv tab toggle */}
        <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setViewMode("active")}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "active" ? "var(--accent)" : "transparent",
              color: viewMode === "active" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t("Faol")}
          </button>
          <button
            onClick={() => setViewMode("archive")}
            title={pendingPickupCount > 0 ? t("Mijozga topshirilmagan shartnomalar bor") : undefined}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "archive" ? "var(--text3)" : "transparent",
              color: viewMode === "archive" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
              position: "relative",
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            {t("Arxiv")}
            {pendingPickupCount > 0 && (
              <span className="animate-pulse" style={{
                position: "absolute", top: 3, right: 4,
                width: 7, height: 7, borderRadius: "50%",
                background: "var(--danger)",
                boxShadow: "0 0 0 2px var(--bg2)",
              }} />
            )}
          </button>
        </div>

        {/* Arxiv sub-tablari: Yakunlangan / Bekor qilingan */}
        {viewMode === "archive" && (
          <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0, animation: "panel-appear 0.18s ease" }}>
            <button
              onClick={() => setArchiveTab("completed")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "completed" ? "var(--success)" : "transparent",
                color: archiveTab === "completed" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" />
              </svg>
              {t("Yakunlangan")}
              {pendingPickupCount > 0 && (
                <span className="animate-pulse" style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: archiveTab === "completed" ? "#fff" : "var(--danger)",
                  flexShrink: 0,
                }} />
              )}
            </button>
            <button
              onClick={() => setArchiveTab("cancelled")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "cancelled" ? "var(--danger)" : "transparent",
                color: archiveTab === "cancelled" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              {t("Bekor qilingan")}
            </button>
          </div>
        )}

        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder={t("Qidirish: raqam, tomon...")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button className="btn-icon" onClick={() => load()} title={t("Yangilash")}
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
            {t("Yangi shartnoma")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>{t("T/r")}</th>
                  {sortableTh(t("Raqam"), "contractNo")}
                  {sortableTh(t("Muddat"), "startDate")}
                  {sortableTh(t("Turi"), "contractType")}
                  {sortableTh(t("Holat"), "status")}
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>{isCompletedView ? t("Topshirish") : t("Faollik")}</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", background: "var(--bg2)" }}>{t("Amal")}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                    {viewMode === "archive"
                      ? (archiveTab === "completed" ? t("Yakunlangan shartnomalar yo'q") : t("Bekor qilingan shartnomalar yo'q"))
                      : t("Ma'lumot topilmadi")}
                  </td></tr>
                ) : contracts.map((c, i) => (
                  <tr key={c.id} onClick={() => openDrawer(c)} style={{ cursor: "pointer" }}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <button onClick={e => { e.stopPropagation(); openDrawer(c); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-inter)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                        {c.contractNo}
                      </button>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {fmt(c.startDate)} – {fmt(c.endDate)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><ContractTypeBadge contractType={c.contractType} /></td>
                    <td style={{ textAlign: "center", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <div style={{ maxWidth: 200, overflow: "hidden", display: "inline-flex", justifyContent: "center" }}>
                        <StatusBadge status={c.status} products={c.products} />
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {isCompletedView ? (() => {
                        // Mijozga topshirish holati: partiyalar yig'indisi / umumiy miqdor
                        const pct = c.totalQuantity > 0
                          ? Math.min(100, Math.round((c.shippedQuantity / c.totalQuantity) * 100))
                          : 0;
                        const delivered = c.totalQuantity > 0 && c.shippedQuantity >= c.totalQuantity;
                        const none = c.shippedQuantity <= 0;
                        const bg     = delivered ? "var(--success-dim)" : none ? "var(--warn-dim)" : "var(--accent-dim)";
                        const color  = delivered ? "var(--success)"     : none ? "var(--warn)"     : "var(--accent)";
                        return (
                          <span title={`${c.shippedQuantity.toLocaleString()} / ${c.totalQuantity.toLocaleString()}`} style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px",
                            borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: bg, color, border: `1px solid ${color}`,
                            whiteSpace: "nowrap",
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {delivered ? t("To'liq topshirildi") : none ? t("Omborda") : `${pct}% ${t("olib ketildi")}`}
                          </span>
                        );
                      })() : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "2px 10px",
                        borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: c.isActive ? "#dcfce7" : "var(--danger-dim)",
                        color: c.isActive ? "#16a34a" : "var(--danger)",
                        border: `1px solid ${c.isActive ? "#86efac" : "var(--danger)"}`,
                      }}>
                        {c.isActive ? t("Faol") : t("Nofaol")}
                      </span>
                      )}
                    </td>
                    <td style={{ borderLeft: "2px solid var(--border)", cursor: "default" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" onClick={() => openDrawer(c)} title={t("Ko'rish")}
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {canUpdate && c.status !== ContractStatus.Completed && (
                          <button className="btn-icon" onClick={() => openEdit(c)} title={t("Tahrirlash")}
                            style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {/* Mijozga topshirish — yakunlangan shartnomalarda har doim,
                            faol ro'yxatda esa kamida bitta mahsulot ishlab chiqarishga
                            kirgan (omborda tayyor miqdor bo'lishi mumkin) bo'lsa. */}
                        {canShipments && c.isActive && (isCompletedView ||
                          c.products.some(p =>
                            p.status === ContractProductStatus.InProduction ||
                            p.status === ContractProductStatus.Completed)) && (
                          <button className="btn-icon" onClick={() => setPickupContract(c)} title={t("Mijozga topshirish")}
                            style={{ color: "var(--accent)", borderColor: "var(--accent-mid)", background: "var(--accent-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="1" y="3" width="15" height="13" rx="1" />
                              <path d="M16 8h4l3 5v3h-7z" />
                              <circle cx="5.5" cy="18.5" r="2.5" />
                              <circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && c.isActive && !isCompletedView && (
                          <button className="btn-icon btn-icon-danger" onClick={() => {
                            setDeactivateReason(ContractDeactivationReason.CustomerCancelled);
                            setDeactivateNote("");
                            setDeactivateError("");
                            setDeactivateId(c.id);
                          }} title={t("Noaktiv qilish")}
                            style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && !c.isActive && c.status !== ContractStatus.Completed && (
                          <button className="btn-icon" onClick={() => setActivateId(c.id)} title={t("Active qilish")}
                            style={{ color: "#16a34a", borderColor: "#16a34a33", background: "#f0fdf4" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" />
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

      {/* Pagination footer */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} {t("tadan")} {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;{t("ko'rsatilmoqda")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            ← {t("Oldingi")}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "var(--text3)", padding: "0 2px" }}>…</span>
              ) : (
                <button
                  key={p}
                  className="btn-secondary"
                  onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            {t("Keyingi")} →
          </button>
        </div>
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

      {/* ── Mijozga topshirish (pickup) modali ── */}
      {pickupContract && (
        <PickupModal
          contract={pickupContract}
          onClose={() => setPickupContract(null)}
          onChanged={() => { load(); loadPendingPickup(); }}
        />
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
              <span>{t("Shartnomani active qilish")}</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                {t("Bu shartnoma va unga bog'liq barcha ma'lumotlar qayta active holatga qaytadi.")}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline" onClick={() => setActivateId(null)}>
                  {t("Bekor qilish")}
                </button>
                <button className="btn" style={{ background: "#16a34a", color: "#fff", border: "none" }}
                  onClick={handleActivate} disabled={activating}>
                  {activating ? t("Bajarilmoqda...") : t("Active qilish")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirm Modal ── */}
      {deactivateId && (
        <div className="modal-overlay" onClick={closeDeactivate}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
            <div className="modal-header" style={{ color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
              <span>{t("Shartnomani noaktiv qilish")}</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                {t("Bu shartnoma va unga bog'liq barcha ma'lumotlar (texjarayon, xarajat normalari, vazifalar va boshqalar) noaktiv bo'lib qoladi.")}
              </p>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[--text3]" style={{ display: "block", marginBottom: 8 }}>
                  {t("Noaktiv qilish sababi")}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DEACTIVATION_REASONS.map(opt => {
                    const selected = deactivateReason === opt.value;
                    return (
                      <label
                        key={opt.value}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px",
                          border: `1px solid ${selected ? "var(--danger)" : "var(--border)"}`,
                          background: selected ? "var(--danger-dim)" : "var(--surface)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontSize: 13,
                          color: selected ? "var(--danger)" : "var(--text)",
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        <input
                          type="radio"
                          name="deactivate-reason"
                          checked={selected}
                          onChange={() => {
                            setDeactivateReason(opt.value);
                            if (opt.value !== ContractDeactivationReason.Other) {
                              setDeactivateNote("");
                              setDeactivateError("");
                            }
                          }}
                          style={{ accentColor: "var(--danger)" }}
                        />
                        {t(opt.label)}
                      </label>
                    );
                  })}
                </div>
              </div>

              {deactivateReason === ContractDeactivationReason.Other && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[--text3]" style={{ display: "block", marginBottom: 8 }}>
                    {t("Sabab")} <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <textarea
                    value={deactivateNote}
                    onChange={e => { setDeactivateNote(e.target.value); if (deactivateError) setDeactivateError(""); }}
                    placeholder={t("Sababni qisqacha yozib qoldiring...")}
                    rows={3}
                    autoFocus
                    style={{
                      width: "100%",
                      background: "var(--surface)",
                      border: `1px solid ${deactivateError ? "var(--danger)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "var(--text)",
                      resize: "vertical",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  {deactivateError && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--danger)" }}>{deactivateError}</p>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-outline" onClick={closeDeactivate} disabled={deactivating}>
                  {t("Bekor qilish")}
                </button>
                <button className="btn btn-danger" onClick={handleDeactivate} disabled={deactivating}>
                  {deactivating ? t("Noaktiv qilinmoqda...") : t("Noaktiv qilish")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
