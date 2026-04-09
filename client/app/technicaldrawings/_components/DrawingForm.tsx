import { useRef } from "react";
import type { ContractResponse } from "@/lib/userService";
import type { DrawingFormValues } from "../_types";

interface DrawingFormProps {
  mode: "create" | "edit";
  contract: ContractResponse | { contractNo: string };
  form: DrawingFormValues;
  setForm: React.Dispatch<React.SetStateAction<DrawingFormValues>>;
  submitted: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function DrawingForm({
  mode,
  contract,
  form,
  setForm,
  submitted,
  saving,
  onSave,
  onCancel,
}: DrawingFormProps) {
  const title = mode === "create" ? "Yangi texnik chizma" : "Texnik chizmani tahrirlash";
  const hasError = submitted && !form.title.trim();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) setForm((f) => ({ ...f, files: [dropped[0]] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) setForm((f) => ({ ...f, files: [selected[0]] }));
    e.target.value = "";
  };

  const removeFile = () =>
    setForm((f) => ({ ...f, files: [] }));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>{title}</span>
      </div>

      <div className="itm-card" style={{ padding: 32, flex: 1 }}>
        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

          {/* Left: form fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                Shartnoma
              </label>
              <div style={{
                height: 44, display: "flex", alignItems: "center", padding: "0 14px",
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", fontSize: 14, color: "var(--text1)", fontWeight: 600,
              }}>
                {contract.contractNo}
              </div>
            </div>

            <div>
              <label style={{
                fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7,
                color: hasError ? "var(--danger)" : "var(--text2)",
              }}>
                Nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Texnik chizma nomi"
                autoFocus={mode === "create"}
                style={{ height: 44, fontSize: 14, ...(hasError ? { borderColor: "var(--danger)" } : {}) }}
              />
              {hasError && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Nomi kiritish shart</div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                Izoh
              </label>
              <textarea
                className="form-input"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={8}
                placeholder="Qo'shimcha izoh (ixtiyoriy)"
                style={{ fontSize: 14, resize: "none" }}
              />
            </div>
          </div>

          {/* Right: file upload */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>
              Fayllar
            </label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius)",
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: "var(--bg2)",
                transition: "border-color 0.15s, background 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--accent-dim)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg2)";
              }}
            >
              <svg width="36" height="36" fill="none" stroke="var(--text3)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 600 }}>
                Fayllarni bu yerga tashlang
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                yoki <span style={{ color: "var(--accent)", textDecoration: "underline" }}>tanlang</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>

            {/* File list */}
            {form.files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {form.files.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "var(--bg2)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", padding: "8px 12px",
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                      background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>
                        {formatSize(file.size)}
                      </div>
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeFile()}
                      title="O'chirish"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--danger)", padding: 4, display: "flex", alignItems: "center",
                        borderRadius: 4, flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {form.files.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                Hech qanday fayl tanlanmagan
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <button
            className="btn btn-outline"
            onClick={onCancel}
            style={{ fontSize: 13, padding: "10px 20px" }}
          >
            Bekor qilish
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
            style={{ fontSize: 13, padding: "10px 22px" }}
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
