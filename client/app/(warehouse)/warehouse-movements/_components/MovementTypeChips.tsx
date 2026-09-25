"use client";

import { STOCK_MOVEMENT_COLOR, STOCK_MOVEMENT_DIM, type StockMovementSummary } from "@/lib/stockMovements";
import Tooltip from "@/app/_components/Tooltip";
import { MOVEMENT_FILTERS, type MovementFilterId } from "../_types";
import { useT } from "@/lib/i18n";

/**
 * Tur bo'yicha filtr chiplari. Sonlar `types` filtridan qat'i nazar hisoblanadi
 * (backend shunday qaytaradi) — aks holda bitta chip tanlangach qolganlari nolga tushardi.
 */
export function MovementTypeChips({ summary, loading, value, onChange }: {
  summary: StockMovementSummary | null;
  loading: boolean;
  value: MovementFilterId | "";
  onChange: (next: MovementFilterId | "") => void;
}) {
  const t = useT();
  const countOf = (f: (typeof MOVEMENT_FILTERS)[number]) =>
    summary ? f.types.reduce((sum, type) => sum + (summary.byType?.[type] ?? 0), 0) : undefined;

  return (
    <>
      <style>{`
        .mv-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 4px 5px 4px 11px; border-radius: 999px;
          border: 1.5px solid var(--border); background: var(--surface);
          font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap;
          cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .mv-chip:hover { border-color: var(--border2); }
        .mv-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .mv-chip-count {
          min-width: 22px; padding: 1px 7px; border-radius: 999px; text-align: center;
          font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 11px; font-weight: 700;
        }
      `}</style>

      <Chip
        label={t("Hammasi")}
        count={summary?.total}
        loading={loading}
        accent="var(--accent)"
        accentBg="var(--accent-dim)"
        active={value === ""}
        onSelect={() => onChange("")}
      />
      {MOVEMENT_FILTERS.map(f => {
        const booking = f.id === "Booking";
        return (
          <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {booking && <span aria-hidden style={{ width: 1, height: 20, margin: "0 4px", background: "var(--border)" }} />}
            <Tooltip label={t(f.desc)}>
              <Chip
                label={f.name}
                count={countOf(f)}
                loading={loading}
                dots={f.types.map(type => STOCK_MOVEMENT_COLOR[type])}
                accent={STOCK_MOVEMENT_COLOR[f.types[0]]}
                accentBg={STOCK_MOVEMENT_DIM[f.types[0]]}
                active={value === f.id}
                onSelect={() => onChange(value === f.id ? "" : f.id)}
              />
            </Tooltip>
          </span>
        );
      })}
    </>
  );
}

function Chip({ label, count, loading, dots = [], accent, accentBg, active, onSelect }: {
  label: string;
  count: number | undefined;
  loading: boolean;
  dots?: string[];
  accent: string;
  accentBg: string;
  active: boolean;
  onSelect: () => void;
}) {
  const empty = !active && count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className="mv-chip"
      style={{
        borderColor: active ? accent : undefined,
        background: active ? accentBg : undefined,
        color: active ? accent : empty ? "var(--text3)" : "var(--text2)",
      }}
    >
      {dots.length > 0 && (
        <span style={{ display: "inline-flex" }}>
          {dots.map((c, i) => (
            <span
              key={c}
              style={{
                width: 7, height: 7, borderRadius: "50%", background: c,
                marginLeft: i > 0 ? -2 : 0, boxShadow: i > 0 ? "0 0 0 1.5px var(--surface)" : undefined,
              }}
            />
          ))}
        </span>
      )}
      {label}
      {loading && count === undefined ? (
        <span className="mv-chip-count animate-pulse" style={{ background: "var(--surface2)", color: "transparent" }}>0</span>
      ) : (
        <span
          className="mv-chip-count"
          style={{
            background: active ? "var(--surface)" : "var(--surface2)",
            color: active ? accent : empty ? "var(--text3)" : "var(--text)",
          }}
        >
          {count ?? 0}
        </span>
      )}
    </button>
  );
}
