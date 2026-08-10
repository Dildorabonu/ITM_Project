"use client";

import { STOCK_MOVEMENT_COLOR, STOCK_MOVEMENT_DIM, type StockMovementType, type StockMovementSummary } from "@/lib/stockMovements";
import { STOCK_MOVEMENT_TYPE_OPTIONS } from "../_types";
import { useT } from "@/lib/i18n";

/**
 * Tur bo'yicha filtr tugmachalari — sonlar va filtr bitta boshqaruvda.
 * Rangli nuqta jadvaldagi badge bilan bir xil, shuning uchun tugmacha va qator
 * ko'z bilan darrov bog'lanadi.
 *
 * Sonlar `type` filtridan qat'i nazar hisoblanadi (backend shunday qaytaradi) —
 * aks holda bitta tur tanlangach qolgan tugmachalar nolga tushib qolardi.
 */
export function MovementFilterTiles({ summary, loading, value, onChange }: {
  summary: StockMovementSummary | null;
  loading: boolean;
  value: StockMovementType | "";
  onChange: (next: StockMovementType | "") => void;
}) {
  const t = useT();

  return (
    <>
      <style>{`
        .mv-tiles { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 8px; }
        @media (max-width: 1180px) { .mv-tiles { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 680px)  { .mv-tiles { grid-template-columns: repeat(2, 1fr); } }
        .mv-tile { position: relative; overflow: hidden; transition: border-color 0.15s, background 0.15s; }
        .mv-tile:hover { border-color: var(--border2); }
        .mv-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .mv-rail { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; transform: scaleX(0); transform-origin: left; transition: transform 0.22s ease; }
        .mv-tile[data-active="true"] .mv-rail { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) { .mv-rail { transition: none; } }
      `}</style>

      <div className="mv-tiles">
        <Tile
          label={t("Hammasi")}
          value={summary?.total}
          loading={loading}
          accent="var(--accent)"
          accentBg="var(--accent-dim)"
          active={value === ""}
          onSelect={() => onChange("")}
        />
        {STOCK_MOVEMENT_TYPE_OPTIONS.map(o => (
          <Tile
            key={o.id}
            label={o.name}
            value={summary?.byType?.[o.id]}
            loading={loading}
            accent={STOCK_MOVEMENT_COLOR[o.id]}
            accentBg={STOCK_MOVEMENT_DIM[o.id]}
            active={value === o.id}
            // Ikkinchi marta bosilsa filtr olib tashlanadi.
            onSelect={() => onChange(value === o.id ? "" : o.id)}
          />
        ))}
      </div>
    </>
  );
}

function Tile({ label, value, loading, accent, accentBg, active, onSelect }: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent: string;
  accentBg: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      data-active={active}
      className="itm-card mv-tile"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        padding: "9px 11px",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
        borderColor: active ? accent : undefined,
        background: active ? accentBg : undefined,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: active ? accent : "var(--text3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </span>

      {loading && value === undefined ? (
        <span style={{ height: 22, width: 34, borderRadius: 4, background: "var(--surface2)" }} className="animate-pulse" />
      ) : (
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            color: active ? accent : value ? "var(--text)" : "var(--text3)",
          }}
        >
          {value ?? 0}
        </span>
      )}

      <span className="mv-rail" style={{ background: accent }} />
    </button>
  );
}
