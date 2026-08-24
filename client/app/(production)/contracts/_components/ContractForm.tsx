"use client";

import {
  DepartmentType,
  type ContractResponse,
  type UserLookup,
  type DepartmentOption,
} from "@/lib/userService";
import { ContractForm as ContractFormType, UNIT_OPTIONS, CONTRACT_TYPE_OPTIONS, emptyProduct } from "../_types";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { DatePickerField } from "./DatePickerField";
import { CustomGroupedMultiSelect } from "./CustomGroupedMultiSelect";
import { ProductCatalogSelect } from "./ProductCatalogSelect";
import { useT } from "@/lib/i18n";

type PickerKey = `${number}:${0 | 1 | 2}` | null;

interface Props {
  form: ContractFormType;
  setForm: React.Dispatch<React.SetStateAction<ContractFormType>>;
  editTarget: ContractResponse | null;
  startDateDisp: string;
  setStartDateDisp: (v: string) => void;
  endDateDisp: string;
  setEndDateDisp: (v: string) => void;
  submitted: boolean;
  saving: boolean;
  formError: string;
  pendingContractFiles: File[];
  setPendingContractFiles: React.Dispatch<React.SetStateAction<File[]>>;
  openPickerKey: PickerKey;
  setOpenPickerKey: (k: PickerKey) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  allUsers: UserLookup[];
  departments: DepartmentOption[];
  handleSave: () => void;
  openScanModal: (target: { kind: "contract" } | { kind: "product-tz"; productIdx: number }) => void;
  onCancel: () => void;
  canCreate: boolean;
  canUpdate: boolean;
}

const USER_CATEGORIES = [
  { idx: 0 as const, label: "Ma'sul xodimlar",  deptType: DepartmentType.IshlabChiqarish, color: "#c2410c", bg: "#fff7ed" },
  { idx: 1 as const, label: "Ma'lumot uchun",   deptType: DepartmentType.Bolim,           color: "#1d4ed8", bg: "#eff6ff" },
  { idx: 2 as const, label: "Kuzatuvchilar",    deptType: DepartmentType.Boshqaruv,       color: "#6d28d9", bg: "#f5f3ff" },
] as const;

