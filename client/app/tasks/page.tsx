"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import {
  contractService,
  ContractResponse,
  ContractStatus,
  Priority,
  PRIORITY_LABELS,
  contractTaskService,
  ContractTaskResponse,
  ContractTaskCreatePayload,
} from "@/lib/userService";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:     "s-gray",
  [ContractStatus.Active]:    "s-blue",
  [ContractStatus.Completed]: "s-green",
  [ContractStatus.Cancelled]: "s-danger",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.Draft]:     "Qoralama",
  [ContractStatus.Active]:    "Faol",
  [ContractStatus.Completed]: "Yakunlandi",
  [ContractStatus.Cancelled]: "Bekor qilindi",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.Low]:    "s-gray",
  [Priority.Medium]: "s-warn",
  [Priority.High]:   "s-danger",
  [Priority.Urgent]: "s-danger",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ─── Contract bar (compact, shown when selected) ──────────────────────────────

function ContractBar({
  contract,
  onClick,
}: {
  contract: ContractResponse;
  onClick: () => void;
}) {
  return (
    <div className="tasks-contract-bar" onClick={onClick}>
      <div className="tcb-back" title="Orqaga">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>
      <div className="tcb-sep" />
      <div className="tcb-identity">
        <span className="tcb-no mono">#{contract.contractNo}</span>
        <span className="tcb-party">{contract.contractParty}</span>
      </div>
      <div className="tcb-sep" />
      <div className="tcb-meta">
        <span className="tcb-product">{contract.productType}</span>
        <span className="tcb-qty">{contract.quantity.toLocaleString()} {contract.unit}</span>
        <span className={`status ${PRIORITY_COLORS[contract.priority]}`} style={{ fontSize: 11 }}>
          {PRIORITY_LABELS[contract.priority]}
        </span>
        <span className="tcb-dates mono">
          {formatDate(contract.startDate)}
          <span style={{ margin: "0 6px", color: "var(--text3)" }}>→</span>
          <span style={{ color: "var(--danger)" }}>{formatDate(contract.endDate)}</span>
        </span>
      </div>
      <span className={`status ${STATUS_COLORS[contract.status]}`} style={{ marginLeft: "auto", flexShrink: 0 }}>
        {STATUS_LABELS[contract.status]}
      </span>
    </div>
  );
}

