"use client";

import { useRef } from "react";
import {
  DepartmentType,
  type ContractResponse,
  type UserLookup,
  type DepartmentResponse,
} from "@/lib/userService";
import { ContractForm as ContractFormType, UNIT_OPTIONS, PRIORITY_OPTIONS } from "../_types";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { DatePickerField, isoToDisplayDate } from "./DatePickerField";
import { CustomGroupedMultiSelect } from "./CustomGroupedMultiSelect";

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
  pendingTzFiles: File[];
  setPendingTzFiles: React.Dispatch<React.SetStateAction<File[]>>;
  formUsers: UserLookup[];
  setFormUsers: React.Dispatch<React.SetStateAction<UserLookup[]>>;
  formSupervisors: UserLookup[];
  setFormSupervisors: React.Dispatch<React.SetStateAction<UserLookup[]>>;
  formObservers: UserLookup[];
  setFormObservers: React.Dispatch<React.SetStateAction<UserLookup[]>>;
  openPickerIdx: number | null;
  setOpenPickerIdx: (v: number | null) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  allUsers: UserLookup[];
  departments: DepartmentResponse[];
  handleSave: () => void;
  openScanModal: (target: "contract" | "tz") => void;
  onCancel: () => void;
  canCreate: boolean;
  canUpdate: boolean;
}

export function ContractForm({
  form, setForm, editTarget,
  startDateDisp, setStartDateDisp,
  endDateDisp, setEndDateDisp,
  submitted, saving, formError,
  pendingContractFiles, setPendingContractFiles,
  pendingTzFiles, setPendingTzFiles,
  formUsers, setFormUsers,
  formSupervisors, setFormSupervisors,
  formObservers, setFormObservers,
  openPickerIdx, setOpenPickerIdx, pickerRef,
  allUsers, departments,
  handleSave, openScanModal, onCancel,
  canCreate, canUpdate,
}: Props) {
  const fieldErr = (val: string) => submitted && !val.trim();
  const startDateErr = submitted && !form.startDate;
  const endDateErr = submitted && !form.endDate;
  const deptErr = submitted && form.departmentIds.length === 0;

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
          Orqaga
        </button>
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
            <DatePickerField
              value={form.startDate}
              displayValue={startDateDisp}
              onDisplayChange={setStartDateDisp}
              onDateSelect={iso => setForm(f => ({ ...f, startDate: iso }))}
              hasError={startDateErr}
            />
            {startDateErr && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Boshlanish sanasini tanlang</div>}
          </div>

          {/* Tugash sanasi */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: endDateErr ? "var(--danger)" : "var(--text2)" }}>
              Tugash sanasi <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <DatePickerField
              value={form.endDate}
              displayValue={endDateDisp}
              onDisplayChange={setEndDateDisp}
              onDateSelect={iso => setForm(f => ({ ...f, endDate: iso }))}
              hasError={endDateErr}
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
              onWheel={e => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>

          {/* O'lchov birligi */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
            <CheckSelect
              value={form.unit}
              onChange={v => setForm(f => ({ ...f, unit: v }))}
              options={UNIT_OPTIONS.filter(o => o.value !== "").map(o => ({ id: o.value, name: o.label, icon: o.icon }))}
              placeholder="— Tanlang —"
            />
          </div>

          {/* Muhimlik */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Muhimlik</label>
            <CheckSelect
              value={form.priority}
              onChange={v => setForm(f => ({ ...f, priority: v }))}
              options={PRIORITY_OPTIONS.map(o => ({ id: o.value, name: o.label, color: o.color }))}
              placeholder="— Tanlang —"
            />
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
              { label: "Ma'lumot uchun",    list: formSupervisors, setList: setFormSupervisors, deptType: DepartmentType.Bolim,            color: "#1d4ed8", bg: "#eff6ff" },
              { label: "Kuzatuvchilar",     list: formObservers,   setList: setFormObservers,   deptType: DepartmentType.Boshqaruv,        color: "#6d28d9", bg: "#f5f3ff" },
            ] as const).map(({ label, list, setList, deptType, color, bg }, idx) => {
              const isOpen = openPickerIdx === idx;
              const noDeptOfType = deptType !== DepartmentType.Boshqaruv &&
                !departments.some(d => d.type === deptType && form.departmentIds.includes(d.id));
              const poolByType = noDeptOfType ? [] : allUsers.filter(u => {
                if (u.departmentType !== deptType) return false;
                if (deptType === DepartmentType.Boshqaruv) return true;
                return u.departmentId != null && form.departmentIds.includes(u.departmentId);
              });
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
                        ) : noDeptOfType ? (
                          <div style={{ padding: "14px 14px", fontSize: 13, color: "var(--text3)", textAlign: "center" }}>
                            Avval ushbu tuzilmadan bo&apos;lim tanlang
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
                            onClick={() => { setList((prev: UserLookup[]) => [...prev, u]); setOpenPickerIdx(null); }}
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
                          <button type="button" onClick={() => setList((prev: UserLookup[]) => prev.filter(x => x.id !== u.id))}
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
        <button onClick={onCancel}
          style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500, transition: "border-color 0.15s, color 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
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
