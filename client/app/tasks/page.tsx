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
      className={`tasks-contract-card${selected ? " selected" : ""}`}
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
  onSave: (data: Omit<ContractTaskCreatePayload, "contractId">) => Promise<void>;
  onCancel: () => void;
  existingTotalImportance: number;
}) {
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (k: keyof NewTaskForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const newImportance = parseFloat(form.importance) || 0;
  const projectedTotal = Math.round((existingTotalImportance + newImportance) * 100) / 100;
  const diff = Math.round((projectedTotal - 100) * 100) / 100;
  const showImportanceHint = form.importance !== "";

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      completedAmount: 0,
      totalAmount: parseFloat(form.totalAmount) || 0,
      importance: newImportance,
    });
    setSaving(false);
  };

  return (
    <div className="add-task-form">
      <div className="atf-title">Yangi vazifa</div>

      <div className="atf-field">
        <label className="atf-label">Vazifa nomi</label>
        <textarea
          ref={nameRef}
          className="itm-input atf-textarea"
          placeholder="Masalan: Tikish bo'yicha tayyorgarlik"
          value={form.name}
          rows={3}
          onChange={e => set("name", e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
        />
      </div>

      <div className="atf-grid2">
        <div className="atf-field">
          <label className="atf-label">Jami miqdor</label>
          <input
            className="itm-input"
            type="number" min="0"
            placeholder="100"
            value={form.totalAmount}
            onChange={e => set("totalAmount", e.target.value)}
          />
        </div>
        <div className="atf-field">
          <label className="atf-label">Muhimlilik (%)</label>
          <input
            className="itm-input"
            type="number" min="0" max="100"
            placeholder="25"
            value={form.importance}
            onChange={e => set("importance", e.target.value)}
          />
        </div>
      </div>

      {/* Live importance hint */}
      {showImportanceHint && (
        <div className={`atf-importance-hint${diff === 0 ? " ok" : diff > 0 ? " over" : " under"}`}>
          {diff === 0 ? (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Qo'shilgandan keyin jami 100% — to'g'ri!
            </>
          ) : diff > 0 ? (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Qo'shilgandan keyin {projectedTotal}% — +{diff}% ortiqcha bo'ladi
            </>
          ) : (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Qo'shilgandan keyin {projectedTotal}% — yana {Math.abs(diff)}% qoladi
            </>
          )}
        </div>
      )}

      <div className="atf-actions">
        <button className="itm-btn s-ghost" onClick={onCancel} disabled={saving}>Bekor</button>
        <button className="itm-btn s-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

// ─── Task panel ───────────────────────────────────────────────────────────────

function TaskPanel({ contract }: { contract: ContractResponse }) {
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
  const importanceDiff = Math.round((totalImportance - 100) * 100) / 100;

  const handleSave = async (data: Omit<ContractTaskCreatePayload, "contractId">) => {
    await contractTaskService.create({ contractId: contract.id, ...data });
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
      <div className="tp-contract-header">
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
      </div>

      {/* Importance banner */}
      {tasks.length > 0 && (
        <div className={`tp-importance-banner${importanceDiff === 0 ? " ok" : " warn"}`}>
          {importanceDiff === 0 ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Muhimlilik to'g'ri taqsimlangan (100%)
            </>
          ) : importanceDiff < 0 ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Yetishmaydi — {totalImportance.toFixed(1)}% (−{Math.abs(importanceDiff)}% qoldi)
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Ortiqcha — {totalImportance.toFixed(1)}% (+{importanceDiff}% ko'p)
            </>
          )}
        </div>
      )}

      {/* Tasks list */}
      <div className="tp-tasks-list">
        {loading ? (
          <div className="tp-empty">Yuklanmoqda…</div>
        ) : tasks.length === 0 && !showForm ? (
          <div className="tp-empty bordered">
            <svg width="32" height="32" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 8 }}>
              <rect x="9" y="2" width="6" height="4" rx="1"/>
              <path d="M5 4h2v2h10V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <span>Hali vazifa qo'shilmagan</span>
          </div>
        ) : (
          tasks.map(task => (
            <TaskRow key={task.id} task={task} onDelete={handleDelete} />
          ))
        )}

        {showForm && (
          <AddTaskForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            existingTotalImportance={totalImportance}
          />
        )}

        {!showForm && (
          <button className="add-task-btn" onClick={() => setShowForm(true)}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Vazifa qo'shish
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContractResponse | null>(null);

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
      ) : (
        <div className={`tasks-layout${selected ? " has-panel" : ""}`}>
          {/* Contract grid: 2 columns */}
          <div className="tasks-contract-grid">
            {contracts.map(c => (
              <ContractCard
                key={c.id}
                contract={c}
                selected={selected?.id === c.id}
                onClick={() => setSelected(prev => prev?.id === c.id ? null : c)}
              />
            ))}
          </div>

          {/* Right: task panel */}
          {selected && (
            <div className="tasks-panel-sticky">
              <TaskPanel key={selected.id} contract={selected} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
