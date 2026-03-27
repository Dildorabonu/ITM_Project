"use client";

import { useMemo, useState } from "react";

type DrawingStatus = "pending" | "approved" | "in_progress" | "rejected";

type DrawingItem = {
  id: string;
  contractNo: string;
  title: string;
  status: DrawingStatus;
  createdAt: string;
  fileName: string;
};

type ContractOption = {
  id: string;
  contractNo: string;
  clientName: string;
};

const STATUS_LABEL: Record<DrawingStatus, string> = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  in_progress: "Jarayonda",
  rejected: "Rad etilgan",
};

const STATUS_STYLE: Record<DrawingStatus, { bg: string; color: string; border: string }> = {
  pending: { bg: "var(--bg3)", color: "var(--text2)", border: "var(--border)" },
  approved: { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
  in_progress: { bg: "#e8f0fe", color: "#1a56db", border: "#a4c0f4" },
  rejected: { bg: "var(--danger-dim)", color: "var(--danger)", border: "var(--danger)" },
};

const CONTRACTS: ContractOption[] = [
  { id: "c1", contractNo: "SH-2026-011", clientName: "UzTech Metall" },
  { id: "c2", contractNo: "SH-2026-014", clientName: "Toshkent Plast" },
  { id: "c3", contractNo: "SH-2026-019", clientName: "Sam Auto Parts" },
];

const INITIAL_DRAWINGS: DrawingItem[] = [
  { id: "TD-001", contractNo: "SH-2026-011", title: "Korpus chizmasi", status: "approved", createdAt: "2026-03-20", fileName: "korpus-v3.pdf" },
  { id: "TD-002", contractNo: "SH-2026-014", title: "Qopqoq detali", status: "in_progress", createdAt: "2026-03-23", fileName: "qopqoq-step1.dwg" },
  { id: "TD-003", contractNo: "SH-2026-019", title: "Yig'ma sxema", status: "pending", createdAt: "2026-03-25", fileName: "yigma-sxema.pdf" },
];

function StatusBadge({ status }: { status: DrawingStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function fmtDate(value: string) {
  return value.slice(0, 10).split("-").reverse().join(".");
}

export default function TechnicalDrawingsPage() {
  const [list, setList] = useState<DrawingItem[]>(INITIAL_DRAWINGS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState("");
  const [form, setForm] = useState({
    contractId: "",
    title: "",
    notes: "",
    file: null as File | null,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      const matchSearch =
        q.length === 0 ||
        item.contractNo.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q);
      const matchStatus = filterStatus === "" || item.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [list, search, filterStatus]);

  const selectedContract = CONTRACTS.find((c) => c.id === form.contractId);

  const openCreate = () => {
    setForm({ contractId: "", title: "", notes: "", file: null });
    setSubmitted(false);
    setFileError("");
    setShowForm(true);
  };

  const refresh = () => {
    setList((prev) => [...prev]);
  };

  const save = () => {
    setSubmitted(true);
    setFileError("");

    if (!form.contractId || !form.title.trim()) return;
    if (!form.file) {
      setFileError("Texnik chizmalari faylini yuklash shart.");
      return;
    }

    setSaving(true);
    const newItem: DrawingItem = {
      id: `TD-${String(list.length + 1).padStart(3, "0")}`,
      contractNo: selectedContract?.contractNo ?? "N/A",
      title: form.title.trim(),
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 10),
      fileName: form.file.name,
    };

    setList((prev) => [newItem, ...prev]);
    setSaving(false);
    setShowForm(false);
  };

  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>Yangi texnik chizma</span>
        </div>

        <div className="itm-card" style={{ padding: 32, flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 24, alignItems: "stretch", minHeight: "70vh" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
              <div>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.contractId ? "var(--danger)" : "var(--text2)" }}>
                  Shartnomani tanlang <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={form.contractId}
                  onChange={(e) => setForm((p) => ({ ...p, contractId: e.target.value }))}
                  style={{ width: "100%", height: 52, fontSize: 15, ...(submitted && !form.contractId ? { borderColor: "var(--danger)" } : {}) }}
                >
                  <option value="">— Shartnomani tanlang —</option>
                  {CONTRACTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractNo} — {c.clientName}
                    </option>
                  ))}
                </select>
                {submitted && !form.contractId && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>Shartnoma tanlash shart</div>}
              </div>

              <div>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.title.trim() ? "var(--danger)" : "var(--text2)" }}>
                  Sarlavha <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Masalan: Texnik chizma 01"
                  style={{ height: 52, fontSize: 15, ...(submitted && !form.title.trim() ? { borderColor: "var(--danger)" } : {}) }}
                />
                {submitted && !form.title.trim() && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>Sarlavha kiritish shart</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: "var(--text2)" }}>
                  Izoh
                </label>
                <textarea
                  className="form-input"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={12}
                  placeholder="Qo&apos;shimcha izoh (ixtiyoriy)"
                  style={{ fontSize: 15, resize: "none", flex: 1, minHeight: 0, paddingTop: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.file ? "var(--danger)" : "var(--text2)" }}>
                Texnik chizmalari <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 10 }}>
                Texnik chizmalari faylini shu yerga yuklang
              </div>
              <label
                htmlFor="technical-drawing-file"
                style={{
                  flex: 1,
                  minHeight: 0,
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  background: "var(--bg1)",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  gap: 10,
                }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)" }}>
                  Faylni tanlash
                </div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                  PDF, DWG, DXF yoki boshqa texnik chizma fayli
                </div>
                {form.file && (
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "var(--accent)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.file.name}
                  </div>
                )}
                <input
                  id="technical-drawing-file"
                  type="file"
                  hidden
                  onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                />
              </label>
              {fileError && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{fileError}</div>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ fontSize: 14, padding: "11px 18px" }}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ fontSize: 14, padding: "11px 20px" }}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, padding: "14px 16px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 220 }}>
          <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Qidirish: sarlavha, shartnoma, fayl..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 14 }}
          />
        </div>

        <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 190, height: 44, fontSize: 14, cursor: "pointer" }}>
          <option value="">Barcha statuslar</option>
          <option value="pending">Kutilmoqda</option>
          <option value="in_progress">Jarayonda</option>
          <option value="approved">Tasdiqlangan</option>
          <option value="rejected">Rad etilgan</option>
        </select>

        <button className="btn-icon" onClick={refresh} title="Yangilash" style={{ width: 44, height: 44 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="23,4 23,10 17,10" />
            <polyline points="1,20 1,14 7,14" />
            <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        <button className="btn-primary" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 44, fontSize: 14, paddingInline: 16 }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yangi yaratish
        </button>
      </div>

      <div className="itm-card" style={{ flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>ID</th>
                <th style={{ width: 170 }}>Shartnoma</th>
                <th>Sarlavha</th>
                <th style={{ width: 200 }}>Fayl</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 130 }}>Sana</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px 14px", color: "var(--text3)" }}>
                    Ma&apos;lumot topilmadi
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{item.id}</td>
                    <td className="mono" style={{ color: "var(--text2)" }}>{item.contractNo}</td>
                    <td style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</td>
                    <td style={{ fontSize: 13 }}>{item.fileName}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ fontSize: 13 }}>{fmtDate(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
