import { DrawingStatus, type TechnicalDrawingResponse, type ContractResponse } from "@/lib/userService";

// ─── Status styles ─────────────────────────────────────────────────────────────

export const STATUS_STYLE: Record<DrawingStatus, { bg: string; color: string; border: string }> = {
  [DrawingStatus.Draft]:      { bg: "var(--warn-dim)",    color: "var(--warn)",    border: "rgba(224,123,0,0.3)" },
  [DrawingStatus.InProgress]: { bg: "#e8f0fe",             color: "#1a56db",        border: "#a4c0f4" },
  [DrawingStatus.Approved]:   { bg: "var(--success-dim)", color: "var(--success)", border: "rgba(15,123,69,0.2)" },
};

// ─── Row type ──────────────────────────────────────────────────────────────────

export type MergedRow =
  | { kind: "drawing"; drawing: TechnicalDrawingResponse }
  | { kind: "empty"; contract: ContractResponse; existingCount: number };

// ─── Form ──────────────────────────────────────────────────────────────────────

export interface DrawingFormValues {
  title: string;
  notes: string;
  files: File[];
  contractProductId: string;     // "" = Umumiy
}

export const emptyDrawingForm: DrawingFormValues = { title: "", notes: "", files: [], contractProductId: "" };
