"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ContractTaskUpdatePayload,
  ContractTaskLogResponse,
} from "@/lib/userService";

// ─── Constants ────────────────────────────────────────────────────────────────

const WAREHOUSE_TASK_NAME = "Tayyor mahsulotni omborga topshirish";

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
  const [tasks, setTasks] = useState<ContractTaskResponse[]>([]);

  useEffect(() => {
    contractTaskService.getByContract(contract.id).then(setTasks);
  }, [contract.id]);

  const overallPct = tasks.length === 0
    ? 0
    : Math.min(100, tasks.reduce((sum, t) => sum + (t.percentComplete * t.importance / 100), 0));

  const r = 34, cx = 44, cy = 44, sw = 7;
  const circumference = 2 * Math.PI * r;
  const filled = (overallPct / 100) * circumference;
  const gradId = `dg-${contract.id}`;

  const now = Date.now();
  const start = new Date(contract.startDate).getTime();
  const end = new Date(contract.endDate).getTime();
  const timePct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const isOverdue = now > end;
  const timeColor = isOverdue || timePct >= 80 ? "var(--danger)" : timePct >= 50 ? "#f59e0b" : "#22c55e";

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

      {/* Body: left info + right donut */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {/* Left: info rows */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <div className="tcc-time-track">
              <div className="tcc-time-fill" style={{ width: `${timePct}%`, background: timeColor }} />
              <div className="tcc-time-dot" style={{ left: `${timePct}%`, background: timeColor }} />
            </div>
            <span className={`mono${isOverdue ? " danger" : ""}`}>{formatDate(contract.endDate)}</span>
          </div>
        </div>

        {/* Right: mini donut */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <svg width="88" height="88" viewBox="0 0 88 88">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "var(--accent-light, var(--accent))", stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} strokeLinecap="round" />
            {/* Center subtle fill */}
            {tasks.length > 0 && overallPct > 0 && (
              <circle cx={cx} cy={cy} r={r - sw} fill="var(--accent)" fillOpacity="0.07" />
            )}
            {/* Glow arc */}
            {tasks.length > 0 && overallPct > 0 && (
              <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={sw + 5}
                strokeOpacity="0.18"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference}`}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
            {/* Progress arc */}
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={tasks.length === 0 ? "var(--border)" : `url(#${gradId})`}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
            {/* Center text */}
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize="15" fontWeight="800"
              fill={tasks.length === 0 ? "var(--text3)" : "var(--accent)"}>
              {overallPct.toFixed(0)}
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="600"
              fill={tasks.length === 0 ? "var(--text3)" : "var(--accent)"} fillOpacity="0.7">
              %
            </text>
          </svg>
          <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Bajarildi
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onDelete,
  onEdit,
  onLog,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}: {
  task: ContractTaskResponse;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onLog: (id: string) => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}) {
  const isWarehouse = task.name === WAREHOUSE_TASK_NAME;
  const pct = Math.min(100, Math.max(0, task.percentComplete));
  const done = pct >= 100;

  return (
    <div
      className="task-row"
      style={{
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver ? "2px solid var(--accent, #3b82f6)" : "2px solid transparent",
        transition: "opacity 0.15s, outline 0.1s",
        borderRadius: 10,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="task-row-header">
        {!isWarehouse && onDragStart ? (
          <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title="Tartibni o'zgartirish"
            style={{
              cursor: "grab",
              color: "var(--text3)",
              padding: "2px 3px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              userSelect: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="4" y1="8" x2="20" y2="8"/>
              <line x1="4" y1="16" x2="20" y2="16"/>
            </svg>
          </div>
        ) : (
          <div style={{ width: 20, flexShrink: 0 }} />
        )}
        <div className={`task-order-badge${done ? " done" : ""}`}>{task.orderNo}</div>
        <div className="task-name">{task.name}</div>
        <span className={`task-pct${done ? " done" : ""}`}>{pct.toFixed(1)}%</span>
        <button className="btn-icon" onClick={() => onLog(task.id)} title="Kunlik kiritish"
          style={{ color: "#3b82f6", borderColor: "#3b82f633", background: "#3b82f612" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
        <button className="btn-icon" onClick={() => onEdit(task.id)} title="Tahrirlash"
          style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        {!isWarehouse && (
          <button className="btn-icon btn-icon-danger" onClick={() => onDelete(task.id)} title="O'chirish"
            style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        )}
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

// ─── Edit task form (modal) ───────────────────────────────────────────────────

function EditTaskModal({
  task,
  allTasks,
  onSave,
  onCancel,
}: {
  task: ContractTaskResponse;
  allTasks: ContractTaskResponse[];
  onSave: (
    mainId: string,
    mainDto: ContractTaskUpdatePayload,
    otherUpdates: { id: string; importance: number }[]
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [completedAmount, setCompletedAmount] = useState(String(task.completedAmount));
  const [totalAmount, setTotalAmount] = useState(String(task.totalAmount));
  // importanceMap: id → string value for all tasks
  const [importanceMap, setImportanceMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(allTasks.map(t => [t.id, String(t.importance)]))
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [importanceError, setImportanceError] = useState("");

  const total = Math.round(
    allTasks.reduce((s, t) => s + (parseFloat(importanceMap[t.id]) || 0), 0) * 100
  ) / 100;
  const diff = Math.round((total - 100) * 100) / 100;

  const setImp = (id: string, val: string) => {
    setImportanceMap(prev => ({ ...prev, [id]: val }));
    setImportanceError("");
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!name.trim()) return;
    if (diff !== 0) {
      setImportanceError(
        diff > 0
          ? `Muhimlilik jami ${total}% — ${diff}% ortiqcha. Jami 100% bo'lishi kerak.`
          : `Muhimlilik jami ${total}% — yana ${Math.abs(diff)}% qoldi. Jami 100% bo'lishi kerak.`
      );
      return;
    }
    setSaving(true);
    const otherUpdates = allTasks
      .filter(t => t.id !== task.id)
      .map(t => ({ id: t.id, importance: parseFloat(importanceMap[t.id]) || 0 }));
    await onSave(
      task.id,
      {
        name: name.trim(),
        completedAmount: parseFloat(completedAmount) || 0,
        totalAmount: parseFloat(totalAmount) || 0,
        importance: parseFloat(importanceMap[task.id]) || 0,
      },
      otherUpdates
    );
    setSaving(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 540, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <span>Vazifani tahrirlash — <span className="mono">#{task.orderNo}</span></span>
          <button className="modal-close" onClick={onCancel}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Main task fields */}
          <div className="atf-field">
            <label className="atf-label">Vazifa nomi <span style={{ color: "var(--danger)" }}>*</span></label>
            <textarea
              className="form-textarea atf-textarea"
              rows={2}
              value={name}
              onChange={e => setName(e.target.value)}
              style={submitted && !name.trim() ? { borderColor: "var(--danger)" } : undefined}
            />
            {submitted && !name.trim() && (
              <div style={{ color: "var(--danger)", fontSize: 12 }}>Vazifa nomini kiriting</div>
            )}
          </div>

          <div className="atf-field">
            <label className="atf-label">Bajarilgan miqdor</label>
            <input
              className="form-input"
              type="number" min="0"
              value={completedAmount}
              onChange={e => setCompletedAmount(e.target.value)}
            />
          </div>

          {/* All tasks importance editor */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Muhimlilikni taqsimlash — jami 100% bo&apos;lishi kerak
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...allTasks].sort((a, b) => a.orderNo - b.orderNo).map(t => {
                const isCurrent = t.id === task.id;
                return (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 8,
                    background: isCurrent ? "var(--accent-dim, #1d4ed815)" : "var(--surface2, var(--card-bg))",
                    border: `1px solid ${isCurrent ? "var(--accent, #1d4ed8)44" : "var(--border)"}`,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: isCurrent ? "var(--accent, #1d4ed8)" : "var(--primary-dim, #1d4ed820)",
                      color: isCurrent ? "#fff" : "var(--primary)", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {t.orderNo}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isCurrent ? <strong>{t.name}</strong> : t.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <input
                        className="form-input"
                        type="number" min="0" max="100"
                        value={importanceMap[t.id]}
                        onChange={e => setImp(t.id, e.target.value)}
                        style={{ width: 72, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text3)", width: 14 }}>%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live total */}
            <div className={`atf-importance-hint${diff === 0 ? " ok" : diff > 0 ? " over" : " under"}`} style={{ marginTop: 10 }}>
              {diff === 0 ? (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Jami {total}% — to&apos;g&apos;ri!
                </>
              ) : diff > 0 ? (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Jami {total}% — {diff}% ortiqcha
                </>
              ) : (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Jami {total}% — yana {Math.abs(diff)}% qoldi
                </>
              )}
            </div>
          </div>
        </div>

        {/* Importance error modal */}
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

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Daily log modal ──────────────────────────────────────────────────────────

function DailyLogModal({
  task,
  onSave,
  onCancel,
}: {
  task: ContractTaskResponse;
  onSave: (taskId: string, amount: number, note: string, date: string) => Promise<void>;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [logs, setLogs] = useState<ContractTaskLogResponse[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    contractTaskService.getLogs(task.id).then(data => {
      setLogs(data);
      setLogsLoading(false);
    });
  }, [task.id]);

  const handleSave = async () => {
    setSubmitted(true);
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return;
    setSaving(true);
    await onSave(task.id, amt, note.trim(), date);
    setSaving(false);
  };

  const remaining = Math.max(0, task.totalAmount - task.completedAmount);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <span>Kunlik kiritish — <span className="mono">#{task.orderNo}</span> {task.name}</span>
          <button className="modal-close" onClick={onCancel}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Progress summary */}
          <div style={{
            display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8,
            background: "var(--surface2, var(--card-bg))", border: "1px solid var(--border)",
            fontSize: 13,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}>Jami</div>
              <div style={{ fontWeight: 600 }}>{task.totalAmount.toLocaleString()}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}>Bajarilgan</div>
              <div style={{ fontWeight: 600 }}>{task.completedAmount.toLocaleString()}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}>Qoldi</div>
              <div style={{ fontWeight: 600, color: remaining > 0 ? "var(--danger)" : "var(--success, #22c55e)" }}>
                {remaining.toLocaleString()}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}>Foiz</div>
              <div style={{ fontWeight: 600, color: "var(--accent, #3b82f6)" }}>{task.percentComplete.toFixed(1)}%</div>
            </div>
          </div>

          {/* Input fields */}
          <div className="atf-grid2">
            <div className="atf-field">
              <label className="atf-label">Sana <span style={{ color: "var(--danger)" }}>*</span></label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="atf-field">
              <label className="atf-label">Bugun bajarildi <span style={{ color: "var(--danger)" }}>*</span></label>
              <input
                className="form-input"
                type="number" min="0.01" step="any"
                placeholder="Miqdorni kiriting"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={submitted && (!amount || parseFloat(amount) <= 0) ? { borderColor: "var(--danger)" } : undefined}
              />
              {submitted && (!amount || parseFloat(amount) <= 0) && (
                <div style={{ color: "var(--danger)", fontSize: 12 }}>Miqdorni kiriting</div>
              )}
            </div>
          </div>

          <div className="atf-field">
            <label className="atf-label">Izoh (ixtiyoriy)</label>
            <textarea
              className="form-textarea atf-textarea"
              rows={2}
              placeholder="Qo'shimcha izoh..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* History */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Kunlik tarix
            </div>
            {logsLoading ? (
              <div style={{ fontSize: 13, color: "var(--text3)" }}>Yuklanmoqda…</div>
            ) : logs.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text3)" }}>Hali kiritilmagan</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {logs.map(l => (
                  <div key={l.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 7,
                    background: "var(--surface2, var(--card-bg))", border: "1px solid var(--border)",
                    fontSize: 13,
                  }}>
                    <span className="mono" style={{ color: "var(--text3)", fontSize: 12, flexShrink: 0 }}>{l.date}</span>
                    <span style={{ fontWeight: 600, color: "var(--accent, #3b82f6)", flexShrink: 0 }}>+{l.amount.toLocaleString()}</span>
                    {l.note && <span style={{ color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note}</span>}
                    <span style={{ color: "var(--text3)", fontSize: 11, flexShrink: 0, marginLeft: "auto" }}>{l.createdByFullName ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  existingTasks,
  contractQuantity,
}: {
  onSave: (
    data: Omit<ContractTaskCreatePayload, "contractId">[],
    existingUpdates: { id: string; importance: number }[]
  ) => Promise<void>;
  onCancel: () => void;
  existingTasks: ContractTaskResponse[];
  contractQuantity: number;
}) {
  const emptyForm = (): NewTaskForm => ({ name: "", totalAmount: String(contractQuantity), importance: "" });
  const [forms, setForms] = useState<NewTaskForm[]>([emptyForm()]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [importanceError, setImportanceError] = useState("");
  const [existingImportanceMap, setExistingImportanceMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingTasks.map(t => [t.id, String(t.importance)]))
  );

  const updateRow = (i: number, k: keyof NewTaskForm, v: string) => {
    setForms(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
    if (k === "importance") setImportanceError("");
  };

  const setExistingImp = (id: string, val: string) => {
    setExistingImportanceMap(prev => ({ ...prev, [id]: val }));
    setImportanceError("");
  };

  const addRow = () => { setForms(prev => [...prev, emptyForm()]); setImportanceError(""); };
  const removeRow = (i: number) => { setForms(prev => prev.filter((_, idx) => idx !== i)); setImportanceError(""); };

  const existingImportanceTotal = existingTasks.reduce((s, t) => s + (parseFloat(existingImportanceMap[t.id]) || 0), 0);
  const pendingImportance = forms.reduce((s, f) => s + (parseFloat(f.importance) || 0), 0);
  const projectedTotal = Math.round((existingImportanceTotal + pendingImportance) * 100) / 100;
  const diff = Math.round((projectedTotal - 100) * 100) / 100;

  const handleSave = async () => {
    setSubmitted(true);
    if (forms.some(f => !f.name.trim() || f.importance === "")) return;
    if (diff !== 0) {
      setImportanceError(
        diff > 0
          ? `Muhimlilik jami ${projectedTotal}% — ${diff}% ortiqcha. Jami 100% bo'lishi kerak.`
          : `Muhimlilik jami ${projectedTotal}% — yana ${Math.abs(diff)}% qoldi. Jami 100% bo'lishi kerak.`
      );
      return;
    }
    setSaving(true);
    const existingUpdates = existingTasks.map(t => ({
      id: t.id,
      importance: parseFloat(existingImportanceMap[t.id]) || 0,
    }));
    await onSave(
      forms.map(f => ({
        name: f.name.trim(),
        completedAmount: 0,
        totalAmount: parseFloat(f.totalAmount) || 0,
        importance: parseFloat(f.importance) || 0,
      })),
      existingUpdates
    );
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

          <div className="atf-field" style={{ marginTop: 8 }}>
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
      ))}

      {/* Add row button */}
      <button className="add-task-btn" onClick={addRow}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Yana vazifa qo&apos;shish
      </button>

      {/* Existing tasks importance editor */}
      {existingTasks.length > 0 && (
        <div className="itm-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Mavjud vazifalar muhimliligini qayta taqsimlash
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...existingTasks].sort((a, b) => a.orderNo - b.orderNo).map(t => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: "var(--surface2, var(--card-bg))",
                border: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: "var(--primary-dim, #1d4ed820)",
                  color: "var(--primary)", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {t.orderNo}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <input
                    className="form-input"
                    type="number" min="0" max="100"
                    value={existingImportanceMap[t.id]}
                    onChange={e => setExistingImp(t.id, e.target.value)}
                    style={{ width: 72, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text3)", width: 14 }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

function sortTasksWithWarehouseLast(data: ContractTaskResponse[]): ContractTaskResponse[] {
  const regular = data.filter(t => t.name !== WAREHOUSE_TASK_NAME).sort((a, b) => a.orderNo - b.orderNo);
  const warehouse = data.filter(t => t.name === WAREHOUSE_TASK_NAME);
  const sorted = [...regular, ...warehouse];
  return sorted.map((t, i) => ({ ...t, orderNo: i + 1 }));
}

function TaskPanel({ contract, hideHeader }: { contract: ContractResponse; hideHeader?: boolean }) {
  const [tasks, setTasks] = useState<ContractTaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setShowForm(false);
    setEditingId(null);
    contractTaskService.getByContract(contract.id).then(async data => {
      const hasWarehouseTask = data.some(t => t.name === WAREHOUSE_TASK_NAME);
      if (!hasWarehouseTask) {
        await contractTaskService.createBulk([{
          contractId: contract.id,
          name: WAREHOUSE_TASK_NAME,
          completedAmount: 0,
          totalAmount: contract.quantity,
          importance: 100,
        }]);
        const updated = await contractTaskService.getByContract(contract.id);
        setTasks(sortTasksWithWarehouseLast(updated));
      } else {
        setTasks(sortTasksWithWarehouseLast(data));
      }
      setLoading(false);
    });
  }, [contract.id]);

  const handleSave = async (
    dataList: Omit<ContractTaskCreatePayload, "contractId">[],
    existingUpdates: { id: string; importance: number }[]
  ) => {
    await Promise.all(existingUpdates.map(u => contractTaskService.update(u.id, { importance: u.importance })));
    await contractTaskService.createBulk(dataList.map(d => ({ contractId: contract.id, ...d })));
    const updated = await contractTaskService.getByContract(contract.id);
    setTasks(sortTasksWithWarehouseLast(updated));
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete?.name === WAREHOUSE_TASK_NAME) return;
    await contractTaskService.delete(id);
    const updated = await contractTaskService.getByContract(contract.id);
    setTasks(sortTasksWithWarehouseLast(updated));
  };

  const handleUpdate = async (
    id: string,
    dto: ContractTaskUpdatePayload,
    otherUpdates: { id: string; importance: number }[]
  ) => {
    await contractTaskService.update(id, dto);
    await Promise.all(otherUpdates.map(u => contractTaskService.update(u.id, { importance: u.importance })));
    const updated = await contractTaskService.getByContract(contract.id);
    setTasks(sortTasksWithWarehouseLast(updated));
    setEditingId(null);
  };

  const handleLogProgress = async (taskId: string, amount: number, note: string, date: string) => {
    await contractTaskService.logProgress(taskId, { amount, note: note || undefined, date });
    const updated = await contractTaskService.getByContract(contract.id);
    setTasks(sortTasksWithWarehouseLast(updated));
    setLoggingId(null);
  };

  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const draggedTask = tasks.find(t => t.id === draggingId);
    const targetTask = tasks.find(t => t.id === targetId);
    if (!draggedTask || !targetTask) return;
    if (draggedTask.name === WAREHOUSE_TASK_NAME || targetTask.name === WAREHOUSE_TASK_NAME) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = tasks.indexOf(draggedTask);
    const toIndex = tasks.indexOf(targetTask);
    const newTasks = [...tasks];
    newTasks.splice(fromIndex, 1);
    newTasks.splice(toIndex, 0, draggedTask);
    const reordered = newTasks.map((t, i) => ({ ...t, orderNo: i + 1 }));
    const prevOrder = new Map(tasks.map(t => [t.id, t.orderNo]));
    setTasks(reordered);
    setDraggingId(null);
    setDragOverId(null);
    const toUpdate = reordered.filter(t => t.orderNo !== prevOrder.get(t.id));
    await Promise.all(toUpdate.map(t => contractTaskService.update(t.id, { orderNo: t.orderNo })));
  };

  const editingTask = editingId ? tasks.find(t => t.id === editingId) ?? null : null;
  const loggingTask = loggingId ? tasks.find(t => t.id === loggingId) ?? null : null;

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
            <TaskRow
              key={task.id}
              task={task}
              onDelete={(id) => setConfirmDeleteId(id)}
              onEdit={(id) => { setEditingId(id); setShowForm(false); setLoggingId(null); }}
              onLog={(id) => { setLoggingId(id); setEditingId(null); setShowForm(false); }}
              onDragStart={() => setDraggingId(task.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(task.id); }}
              onDrop={() => handleDrop(task.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              isDragging={draggingId === task.id}
              isDragOver={dragOverId === task.id && draggingId !== task.id}
            />
          ))}
        </div>
      )}

      {/* Add form (below the grid) */}
      {showForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: tasks.length > 0 ? 10 : 0 }}>
          <AddTaskForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            existingTasks={tasks}
            contractQuantity={contract.quantity}
          />
        </div>
      ) : (
        <button className="add-task-btn" onClick={() => { setShowForm(true); setEditingId(null); }} style={{ marginTop: tasks.length > 0 ? 10 : 0 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Vazifa qo&apos;shish
        </button>
      )}

      {/* Edit modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          allTasks={tasks}
          onSave={handleUpdate}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Daily log modal */}
      {loggingTask && (
        <DailyLogModal
          task={loggingTask}
          onSave={handleLogProgress}
          onCancel={() => setLoggingId(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (() => {
        const taskToConfirm = tasks.find(t => t.id === confirmDeleteId);
        return (
          <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
              <div className="modal-header" style={{ color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                  Vazifani o&apos;chirish
                </span>
              </div>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text1)" }}>&ldquo;{taskToConfirm?.name}&rdquo;</strong> vazifasini o&apos;chirmoqchimisiz? Bu amalni qaytarib bo&apos;lmaydi.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-outline" onClick={() => setConfirmDeleteId(null)}>
                    Bekor qilish
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      const id = confirmDeleteId;
                      setConfirmDeleteId(null);
                      await handleDelete(id);
                    }}
                  >
                    O&apos;chirish
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
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
