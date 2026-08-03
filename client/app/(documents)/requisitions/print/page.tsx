"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useToastStore } from "@/lib/store/toastStore";
import { useAuthStore } from "@/lib/store/authStore";
import {
  requisitionService,
  contractService,
  departmentService,
  costNormService,
  DrawingStatus,
  RequisitionType,
  ProductUnit,
  PRODUCT_UNIT_LABELS_CYR,
  type ContractResponse,
  type ContractProductResponse,
  type DepartmentResponse,
  type CostNormResponse,
} from "@/lib/userService";
import { CheckSelect } from "../_components/CheckSelect";
import { SubmitProgressOverlay } from "../_components/SubmitProgressOverlay";
import { useT } from "@/lib/i18n";
import { mulDecimalStr } from "@/lib/num";

// html2pdf.js chunk'i katta (jsPDF + html2canvas birga ~700 KB) — birinchi
// generatsiyada uni yuklab, parse qilish 1-2 soniya oladi. Shu sababli sahifa
// ochilganda fon rejimida yuklab qo'yamiz (pastdagi useEffect), shunda
// "Talabnomani yuborish" bosilganda modul allaqachon tayyor bo'ladi.
// Promise modul darajasida keshlanadi — takroriy import qilinmaydi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let html2pdfPromise: Promise<any> | null = null;
const loadHtml2Pdf = () => {
  if (!html2pdfPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2pdfPromise = import("html2pdf.js" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((m: any) => m.default)
      .catch((err: unknown) => {
        // Muvaffaqiyatsiz yuklashni keshda qoldirmaymiz — aks holda keyingi
        // urinishlar ham abadiy rejected promise'ni qaytaradi.
        html2pdfPromise = null;
        throw err;
      });
  }
  return html2pdfPromise;
};

interface TableRow {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  spec: string;
  notes: string;
  image: string;      // preview URL (objectURL yoki server URL)
  imageFile: File | null; // yuklanadigan fayl (yangi tanlangan bo'lsa)
  locked?: boolean;   // me'yoriy sarfdan kelgan qator — nomi/birligi/miqdori o'zgartirilmaydi
}

const emptyRow = (id: number): TableRow => ({ id, name: "", unit: "", quantity: "", spec: "", notes: "", image: "", imageFile: null });

// ─── A4 page geometry ─────────────────────────────────────────────────────────
// 96dpi: 1mm = 3.7795px
const MM_TO_PX = 96 / 25.4;
const A4_W = Math.round(210 * MM_TO_PX);          // 794
const A4_H = Math.round(297 * MM_TO_PX);          // 1123
// Standard talabnoma marjnlari: 12mm vertikal, 15mm gorizontal
const PAD_TOP = Math.round(12 * MM_TO_PX);        // 45
const PAD_BOTTOM = Math.round(12 * MM_TO_PX);     // 45
const PAD_LEFT = Math.round(15 * MM_TO_PX);       // 57
const PAD_RIGHT = Math.round(15 * MM_TO_PX);      // 57
const CONTENT_H = A4_H - PAD_TOP - PAD_BOTTOM;    // 1033
// Fallback o'lchamlar (refs hali biriktirilmagan render bosqichida)
const FALLBACK_ROW_H = 90;
const FALLBACK_HEADER_H = 150;
const FALLBACK_SIGNATURE_H = 130;
const TABLE_HEAD_H = 46;
const ADD_ROW_BTN_H = 36;
const FOOTER_BUFFER = 16;
// Har sahifa pastida qoldiriladigan reserve bo'shliq — qatorlar
// pastki marjnga yopishib qolmasligi uchun nafas joyi (~1cm).
const PAGE_BOTTOM_PAD = 40;

function RequisitionPrintContent() {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const docRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLSpanElement>(null);
  const showToast = useToastStore((s) => s.show);

  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<TableRow[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signDate, setSignDate] = useState(new Date().toLocaleDateString("ru-RU").replace(/\//g, "."));

  const [type, setType] = useState<RequisitionType>(RequisitionType.Contract);
  const [contractId, setContractId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  // Talabnoma nomi foydalanuvchidan so'ralmaydi — yakuniy nomni backend manba
  // hujjatdan yasaydi (band bo'lsa oxiriga tartib raqami qo'shadi). Bu yerda
  // shu nomning ko'rinishi tasdiqlash oynasi va PDF fayl nomi uchun tuziladi.
  const autoReqName = useMemo(() => {
    if (type === RequisitionType.Contract) {
      const c = contracts.find(x => x.id === contractId);
      return c ? `${c.contractNo} shartnoma talabnomasi` : "";
    }
    const d = departments.find(x => x.id === departmentId);
    return d ? `${d.name} bo'lim talabnomasi` : "";
  }, [type, contractId, departmentId, contracts, departments]);

  const typeTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [typePill, setTypePill] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const idx = type === RequisitionType.Contract ? 0 : 1;
    const el = typeTabRefs.current[idx];
    if (!el) return;
    setTypePill(prev => {
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      return prev.left === next.left && prev.width === next.width ? prev : next;
    });
  }, [type]);

  // ─── Page measurement & pagination ──────────────────────────────────────────
  const headerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const [headerH, setHeaderH] = useState(FALLBACK_HEADER_H);
  const [signatureH, setSignatureH] = useState(FALLBACK_SIGNATURE_H);
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [rowManualHeights, setRowManualHeights] = useState<Record<number, number>>({});
  const dragRef = useRef<{ rowId: number; startY: number; startHeight: number } | null>(null);

  // Column kengliklar — % da. 7 ta ko'rinadigan column (action col 36px alohida).
  const [colWidthsPct, setColWidthsPct] = useState<number[]>([6, 23, 11, 9, 24, 12, 15]);

  const startColResize = useCallback((colIdx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handleEl = e.currentTarget as HTMLElement;
    const table = handleEl.closest("table") as HTMLTableElement | null;
    if (!table) return;
    // Action col 36px ni hisobga olib, % asosini hisoblaymiz.
    const basis = Math.max(1, table.getBoundingClientRect().width - 36);
    const startX = e.clientX;
    let startA = 0, startB = 0;
    setColWidthsPct(prev => { startA = prev[colIdx]; startB = prev[colIdx + 1]; return prev; });

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const minPct = 3;
    const onMove = (ev: MouseEvent) => {
      const dxPct = ((ev.clientX - startX) / basis) * 100;
      const total = startA + startB;
      let newA = startA + dxPct;
      let newB = startB - dxPct;
      if (newA < minPct) { newA = minPct; newB = total - minPct; }
      if (newB < minPct) { newB = minPct; newA = total - minPct; }
      setColWidthsPct(prev => {
        if (prev[colIdx] === newA && prev[colIdx + 1] === newB) return prev;
        const next = [...prev];
        next[colIdx] = newA;
        next[colIdx + 1] = newB;
        return next;
      });
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const startRowResize = useCallback((rowId: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tr = rowRefs.current.get(rowId);
    if (!tr) return;
    const startHeight = Math.ceil(tr.getBoundingClientRect().height);
    dragRef.current = { rowId, startY: e.clientY, startHeight };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = ev.clientY - d.startY;
      const newH = Math.max(32, d.startHeight + dy);
      setRowManualHeights(prev => prev[d.rowId] === newH ? prev : { ...prev, [d.rowId]: newH });
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const setRowRef = useCallback((id: number) => (el: HTMLTableRowElement | null) => {
    if (el) {
      el.dataset.rowId = String(id);
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  // Header / signature balandligini render dan keyin o'lchaymiz
  useLayoutEffect(() => {
    if (headerRef.current) {
      const h = Math.ceil(headerRef.current.getBoundingClientRect().height);
      setHeaderH(prev => (prev !== h ? h : prev));
    }
    if (signatureRef.current) {
      const h = Math.ceil(signatureRef.current.getBoundingClientRect().height);
      setSignatureH(prev => (prev !== h ? h : prev));
    }
  }, [description, signerName, signerTitle, signDate]);

  // Qatorlar balandligini render dan keyin o'lchaymiz
  useLayoutEffect(() => {
    setRowHeights(prev => {
      const next: Record<number, number> = {};
      let changed = false;
      rows.forEach(r => {
        const el = rowRefs.current.get(r.id);
        if (el) {
          const h = Math.ceil(el.getBoundingClientRect().height);
          // 0 yoki juda kichik o'lchov real emas — saqlamaymiz, shunda paginatsiya FALLBACK ga tushadi.
          if (h > 0) {
            next[r.id] = h;
            if (prev[r.id] !== h) changed = true;
          }
        }
      });
      // O'chirilgan qatorlarni state dan ham olib tashlash
      const prevKeys = Object.keys(prev);
      if (prevKeys.length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [rows]);

  // ResizeObserver — textarea qo'lda kichraytirilganda/kattalashtirilganda balandlik yangilanadi.
  // MUHIM: <tr> elementi uchun `contentRect.height` ishonchli emas (table-row da content-box yo'q,
  // ko'p browserlarda 0 qaytaradi). Shuning uchun layout balandligini `getBoundingClientRect()` orqali olamiz.
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setRowHeights(prev => {
        let changed = false;
        const next = { ...prev };
        entries.forEach(e => {
          const el = e.target as HTMLElement;
          const id = Number(el.dataset.rowId);
          if (Number.isNaN(id)) return;
          const h = Math.ceil(el.getBoundingClientRect().height);
          if (h > 0 && next[id] !== h) {
            next[id] = h;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    });
    rowRefs.current.forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [rows]);

  // Sahifalarga taqsimlash
  const pages = useMemo<TableRow[][]>(() => {
    const result: TableRow[][] = [];
    let current: TableRow[] = [];
    let used = 0;

    rows.forEach((row, i) => {
      // Manual (drag bilan o'rnatilgan) va o'lchangan balandlikning kattasini olamiz.
      // Manual'ni alohida hisobga olamiz, chunki qator yangi sahifaga ko'chganda
      // <tr> qayta mount bo'ladi va eski ResizeObserver yangisini kuzatmaydi —
      // manual qiymat esa state'da turg'un bo'lib paginatsiyani sinxron yangilaydi.
      const measured = rowHeights[row.id] ?? 0;
      const manual = rowManualHeights[row.id] ?? 0;
      const rowH = Math.max(measured, manual) || FALLBACK_ROW_H;
      const isFirstPage = result.length === 0;
      const overhead = (isFirstPage ? headerH : 0) + TABLE_HEAD_H;
      const isLastRow = i === rows.length - 1;
      const footer = isLastRow ? signatureH + ADD_ROW_BTN_H + FOOTER_BUFFER : 0;
      const available = CONTENT_H - overhead - footer - PAGE_BOTTOM_PAD;

      if (used + rowH > available && current.length > 0) {
        result.push(current);
        current = [];
        used = 0;
      }
      current.push(row);
      used += rowH;
    });

    if (current.length || result.length === 0) result.push(current);
    return result;
  }, [rows, rowHeights, rowManualHeights, headerH, signatureH]);

  const [saving, setSaving] = useState(false);
  // Tizimga yuborish bosqichi: null — yuborilmayapti, 0..2 — faol bosqich,
  // 3 — hammasi tugadi (navigatsiyagacha overlay 100% da turadi).
  const [submitStage, setSubmitStage] = useState<number | null>(null);
  const savingSystem = submitStage !== null;
  const [normLoading, setNormLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tzFile, setTzFile] = useState<File | null>(null);
  const tzInputRef = useRef<HTMLInputElement>(null);

  // html2pdf chunk'ini fon rejimida oldindan yuklaymiz — "Talabnomani yuborish"
  // bosilganda modulni kutish (1-2s) kutish vaqtidan tushib qoladi.
  useEffect(() => {
    loadHtml2Pdf().catch(() => { /* generatsiya vaqtida qayta urinadi */ });
  }, []);

  // Yuborish jarayonida tab yopish / reload qilishga urinishda ogohlantirish:
  // yarim yo'lda to'xtatilsa talabnoma PDF'siz saqlanib qolishi mumkin.
  useEffect(() => {
    if (submitStage === null) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [submitStage]);

  const [normPickerOpen, setNormPickerOpen] = useState(false);

  // Me'yoriy sarf qatorlari bo'limlarga biriktirilgan bo'lsa, faqat foydalanuvchining
  // o'z bo'limiga tegishli qatorlar to'ldiriladi va shu bo'lim talabnomaga bog'lanadi
  // (faqat tizimda — chop etiladigan blankda ko'rinmaydi). Talabnoma faqat o'z bo'limi
  // uchun yaratiladi — boshqa bo'lim tanlash mumkin emas.
  const user = useAuthStore(s => s.user);
  const [normDept, setNormDept] = useState<{ id: string; name: string } | null>(null);

  const applyNormRows = (norm: CostNormResponse, dept: { id: string; name: string } | null) => {
    const qty = norm.contractQuantity;
    // Bo'lim sarlavhalarini va butunlay bo'sh qatorlarni chiqaramiz; totalQty
    // to'ldirilmagan bo'lsa ham, agar nom yoki raqami bo'lsa qator ko'chiriladi.
    let lines = norm.items.filter(i => !i.isSection && (i.name || i.no));
    if (dept) lines = lines.filter(i => i.departmentId === dept.id);
    if (!lines.length) { showToast(t("Me'yoriy sarfda material qatorlari topilmadi"), t("Xatolik")); return; }
    const newRows = lines.map((ni, idx) => {
      // Aniq o'nlik ko'paytirish: 0.018 × 3000 = "54" (oddiy `*` bilan
      // 53.99999999999999 chiqadi). mulDecimalStr kutilmagan formatni o'qiy
      // olmasa null qaytaradi — u holda eski xatti-harakat, yaxlitlash yo'q.
      const exact = ni.totalQty ? mulDecimalStr(ni.totalQty, qty) : null;
      const totalQtyNum = ni.totalQty ? parseFloat(ni.totalQty.replace(",", ".")) : NaN;
      return {
        id: Date.now() + idx,
        name: ni.name ?? ni.no ?? "",
        unit: ni.unit ?? "",
        quantity: exact ?? (Number.isFinite(totalQtyNum) ? String(totalQtyNum * qty) : ""),
        spec: "",
        notes: "",
        image: ni.photoRaw ?? ni.photoSemi ?? "",
        imageFile: null,
        locked: true,
      };
    });
    setRows(newRows);
    setNormDept(dept);
    showToast(
      dept
        ? `${dept.name}: ${newRows.length} ${t("ta qator to'ldirildi")}`
        : `${t("Me'yoriy sarfdan")} ${newRows.length} ${t("ta qator to'ldirildi")}`,
      "success",
    );
  };

  const applyNorm = (norm: CostNormResponse) => {
    const lines = norm.items.filter(i => !i.isSection && (i.name || i.no));
    if (!lines.length) { showToast(t("Me'yoriy sarfda material qatorlari topilmadi"), t("Xatolik")); return; }

    const depts: { id: string; name: string; count: number }[] = [];
    lines.forEach(l => {
      if (!l.departmentId) return;
      const d = depts.find(x => x.id === l.departmentId);
      if (d) d.count++;
      else depts.push({ id: l.departmentId, name: l.departmentName ?? "—", count: 1 });
    });

    // Bo'lim biriktirilmagan me'yor — eski xatti-harakat: hammasi to'ldiriladi.
    if (!depts.length) { applyNormRows(norm, null); return; }

    // Talabnoma faqat o'z bo'limi uchun yaratiladi — me'yordan ham faqat
    // foydalanuvchi bo'limiga tegishli qatorlar olinadi.
    const mine = depts.find(d => d.id === user?.departmentId);
    if (!mine) {
      showToast(t("Bu me'yoriy sarfda sizning bo'limingiz uchun qatorlar yo'q"), t("Xatolik"));
      return;
    }
    applyNormRows(norm, mine);
  };

  const fetchAndApplyNorm = async (productId?: string, productLabel?: string) => {
    if (!contractId) return;
    setNormLoading(true);
    try {
      const norms = await costNormService.getAll(contractId);
      const candidates = productId
        ? norms.filter(n => n.contractProductId === productId)
        : norms;
      if (!candidates.length) {
        const target = productLabel ? `"${productLabel}"` : t("Bu shartnoma");
        showToast(`${target} ${t("uchun me'yoriy sarf topilmadi")}`, t("Xatolik"));
        return;
      }
      const norm =
        candidates.find(n => n.isActive && n.status === DrawingStatus.Approved) ??
        candidates.find(n => n.isActive) ??
        candidates[0];
      // List endpointda items kelmaydi — material qatorlari uchun to'liq versiyani olamiz.
      const full = await costNormService.getById(norm.id);
      applyNorm(full);
    } catch {
      showToast(t("Me'yoriy sarf yuklanmadi"), t("Xatolik"));
    } finally {
      setNormLoading(false);
    }
  };

  const fillFromNorm = async () => {
    if (!contractId) return;
    const contract = contracts.find(c => c.id === contractId);
    const products = contract?.products ?? [];
    if (products.length >= 2) {
      // Ko'p mahsulotli shartnoma — qaysi mahsulot bo'yicha to'ldirishni
      // foydalanuvchi tanlaydi. Me'yor mavjud-mavjud emasligi tanlovdan keyin
      // tekshiriladi (yo'q bo'lsa toast ko'rsatamiz).
      setNormPickerOpen(true);
      return;
    }
    await fetchAndApplyNorm();
  };

  // Shartnoma tipida me'yoriy sarfdan to'ldirish majburiy — shartnoma tanlanishi
  // bilan jadval avtomatik to'ldiriladi (alohida tugma yo'q). Ref bir shartnoma
  // uchun qayta-qayta yuklashning oldini oladi; tip/shartnoma almashganda
  // resetNormRows uni bo'shatib qo'yadi.
  const autoFillRef = useRef<string | null>(null);
  useEffect(() => {
    if (type !== RequisitionType.Contract || !contractId || !contracts.length) return;
    if (autoFillRef.current === contractId) return;
    autoFillRef.current = contractId;
    fillFromNorm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, contractId, contracts]);

  const handleProductPick = (product: ContractProductResponse) => {
    setNormPickerOpen(false);
    fetchAndApplyNorm(product.id, product.productType);
  };

  useEffect(() => {
    const urlContractId = searchParams.get("contractId");
    Promise.all([
      contractService.getAll(undefined, undefined, true),
      departmentService.getAllFull(),
    ]).then(([contractsData, depsData]) => {
      setContracts(contractsData);
      setDepartments(depsData);
      if (urlContractId) {
        setType(RequisitionType.Contract);
        setContractId(urlContractId);
      }
    });
  }, [searchParams]);

  // Individual talabnomada bo'lim tanlanmaydi — foydalanuvchining o'z bo'limi
  // avtomatik qo'yiladi (talabnoma faqat o'z bo'limi nomidan yaratiladi).
  useEffect(() => {
    if (user?.departmentId) setDepartmentId(user.departmentId);
  }, [user?.departmentId]);

  const handleClear = () => {
    setRows(prev => {
      prev.forEach(r => { if (r.image.startsWith("blob:")) URL.revokeObjectURL(r.image); });
      return [emptyRow(1), emptyRow(2), emptyRow(3)];
    });
    setDescription("");
    setSignerName("");
    setSignerTitle("");
    setSignDate(new Date().toLocaleDateString("ru-RU").replace(/\//g, "."));
    setContractId("");
    setDepartmentId("");
    setNormDept(null);
    setTzFile(null);
    if (tzInputRef.current) tzInputRef.current.value = "";
    if (descRef.current) descRef.current.textContent = "";
  };

  // Tip yoki shartnoma almashganda me'yordan to'ldirilgan (locked) qatorlar
  // eski shartnomadan qolib ketmasligi uchun jadval bo'shatiladi.
  const resetNormRows = () => {
    setRows(prev => {
      if (!prev.some(r => r.locked)) return prev;
      prev.forEach(r => { if (r.image.startsWith("blob:")) URL.revokeObjectURL(r.image); });
      return [emptyRow(1), emptyRow(2), emptyRow(3)];
    });
    setNormDept(null);
    autoFillRef.current = null;
  };

  const addRow = () => setRows(r => [...r, emptyRow(Date.now())]);
  const removeRow = (id: number) => setRows(r => r.filter(row => row.id !== id || row.locked));
  // Me'yoriy sarfdan kelgan (locked) qatorlarda nomi, birligi va miqdori o'zgartirilmaydi.
  const LOCKED_FIELDS: (keyof TableRow)[] = ["name", "unit", "quantity"];
  const updateRow = (id: number, field: keyof TableRow, value: string) =>
    setRows(r => r.map(row => {
      if (row.id !== id) return row;
      if (row.locked && LOCKED_FIELDS.includes(field)) return row;
      return { ...row, [field]: value };
    }));

  // Me'yordan kelgan (locked) qatorlarda rasm ham o'zgartirilmaydi — me'yorda
  // qanday bo'lsa shundayligicha qoladi.
  const handleImageUpload = (id: number, file: File) => {
    setRows(r => r.map(row => {
      if (row.id !== id || row.locked) return row;
      return { ...row, image: URL.createObjectURL(file), imageFile: file };
    }));
  };

  const handleImageRemove = (id: number) => {
    setRows(r => r.map(row => {
      if (row.id !== id || row.locked) return row;
      if (row.image.startsWith("blob:")) URL.revokeObjectURL(row.image);
      return { ...row, image: "", imageFile: null };
    }));
  };

  const handlePrint = () => window.print();

  const handleSavePdf = async () => {
    setSaving(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) return;
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talabnoma_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setSaving(false);
    }
  };

  const validateSystem = () => {
    const filledRows = rows.filter(r => r.name.trim());
    // Talabnoma faqat o'z bo'limi nomidan yaratiladi — bo'limga biriktirilmagan
    // foydalanuvchi (jumladan superadmin) yarata olmaydi. Backend ham tekshiradi.
    if (!user?.departmentId) { showToast(t("Talabnoma yaratish uchun bo'limga biriktirilgan bo'lishingiz kerak"), t("Xatolik")); return false; }
    if (!filledRows.length) { showToast(t("Kamida bitta material kiriting"), t("Xatolik")); return false; }
    if (type === RequisitionType.Contract && !contractId) { showToast(t("Shartnomani tanlang"), t("Xatolik")); return false; }
    // Shartnoma tipida materiallar faqat me'yoriy sarfdan olinadi — qo'lda
    // kiritilgan (locked bo'lmagan) qatorlar bilan tizimga saqlab bo'lmaydi.
    if (type === RequisitionType.Contract && filledRows.some(r => !r.locked)) {
      showToast(t("Shartnoma tipida materiallar me'yoriy sarfdan avtomatik to'ldiriladi — qo'lda kiritilgan qatorlar saqlanmaydi"), t("Xatolik"));
      return false;
    }
    if (type === RequisitionType.Individual && !departmentId) { showToast(t("Bo'limni tanlang"), t("Xatolik")); return false; }
    return true;
  };

  const handleSaveSystem = () => {
    if (!validateSystem()) return;
    setConfirmOpen(true);
  };

  const resolvePhotoUrl = async (row: TableRow): Promise<string | undefined> => {
    if (!row.image) return undefined;
    // Yangi tanlangan fayl — serverga yuklash
    if (row.imageFile) {
      return await requisitionService.uploadPhoto(row.imageFile);
    }
    // Me'yoriy sarfdan kelgan base64 — serverga yuklash
    if (row.image.startsWith("data:")) {
      const res = await fetch(row.image);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] ?? "jpg";
      const file = new File([blob], `norm-photo.${ext}`, { type: blob.type });
      return await requisitionService.uploadPhoto(file);
    }
    // Allaqachon URL (masalan, qayta saqlash)
    return row.image;
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!docRef.current) return null;
    const original = docRef.current;

    // Hujjatni ekrandan tashqari joyga klonlaymiz — barcha mutatsiyalar (no-print
    // yashirish, print-image ochish, cell-select swap, generating-pdf klassi)
    // klonda bajariladi, foydalanuvchining ko'zi oldidagi DOM tegilmaydi.
    const wrapper = document.createElement("div");
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.style.cssText = `position:fixed;top:0;left:-${A4_W + 200}px;width:${A4_W}px;pointer-events:none;`;
    const clone = original.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // cloneNode input/textarea ning live `.value` ini ko'chirmaydi — qo'lda sinxronlaymiz.
    const origFields = original.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    const cloneFields = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    origFields.forEach((orig, i) => {
      const c = cloneFields[i];
      if (!c) return;
      if (c.tagName === "TEXTAREA") {
        c.textContent = orig.value;
        (c as HTMLTextAreaElement).value = orig.value;
      } else if ((orig as HTMLInputElement).type !== "file") {
        c.setAttribute("value", orig.value);
        (c as HTMLInputElement).value = orig.value;
      }
    });

    // html2canvas <textarea> ichidagi matnni ekrandagi kabi o'ramaydi — metrikalar
    // farq qiladi va uzun matn bir qatorga "ezilib" qolib, qatorni pastga
    // tushirmaydi. Har bir textarea'ni shu uslublarga ega <div> bilan almashtiramiz,
    // shunda html2pdf matnni oddiy DOM matnidek render qiladi va o'rash to'g'ri ishlaydi.
    const cloneTextareas = clone.querySelectorAll<HTMLTextAreaElement>("textarea");
    const origTextareas = original.querySelectorAll<HTMLTextAreaElement>("textarea");
    cloneTextareas.forEach((c, i) => {
      const orig = origTextareas[i];
      if (!orig) return;
      const cs = window.getComputedStyle(orig);
      const div = document.createElement("div");
      div.textContent = orig.value;
      div.style.cssText = [
        "width:100%",
        `min-height:${orig.style.height || cs.height}`,
        `font-family:${cs.fontFamily}`,
        `font-size:${cs.fontSize}`,
        `line-height:${cs.lineHeight}`,
        `font-weight:${cs.fontWeight}`,
        `text-transform:${cs.textTransform}`,
        `color:${cs.color}`,
        `padding:${cs.padding}`,
        "margin:0",
        "white-space:pre-wrap",
        "word-break:break-word",
        "overflow-wrap:break-word",
        "box-sizing:border-box",
      ].join(";");
      c.parentNode?.replaceChild(div, c);
    });

    const noPrint = clone.querySelectorAll<HTMLElement>(".no-print");
    noPrint.forEach(e => (e.style.display = "none"));
    const printImages = clone.querySelectorAll<HTMLElement>(".print-image");
    printImages.forEach(e => (e.style.display = "block"));
    const inlineEditables = clone.querySelectorAll<HTMLElement>(".inline-editable");
    inlineEditables.forEach(e => (e.style.borderBottom = "none"));

    const cellSelects = clone.querySelectorAll<HTMLElement>("[data-cell-select='true']");
    cellSelects.forEach(wrap => {
      const btn = wrap.querySelector("button");
      const textSpan = btn?.querySelector("span");
      const span = document.createElement("span");
      span.textContent = textSpan?.textContent?.trim() ?? wrap.getAttribute("data-value") ?? "";
      span.style.cssText = "font-family:Times New Roman,serif;font-size:12px;color:#000;";
      wrap.parentNode?.insertBefore(span, wrap);
      wrap.style.display = "none";
    });

    clone.classList.add("generating-pdf");

    try {
      const html2pdf = await loadHtml2Pdf();
      const blob: Blob = await html2pdf()
        .set({
          margin: 0,
          pagebreak: { mode: ["css"], avoid: ".page-sheet" },
          // scale 1.5 → A4 varaq ~1191px kenglikda, ya'ni ~144 DPI: matn
          // bir xil o'qiladi, lekin canvas maydoni scale 2 ga nisbatan 44%
          // ga kichrayadi. quality 0.85 fayl hajmini ~3 barobar kamaytiradi —
          // bu PDF'ni serverga yuklash vaqtini ham qisqartiradi.
          image: { type: "jpeg", quality: 0.85 },
          // imageTimeout — remote rasm (masalan /uploads dagi me'yor fotosi)
          // yuklanmasa html2canvas default 15 soniya kutadi va butun jarayon
          // osilib qoladi. 3 soniyadan keyin rasmsiz davom etadi.
          html2canvas: { scale: 1.5, useCORS: true, imageTimeout: 3000, width: A4_W, windowWidth: A4_W },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(clone)
        .toPdf()
        .output("blob");
      return blob;
    } finally {
      wrapper.parentNode?.removeChild(wrapper);
    }
  };

  const doSaveSystem = async () => {
    setConfirmOpen(false);
    const filledRows = rows.filter(r => r.name.trim());
    // Overlay ostidagi katakda fokus qolib ketmasligi uchun — aks holda
    // foydalanuvchi ko'rmaydigan inputga yozishda davom etishi mumkin.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSubmitStage(0);
    try {
      // ── 1-bosqich: rasm yuklash + PDF generatsiyasi PARALLEL ───────────────
      // PDF blank DOM'idan olinadi va serverga yuklangan rasm URL'lariga
      // bog'liq emas, shuning uchun ikkisini ketma-ket kutish shart emas —
      // html2canvas ishlaganda upload'lar tarmoqda parallel ketadi.
      //
      // PDF'ni create'dan OLDIN olish alohida muhim: DOM aynan foydalanuvchi
      // tasdiqlagan holatda suratga olinadi, shu sababli biriktirilgan PDF
      // bazadagi yozuvdan farq qilib qolmaydi.
      const pdfPromise = generatePdfBlob().catch(() => null);
      const photoUrls = await Promise.all(filledRows.map(resolvePhotoUrl));

      // ── 2-bosqich: talabnomani yaratish ───────────────────────────────────
      // Validatsiya xatosi (nom band, me'yorga mos emas) shu yerda darhol
      // chiqadi — PDF tugashini kutmaymiz.
      setSubmitStage(1);
      const reqId = await requisitionService.create({
        // requisitionNo yuborilmaydi — nomni backend shartnoma/bo'lim nomidan
        // yasaydi va takrorlanmasligini o'zi ta'minlaydi.
        type,
        contractId: type === RequisitionType.Contract ? contractId : undefined,
        // Shartnoma tipida ham bo'lim biriktiriladi — tizimda talabnoma qaysi
        // bo'limniki ekani ko'rinadi (blankka chiqmaydi). Me'yordan bo'lim kelmasa
        // yaratuvchining o'z bo'limi qo'yiladi; backend mosligini tekshiradi.
        departmentId: type === RequisitionType.Individual ? departmentId : (normDept?.id ?? user?.departmentId ?? undefined),
        purpose: description || t("Blank talabnoma"),
        signerName: signerName.trim() || undefined,
        signerTitle: signerTitle || undefined,
        signDate: signDate || undefined,
        items: filledRows.map((r, i) => ({
          freeTextName: r.name,
          freeTextUnit: r.unit,
          freeTextSpec: r.spec,
          freeTextPhoto: photoUrls[i] || undefined,
          quantity: Number(r.quantity) || 1,
          notes: r.notes || undefined,
        })),
      });

      // ── 3-bosqich: fayllarni biriktirish ──────────────────────────────────
      // PDF 1-bosqichda boshlangan, shuning uchun bu yerda odatda allaqachon
      // tayyor. PDF va TZ ketma-ket emas, parallel yuklanadi.
      setSubmitStage(2);
      const pdfBlob = await pdfPromise;
      const uploads: Promise<unknown>[] = [];
      if (pdfBlob) {
        const safeNo = (autoReqName || "talabnoma").replace(/[^A-Za-z0-9_-]+/g, "_");
        const pdfFile = new File([pdfBlob], `talabnoma_${safeNo}.pdf`, { type: "application/pdf" });
        uploads.push(requisitionService.uploadFile(reqId, pdfFile, "pdf"));
      }
      if (tzFile) {
        uploads.push(requisitionService.uploadFile(reqId, tzFile, "tz"));
      }
      await Promise.all(uploads);

      // Overlay 100% da qoladi va navigatsiyada komponent bilan birga yo'qoladi —
      // shunda tahrirlanadigan forma bir lahzaga "chaqnab" ko'rinmaydi.
      setSubmitStage(3);
      showToast(t("Talabnoma tizimda saqlandi"), "success");
      router.push("/requisitions");
    } catch {
      showToast(t("Xatolik yuz berdi"), t("Xatolik"));
      setSubmitStage(null);
    }
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          /* Layout wrapperlarini (html / body / #app-root / main / main>div)
             normal block oqimiga qaytaramiz. position:absolute ishlatib bo'lmaydi —
             Chrome absolute container ichidagi page-break-after ni hurmat qilmaydi
             va natijada faqat 1 sahifa chiqadi. Buning o'rniga sidebar/topbar ni
             display:none bilan yashirib, .document-stack ni natural oqimda
             qoldiramiz — shunda har page-sheet uchun page-break ishlaydi. */
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            display: block !important;
          }
          #app-root {
            display: block !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Sidebar (#app-root > aside) */
          #app-root > aside { display: none !important; }
          /* O'ng tomon container (#app-root > div) — flex column ni block ga */
          #app-root > div {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Topbar — o'ng tomonning birinchi farzandi */
          #app-root > div > div:first-child { display: none !important; }
          main {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            background: transparent !important;
          }
          main > div {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }
          .document-stack {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            width: 210mm !important;
            background: #fff !important;
          }
          .page-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .page-sheet table { font-size: 10px !important; }
          /* Header rang fonini print da saqlash — Chrome default da background
             ranglarini olib tashlaydi, shuning uchun print-color-adjust: exact
             majburlanadi. Aks holda oltin fon yo'qoladi va oq matn ko'rinmay qoladi. */
          .page-sheet table thead tr,
          .page-sheet table th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .page-sheet table th {
            padding: 6px 6px !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            font-weight: 700 !important;
            background: #b8860b !important;
            color: #fff !important;
          }
          .page-sheet table th span { font-size: 9.5px !important; line-height: 1.3 !important; }
          .page-sheet table td { padding: 4px 5px !important; }
          /* Grid chiziqlari — ekrandagi #ccc juda och, ko'p printerlarda
             zo'rg'a chiqadi. Print da to'q kulrang qilib aniq ko'rinishini
             ta'minlaymiz. borderCollapse: collapse holatida har tomonlamasini
             ham aniq beramiz, aks holda ba'zi qirralar yo'qolib qoladi. */
          .page-sheet table { border-collapse: collapse !important; border: 1px solid #333 !important; }
          /* Header (oltin fonli) — to'q jigarrang chegara, ustun sarlavhalari
             orasida aniq separator. Data (td) — to'q kulrang, oq fonda yaxshi
             ko'rinadi. */
          .page-sheet table th { border: 1px solid #5a3f00 !important; }
          .page-sheet table td { border: 1px solid #333 !important; }
          .page-sheet table tr { border: none !important; }
          input, textarea { border: none !important; background: transparent !important; resize: none !important; overflow: hidden !important; }
          .inline-editable { border: none !important; }
          [data-cell-select] button { border: none !important; background: transparent !important; padding: 0 !important; font-family: Times New Roman, serif !important; font-size: 12px !important; color: #000 !important; height: auto !important; }
          [data-cell-select] svg { display: none !important; }
          .add-row-btn { display: none !important; }
          .remove-row-btn { display: none !important; }
          .print-image { display: block !important; }
          .no-print { display: none !important; }
        }
        /* PDF generatsiyasi vaqtidagi normallashtirish — page-break qoidalari
           inline style orqali per-sheet beriladi (isLastPage bo'yicha), shu
           tufayli html2pdf'ning :last-child evaluatsiyasiga bog'liq emasmiz —
           aks holda oxirgi varaqdan keyin bo'sh PDF sahifa qo'shilib qolardi. */
        .generating-pdf { display: block !important; gap: 0 !important; }
        .generating-pdf .page-sheet {
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }
        @page { margin: 0; size: A4 portrait; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .inline-editable[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
        .req-img-actions { opacity: 0; pointer-events: none; }
        .req-img-wrap:hover .req-img-actions,
        .req-img-wrap:focus-within .req-img-actions { opacity: 1; pointer-events: auto; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        marginBottom: 24,
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
      }}>
        {/* Top row: navigation + title */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg3)",
        }}>
          <button
            onClick={() => router.push("/requisitions")}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)", flexShrink: 0, transition: "border-color 0.15s, color 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t("Orqaga")}
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{t("Talabnoma blanki")}</h1>

          <div style={{ flex: 1 }} />

          {/* Type + contract/dept selectors */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div
              style={{
                position: "relative",
                display: "inline-grid",
                gridTemplateColumns: "1fr 1fr",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--bg2)",
                overflow: "hidden",
                isolation: "isolate",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: typePill.width,
                  transform: `translateX(${typePill.left}px)`,
                  background: "var(--accent)",
                  transition: "transform 0.42s cubic-bezier(0.32, 0.72, 0, 1), width 0.42s cubic-bezier(0.32, 0.72, 0, 1)",
                  willChange: "transform, width",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
              {([
                { value: RequisitionType.Contract, label: t("Shartnoma bo'yicha") },
                { value: RequisitionType.Individual, label: t("Individual") },
              ] as const).map((opt, i) => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    ref={el => { typeTabRefs.current[i] = el; }}
                    type="button"
                    onClick={() => { if (opt.value !== type) { setType(opt.value); resetNormRows(); } }}
                    style={{
                      position: "relative",
                      padding: "5px 12px",
                      border: "none",
                      background: "transparent",
                      color: active ? "#fff" : "var(--text)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "color 0.32s ease",
                      zIndex: 1,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {type === RequisitionType.Contract ? (
              <CheckSelect
                value={contractId}
                onChange={v => { setContractId(v); if (v !== contractId) resetNormRows(); }}
                options={contracts.map(c => ({ id: c.id, name: c.contractParty ? `${c.contractNo} — ${c.contractParty}` : c.contractNo }))}
                placeholder={t("— Shartnoma —")}
                style={{ width: 220 }}
              />
            ) : (
              <CheckSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={departments.filter(d => d.id === user?.departmentId).map(d => ({ id: d.id, name: d.name }))}
                placeholder={t("— Bo'lim —")}
                style={{ width: 220 }}
              />
            )}
          </div>
        </div>

        {/* Bottom row: action buttons — guruhlangan
              chap: destruktiv | input guruhi
              o'ng: chiqarish guruhi | yakuniy amal (yagona primary) */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
        }}>
          {/* — Destruktiv (ajralib turadi) — */}
          <button
            onClick={handleClear}
            title={t("Blankni tozalash")}
            onMouseEnter={e => { e.currentTarget.style.background = "#fff0f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg3)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", background: "var(--bg3)", border: "1.5px solid #e53e3e", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#e53e3e", transition: "background 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            {t("Tozalash")}
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* — Input/yuklash guruhi (TZ ilova + Me'yoriy sarf) — */}
          <input
            ref={tzInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0] ?? null;
              setTzFile(f);
            }}
          />
          {tzFile ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--accent-dim)", border: "1.5px solid var(--accent)", borderRadius: "var(--radius)", maxWidth: 220 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {tzFile.name}
              </span>
              <button
                type="button"
                onClick={() => { setTzFile(null); if (tzInputRef.current) tzInputRef.current.value = ""; }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, lineHeight: 1, flexShrink: 0 }}
                title={t("O'chirish")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => tzInputRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)", transition: "border-color 0.15s, color 0.15s" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              {t("TZ ilova")}
            </button>
          )}

          {type === RequisitionType.Contract && (
            <>
            {/* Me'yoriy sarf shartnoma tanlanganda avtomatik yuklanadi — bu chip
                faqat yuklanish jarayonini ko'rsatadi */}
            {normLoading && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--accent-dim)", border: "1.5px solid var(--accent)", borderRadius: "var(--radius)", whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{t("Me'yoriy sarfdan to'ldirilmoqda…")}</span>
              </div>
            )}

            {normDept && (
              <div
                title={t("Talabnoma shu bo'lim me'yoriy sarfi asosida yaratilmoqda. Bu belgi qog'ozga chiqmaydi.")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--purple-dim)", border: "1.5px solid var(--purple)", borderRadius: "var(--radius)", maxWidth: 260 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
                  <line x1="9" y1="10" x2="9" y2="10.01" /><line x1="15" y1="10" x2="15" y2="10.01" />
                  <line x1="9" y1="14" x2="9" y2="14.01" /><line x1="15" y1="14" x2="15" y2="14.01" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--purple)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {normDept.name}
                  {user?.departmentId === normDept.id && (
                    <span style={{ fontWeight: 500, opacity: 0.75 }}> · {t("Sizning bo'limingiz")}</span>
                  )}
                </span>
              </div>
            )}
            </>
          )}

          {/* spacer — chiqarish guruhi va yakuniy amalni o'ngga itaradi */}
          <div style={{ flex: 1 }} />

          {/* — Chiqarish guruhi (saqlash + chop etish, ikkalasi ham ghost) — */}
          <button
            onClick={handleSavePdf}
            disabled={saving}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; } }}
            onMouseLeave={e => { if (!saving) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; } }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--bg3)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1, transition: "border-color 0.15s, color 0.15s" }}
          >
            {saving ? (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            {t("PDF saqlash")}
          </button>

          <button
            onClick={handlePrint}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--bg3)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "border-color 0.15s, color 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="6,9 6,2 18,2 18,9" />
              <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            {t("Chop etish")}
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* — Yakuniy amal (yagona primary purple) — */}
          <button
            onClick={handleSaveSystem}
            disabled={savingSystem || confirmOpen || normPickerOpen}
            onMouseEnter={e => { if (!savingSystem) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = savingSystem ? "0.7" : "1"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: savingSystem ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: savingSystem ? 0.7 : 1, transition: "opacity 0.15s" }}
          >
            {savingSystem ? (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            {t("Talabnomani yuborish")}
          </button>
        </div>
      </div>

      {/* Document — multi-page A4 stack (Word kabi) */}
      <div ref={docRef} className="document-stack" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        flexShrink: 0,
      }}>
        {pages.map((pageRows, pageIdx) => {
          const isFirstPage = pageIdx === 0;
          const isLastPage = pageIdx === pages.length - 1;
          return (
            <div
              key={pageIdx}
              className="page-sheet"
              style={{
                background: "#fff",
                color: "#000",
                fontFamily: "Times New Roman, serif",
                fontSize: 13,
                width: A4_W,
                height: A4_H,
                minHeight: A4_H,
                flexShrink: 0,
                padding: `${PAD_TOP}px ${PAD_RIGHT}px ${PAD_BOTTOM}px ${PAD_LEFT}px`,
                boxSizing: "border-box",
                boxShadow: "var(--shadow2)",
                borderRadius: 6,
                border: "1px solid var(--border)",
                position: "relative",
                overflow: "hidden",
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              {isFirstPage && (
                <div ref={headerRef}>
                  {/* Company header */}
                  <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "Times New Roman, serif" }}>
                      &quot;INNOVATSIYA TEXNOLOGIYALARI MARKAZI&quot; MChJ
                    </div>
                  </div>
                  <div style={{ textAlign: "center", marginBottom: 2, fontSize: 13 }}>
                    Бош директорига
                  </div>
                  <div style={{ textAlign: "center", margin: "12px 0 18px", fontFamily: "Times New Roman, serif" }}>
                    <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>ТАЛАБНОМА</div>
                  </div>

                  {/* Intro text with editable box */}
                  <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>
                    Ушбу оркали Сиздан,{" "}
                    <span
                      ref={descRef}
                      className="inline-editable"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="matn kiriting..."
                      onInput={e => setDescription(e.currentTarget.textContent || "")}
                      style={{
                        borderBottom: "1px solid #999",
                        display: "inline",
                        outline: "none",
                        fontFamily: "Times New Roman, serif",
                        fontSize: 13,
                        color: "#000",
                        cursor: "text",
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                      }}
                    />{" "}
                    омбордан берилиши учун рухсат беришингизни сўрайман.
                  </div>
                </div>
              )}

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                <colgroup>
                  {colWidthsPct.map((w, ci) => <col key={ci} style={{ width: `${w}%` }} />)}
                  <col className="no-print" style={{ width: 36 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>№<ColResizer idx={0} onStart={startColResize} /></th>
                    <th style={th}>Махсулот номи<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(рус тилида кўрсатилган)</span><ColResizer idx={1} onStart={startColResize} /></th>
                    <th style={th}>Ўлчов<br />бирлиги<ColResizer idx={2} onStart={startColResize} /></th>
                    <th style={th}>Миқдори<ColResizer idx={3} onStart={startColResize} /></th>
                    <th style={th}>Техник кўрсаткичи<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(рус тилида кўрсатилди)</span><ColResizer idx={4} onStart={startColResize} /></th>
                    <th style={th}>Фотосурати<ColResizer idx={5} onStart={startColResize} /></th>
                    <th style={th}>Изох</th>
                    <th className="no-print" style={{ ...th, background: "#9a6f00" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => {
                    const i = rows.findIndex(r => r.id === row.id);
                    // Shartnoma tipida qo'lda kiritish yo'q — me'yordan kelmagan
                    // (bo'sh) qatorlar shartnoma tanlanguncha inert bo'sh katak
                    // sifatida turadi, hech narsa yozib bo'lmaydi.
                    const inert = !row.locked && type === RequisitionType.Contract;
                    return (
                      <tr key={row.id} ref={setRowRef(row.id)} style={{ borderBottom: "1px solid #ccc", position: "relative" }}>
                        <td style={{ ...td, textAlign: "center", fontWeight: 600, whiteSpace: "nowrap", height: rowManualHeights[row.id] || undefined }}>{i + 1}.</td>
                        <td style={td}>
                          {row.locked ? (
                            <div style={lockedCell}>{row.name}</div>
                          ) : inert ? (
                            <div style={{ minHeight: 36 }} />
                          ) : (
                            <AutoTextarea
                              value={row.name}
                              onChange={v => updateRow(row.id, "name", v)}
                              placeholder={t("Nomi...")}
                              style={cellInput}
                              minHeight={36}
                            />
                          )}
                        </td>
                        <td style={td}>
                          {row.locked ? (
                            <div style={{ ...lockedCell, textAlign: "center" }}>{row.unit || "—"}</div>
                          ) : inert ? (
                            <div style={{ minHeight: 36 }} />
                          ) : (
                            <div data-cell-select="true" data-value={row.unit}>
                              <CheckSelect
                                value={row.unit}
                                onChange={v => updateRow(row.id, "unit", v)}
                                options={[
                                  { id: "", name: "—" },
                                  ...(Object.values(ProductUnit).filter(v => typeof v === "number") as ProductUnit[]).map(u => ({ id: PRODUCT_UNIT_LABELS_CYR[u], name: PRODUCT_UNIT_LABELS_CYR[u] })),
                                ]}
                                placeholder="—"
                                buttonStyle={{ background: "transparent", color: "#000", border: "1px solid #ccc" }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          {row.locked ? (
                            <div style={lockedCell}>{row.quantity}</div>
                          ) : inert ? (
                            <div style={{ minHeight: 36 }} />
                          ) : (
                            <AutoTextarea
                              value={row.quantity}
                              onChange={v => updateRow(row.id, "quantity", v)}
                              placeholder="0"
                              style={cellInput}
                              minHeight={36}
                            />
                          )}
                        </td>
                        <td style={td}>
                          {inert ? (
                            <div style={{ minHeight: 54 }} />
                          ) : (
                            <AutoTextarea
                              value={row.spec}
                              onChange={v => updateRow(row.id, "spec", v)}
                              placeholder={t("Texnik ko'rsatkich...")}
                              style={cellInput}
                              minHeight={54}
                            />
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center", padding: 6, verticalAlign: "middle" }}>
                          {row.image ? (
                            <>
                              {/* Preview + overlay action buttons (locked qatorda
                                  rasm o'zgartirilmaydi — tugmalar chiqmaydi) */}
                              <div className="no-print req-img-wrap" style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
                                <img src={row.image} alt="расм" style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain", borderRadius: 3, border: "1px solid #e0c060", display: "block" }} />
                                {!row.locked && (
                                  <div className="req-img-actions" style={{
                                    position: "absolute", top: 2, right: 2,
                                    display: "flex", gap: 2,
                                    transition: "opacity 0.15s",
                                  }}>
                                    <label title={t("Rasmni almashtirish")} style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 18, height: 18, fontSize: 10, lineHeight: 1,
                                      color: "#b8860b", cursor: "pointer",
                                      background: "#fffbea", border: "1px solid #d4a900",
                                      borderRadius: 3, fontFamily: "Arial, sans-serif",
                                      pointerEvents: "auto",
                                    }}>
                                      <input type="file" accept="image/*" style={{ display: "none" }}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(row.id, f); }} />
                                      ✎
                                    </label>
                                    <button onClick={() => handleImageRemove(row.id)} title={t("Rasmni o'chirish")} style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 18, height: 18, fontSize: 10, lineHeight: 1,
                                      color: "#c00", cursor: "pointer",
                                      background: "#fff0f0", border: "1px solid #f99",
                                      borderRadius: 3, fontFamily: "Arial, sans-serif", padding: 0,
                                      pointerEvents: "auto",
                                    }}>✕</button>
                                  </div>
                                )}
                              </div>
                              {/* Print-only image */}
                              <img src={row.image} alt="расм" className="print-image" style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain", display: "none" }} />
                            </>
                          ) : (inert || row.locked) ? (
                            <div style={{ height: 72 }} />
                          ) : (
                            <label className="no-print" title={t("Rasm yuklash")} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 72, border: "1.5px dashed #c9a020", borderRadius: 5, cursor: "pointer", color: "#b8860b", background: "#fffdf0", transition: "background 0.15s" }}>
                              <input type="file" accept="image/*" style={{ display: "none" }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(row.id, f); }} />
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a020" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                              <span style={{ fontSize: 9, fontFamily: "Arial, sans-serif", color: "#b8860b" }}>{t("Rasm yuklash")}</span>
                            </label>
                          )}
                        </td>
                        <td style={td}>
                          {inert ? (
                            <div style={{ minHeight: 36 }} />
                          ) : (
                            <AutoTextarea
                              value={row.notes}
                              onChange={v => updateRow(row.id, "notes", v)}
                              placeholder="..."
                              style={cellInput}
                              minHeight={36}
                            />
                          )}
                        </td>
                        <td className="no-print remove-row-btn" style={{ ...td, textAlign: "center", verticalAlign: "middle" }}>
                          {rows.length > 1 && !row.locked && !inert && (
                            <button
                              onClick={() => removeRow(row.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#c00", fontSize: 16, padding: 4 }}
                            >✕</button>
                          )}
                          <div
                            className="no-print"
                            onMouseDown={startRowResize(row.id)}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              bottom: -3,
                              height: 6,
                              cursor: "ns-resize",
                              zIndex: 5,
                              background: "transparent",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {isLastPage && (
                <>
                  {/* Add row — shartnoma tipida materiallar faqat me'yoriy sarfdan
                      to'ldiriladi, qo'lda qator qo'shilmaydi */}
                  {type === RequisitionType.Individual ? (
                    <div className="no-print add-row-btn" style={{ marginTop: 12, marginBottom: 16 }}>
                      <button
                        onClick={addRow}
                        style={{ fontSize: 12, fontWeight: 600, color: "#b8860b", background: "none", border: "1px dashed #b8860b", borderRadius: 4, padding: "5px 14px", cursor: "pointer" }}
                      >
                        + {t("Qator qo'shish")}
                      </button>
                    </div>
                  ) : (
                    <div className="no-print add-row-btn" style={{ marginTop: 12, marginBottom: 16, fontSize: 11, color: "#999", fontFamily: "Arial, sans-serif" }}>
                      {contractId
                        ? t("Shartnoma tipida materiallar me'yoriy sarfdan avtomatik to'ldiriladi")
                        : t("Shartnomani tanlang — jadval me'yoriy sarfdan avtomatik to'ldiriladi")}
                    </div>
                  )}

                  {/* Signature */}
                  <div ref={signatureRef}>
                    <div style={{ display: "flex", gap: 40, alignItems: "flex-start", marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        <textarea
                          value={signerTitle}
                          onChange={e => setSignerTitle(e.target.value)}
                          placeholder={t("Lavozim (masalan: ТИКУВ ЦЕХИ БОШЛИҒИ)")}
                          rows={2}
                          style={{ ...sigInput, width: "100%", textTransform: "uppercase", fontWeight: 700, fontSize: 12, resize: "none", display: "block", overflow: "hidden", wordBreak: "break-word" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <textarea
                          value={signerName}
                          onChange={e => setSignerName(e.target.value)}
                          placeholder={t("F.I.O.")}
                          rows={2}
                          style={{ ...sigInput, width: "100%", resize: "none", display: "block", overflow: "hidden", wordBreak: "break-word" }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ display: "inline-block", borderBottom: "1px solid #999", minWidth: 110, maxWidth: 110, fontSize: 12, fontFamily: "Times New Roman, serif", paddingBottom: 2, paddingLeft: 2 }}>
                        {signDate}
                      </span>
                      <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>йил</span>
                    </div>
                  </div>
                </>
              )}

              {/* Page number indicator (faqat ekranda) */}
              {pages.length > 1 && (
                <div className="no-print" style={{
                  position: "absolute",
                  right: 14,
                  bottom: 8,
                  fontSize: 10,
                  color: "#999",
                  fontFamily: "Arial, sans-serif",
                  letterSpacing: 0.3,
                }}>
                  {pageIdx + 1} / {pages.length}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {normPickerOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 24, width: 520, maxWidth: "90vw", maxHeight: "80vh", boxShadow: "var(--shadow2)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text1)" }}>{t("Mahsulotni tanlang")}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16, lineHeight: 1.5 }}>
              {t("Bu shartnomada bir nechta mahsulot bor. Qaysi mahsulot bo'yicha me'yoriy sarfdan to'ldirishni tanlang.")}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 }}>
              {(contracts.find(c => c.id === contractId)?.products ?? []).map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductPick(product)}
                  style={{
                    display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch",
                    padding: "12px 14px", textAlign: "left", cursor: "pointer",
                    background: "var(--bg3)", border: "1.5px solid var(--border)",
                    borderRadius: "var(--radius)", transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg3)"; }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                    {product.productType}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    <span>{t("Soni")}: {product.quantity} {product.unit}</span>
                    {product.notes && <><span>•</span><span>{product.notes}</span></>}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", marginTop: 18 }}>
              <button
                onClick={() => {
                  // Mahsulot tanlanmasa me'yordan to'ldirib bo'lmaydi — shartnoma
                  // tanlovi ham bekor qilinadi (to'ldirish majburiy bo'lgani uchun).
                  setNormPickerOpen(false);
                  setContractId("");
                  resetNormRows();
                }}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                {t("Bekor")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 460, maxWidth: "90vw", minHeight: 240, boxShadow: "var(--shadow2)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "var(--text1)" }}>{t("Ishonchingiz komilmi?")}</div>
            <div style={{ fontSize: 15, color: "var(--text2)", marginBottom: 20, lineHeight: 1.6 }}>
              <strong>{autoReqName}</strong> {t("nomli talabnoma")}{" "}
              {type === RequisitionType.Contract ? t("ombor tekshiruviga") : t("tizimga")}{" "}
              {t("yuboriladi. Yuborilgandan keyin tahrirlab bo'lmaydi.")}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}
              >
                {t("Bekor")}
              </button>
              <button
                onClick={doSaveSystem}
                style={{ flex: 1, padding: "9px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600 }}
              >
                {t("Tasdiqlash va yuborish")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Yuborish jarayonini bloklovchi overlay — jarayon davomida blank
          tahrirlanmaydi va boshqa sahifaga o'tib ketilmaydi. */}
      {submitStage !== null && <SubmitProgressOverlay stage={submitStage} />}
    </>
  );
}

export default function RequisitionPrintPage() {
  return (
    <Suspense>
      <RequisitionPrintContent />
    </Suspense>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "7px 8px",
  // Background har th ga to'g'ridan-to'g'ri qo'yiladi (tr emas) — shunda
  // border-collapse ostida tr fonidan kelib chiqadigan bo'yash artefaktlari
  // bo'lmaydi. To'q jigarrang chegara oltin fonda yaqqol ko'rinadi.
  background: "#b8860b",
  border: "1px solid #5a3f00",
  fontWeight: 700,
  fontSize: 11,
  textAlign: "center",
  lineHeight: 1.35,
  position: "relative",
  color: "#fff",
};

function ColResizer({ idx, onStart }: { idx: number; onStart: (i: number) => (e: React.MouseEvent) => void }) {
  return (
    <span
      className="no-print"
      onMouseDown={onStart(idx)}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: -3,
        width: 6,
        cursor: "ew-resize",
        zIndex: 5,
        background: "transparent",
      }}
    />
  );
}

const td: React.CSSProperties = {
  padding: "5px 7px",
  border: "1px solid #ccc",
  verticalAlign: "top",
  overflow: "hidden",
  wordBreak: "break-word",
};

// Me'yoriy sarfdan kelgan (locked) qator katagi — cellInput bilan bir xil
// tipografiya, lekin tahrirlanmaydigan oddiy matn sifatida chiqadi.
const lockedCell: React.CSSProperties = {
  width: "100%",
  fontFamily: "Times New Roman, serif",
  fontSize: 12,
  color: "#000",
  lineHeight: 1.5,
  wordBreak: "break-word",
  minHeight: 28,
  boxSizing: "border-box",
};

const cellInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  fontFamily: "Times New Roman, serif",
  fontSize: 12,
  resize: "none",
  outline: "none",
  padding: 0,
  color: "#000",
  boxSizing: "border-box",
  lineHeight: 1.5,
  overflow: "hidden",
  wordBreak: "break-word",
  minHeight: 28,
  display: "block",
};

function AutoTextarea({
  value,
  onChange,
  placeholder,
  style,
  minHeight = 28,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, minHeight) + "px";
  }, [value, minHeight]);
  // Column kengligi o'zgarganda matn boshqa darajada wrap bo'ladi — qayta o'lchaymiz.
  // Faqat width o'zgarganda re-fit qilamiz, height o'zgarishini e'tiborsiz qoldiramiz
  // (aks holda RO loop bo'lishi mumkin).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== lastWidth) {
        lastWidth = el.offsetWidth;
        el.style.height = "auto";
        el.style.height = Math.max(el.scrollHeight, minHeight) + "px";
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      style={style}
    />
  );
}

const sigInput: React.CSSProperties = {
  border: "none",
  borderBottom: "1px solid #999",
  background: "transparent",
  fontFamily: "Times New Roman, serif",
  fontSize: 13,
  outline: "none",
  padding: "2px 4px",
  color: "#000",
};
