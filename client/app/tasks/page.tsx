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

// ─── Contract card (left list) ────────────────────────────────────────────────

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
      className="itm-card"
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        border: selected ? "2px solid var(--accent)" : "2px solid transparent",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = ""; }}
    >
      <div className="itm-card-header" style={{ marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>
            #{contract.contractNo}
          </div>
          <div className="itm-card-title" style={{ fontSize: 14 }}>
            {contract.contractParty}
          </div>
        </div>
        <span className={`status ${STATUS_COLORS[contract.status]}`}>
          {STATUS_LABELS[contract.status]}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Mahsulot</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{contract.productType}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Miqdor</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            {contract.quantity.toLocaleString()} {contract.unit}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Ustuvorlik</span>
          <span className={`status ${PRIORITY_COLORS[contract.priority]}`} style={{ fontSize: 11 }}>
            {PRIORITY_LABELS[contract.priority]}
          </span>
        </div>
        <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--text3)" }}>{formatDate(contract.startDate)}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--danger)" }}>{formatDate(contract.endDate)}</span>
        </div>
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

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      {/* Header: order no + name + percent */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "var(--accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {task.orderNo}
        </div>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{task.name}</div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: pct >= 100 ? "var(--success, #22c55e)" : "var(--accent)",
        }}>
          {pct.toFixed(1)}%
        </span>
        <button
          onClick={() => onDelete(task.id)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text3)", padding: "2px 4px", borderRadius: 4,
            lineHeight: 1,
          }}
          title="O'chirish"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, background: "var(--border)", borderRadius: 999,
        overflow: "hidden", marginBottom: 8,
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: pct >= 100 ? "var(--success, #22c55e)" : "var(--accent)",
          borderRadius: 999,
          transition: "width 0.3s",
        }} />
      </div>

      {/* Footer: completed/total + importance */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Bajarildi:</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {task.completedAmount.toLocaleString()} / {task.totalAmount.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Muhimlilik:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warn, #f59e0b)" }}>
            {task.importance}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

interface NewTaskForm {
  name: string;
  completedAmount: string;
  totalAmount: string;
  importance: string;
}

const EMPTY_FORM: NewTaskForm = { name: "", completedAmount: "0", totalAmount: "0", importance: "" };

function AddTaskForm({
  onSave,
  onCancel,
}: {
  onSave: (data: Omit<ContractTaskCreatePayload, "contractId">) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (k: keyof NewTaskForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      completedAmount: parseFloat(form.completedAmount) || 0,
      totalAmount: parseFloat(form.totalAmount) || 0,
      importance: parseFloat(form.importance) || 0,
    });
    setSaving(false);
  };

  return (
    <div style={{
      border: "1.5px dashed var(--accent)",
      borderRadius: 10,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--accent)" }}>Yangi vazifa</div>

      <div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Vazifa nomi</div>
        <input
          ref={nameRef}
          className="itm-input"
          placeholder="Masalan: Tikish bo'yicha tayyorgarlik"
          value={form.name}
          onChange={e => set("name", e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Bajarilgan</div>
          <input
            className="itm-input"
            type="number" min="0"
            placeholder="0"
            value={form.completedAmount}
            onChange={e => set("completedAmount", e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Jami miqdor</div>
          <input
            className="itm-input"
            type="number" min="0"
            placeholder="100"
            value={form.totalAmount}
            onChange={e => set("totalAmount", e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Muhimlilik (%)</div>
          <input
            className="itm-input"
            type="number" min="0" max="100"
            placeholder="25"
            value={form.importance}
            onChange={e => set("importance", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="itm-btn s-ghost" onClick={onCancel} disabled={saving}>
          Bekor
        </button>
        <button className="itm-btn s-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

// ─── Task panel (right side) ──────────────────────────────────────────────────

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
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Contract info header */}
      <div className="itm-card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>
              #{contract.contractNo}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{contract.contractParty}</div>
          </div>
          <span className={`status ${STATUS_COLORS[contract.status]}`}>
            {STATUS_LABELS[contract.status]}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          {contract.productType} · {contract.quantity.toLocaleString()} {contract.unit}
        </div>
      </div>

      {/* Importance summary */}
      {tasks.length > 0 && (
        <div style={{
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          display: "flex", alignItems: "center", gap: 8,
          background: importanceDiff === 0
            ? "rgba(34,197,94,0.08)"
            : "rgba(239,68,68,0.08)",
          border: `1px solid ${importanceDiff === 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: importanceDiff === 0 ? "var(--success, #22c55e)" : "var(--danger)",
        }}>
          {importanceDiff === 0 ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Muhimlilik to'g'ri taqsimlangan (100%)
            </>
          ) : importanceDiff < 0 ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Muhimlilik yetishmaydi — hozir {totalImportance.toFixed(1)}% (−{Math.abs(importanceDiff)}% qoldi)
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Muhimlilik ortib ketdi — hozir {totalImportance.toFixed(1)}% (+{importanceDiff}% ortiqcha)
            </>
          )}
        </div>
      )}

      {/* Tasks list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text3)", fontSize: 13 }}>
            Yuklanmoqda…
          </div>
        ) : tasks.length === 0 && !showForm ? (
          <div style={{
            textAlign: "center", padding: 32, color: "var(--text3)",
            border: "1px dashed var(--border)", borderRadius: 10,
          }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Hali vazifa qo'shilmagan</div>
            <div style={{ fontSize: 12 }}>Pastdagi + tugmasini bosing</div>
          </div>
        ) : (
          tasks.map(task => (
            <TaskRow key={task.id} task={task} onDelete={handleDelete} />
          ))
        )}

        {/* Add form */}
        {showForm && (
          <AddTaskForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Add button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              border: "1.5px dashed var(--border)",
              borderRadius: 10,
              background: "none",
              color: "var(--text3)",
              cursor: "pointer",
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 500,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text3)";
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
      <div className="page-header">
        <div className="ph-title">Vazifalar</div>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          Shartnomani tanlang, keyin vazifalar kiriting
        </span>
      </div>

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
        <div style={{ display: "grid", gridTemplateColumns: selected ? "340px 1fr" : "1fr", gap: 16, alignItems: "start" }}>
          {/* Left: contract list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            <div style={{ position: "sticky", top: 16 }}>
              <TaskPanel key={selected.id} contract={selected} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
