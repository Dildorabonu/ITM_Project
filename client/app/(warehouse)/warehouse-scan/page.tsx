"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  warehouseScanService,
  type ScanLookupResult,
  type ScanActionType,
} from "@/lib/scan";
import {
  departmentService,
  PRODUCT_UNIT_LABELS,
  type DepartmentOption,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

// Savatdagi bitta qator — skanerlangan Product + tanlangan miqdor.
interface BasketLine {
  key: string;
  product: ScanLookupResult;
  qty: number;
  error?: string; // commit'da xato bo'lsa shu qatorda ko'rsatamiz
}

// Savat amali — Chiqim (Out) yoki Ko'chirish (Transfer). Adjust savatga mos kelmaydi.
const BASKET_ACTIONS: { type: ScanActionType; label: string; token: string }[] = [
  { type: "Out",      label: "Chiqim",     token: "--danger" },
  { type: "Transfer", label: "Ko'chirish", token: "--accent" },
];

export default function WarehouseScanPage() {
  const t = useT();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAct = hasPermission("Products.Update");
  const showToast = useToastStore((s) => s.show);

  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Savat holati
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [actionType, setActionType] = useState<ScanActionType>("Out");
  const [targetDept, setTargetDept] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const focusScan = useCallback(() => scanRef.current?.focus(), []);

  // Boshlang'ich fokus + bo'limlar (Ko'chirish select uchun).
  useEffect(() => {
    focusScan();
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [focusScan]);

  // Neytral joyga bosilganda skaner inputini qayta fokusla (uzluksiz skanerlash).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,select,textarea,button,a,[contenteditable]")) return;
      focusScan();
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [focusScan]);

  // onBlur'da qayta fokus — boshqa form maydoniga o'tilmagan bo'lsa.
  const handleScanBlur = useCallback(() => {
    setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) focusScan();
    }, 0);
  }, [focusScan]);

  // Mahsulotni savatga qo'sh — agar bor bo'lsa miqdorini oshiramiz (self-checkout).
  const addToBasket = useCallback((product: ScanLookupResult) => {
    setBasket((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], product, qty: next[idx].qty + 1, error: undefined };
        return next;
      }
      return [{ key: `${product.id}-${prev.length}`, product, qty: 1 }, ...prev];
    });
  }, []);

  const doLookup = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setLookupError("");
    try {
      const data = await warehouseScanService.lookup(value);
      addToBasket(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setLookupError(msg || t("Mahsulot topilmadi"));
    } finally {
      setLoading(false);
      setCode("");
      focusScan();
    }
  }, [addToBasket, focusScan, t]);

  const onScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLookup(code);
    }
  };

  const setLineQty = (key: string, qty: number) =>
    setBasket((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty), error: undefined } : l)));

  const removeLine = (key: string) =>
    setBasket((prev) => prev.filter((l) => l.key !== key));

  const clearBasket = () => {
    setBasket([]);
    setSubmitError("");
    setNotes("");
    focusScan();
  };

  const unitLabel = (u: number) => t(PRODUCT_UNIT_LABELS[u as keyof typeof PRODUCT_UNIT_LABELS] ?? "");

  const totalQty = useMemo(() => basket.reduce((s, l) => s + l.qty, 0), [basket]);
  const hasOverflow = useMemo(() => basket.some((l) => l.qty > l.product.available), [basket]);

  // Savatni bajarish — har bir qator uchun ketma-ket action chaqiramiz.
  const submitBasket = async () => {
    if (!basket.length) return;
    if (actionType === "Transfer" && !targetDept) {
      setSubmitError(t("Maqsad bo'limni tanlang"));
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const trimmedNotes = notes.trim() || undefined;
    let ok = 0;
    const failed: BasketLine[] = [];

    for (const line of basket) {
      try {
        await warehouseScanService.action({
          productId: line.product.id,
          type: actionType,
          quantity: line.qty,
          targetDepartmentId: actionType === "Transfer" ? targetDept : undefined,
          notes: trimmedNotes,
        });
        ok += 1;
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        failed.push({ ...line, error: msg || t("Amalni bajarishda xatolik") });
      }
    }

    setSubmitting(false);
    setBasket(failed);
    focusScan();

    if (ok > 0) showToast(`${ok} ${t("ta qator bajarildi")}`);
    if (failed.length > 0) setSubmitError(t("Ba'zi qatorlarda xatolik yuz berdi"));
    else {
      setNotes("");
      setTargetDept("");
    }
  };

  const empty = basket.length === 0;

  // ─── Skaner inputi ───
  const scannerInput = (
    <div className="group relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[--text3] transition-colors group-focus-within:text-[--accent]">
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </svg>
      </span>
      <input
        ref={scanRef}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onScanKeyDown}
        onBlur={handleScanBlur}
        autoFocus
        placeholder={t("Skanerlang yoki kodni kiriting")}
        className="w-full rounded-[--radius2] border-[1.5px] border-[--border] bg-[--surface] py-4 pl-12 pr-12
                   font-mono text-base text-[--text] shadow-[var(--shadow)] placeholder:font-sans placeholder:text-[--text3]
                   focus:border-[--accent] focus:outline-none focus:ring-4 focus:ring-[--accent-dim]
                   transition-all duration-150"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2">
          <span className="nd-spinner inline-block h-5 w-5 rounded-full border-2 border-[--border] border-t-[--accent]" />
        </span>
      )}
    </div>
  );

  const actionMeta = BASKET_ACTIONS.find((a) => a.type === actionType)!;

  return (
    <div className="page-transition relative min-h-screen overflow-hidden bg-[--bg] p-6">
      {/* Orqa fon yumshoq accent nuri */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[460px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(ellipse at center, var(--accent-dim), transparent 70%)" }}
      />

      {/* Sahifa sarlavhasi */}
      <div className="relative mb-6 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[--radius2] border border-[--border] bg-[--surface] text-[--accent] shadow-[var(--shadow)]">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
          </div>
          <div>
            <h1 className="font-head-itm text-2xl font-bold tracking-tight text-[--text]">
              {t("Ombor skaneri")}
            </h1>
            <p className="mt-0.5 text-sm text-[--text3]">
              {t("QR kodni skanerlang — mahsulotlar savatga yig'iladi")}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[--success] bg-[--success-dim] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[--success] shadow-[var(--shadow)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[--success] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[--success]" />
          </span>
          {t("Skanerlashga tayyor")}
        </span>
      </div>

      <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Chap: skaner + savat ro'yxati */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {scannerInput}
          {lookupError && (
            <div className="flex items-center gap-2 rounded-[--radius] border border-[--danger] bg-[--danger-dim] px-3 py-2 text-sm text-[--danger] [animation:panel-appear_0.2s_ease]">
              <span className="text-base leading-none">✕</span> {lookupError}
            </div>
          )}

          {/* Savat */}
          <div className="overflow-hidden rounded-[--radius2] border-[1.5px] border-[--border] bg-[--surface] shadow-[var(--shadow)]">
            {/* Savat sarlavhasi */}
            <div className="flex items-center justify-between border-b-[1.5px] border-[--border] bg-[--bg3] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[--accent]">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[--text2]">
                  {t("Savat")}
                </span>
                {basket.length > 0 && (
                  <span className="rounded-full bg-[--accent] px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-[0_1px_4px_var(--accent-mid)]">
                    {basket.length}
                  </span>
                )}
              </div>
              {basket.length > 0 && (
                <button
                  onClick={clearBasket}
                  className="flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-xs font-medium text-[--text3] transition-colors hover:bg-[--danger-dim] hover:text-[--danger]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  {t("Savatni tozalash")}
                </button>
              )}
            </div>

            {empty ? (
              <div className="flex flex-col items-center px-8 py-9 text-center">
                <ScannerViewport />
                <p className="mt-5 text-base font-semibold text-[--text]">{t("Savat bo'sh")}</p>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[--text3]">
                  {t("Skanerlang — mahsulotlar shu yerda yig'iladi")}
                  <kbd className="rounded border border-[--border2] bg-[--surface] px-1.5 py-0.5 font-mono text-[10px] text-[--text2] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    Enter
                  </kbd>
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[--border]">
                {basket.map((line, i) => (
                  <BasketRow
                    key={line.key}
                    line={line}
                    index={i}
                    unit={unitLabel(line.product.unit)}
                    onQty={(q) => setLineQty(line.key, q)}
                    onRemove={() => removeLine(line.key)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* O'ng: checkout paneli */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 overflow-hidden rounded-[--radius2] border-[1.5px] border-[--border] bg-[--surface] shadow-[var(--shadow2)]">
            {/* Panel sarlavhasi */}
            <div className="flex items-center gap-2.5 border-b-[1.5px] border-[--border] bg-[--bg3] px-5 py-3.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[--accent]">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[--text2]">
                {t("Yakuniy amal")}
              </span>
            </div>

            <div className="flex flex-col gap-4 p-5">
              {/* Yig'indi metrikalari */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[--radius] border border-[--border] bg-[--bg3] p-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
                    {t("Mahsulot turlari")}
                  </div>
                  <div className="mt-1 font-mono text-3xl font-bold leading-none text-[--text]">{basket.length}</div>
                </div>
                <div
                  className="rounded-[--radius] border p-3.5 transition-colors"
                  style={{
                    borderColor: hasOverflow ? "var(--warn)" : "var(--accent-dim)",
                    background: hasOverflow ? "var(--warn-dim)" : "var(--accent-dim)",
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
                    {t("Jami miqdor")}
                  </div>
                  <div
                    className="mt-1 font-mono text-3xl font-bold leading-none"
                    style={{ color: hasOverflow ? "var(--warn)" : "var(--accent)" }}
                  >
                    {totalQty}
                  </div>
                </div>
              </div>

              {/* Amal turi — segmented toggle */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
                  {t("Amal turi")}
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-[--radius] border border-[--border] bg-[--bg3] p-1">
                  {BASKET_ACTIONS.map((a) => {
                    const active = actionType === a.type;
                    return (
                      <button
                        key={a.type}
                        onClick={() => { setActionType(a.type); setSubmitError(""); }}
                        className="rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
                        style={{
                          background: active ? "var(--surface)" : "transparent",
                          color: active ? `var(${a.token})` : "var(--text3)",
                          boxShadow: active ? "var(--shadow)" : "none",
                        }}
                      >
                        {t(a.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ko'chirish maqsad bo'limi */}
              {actionType === "Transfer" && (
                <div className="[animation:panel-appear_0.24s_ease]">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
                    {t("Maqsad bo'lim")}
                  </label>
                  <select
                    value={targetDept}
                    onChange={(e) => { setTargetDept(e.target.value); setSubmitError(""); }}
                    className="w-full rounded-[--radius] border border-[--border] bg-[--bg3] px-3 py-2 text-sm text-[--text]
                               focus:border-[--accent] focus:bg-[--surface] focus:outline-none focus:ring-2 focus:ring-[--accent-dim] transition-colors duration-150"
                  >
                    <option value="">{t("Maqsad bo'limni tanlang")}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Izoh */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
                  {t("Izoh")}
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("Ixtiyoriy")}
                  className="w-full rounded-[--radius] border border-[--border] bg-[--bg3] px-3 py-2 text-sm text-[--text]
                             placeholder:text-[--text3] focus:border-[--accent] focus:bg-[--surface] focus:outline-none focus:ring-2 focus:ring-[--accent-dim] transition-colors duration-150"
                />
              </div>

              {hasOverflow && (
                <div className="flex items-center gap-1.5 rounded-[--radius] bg-[--warn-dim] px-2.5 py-1.5 text-xs font-medium text-[--warn]">
                  <span>⚠</span> {t("Ba'zi qatorlar mavjud zaxiradan ko'p")}
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 rounded-[--radius] border border-[--danger] bg-[--danger-dim] px-3 py-2 text-xs text-[--danger]">
                  <span className="text-sm leading-none">✕</span> {submitError}
                </div>
              )}

              <button
                onClick={submitBasket}
                disabled={empty || submitting || !canAct}
                title={!canAct ? t("Ruxsat yo'q") : undefined}
                className="flex w-full items-center justify-center gap-2 rounded-[--radius] px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow)]
                           transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:brightness-100"
                style={{ background: empty ? "var(--text3)" : `var(${actionMeta.token})` }}
              >
                {submitting ? (
                  <>
                    <span className="nd-spinner inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                    {t("Bajarilmoqda...")}
                  </>
                ) : (
                  <>
                    {t(actionMeta.label)}
                    {basket.length > 0 && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-xs">{basket.length}</span>
                    )}
                  </>
                )}
              </button>
              {!canAct && (
                <p className="text-center text-[11px] text-[--text3]">{t("Amal qilish uchun ruxsat yo'q")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Yordamchi komponentlar ───────────────────────────────────────────────────

// Savatdagi bitta mahsulot qatori — QR, nom, zaxira, miqdor stepperi, o'chirish.
function BasketRow({
  line, index, unit, onQty, onRemove, t,
}: {
  line: BasketLine;
  index: number;
  unit: string;
  onQty: (q: number) => void;
  onRemove: () => void;
  t: (s: string) => string;
}) {
  const { product, qty, error } = line;
  const overflow = qty > product.available;

  return (
    <div
      className={`nd-fadein-${Math.min(index, 4)} group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-[--surface2]`}
      style={overflow ? { boxShadow: "inset 3px 0 0 var(--warn)" } : undefined}
    >
      {/* QR thumbnail */}
      {product.qrPngBase64 ? (
        <Link
          href={`/warehouse-inventory/label/${product.id}`}
          target="_blank"
          className="flex-shrink-0 transition-transform hover:scale-105"
          title={t("Yorliqni chop etish")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${product.qrPngBase64}`}
            alt={product.qrCode ?? ""}
            width={46}
            height={46}
            style={{ imageRendering: "pixelated" }}
            className="rounded-[--radius] border border-[--border] bg-white p-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          />
        </Link>
      ) : (
        <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[--radius] border border-[--border] bg-[--bg3] text-[--text3]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-40">
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z" />
          </svg>
        </div>
      )}

      {/* Nom + meta */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[--text]">{product.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {product.qrCode && (
            <span className="rounded-[--radius] bg-[--accent-dim] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[--accent]">
              {product.qrCode}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-[--text3]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
            {product.departmentName}
          </span>
          <span
            className="font-mono text-[11px] font-medium"
            style={{ color: overflow ? "var(--warn)" : "var(--text3)" }}
          >
            {t("Mavjud")}: {product.available}{unit ? ` ${unit}` : ""}
          </span>
        </div>
        {error && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[--danger]"><span>✕</span>{error}</div>}
      </div>

      {/* Miqdor stepperi */}
      <div className="flex flex-shrink-0 items-center overflow-hidden rounded-[--radius] border border-[--border] bg-[--surface] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => onQty(qty - 1)}
          disabled={qty <= 1}
          className="flex h-9 w-9 items-center justify-center text-lg text-[--text2] transition-colors hover:bg-[--accent-dim] hover:text-[--accent] disabled:cursor-not-allowed disabled:text-[--text3] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => onQty(Number(e.target.value) || 1)}
          className="h-9 w-12 border-x border-[--border] bg-transparent text-center font-mono text-sm font-bold text-[--text] focus:bg-[--accent-dim] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          style={{ color: overflow ? "var(--warn)" : "var(--text)" }}
        />
        <button
          onClick={() => onQty(qty + 1)}
          className="flex h-9 w-9 items-center justify-center text-lg text-[--text2] transition-colors hover:bg-[--accent-dim] hover:text-[--accent]"
        >
          +
        </button>
      </div>

      {/* O'chirish */}
      <button
        onClick={onRemove}
        title={t("O'chirish")}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] text-[--text3] opacity-60 transition-all hover:bg-[--danger-dim] hover:text-[--danger] hover:opacity-100 group-hover:opacity-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </div>
  );
}

// Animatsiyali skaner viewport — burchak qavslari, QR ikona va skan chizig'i.
function ScannerViewport() {
  return (
    <div className="nd-fadein-0 relative h-[132px] w-[132px]">
      <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-[--radius] border-l-2 border-t-2 border-[--accent]" />
      <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-[--radius] border-r-2 border-t-2 border-[--accent]" />
      <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-[--radius] border-b-2 border-l-2 border-[--accent]" />
      <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-[--radius] border-b-2 border-r-2 border-[--accent]" />

      <div className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-[--radius] border border-[--border] bg-[--bg3]">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-[--text3] opacity-40">
          <path fill="currentColor" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm0 4h2v2h-2v-2z" />
        </svg>
        <div
          className="scan-sweep absolute inset-x-0 top-0 h-0.5 bg-[--accent]"
          style={{ boxShadow: "0 0 12px 2px var(--accent)" }}
        />
      </div>

      <style>{`
        @keyframes scanSweep {
          0%   { transform: translateY(0);    opacity: .25; }
          50%  { transform: translateY(98px); opacity: 1; }
          100% { transform: translateY(0);    opacity: .25; }
        }
        .scan-sweep { animation: scanSweep 2.6s cubic-bezier(0.45,0,0.55,1) infinite; }
      `}</style>
    </div>
  );
}