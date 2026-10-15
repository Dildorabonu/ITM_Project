"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  meterDeviceService,
  type MeterDevice,
  type MeterDeviceSave,
  type MeterDeviceTestResult,
} from "@/lib/meterDevice";
import { apiErrorMessage } from "@/lib/api";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

const DEFAULTS = { port: "502", slaveId: "1", startAddress: "100", registerCount: "55", ptRatio: "1" };

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

type DeviceForm = {
  id: string | null;
  nameLocked: boolean;
  name: string;
  ip: string;
  port: string;
  slaveId: string;
  startAddress: string;
  registerCount: string;
  ptRatio: string;
  intervalSeconds: string;
  enabled: boolean;
};

type TestState =
  | { status: "running" }
  | { status: "ok"; data: MeterDeviceTestResult }
  | { status: "error"; message: string };

function emptyForm(): DeviceForm {
  return { id: null, nameLocked: false, name: "", ip: "", intervalSeconds: "", enabled: true, ...DEFAULTS };
}

function toForm(d: MeterDevice): DeviceForm {
  return {
    id: d.id,
    nameLocked: d.hasReadings,
    name: d.name,
    ip: d.ip,
    port: String(d.port),
    slaveId: String(d.slaveId),
    startAddress: String(d.startAddress),
    registerCount: String(d.registerCount),
    ptRatio: String(d.ptRatio),
    intervalSeconds: d.intervalSeconds === null ? "" : String(d.intervalSeconds),
    enabled: d.enabled,
  };
}

function toDto(form: DeviceForm): MeterDeviceSave {
  return {
    name: form.name.trim(),
    ip: form.ip.trim(),
    port: Number(form.port),
    slaveId: Number(form.slaveId),
    startAddress: Number(form.startAddress),
    registerCount: Number(form.registerCount),
    ptRatio: Number(form.ptRatio),
    intervalSeconds: form.intervalSeconds.trim() === "" ? null : Number(form.intervalSeconds),
    enabled: form.enabled,
  };
}

function hasCustomAdvanced(form: DeviceForm) {
  return form.startAddress !== DEFAULTS.startAddress
    || form.registerCount !== DEFAULTS.registerCount
    || Number(form.ptRatio) !== 1
    || form.intervalSeconds !== "";
}

const inputStyle: CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
  color: "var(--text)", outline: "none",
};

const monoInput: CSSProperties = { ...inputStyle, fontFamily: "var(--font-mono)" };

function Field({ label, hint, style, children }: {
  label: string;
  hint?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--text3)" }}>{hint}</span>}
    </label>
  );
}

