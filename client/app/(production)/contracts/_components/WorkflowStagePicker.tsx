"use client";

import { StageType, type WorkflowTemplateResponse } from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { STAGE_TYPE_META, ALL_STAGE_TYPES } from "../_types";

interface Props {
  templates: WorkflowTemplateResponse[];
  templateId: string;
  stages: StageType[];
  onTemplateChange: (id: string) => void;
  onStagesChange: (stages: StageType[]) => void;
}

// Contract-create workflow picker: choose a template, then optionally toggle /
// reorder the stages for this specific contract (an override). The chosen
// ordered list is what every product in the contract starts with.
export function WorkflowStagePicker({ templates, templateId, stages, onTemplateChange, onStagesChange }: Props) {
  const disabledStages = ALL_STAGE_TYPES.filter(s => !stages.includes(s));

  const applyTemplate = (id: string) => {
    onTemplateChange(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) onStagesChange([...tpl.stages]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onStagesChange(next);
  };

  const toggleOff = (stage: StageType) => onStagesChange(stages.filter(s => s !== stage));
  const toggleOn = (stage: StageType) => onStagesChange([...stages, stage]);

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>
        Ish jarayoni{" "}
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>
          (shartnoma qaysi bosqichlardan, qaysi tartibda o&apos;tishi)
        </span>
      </label>

      <div style={{ maxWidth: 360, marginBottom: 12 }}>
        <CheckSelect
          value={templateId}
          onChange={applyTemplate}
          options={templates.map(t => ({ id: t.id, name: t.isDefault ? `${t.name} (asosiy)` : t.name }))}
          placeholder="— Shablon tanlang —"
        />
      </div>

      {/* Ordered enabled stages with reorder + remove */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.map((stage, idx) => {
          const meta = STAGE_TYPE_META[stage];
          return (
            <div key={stage} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 10,
              background: "var(--bg2)", border: "1px solid var(--border)",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: meta.active, color: meta.text,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>{idx + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{meta.label}</span>

              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                title="Yuqoriga"
                style={{
                  width: 26, height: 26, borderRadius: 6, cursor: idx === 0 ? "not-allowed" : "pointer",
                  border: "1px solid var(--border)", background: "var(--bg1)",
                  color: idx === 0 ? "var(--text3)" : "var(--text2)", opacity: idx === 0 ? 0.5 : 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === stages.length - 1}
                title="Pastga"
                style={{
                  width: 26, height: 26, borderRadius: 6, cursor: idx === stages.length - 1 ? "not-allowed" : "pointer",
                  border: "1px solid var(--border)", background: "var(--bg1)",
                  color: idx === stages.length - 1 ? "var(--text3)" : "var(--text2)", opacity: idx === stages.length - 1 ? 0.5 : 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              <button type="button" onClick={() => toggleOff(stage)} disabled={stages.length <= 1}
                title="O'chirish"
                style={{
                  width: 26, height: 26, borderRadius: 6, cursor: stages.length <= 1 ? "not-allowed" : "pointer",
                  border: "1px solid var(--danger)", background: "var(--danger-dim)", color: "var(--danger)",
                  opacity: stages.length <= 1 ? 0.4 : 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                }}>✕</button>
            </div>
          );
        })}
      </div>

      {disabledStages.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text3)" }}>Qo&apos;shish:</span>
          {disabledStages.map(stage => {
            const meta = STAGE_TYPE_META[stage];
            return (
              <button key={stage} type="button" onClick={() => toggleOn(stage)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 16, cursor: "pointer",
                  border: `1.5px dashed ${meta.active}66`, background: "transparent",
                  color: meta.active, fontSize: 11, fontWeight: 600,
                }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
