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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>{title}</span>
      </div>

      <div className="itm-card" style={{ padding: 32, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 600 }}>

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
              rows={6}
              placeholder="Qo'shimcha izoh (ixtiyoriy)"
              style={{ fontSize: 14, resize: "none" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
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
