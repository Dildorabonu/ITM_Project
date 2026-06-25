"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { ConfirmModal } from "@/app/_components/ConfirmModal";
import {
  workflowService,
  StageType,
  STAGE_TYPE_LABELS,
  type WorkflowTemplateResponse,
} from "@/lib/userService";

const ALL_STAGES: StageType[] = [StageType.Drawing, StageType.TechProcess, StageType.CostNorm, StageType.Tasks];

const STAGE_COLOR: Record<StageType, string> = {
  [StageType.Drawing]:     "#7c3aed",
  [StageType.TechProcess]: "#c2410c",
  [StageType.CostNorm]:    "#0d9488",
  [StageType.Tasks]:       "#1e7e34",
};

type EditorState = {
  id: string | null;
  name: string;
  isDefault: boolean;
  stages: StageType[];
};

const emptyEditor: EditorState = { id: null, name: "", isDefault: false, stages: [...ALL_STAGES] };

export default function WorkflowsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const showToast = useToastStore(s => s.show);

  const canCreate = hasPermission("Workflows.Create");
  const canUpdate = hasPermission("Workflows.Update");
  const canDelete = hasPermission("Workflows.Delete");

  const [templates, setTemplates] = useState<WorkflowTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplateResponse | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await workflowService.getAll();
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => setEditor({ ...emptyEditor, stages: [...ALL_STAGES] });
  const openEdit = (t: WorkflowTemplateResponse) =>
    setEditor({ id: t.id, name: t.name, isDefault: t.isDefault, stages: [...t.stages] });

  const move = (idx: number, dir: -1 | 1) => {
    setEditor(e => {
      if (!e) return e;
      const next = [...e.stages];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return e;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...e, stages: next };
    });
  };
  const toggleOff = (stage: StageType) =>
    setEditor(e => (e ? { ...e, stages: e.stages.filter(s => s !== stage) } : e));
  const toggleOn = (stage: StageType) =>
    setEditor(e => (e ? { ...e, stages: [...e.stages, stage] } : e));

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) { showToast("Shablon nomini kiriting", "Xatolik"); return; }
    if (editor.stages.length === 0) { showToast("Kamida bitta bosqich tanlang", "Xatolik"); return; }
    setSaving(true);
    try {
      if (editor.id) {
        await workflowService.update(editor.id, { name: editor.name.trim(), isDefault: editor.isDefault, stages: editor.stages });
        showToast("Shablon yangilandi");
      } else {
        await workflowService.create({ name: editor.name.trim(), isDefault: editor.isDefault, stages: editor.stages });
        showToast("Shablon yaratildi");
      }
      setEditor(null);
      await load();
    } catch {
      showToast("Saqlashda xatolik", "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (t: WorkflowTemplateResponse) => {
    try {
      await workflowService.setDefault(t.id);
      showToast(`«${t.name}» asosiy shablon qilindi`);
      await load();
    } catch {
      showToast("Xatolik", "Xatolik");
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await workflowService.remove(deleteTarget.id);
      showToast("Shablon o'chirildi");
      setDeleteTarget(null);
      await load();
    } catch {
      showToast("O'chirishda xatolik", "Xatolik");
    }
  };

  const disabledStages = editor ? ALL_STAGES.filter(s => !editor.stages.includes(s)) : [];

  return (
    <div className="page-transition" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="font-head-itm" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Ish jarayonlari</h1>
          <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>
            Shartnoma qaysi bosqichlardan, qaysi tartibda o&apos;tishini belgilovchi shablonlar
          </p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Yangi shablon
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Yuklanmoqda...</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)", border: "1.5px dashed var(--border)", borderRadius: 12 }}>
          Hali shablon yo&apos;q.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="itm-card" style={{ padding: 16, opacity: t.isActive ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t.name}</span>
                  {t.isDefault && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                      Asosiy
                    </span>
                  )}
                  {!t.isActive && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--danger-dim)", color: "var(--danger)" }}>
                      Nofaol
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {canUpdate && !t.isDefault && t.isActive && (
                    <button onClick={() => setDefault(t)}
                      style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", cursor: "pointer" }}>
                      Asosiy qilish
                    </button>
                  )}
                  {canUpdate && (
                    <button onClick={() => openEdit(t)}
                      style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", cursor: "pointer" }}>
                      Tahrirlash
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setDeleteTarget(t)}
                      style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--danger)", background: "var(--danger-dim)", color: "var(--danger)", cursor: "pointer" }}>
                      O&apos;chirish
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {t.stages.map((stage, i) => (
                  <div key={stage} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: `${STAGE_COLOR[stage]}14`, color: STAGE_COLOR[stage], border: `1px solid ${STAGE_COLOR[stage]}44`,
                    }}>
                      <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{i + 1}</span>
                      {STAGE_TYPE_LABELS[stage]}
                    </span>
                    {i < t.stages.length - 1 && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor modal ──────────────────────────────────────────────────── */}
      {editor && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => !saving && setEditor(null)}>
          <div className="itm-card" style={{ width: "100%", maxWidth: 480, padding: 24, maxHeight: "90vh", overflow: "auto", animation: "panel-appear 0.28s ease" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 18 }}>
              {editor.id ? "Shablonni tahrirlash" : "Yangi shablon"}
            </h2>

            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Nomi</label>
            <input className="form-input" value={editor.name}
              onChange={e => setEditor(s => (s ? { ...s, name: e.target.value } : s))}
              placeholder="Masalan: Standart, Chizmasiz..." style={{ marginBottom: 16 }} />

            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, color: "var(--text2)" }}>Bosqichlar (tartibda)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {editor.stages.map((stage, idx) => (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--bg2)", border: "1px solid var(--border)" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: STAGE_COLOR[stage], color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{STAGE_TYPE_LABELS[stage]}</span>
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                    style={{ width: 26, height: 26, borderRadius: 6, cursor: idx === 0 ? "not-allowed" : "pointer", border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text2)", opacity: idx === 0 ? 0.4 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === editor.stages.length - 1}
                    style={{ width: 26, height: 26, borderRadius: 6, cursor: idx === editor.stages.length - 1 ? "not-allowed" : "pointer", border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text2)", opacity: idx === editor.stages.length - 1 ? 0.4 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  <button type="button" onClick={() => toggleOff(stage)} disabled={editor.stages.length <= 1}
                    style={{ width: 26, height: 26, borderRadius: 6, cursor: editor.stages.length <= 1 ? "not-allowed" : "pointer", border: "1px solid var(--danger)", background: "var(--danger-dim)", color: "var(--danger)", opacity: editor.stages.length <= 1 ? 0.4 : 1, fontSize: 13, fontWeight: 700 }}>✕</button>
                </div>
              ))}
            </div>

            {disabledStages.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Qo&apos;shish:</span>
                {disabledStages.map(stage => (
                  <button key={stage} type="button" onClick={() => toggleOn(stage)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 16, cursor: "pointer", border: `1.5px dashed ${STAGE_COLOR[stage]}66`, background: "transparent", color: STAGE_COLOR[stage], fontSize: 11, fontWeight: 600 }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> {STAGE_TYPE_LABELS[stage]}
                  </button>
                ))}
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
              <input type="checkbox" checked={editor.isDefault}
                onChange={e => setEditor(s => (s ? { ...s, isDefault: e.target.checked } : s))} />
              Asosiy shablon (yangi shartnomalarda oldindan tanlanadi)
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button onClick={() => setEditor(null)} disabled={saving}
                style={{ padding: "9px 18px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                Bekor qilish
              </button>
              <button className="btn-primary" onClick={save} disabled={saving}
                style={{ padding: "9px 22px", borderRadius: "var(--radius)" }}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Shablonni o'chirish"
        message={`«${deleteTarget?.name}» shablonini o'chirmoqchimisiz? Mavjud shartnomalar o'zgarmaydi.`}
        confirmLabel="O'chirish"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