export function DeviceSettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [devices, setDevices] = useState<MeterDevice[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [test, setTest] = useState<TestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeterDevice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setDevices(await meterDeviceService.getAll());
    } catch {
      showToast(t("Qurilmalarni yuklashda xatolik."), "error");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Maydon o'zgarsa oldingi tekshiruv natijasi endi shu sozlamaga tegishli emas;
  // hali kelmagan javob ham (testIdRef) e'tiborsiz qoldiriladi.
  const testIdRef = useRef(0);
  const clearTest = () => {
    testIdRef.current++;
    setTest(null);
  };

  const update = (patch: Partial<DeviceForm>) => {
    setForm(f => ({ ...f, ...patch }));
    clearTest();
  };

  // Ro'yxat ochilgandan keyin yangi qurilma birinchi o'lchovini yuborgan bo'lishi
  // mumkin — nom qulfi (hasReadings) eskirmasligi uchun yangidan olinadi.
  const startEdit = async (device: MeterDevice) => {
    let fresh = device;
    try {
      const list = await meterDeviceService.getAll();
      setDevices(list);
      fresh = list.find(d => d.id === device.id) ?? device;
    } catch {
      // Eski ma'lumot bilan davom etamiz — backend nom qulfini baribir tekshiradi.
    }

    const next = toForm(fresh);
    setForm(next);
    setAdvancedOpen(hasCustomAdvanced(next));
    clearTest();
  };

  const resetForm = () => {
    setForm(emptyForm());
    setAdvancedOpen(false);
    clearTest();
  };

  const validate = (requireName: boolean): string | null => {
    if (requireName && !form.name.trim()) return t("Qurilma nomi kiritilmagan.");
    if (!IPV4.test(form.ip.trim())) return t("IP manzil noto'g'ri (masalan: 192.168.30.222).");
    return null;
  };

  const runTest = async () => {
    const error = validate(false);
    if (error) { setTest({ status: "error", message: error }); return; }

    const id = ++testIdRef.current;
    setTest({ status: "running" });
    try {
      const data = await meterDeviceService.test(toDto(form));
      if (id === testIdRef.current) setTest({ status: "ok", data });
    } catch (e) {
      if (id === testIdRef.current)
        setTest({ status: "error", message: apiErrorMessage(e, t("Ulanishni tekshirishda xatolik.")) });
    }
  };

  const save = async () => {
    const error = validate(true);
    if (error) { showToast(error, "error"); return; }

    try {
      setSaving(true);
      const dto = toDto(form);

      if (form.id) await meterDeviceService.update(form.id, dto);
      else await meterDeviceService.create(dto);

      showToast(t("Qurilma saqlandi."), "success");
      resetForm();
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Qurilmani saqlashda xatolik.")), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const device = pendingDelete;

    try {
      setDeleting(true);
      await meterDeviceService.remove(device.id);
      showToast(t("Qurilma o'chirildi."), "success");
      if (form.id === device.id) resetForm();
      setPendingDelete(null);
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Qurilmani o'chirishda xatolik.")), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="itm-card"
        style={{
          width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto",
          padding: 20, animation: "panel-appear 0.28s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {t("Hisoblagich qurilmalari")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
              {t("Tizim har qurilmaga Modbus TCP orqali o'zi ulanadi. O'zgarishlar darhol kuchga kiradi.")}
            </p>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            title={t("Yopish")}
            style={{ width: 30, height: 30 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
            {t("Yuklanmoqda...")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            {devices.map((device, i) => {
              const editing = form.id === device.id;
              return (
                <div
                  key={device.id}
                  className={`nd-fadein-${Math.min(i, 4)}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    background: "var(--surface2)", borderRadius: "var(--radius)",
                    border: `1px solid ${editing ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: device.enabled ? "var(--accent)" : "var(--text3)",
                  }} />

                  <span style={{
                    fontSize: 13, fontWeight: 700, color: device.enabled ? "var(--text)" : "var(--text3)",
                    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {device.name}
                  </span>

                  <span style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text2)", whiteSpace: "nowrap" }}>
                    {device.ip}:{device.port}
                    <span style={{ color: "var(--text3)" }}> · #{device.slaveId}</span>
                  </span>

                  {!device.enabled && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                      fontFamily: "var(--font-mono)", background: "var(--warn-dim)", color: "var(--warn)",
                    }}>
                      {t("To'xtatilgan")}
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(device)}
                    className="btn-icon"
                    title={t("Tahrirlash")}
                    style={{ width: 26, height: 26 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setPendingDelete(device)}
                    className="btn-icon"
                    title={t("O'chirish")}
                    style={{ width: 26, height: 26, color: "var(--danger)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {devices.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12.5 }}>
                {t("Qurilma qo'shilmagan.")}
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>
            {form.id ? t("Qurilmani tahrirlash") : t("Yangi qurilma")}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Field
              label={t("Qurilma nomi")}
              hint={form.nameLocked ? t("Qurilma ma'lumot yuborgan — nomini o'zgartirib bo'lmaydi.") : undefined}
              style={{ flex: 1, minWidth: 170 }}
            >
              <input
                value={form.name}
                onChange={e => update({ name: e.target.value })}
                disabled={form.nameLocked}
                placeholder="DR134"
                maxLength={200}
                style={{ ...inputStyle, ...(form.nameLocked ? { color: "var(--text3)", cursor: "not-allowed" } : {}) }}
              />
            </Field>

            <Field label={t("IP manzil")} style={{ width: 170 }}>
              <input
                value={form.ip}
                onChange={e => update({ ip: e.target.value })}
                placeholder="192.168.30.222"
                inputMode="decimal"
                style={monoInput}
              />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
            <Field label={t("Port")} style={{ width: 90 }}>
              <input type="number" min={1} max={65535} value={form.port}
                onChange={e => update({ port: e.target.value })} style={monoInput} />
            </Field>

            <Field label="Slave ID" style={{ width: 90 }}>
              <input type="number" min={0} max={255} value={form.slaveId}
                onChange={e => update({ slaveId: e.target.value })} style={monoInput} />
            </Field>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text2)", cursor: "pointer", padding: "8px 4px" }}>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => update({ enabled: e.target.checked })}
                style={{ accentColor: "var(--accent)" }}
              />
              {t("So'rash yoqilgan")}
            </label>

            <button
              onClick={() => setAdvancedOpen(o => !o)}
              style={{
                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 4px", background: "transparent", border: "none",
                color: "var(--text2)", fontSize: 12, cursor: "pointer",
              }}
            >
              {t("Qo'shimcha sozlamalar")}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {advancedOpen && (
            <div
              style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, alignItems: "end",
                padding: 10, marginBottom: 10, background: "var(--surface2)", borderRadius: "var(--radius)",
                animation: "panel-appear 0.2s ease",
              }}
            >
              <Field label={t("Boshlang'ich registr")}>
                <input type="number" min={0} value={form.startAddress}
                  onChange={e => update({ startAddress: e.target.value })} style={monoInput} />
              </Field>
              <Field label={t("Registrlar soni")}>
                <input type="number" min={51} max={125} value={form.registerCount}
                  onChange={e => update({ registerCount: e.target.value })} style={monoInput} />
              </Field>
              <Field label={t("PT koeffitsiyenti")}>
                <input type="number" min={0} step="any" value={form.ptRatio}
                  onChange={e => update({ ptRatio: e.target.value })} style={monoInput} />
              </Field>
              <Field label={t("O'qish davri (s)")}>
                <input type="number" min={1} max={3600} value={form.intervalSeconds}
                  onChange={e => update({ intervalSeconds: e.target.value })}
                  placeholder={t("Umumiy")} style={monoInput} />
              </Field>
            </div>
          )}

          {test && test.status !== "running" && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 10,
                borderRadius: "var(--radius)", fontSize: 12.5,
                background: test.status === "ok" ? "var(--success-dim)" : "var(--danger-dim)",
                color: test.status === "ok" ? "var(--success)" : "var(--danger)",
              }}
            >
              {test.status === "ok" ? (
                <>
                  <span style={{ fontWeight: 700 }}>{t("Ulanish muvaffaqiyatli")}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    U {test.data.voltage.toFixed(1)} V · P {Math.round(test.data.power)} W · f {test.data.frequency.toFixed(2)} Hz
                  </span>
                </>
              ) : (
                <span>{test.message}</span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={runTest}
              disabled={test?.status === "running"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 14px", background: "transparent", border: "1px solid var(--border2)",
                borderRadius: "var(--radius)", color: "var(--text2)", fontSize: 12.5,
                cursor: test?.status === "running" ? "default" : "pointer",
              }}
            >
              {test?.status === "running" && (
                <span style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: "2px solid var(--border)", borderTopColor: "var(--accent)",
                  animation: "spin 0.8s linear infinite",
                }} />
              )}
              {test?.status === "running" ? t("Tekshirilmoqda...") : t("Ulanishni tekshirish")}
            </button>

            <div style={{ flex: 1 }} />

            {form.id && (
              <button
                onClick={resetForm}
                style={{
                  padding: "7px 14px", background: "transparent", border: "1px solid var(--border2)",
                  borderRadius: "var(--radius)", color: "var(--text2)", fontSize: 12.5, cursor: "pointer",
                }}
              >
                {t("Bekor qilish")}
              </button>
            )}

            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "7px 16px", background: "var(--accent)", border: "none",
                borderRadius: "var(--radius)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t("Saqlanmoqda...") : t("Saqlash")}
            </button>
          </div>
        </div>
      </div>

      <div onClick={e => e.stopPropagation()}>
        <ConfirmModal
          open={!!pendingDelete}
          title={t("Qurilmani o'chirish")}
          message={t("\"{0}\" endi so'ralmaydi. O'lchovlar tarixi saqlanib qoladi.").replace("{0}", pendingDelete?.name ?? "")}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </div>
  );
}