export function ContractForm({
  form, setForm, editTarget,
  startDateDisp, setStartDateDisp,
  endDateDisp, setEndDateDisp,
  submitted, saving, formError,
  pendingContractFiles, setPendingContractFiles,
  openPickerKey, setOpenPickerKey, pickerRef,
  allUsers, departments,
  handleSave, openScanModal, onCancel,
  canCreate, canUpdate,
}: Props) {
  const t = useT();
  const fieldErr = (val: string) => submitted && !val.trim();
  const startDateErr = submitted && !form.startDate;
  const endDateErr = submitted && !form.endDate;

  const updateProduct = (idx: number, patch: Partial<ContractFormType["products"][number]>) =>
    setForm(f => ({ ...f, products: f.products.map((x, i) => i === idx ? { ...x, ...patch } : x) }));

  const addUserToProduct = (idx: number, cat: 0 | 1 | 2, user: UserLookup) => {
    setForm(f => ({
      ...f,
      products: f.products.map((p, i) => {
        if (i !== idx) return p;
        const key = cat === 0 ? "responsibleUsers" : cat === 1 ? "supervisorUsers" : "observerUsers";
        return { ...p, [key]: [...p[key], user] };
      }),
    }));
  };

  const removeUserFromProduct = (idx: number, cat: 0 | 1 | 2, userId: string) => {
    setForm(f => ({
      ...f,
      products: f.products.map((p, i) => {
        if (i !== idx) return p;
        const key = cat === 0 ? "responsibleUsers" : cat === 1 ? "supervisorUsers" : "observerUsers";
        return { ...p, [key]: p[key].filter(u => u.id !== userId) };
      }),
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--bg3)", border: "1.5px solid var(--border)",
            borderRadius: "var(--radius)", cursor: "pointer",
            padding: "7px 14px", color: "var(--text2)", fontSize: 13, fontWeight: 500,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t("Orqaga")}
        </button>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
          {editTarget ? t("Shartnomani tahrirlash") : t("Yangi shartnoma")}
        </span>
      </div>

      <div className="itm-card" style={{ padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Shartnoma raqami */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.contractNo) ? "var(--danger)" : "var(--text2)" }}>
              {t("Shartnoma raqami")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input className="form-input" value={form.contractNo}
              onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
              placeholder="SH-2025-001"
              style={fieldErr(form.contractNo) ? { borderColor: "var(--danger)" } : undefined}
            />
            {fieldErr(form.contractNo) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{t("Shartnoma raqamini kiriting")}</div>}
          </div>

          {/* Shartnoma tuzilgan tomon */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
              {t("Shartnoma tuzilgan tomon")}
            </label>
            <input className="form-input" value={form.contractParty}
              onChange={e => setForm(f => ({ ...f, contractParty: e.target.value }))}
              placeholder={t("Masalan: Ichki ishlar vazirligi, 3-uchastka, Texnologiya bo'limi...")}
            />
          </div>

          {/* Boshlanish sanasi */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: startDateErr ? "var(--danger)" : "var(--text2)" }}>
              {t("Boshlanish sanasi")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <DatePickerField
              value={form.startDate}
              displayValue={startDateDisp}
              onDisplayChange={setStartDateDisp}
              onDateSelect={iso => setForm(f => ({ ...f, startDate: iso }))}
              hasError={startDateErr}
            />
            {startDateErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{t("Boshlanish sanasini tanlang")}</div>}
          </div>

          {/* Tugash sanasi */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: endDateErr ? "var(--danger)" : "var(--text2)" }}>
              {t("Tugash sanasi")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <DatePickerField
              value={form.endDate}
              displayValue={endDateDisp}
              onDisplayChange={setEndDateDisp}
              onDateSelect={iso => setForm(f => ({ ...f, endDate: iso }))}
              hasError={endDateErr}
            />
            {endDateErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{t("Tugash sanasini tanlang")}</div>}
          </div>

          {/* Shartnoma turi */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>{t("Shartnoma turi")}</label>
            <CheckSelect
              value={form.contractType}
              onChange={v => setForm(f => ({ ...f, contractType: v }))}
              options={CONTRACT_TYPE_OPTIONS.map(o => ({ id: o.value, name: t(o.label), color: o.color }))}
              placeholder={t("— Tanlang —")}
            />
          </div>

          {/* ── Mahsulotlar ─────────────────────────────────────────────────── */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                {t("Mahsulotlar")} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>{t("(har bir mahsulotga bo'lim, xodimlar va TZ fayllarini biriktiring)")}</span>
              </label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, products: [...f.products, { ...emptyProduct, departmentIds: [], responsibleUsers: [], supervisorUsers: [], observerUsers: [], pendingTzFiles: [] }] }))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", border: "1.5px solid var(--accent)",
                  background: "var(--accent-dim)", color: "var(--accent)",
                  borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-mid)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--accent-dim)")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t("Mahsulot qo'shish")}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {form.products.map((p, idx) => {
                const productDeptErr = submitted && p.productType.trim() !== "" && p.departmentIds.length === 0;
                const productTypeErr = submitted && !p.productType.trim();
                const quantityErr = submitted && (p.quantity.trim() === "" || !(Number(p.quantity) > 0));
                const unitErr = submitted && !p.unit.trim();
                return (
                  <div key={idx} style={{
                    border: "1.5px solid var(--border)", borderRadius: 12, padding: 16,
                    background: "var(--bg2)", position: "relative",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: 7, background: "var(--accent)",
                          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700,
                        }}>{idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>{t("Mahsulot")} #{idx + 1}</span>
                      </div>
                      {form.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, products: f.products.filter((_, i) => i !== idx) }))}
                          style={{
                            background: "var(--danger-dim)", border: "1px solid var(--danger)",
                            color: "var(--danger)", borderRadius: 6, cursor: "pointer",
                            padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          }}
                        >
                          ✕ {t("O'chirish")}
                        </button>
                      )}
                    </div>

                    {/* Asosiy fieldlar */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: productTypeErr ? "var(--danger)" : "var(--text2)" }}>
                          {t("Mahsulot")} <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <ProductCatalogSelect
                          productType={p.productType}
                          productCode={p.productCode}
                          hasError={productTypeErr}
                          canCreate={editTarget ? canUpdate : canCreate}
                          // Erkin matn — hali katalog tanlanmagan, shuning uchun bog'lanishni tozalaymiz.
                          onType={value => updateProduct(idx, { productType: value, productCatalogId: null, productCode: null })}
                          onSelect={sel => updateProduct(idx, {
                            productType: sel.productType,
                            productCatalogId: sel.productCatalogId,
                            productCode: sel.productCode,
                            // Katalogdagi standart birlik bilan oldindan to'ldiramiz (agar hali bo'sh bo'lsa).
                            ...(sel.unit && !p.unit ? { unit: sel.unit } : {}),
                          })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: quantityErr ? "var(--danger)" : "var(--text2)" }}>
                          {t("Miqdor")} <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <input
                          className="form-input"
                          type="text"
                          inputMode="decimal"
                          value={p.quantity}
                          onChange={e => {
                            const cleaned = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                            updateProduct(idx, { quantity: cleaned });
                          }}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          placeholder="0"
                          style={quantityErr ? { borderColor: "var(--danger)" } : undefined}
                        />
                        {quantityErr && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{t("Miqdorni kiriting")}</div>}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: unitErr ? "var(--danger)" : "var(--text2)" }}>
                          {t("O'lchov birligi")} <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <div style={unitErr ? { borderRadius: "var(--radius)", boxShadow: "0 0 0 1.5px var(--danger)" } : undefined}>
                          <CheckSelect
                            value={p.unit}
                            onChange={v => updateProduct(idx, { unit: v })}
                            options={UNIT_OPTIONS.filter(o => o.value !== "").map(o => ({ id: o.value, name: t(o.label), icon: o.icon }))}
                            placeholder={t("— Tanlang —")}
                          />
                        </div>
                        {unitErr && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{t("Birlikni tanlang")}</div>}
                      </div>
                    </div>

                    {/* Bo'limlar */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: productDeptErr ? "var(--danger)" : "var(--text2)" }}>
                        {t("Bo'limlar")} <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <CustomGroupedMultiSelect
                        values={p.departmentIds}
                        onChange={v => updateProduct(idx, { departmentIds: v, responsibleUsers: [], supervisorUsers: [] })}
                        departments={departments}
                        placeholder={t("— Bo'limlar tanlang —")}
                        hasError={productDeptErr}
                      />
                      {productDeptErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{t("Kamida bitta bo'limni tanlang")}</div>}
                    </div>

                    {/* Xodimlar — 3 toifa */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {USER_CATEGORIES.map(({ idx: cat, label, deptType, color, bg }) => {
                        const list = cat === 0 ? p.responsibleUsers : cat === 1 ? p.supervisorUsers : p.observerUsers;
                        const key: PickerKey = `${idx}:${cat}`;
                        const isOpen = openPickerKey === key;
                        const noDeptOfType = deptType !== DepartmentType.Boshqaruv &&
                          !departments.some(d => d.type === deptType && p.departmentIds.includes(d.id));
                        const poolByType = noDeptOfType ? [] : allUsers.filter(u => {
                          if (u.departmentType !== deptType) return false;
                          if (deptType === DepartmentType.Boshqaruv) return true;
                          return u.departmentId != null && p.departmentIds.includes(u.departmentId);
                        });
                        const available = poolByType.filter(u => !list.some(x => x.id === u.id));

                        return (
                          <div key={cat}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>
                              {t(label)} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>{t("(ixtiyoriy)")}</span>
                            </label>
                            <div ref={isOpen ? pickerRef : null} style={{ position: "relative" }}>
                              <button type="button"
                                onClick={() => setOpenPickerKey(isOpen ? null : key)}
                                style={{
                                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "8px 10px", background: "var(--bg1)",
                                  border: isOpen ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                                  borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12,
                                  color: available.length ? "var(--text2)" : "var(--text3)",
                                }}>
                                <span>{t("Xodim tanlang")}</span>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                  style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>

                              {isOpen && (
                                <div style={{
                                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                                  background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10,
                                  boxShadow: "0 6px 24px rgba(0,0,0,0.13)",
                                  maxHeight: 240, overflow: "auto",
                                }}>
                                  {allUsers.length === 0 ? (
                                    <div style={{ padding: "12px", fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                                      {t("Yuklanmoqda...")}
                                    </div>
                                  ) : noDeptOfType ? (
                                    <div style={{ padding: "12px", fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                                      {t("Avval bu turdagi bo'limni tanlang")}
                                    </div>
                                  ) : poolByType.length === 0 ? (
                                    <div style={{ padding: "12px", fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                                      {t("Bu toifada xodim yo'q")}
                                    </div>
                                  ) : available.length === 0 ? (
                                    <div style={{ padding: "12px", fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                                      {t("Barcha xodimlar tanlangan")}
                                    </div>
                                  ) : available.map(u => (
                                    <button key={u.id} type="button"
                                      onClick={() => { addUserToProduct(idx, cat, u); setOpenPickerKey(null); }}
                                      style={{
                                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                                        padding: "8px 12px", border: "none", background: "transparent",
                                        cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--border)",
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                      <div style={{
                                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                        background: "var(--accent-dim)", display: "flex", alignItems: "center",
                                        justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--accent)",
                                      }}>
                                        {u.firstName.charAt(0).toUpperCase()}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {u.firstName} {u.lastName}
                                        </div>
                                        {u.departmentName && (
                                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                {list.map(u => (
                                  <div key={u.id} style={{
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    background: bg, border: `1.5px solid ${color}44`,
                                    borderRadius: 16, padding: "3px 8px 3px 6px", fontSize: 11, color,
                                  }}>
                                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                                      {u.firstName.charAt(0).toUpperCase()}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</span>
                                    <button type="button" onClick={() => removeUserFromProduct(idx, cat, u.id)}
                                      style={{ background: "none", border: "none", cursor: "pointer", color, padding: 0, lineHeight: 1, fontSize: 12, opacity: 0.7 }}>✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* TZ fayl */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
                        {t("Texnik topshiriq (TZ)")} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>{t("(ixtiyoriy)")}</span>
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <label style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                          gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 8,
                          padding: "10px", background: "var(--bg1)", transition: "border-color 0.15s",
                          fontSize: 12,
                        }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
                          onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = "var(--border)";
                            const files = Array.from(e.dataTransfer.files);
                            if (files.length) updateProduct(idx, { pendingTzFiles: [...p.pendingTzFiles, ...files] });
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span style={{ fontWeight: 600, color: "var(--accent)" }}>{t("TZ fayl tanlash yoki tashlash")}</span>
                          <input type="file" multiple style={{ display: "none" }}
                            onChange={e => {
                              const files = Array.from(e.target.files ?? []);
                              if (files.length) updateProduct(idx, { pendingTzFiles: [...p.pendingTzFiles, ...files] });
                              e.target.value = "";
                            }} />
                        </label>
                        <button type="button" onClick={() => openScanModal({ kind: "product-tz", productIdx: idx })} style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                          cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 8,
                          padding: "10px 14px", background: "var(--bg1)", transition: "border-color 0.15s",
                          fontSize: 12, fontWeight: 600, color: "var(--accent)",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                            <rect x="2" y="7" width="20" height="10" rx="2" />
                            <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                            <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                          </svg>
                          {t("Skaner")}
                        </button>
                      </div>
                      {p.pendingTzFiles.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {p.pendingTzFiles.map((f, fi) => (
                            <div key={fi} style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: "var(--bg3)", border: "1.5px solid var(--border)",
                              borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text1)", maxWidth: 200,
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                              </svg>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                              <button type="button" onClick={() => updateProduct(idx, { pendingTzFiles: p.pendingTzFiles.filter((_, j) => j !== fi) })}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, lineHeight: 1, fontSize: 13 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mahsulot izohi */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "var(--text2)" }}>{t("Izoh")}</label>
                      <input
                        className="form-input"
                        value={p.notes}
                        onChange={e => updateProduct(idx, { notes: e.target.value })}
                        placeholder={t("Mahsulot bo'yicha qo'shimcha izoh")}
                      />
                    </div>
                  </div>
                );
              })}
              {form.products.length === 0 && (
                <div style={{
                  padding: "20px", textAlign: "center", fontSize: 13, color: "var(--text3)",
                  border: "1.5px dashed var(--border)", borderRadius: 10,
                }}>
                  {t("Hali mahsulot qo'shilmagan. \"Mahsulot qo'shish\" tugmasini bosing.")}
                </div>
              )}
            </div>
          </div>

          {/* Shartnoma fayli (umumiy) */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📄</span>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                {t("Shartnoma fayli")} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>{t("(ixtiyoriy)")}</span>
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
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{t("Fayl tanlash yoki tashlash")}</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>{t("PDF, Word, Excel — har qanday format")}</span>
                <input type="file" multiple style={{ display: "none" }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setPendingContractFiles(prev => [...prev, ...files]);
                    e.target.value = "";
                  }} />
              </label>
              <button type="button" onClick={() => openScanModal({ kind: "contract" })} style={{
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
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>{t("Skaner qilish")}</span>
                <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>{t("Printerdan skanerlash")}</span>
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
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{t("Mavjud fayllarni ko'rish/boshqarish uchun shartnomani oching")}</div>
            )}
          </div>

          {/* Izoh (umumiy) */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>{t("Shartnoma izohi")}</label>
            <textarea className="form-input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t("Qo'shimcha izoh (ixtiyoriy)")} rows={2} style={{ resize: "none" }} />
          </div>
        </div>
      </div>

      {formError && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
          {formError}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
        <button onClick={onCancel}
          style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500, transition: "border-color 0.15s, color 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
          {t("Bekor qilish")}
        </button>
        {(editTarget ? canUpdate : canCreate) && (
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? t("Saqlanmoqda...") : editTarget ? t("O'zgarishlarni saqlash") : t("Shartnoma saqlash")}
          </button>
        )}
      </div>
    </div>
  );
}