// ─── Contract card ────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  selected,
  onClick,
}: {
  contract: ContractResponse;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`tasks-contract-card${selected ? " selected launching" : ""}`}
    >
      {/* Top row */}
      <div className="tcc-header">
        <div className="tcc-meta">
          <span className="tcc-no mono">#{contract.contractNo}</span>
          <span className="tcc-party">{contract.contractParty}</span>
        </div>
        <span className={`status ${STATUS_COLORS[contract.status]}`}>
          {STATUS_LABELS[contract.status]}
        </span>
      </div>

      {/* Middle rows */}
      <div className="tcc-rows">
        <div className="tcc-row">
          <span className="tcc-label">Mahsulot</span>
          <span className="tcc-value">{contract.productType}</span>
        </div>
        <div className="tcc-row">
          <span className="tcc-label">Miqdor</span>
          <span className="tcc-value accent">{contract.quantity.toLocaleString()} {contract.unit}</span>
        </div>
        <div className="tcc-row">
          <span className="tcc-label">Ustuvorlik</span>
          <span className={`status ${PRIORITY_COLORS[contract.priority]}`} style={{ fontSize: 11 }}>
            {PRIORITY_LABELS[contract.priority]}
          </span>
        </div>
      </div>

      {/* Date footer */}
      <div className="tcc-footer">
        <span className="mono">{formatDate(contract.startDate)}</span>
        <span className="mono danger">{formatDate(contract.endDate)}</span>
      </div>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onDelete,
}: {
  task: ContractTaskResponse;
  onDelete: (id: string) => void;
}) {
  const pct = Math.min(100, Math.max(0, task.percentComplete));
  const done = pct >= 100;

  return (
    <div className="task-row">
      <div className="task-row-header">
        <div className={`task-order-badge${done ? " done" : ""}`}>{task.orderNo}</div>
        <div className="task-name">{task.name}</div>
        <span className={`task-pct${done ? " done" : ""}`}>{pct.toFixed(1)}%</span>
        <button className="task-delete-btn" onClick={() => onDelete(task.id)} title="O'chirish">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="task-progress-track">
        <div className={`task-progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Footer */}
      <div className="task-row-footer">
        <div className="task-footer-item">
          <span className="task-footer-label">Bajarildi</span>
          <span className="task-footer-val">
            {task.completedAmount.toLocaleString()} / {task.totalAmount.toLocaleString()}
          </span>
        </div>
        <div className="task-footer-item">
          <span className="task-footer-label">Muhimlilik</span>
          <span className="task-footer-val warn">{task.importance}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

interface NewTaskForm {
  name: string;
  totalAmount: string;
  importance: string;
}

const EMPTY_FORM: NewTaskForm = { name: "", totalAmount: "0", importance: "" };

function AddTaskForm({
  onSave,
  onCancel,
  existingTotalImportance,
}: {
  onSave: (data: Omit<ContractTaskCreatePayload, "contractId">[]) => Promise<void>;
  onCancel: () => void;
  existingTotalImportance: number;
}) {
  const [forms, setForms] = useState<NewTaskForm[]>([{ ...EMPTY_FORM }]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [importanceError, setImportanceError] = useState("");

  const updateRow = (i: number, k: keyof NewTaskForm, v: string) => {
    setForms(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
    if (k === "importance") setImportanceError("");
  };

  const addRow = () => { setForms(prev => [...prev, { ...EMPTY_FORM }]); setImportanceError(""); };
  const removeRow = (i: number) => { setForms(prev => prev.filter((_, idx) => idx !== i)); setImportanceError(""); };

  const pendingImportance = forms.reduce((s, f) => s + (parseFloat(f.importance) || 0), 0);
  const projectedTotal = Math.round((existingTotalImportance + pendingImportance) * 100) / 100;
  const diff = Math.round((projectedTotal - 100) * 100) / 100;

  const handleSave = async () => {
    setSubmitted(true);
    if (forms.some(f => !f.name.trim() || f.totalAmount === "" || f.totalAmount === "0" || f.importance === "")) return;
    if (diff !== 0) {
      setImportanceError(
        diff > 0
          ? `Muhimlilik jami ${projectedTotal}% — ${diff}% ortiqcha. Jami 100% bo'lishi kerak.`
          : `Muhimlilik jami ${projectedTotal}% — yana ${Math.abs(diff)}% qoldi. Jami 100% bo'lishi kerak.`
      );
      return;
    }
    setSaving(true);
    await onSave(forms.map(f => ({
      name: f.name.trim(),
      completedAmount: 0,
      totalAmount: parseFloat(f.totalAmount) || 0,
      importance: parseFloat(f.importance) || 0,
    })));
    setSaving(false);
  };

  return (
    <>
      {forms.map((f, i) => (
        <div key={i} className="itm-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>#{i + 1} vazifa</span>
            {forms.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                style={{
                  background: "var(--danger-dim)", border: "1px solid var(--danger)33",
                  borderRadius: 6, cursor: "pointer", padding: "3px 10px",
                  color: "var(--danger)", fontSize: 12, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Olib tashlash
              </button>
            )}
          </div>

          <div className="atf-field">
            <label className="atf-label">Vazifa nomi <span style={{ color: "var(--danger)" }}>*</span></label>
            <textarea
              className="form-textarea atf-textarea"
              placeholder="Masalan: Tikish bo'yicha tayyorgarlik"
              value={f.name}
              rows={2}
              onChange={e => updateRow(i, "name", e.target.value)}
              style={submitted && !f.name.trim() ? { borderColor: "var(--danger)" } : undefined}
            />
            {submitted && !f.name.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12 }}>Vazifa nomini kiriting</div>
            )}
          </div>

          <div className="atf-grid2" style={{ marginTop: 8 }}>
            <div className="atf-field">
              <label className="atf-label">Jami miqdor <span style={{ color: "var(--danger)" }}>*</span></label>
              <input
                className="form-input"
                type="number" min="0"
                placeholder="100"
                value={f.totalAmount}
                onChange={e => updateRow(i, "totalAmount", e.target.value)}
                style={submitted && (f.totalAmount === "" || f.totalAmount === "0") ? { borderColor: "var(--danger)" } : undefined}
              />
              {submitted && (f.totalAmount === "" || f.totalAmount === "0") && (
                <div style={{ color: "var(--danger)", fontSize: 12 }}>Miqdorni kiriting</div>
              )}
            </div>
            <div className="atf-field">
              <label className="atf-label">Muhimlilik (%) <span style={{ color: "var(--danger)" }}>*</span></label>
              <input
                className="form-input"
                type="number" min="0" max="100"
                placeholder="25"
                value={f.importance}
                onChange={e => updateRow(i, "importance", e.target.value)}
                style={submitted && f.importance === "" ? { borderColor: "var(--danger)" } : undefined}
              />
              {submitted && f.importance === "" && (
                <div style={{ color: "var(--danger)", fontSize: 12 }}>Muhimlilikni kiriting</div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add row button */}
      <button className="add-task-btn" onClick={addRow}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Yana vazifa qo&apos;shish
      </button>

      {/* Importance warning modal */}
      {importanceError && (
        <div className="modal-overlay" onClick={() => setImportanceError("")}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
            <div className="modal-header" style={{ color: "var(--warn, #f59e0b)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Muhimlilik xatosi
              </span>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{importanceError}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setImportanceError("")}>Tushundim</button>
            </div>
          </div>
        </div>
      )}

      {/* Live importance hint */}
      {pendingImportance > 0 && (
        <div className={`atf-importance-hint${diff === 0 ? " ok" : diff > 0 ? " over" : " under"}`}>
          {diff === 0 ? (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Jami {projectedTotal}% — to&apos;g&apos;ri!
            </>
          ) : diff > 0 ? (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Jami {projectedTotal}% — {diff}% ortiqcha
            </>
          ) : (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Jami {projectedTotal}% — yana {Math.abs(diff)}% qoldi
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="atf-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saqlanmoqda…" : forms.length === 1 ? "Saqlash" : `${forms.length} ta vazifa saqlash`}
        </button>
      </div>
    </>
  );
}

// ─── Task panel ───────────────────────────────────────────────────────────────

function TaskPanel({ contract, hideHeader }: { contract: ContractResponse; hideHeader?: boolean }) {
  const [tasks, setTasks] = useState<ContractTaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    setShowForm(false);
    contractTaskService.getByContract(contract.id).then(data => {
      setTasks(data);
      setLoading(false);
    });
  }, [contract.id]);

  const totalImportance = tasks.reduce((s, t) => s + t.importance, 0);

  const handleSave = async (dataList: Omit<ContractTaskCreatePayload, "contractId">[]) => {
    await contractTaskService.createBulk(dataList.map(d => ({ contractId: contract.id, ...d })));
    const updated = await contractTaskService.getByContract(contract.id);
    setTasks(updated);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await contractTaskService.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="task-panel">
      {/* Contract header */}
      {!hideHeader && <div className="tp-contract-header">
        <div className="tp-contract-info">
          <div className="tp-contract-no mono">#{contract.contractNo}</div>
          <div className="tp-contract-party">{contract.contractParty}</div>
          <div className="tp-contract-sub">
            {contract.productType} · {contract.quantity.toLocaleString()} {contract.unit}
          </div>
        </div>
        <span className={`status ${STATUS_COLORS[contract.status]}`}>
          {STATUS_LABELS[contract.status]}
        </span>
      </div>}


      {/* Tasks list */}
      {loading ? (
        <div className="tp-empty">Yuklanmoqda…</div>
      ) : tasks.length === 0 && !showForm ? (
        <div className="tp-empty bordered">
          <svg width="32" height="32" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 8 }}>
            <rect x="9" y="2" width="6" height="4" rx="1"/>
            <path d="M5 4h2v2h10V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
            <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <span>Hali vazifa qo&apos;shilmagan</span>
        </div>
      ) : (
        <div className="tp-tasks-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add form (below the grid) */}
      {showForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: tasks.length > 0 ? 10 : 0 }}>
          <AddTaskForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            existingTotalImportance={totalImportance}
          />
        </div>
      ) : (
        <button className="add-task-btn" onClick={() => setShowForm(true)} style={{ marginTop: tasks.length > 0 ? 10 : 0 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Vazifa qo&apos;shish
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "grid" | "grid-exit" | "panel" | "panel-exit";

export default function TasksPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContractResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("grid");

  const handleSelect = (c: ContractResponse) => {
    if (phase !== "grid") return;
    setSelected(c);
    setPhase("grid-exit");
    setTimeout(() => setPhase("panel"), 280);
  };

  const handleBack = () => {
    if (phase !== "panel") return;
    setPhase("panel-exit");
    setTimeout(() => { setSelected(null); setPhase("grid"); }, 230);
  };

  useEffect(() => {
    if (!hasPermission("Tasks.View")) return;
    contractService.getMyProductionTasks().then(data => {
      setContracts(data);
      setLoading(false);
    });
  }, [hasPermission]);

  if (!hasPermission("Tasks.View")) {
    return (
      <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
        Bu sahifaga kirish huquqingiz yo&apos;q.
      </div>
    );
  }

  return (
    <>
      {loading ? (
        <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
          Yuklanmoqda...
        </div>
      ) : contracts.length === 0 ? (
        <div className="itm-card" style={{ textAlign: "center", padding: 48, color: "var(--text3)" }}>
          <svg width="40" height="40" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
            <rect x="9" y="2" width="6" height="4" rx="1"/>
            <path d="M5 4h2v2h10V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
            <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <div>Sizga biriktirilgan shartnoma topilmadi.</div>
        </div>
      ) : (phase === "grid" || phase === "grid-exit") ? (
        /* Grid view (with exit animation when transitioning) */
        <div className={`tasks-contract-grid${phase === "grid-exit" ? " tg-exiting" : ""}`}>
          {contracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              selected={selected?.id === c.id}
              onClick={() => handleSelect(c)}
            />
          ))}
        </div>
      ) : (
        /* Panel view (bar + tasks) */
        <div className={`tasks-selected-layout${phase === "panel-exit" ? " tsl-exiting" : ""}`}>
          <ContractBar contract={selected!} onClick={handleBack} />
          <TaskPanel key={selected!.id} contract={selected!} hideHeader />
        </div>
      )}
    </>
  );
}
