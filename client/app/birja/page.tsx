"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  materialService,
  costNormService,
  contractService,
  type DeficitCheckItem,
  type CostNormResponse,
  type ContractResponse,
} from "@/lib/userService";

/* ══════════════════════════════════════════════════════════════
   TIPLAR
   ══════════════════════════════════════════════════════════════ */

interface BirjaSorov {
  id: string;
  mahsulot: string;
  birlik: string;
  kerakli: number;
  mavjud: number;
  deficit: number;
  shartnoma: string;
  costNormTitle: string;
  holat: "kutilmoqda" | "tasdiqlandi" | "rad_etildi";
  materialId: string | null;
}

interface NormSummary {
  norm: CostNormResponse;
  contractNo: string;
  totalItems: number;
  deficitCount: number;
  notFoundCount: number;
  okCount: number;
}

type FilterHolat = "barchasi" | "kutilmoqda" | "tasdiqlandi" | "rad_etildi";

/* ══════════════════════════════════════════════════════════════
   YORDAMCHI FUNKSIYALAR
   ══════════════════════════════════════════════════════════════ */

function fmt(n: number): string {
  return n.toLocaleString("uz-UZ");
}

function deficitToHolat(status: string): "kutilmoqda" | "tasdiqlandi" | "rad_etildi" {
  if (status === "Yetarli") return "tasdiqlandi";
  if (status === "Yo'q") return "rad_etildi";
  return "kutilmoqda";
}

const holatConfig = {
  kutilmoqda:  { label: "Kutilmoqda",  cls: "s-warn" },
  tasdiqlandi: { label: "Yetarli",     cls: "s-ok" },
  rad_etildi:  { label: "Topilmadi",   cls: "s-danger" },
} as const;

/* ══════════════════════════════════════════════════════════════
   INLINE SVG IKONLAR
   ══════════════════════════════════════════════════════════════ */

function SearchIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
}
function EyeIcon() {
  return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function CheckIcon() {
  return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>;
}
function XIcon() {
  return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>;
}
function ClipboardIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
}
function WalletIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>;
}
function ChevronDownIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>;
}
function ChevronUpIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>;
}
function ArrowLeftIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>;
}
function AlertIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function DownloadIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function LoaderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ASOSIY SAHIFA
   ══════════════════════════════════════════════════════════════ */

export default function BirjaPage() {
  const [loading, setLoading] = useState(true);
  const [selectedNormId, setSelectedNormId] = useState<string | null>(null);
  const [normSearch, setNormSearch] = useState("");

  /* Detail page state */
  const [qidiruv, setQidiruv] = useState("");
  const [filterHolat, setFilterHolat] = useState<FilterHolat>("barchasi");
  const [korishSoni, setKorishSoni] = useState(10);

  /* API dan kelgan ma'lumotlar */
  const [costNorms, setCostNorms] = useState<CostNormResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [deficitMap, setDeficitMap] = useState<Record<string, DeficitCheckItem[]>>({});

  /* Ma'lumotlarni yuklash */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [norms, ctrs] = await Promise.all([
          costNormService.getAll(),
          contractService.getAll(),
        ]);

        if (cancelled) return;
        setCostNorms(norms);
        setContracts(ctrs);

        /* Har bir cost norm uchun deficit tekshirish */
        const defResults: Record<string, DeficitCheckItem[]> = {};
        await Promise.all(
          norms.map(async (n) => {
            const items = await materialService.checkDeficitByCostNorm(n.id);
            defResults[n.id] = items;
          }),
        );
        if (!cancelled) setDeficitMap(defResults);
      } catch (err) {
        console.error("Birja ma'lumotlarini yuklashda xatolik:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* Shartnoma nomi bo'yicha lookup */
  const contractMap = useMemo(() => {
    const map: Record<string, ContractResponse> = {};
    contracts.forEach((c) => { map[c.id] = c; });
    return map;
  }, [contracts]);

  /* Norma-rasxodlar xulosasi */
  const normSummaries = useMemo<NormSummary[]>(() => {
    return costNorms.map((norm) => {
      const items = deficitMap[norm.id] ?? [];
      const ctr = contractMap[norm.contractId];
      const contractNo = ctr ? ctr.contractNo : norm.contractNo;

      let deficitCount = 0;
      let notFoundCount = 0;
      let okCount = 0;
      items.forEach((item) => {
        const h = deficitToHolat(item.status);
        if (h === "kutilmoqda") deficitCount++;
        else if (h === "rad_etildi") notFoundCount++;
        else okCount++;
      });

      return {
        norm,
        contractNo,
        totalItems: items.length,
        deficitCount,
        notFoundCount,
        okCount,
      };
    });
  }, [costNorms, deficitMap, contractMap]);

  /* Filtrlangan norma-rasxodlar */
  const filteredNorms = useMemo(() => {
    const q = normSearch.toLowerCase();
    if (!q) return normSummaries;
    return normSummaries.filter((s) =>
      s.norm.title.toLowerCase().includes(q) ||
      s.contractNo.toLowerCase().includes(q)
    );
  }, [normSummaries, normSearch]);

  /* Tanlangan norm uchun so'rovlar */
  const selectedNorm = useMemo(() => {
    if (!selectedNormId) return null;
    return costNorms.find((n) => n.id === selectedNormId) ?? null;
  }, [selectedNormId, costNorms]);

  const sorovlar = useMemo<BirjaSorov[]>(() => {
    if (!selectedNormId) return [];
    const items = deficitMap[selectedNormId] ?? [];
    const norm = costNorms.find((n) => n.id === selectedNormId);
    if (!norm) return [];

    const ctr = contractMap[norm.contractId];
    const shartnomaNomi = ctr ? ctr.contractNo : norm.contractNo;

    let idx = 1;
    return items.map((item) => ({
      id: `BR-${String(idx++).padStart(3, "0")}`,
      mahsulot: item.costNormItemName,
      birlik: item.costNormItemUnit,
      kerakli: item.requiredQty,
      mavjud: item.availableQty,
      deficit: item.deficitQty,
      shartnoma: shartnomaNomi,
      costNormTitle: norm.title,
      holat: deficitToHolat(item.status),
      materialId: item.materialId,
    }));
  }, [selectedNormId, deficitMap, costNorms, contractMap]);

  /* Filtrlangan so'rovlar */
  const filtered = useMemo(() => {
    return sorovlar.filter((s) => {
      const q = qidiruv.toLowerCase();
      const matchSearch =
        s.mahsulot.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);
      const matchHolat = filterHolat === "barchasi" || s.holat === filterHolat;
      return matchSearch && matchHolat;
    });
  }, [sorovlar, qidiruv, filterHolat]);

  useEffect(() => { setKorishSoni(10); }, [qidiruv, filterHolat]);

  const korinuvchi = filtered.slice(0, korishSoni);
  const qolganSoni = filtered.length - korishSoni;

  /* Statistika (tanlangan norm uchun) */
  const jami = sorovlar.length;
  const kutilayotgan = sorovlar.filter((s) => s.holat === "kutilmoqda").length;
  const yetarli = sorovlar.filter((s) => s.holat === "tasdiqlandi").length;
  const topilmagan = sorovlar.filter((s) => s.holat === "rad_etildi").length;

  const handleSelectNorm = useCallback((normId: string) => {
    setSelectedNormId(normId);
    setQidiruv("");
    setFilterHolat("barchasi");
    setKorishSoni(10);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedNormId(null);
  }, []);

  /* ═══════════════════ RENDER ═══════════════════ */

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 12 }}>
        <LoaderIcon />
        <span style={{ color: "var(--text3)", fontSize: 15 }}>Ma&apos;lumotlar yuklanmoqda...</span>
      </div>
    );
  }

  /* ─────────── ICHKI SAHIFA: Tanlangan norma-rasxod deficit ─────────── */
  if (selectedNormId && selectedNorm) {
    return (
      <>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            className="btn-ghost"
            onClick={handleBack}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--accent)", fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius2)", border: "1px solid var(--border)" }}
          >
            <ArrowLeftIcon /> Orqaga
          </button>

          <div>
            <h1
              className="font-head-itm"
              style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, color: "var(--text)", textTransform: "uppercase", margin: 0 }}
            >
              {selectedNorm.title}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>
              Shartnoma: {sorovlar[0]?.shartnoma ?? selectedNorm.contractNo}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <button
            style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
              padding: "7px 14px", borderRadius: "var(--radius2)",
              background: "#1a7a3a", color: "#fff",
              border: "1px solid #15662f", cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#15662f"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1a7a3a"; }}
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const rows = filtered.map((s, i) => ({
                "№": i + 1,
                "Material nomi": s.mahsulot,
                "Birlik": s.birlik,
                "Kerakli": s.kerakli,
                "Mavjud": s.mavjud,
                "Deficit": s.deficit,
                "Holat": holatConfig[s.holat].label,
              }));
              const ws = XLSX.utils.json_to_sheet(rows);
              ws["!cols"] = [
                { wch: 5 }, { wch: 30 }, { wch: 10 },
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
              ];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Deficit");
              XLSX.writeFile(wb, `${selectedNorm.title}_${today}.xlsx`);
            }}
          >
            <DownloadIcon />
            <span>.xls</span>
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>
              {selectedNorm.title} — {new Date().toLocaleDateString("uz-UZ")}
            </span>
          </button>

          <div className="search-wrap" style={{ maxWidth: 260 }}>
            <SearchIcon />
            <input
              className="search-input"
              placeholder="Material qidirish..."
              value={qidiruv}
              onChange={(e) => setQidiruv(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: 170, padding: "8px 12px" }}
            value={filterHolat}
            onChange={(e) => setFilterHolat(e.target.value as FilterHolat)}
          >
            <option value="barchasi">Barcha holatlar</option>
            <option value="kutilmoqda">Kam (deficit)</option>
            <option value="tasdiqlandi">Yetarli</option>
            <option value="rad_etildi">Topilmadi</option>
          </select>
        </div>

        {/* Statistika */}
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-card blue">
            <div className="stat-label">Jami tekshirilgan</div>
            <div className="stat-value">{jami}</div>
            <div className="stat-meta">materiallar soni</div>
          </div>
          <div className="stat-card warn">
            <div className="stat-label">Kam (deficit)</div>
            <div className="stat-value">{kutilayotgan}</div>
            <div className="stat-meta">Yetishmayotgan materiallar</div>
            {kutilayotgan > 0 && <div className="stat-delta dn">Diqqat talab</div>}
          </div>
        </div>

        {/* Jadval + Xulosa */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          {/* Chap ustun — jadval */}
          <div className="itm-card">
            <div className="itm-card-header">
              <div className="icon-bg ib-blue">
                <ClipboardIcon />
              </div>
              <span className="itm-card-title">Kerakli mahsulot arizalari</span>
              <span className="itm-card-subtitle">{filtered.length} ta natija</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="itm-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th style={{ width: "28%" }}>Material nomi</th>
                    <th style={{ width: 80 }}>Kerakli</th>
                    <th style={{ width: 80 }}>Mavjud</th>
                    <th style={{ width: 80 }}>Deficit</th>
                    <th style={{ width: 110 }}>Holat</th>
                    <th style={{ width: 100 }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>
                        {sorovlar.length === 0
                          ? "Bu norma-rasxodda deficit ma'lumotlari topilmadi"
                          : "Filtr bo'yicha natija topilmadi"
                        }
                      </td>
                    </tr>
                  ) : (
                    korinuvchi.map((s) => (
                      <tr key={s.id}>
                        <td className="mono" style={{ color: "var(--text3)", fontWeight: 600 }}>{s.id}</td>
                        <td style={{ fontWeight: 500, textAlign: "left" }}>
                          <div>{s.mahsulot}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.birlik}</div>
                        </td>
                        <td className="mono">{fmt(s.kerakli)}</td>
                        <td className="mono">{fmt(s.mavjud)}</td>
                        <td className="mono" style={{ color: s.deficit > 0 ? "#b45309" : "var(--text3)", fontWeight: 600 }}>
                          {s.deficit > 0 ? `-${fmt(s.deficit)}` : "0"}
                        </td>
                        <td>
                          <span className={`status ${holatConfig[s.holat].cls}`}>
                            {holatConfig[s.holat].label}
                          </span>
                        </td>
                        <td className="td-actions">
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-icon" title="Ko'rish"><EyeIcon /></button>
                            {s.holat === "kutilmoqda" && (
                              <>
                                <button className="btn-icon" title="Tasdiqlash" style={{ borderColor: "rgba(15,123,69,0.3)" }}>
                                  <span style={{ color: "var(--success)" }}><CheckIcon /></span>
                                </button>
                                <button className="btn-icon btn-icon-danger" title="Rad etish">
                                  <XIcon />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > 10 && (
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "12px 18px", borderTop: "1px solid var(--border)", gap: 8,
                }}
              >
                {qolganSoni > 0 ? (
                  <button
                    className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)" }}
                    onClick={() => setKorishSoni((p) => p + 10)}
                  >
                    <ChevronDownIcon />
                    Yana {Math.min(qolganSoni, 10)} ta ko&apos;rsatish
                    <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 400 }}>
                      ({korishSoni}/{filtered.length})
                    </span>
                  </button>
                ) : (
                  <button
                    className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text3)" }}
                    onClick={() => setKorishSoni(10)}
                  >
                    <ChevronUpIcon />
                    Yig&apos;ish
                  </button>
                )}
              </div>
            )}
          </div>

          {/* O'ng ustun — Xulosa */}
          <div className="itm-card">
            <div className="itm-card-header">
              <div className="icon-bg ib-blue">
                <WalletIcon />
              </div>
              <span className="itm-card-title">Tahlil xulosasi</span>
            </div>
            <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>Jami tekshirilgan</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{jami} ta</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>Kam (xarid kerak)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--warn)" }}>{kutilayotgan} ta</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>Topilmagan</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>{topilmagan} ta</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>Yetarli (omborda bor)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>{yetarli} ta</span>
                </div>
              </div>

              {jami > 0 && (
                <div>
                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ height: 10, borderRadius: 5 }}>
                      <div className="progress-fill pf-green" style={{ width: `${Math.round((yetarli / jami) * 100)}%`, borderRadius: "5px 0 0 5px" }} />
                      <div className="progress-fill pf-warn" style={{ width: `${Math.round((kutilayotgan / jami) * 100)}%`, marginLeft: -1 }} />
                    </div>
                    <span className="progress-pct" style={{ fontWeight: 700 }}>{Math.round((yetarli / jami) * 100)}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
                    Materiallarning {Math.round((yetarli / jami) * 100)}% ta&apos;minlangan
                  </div>
                </div>
              )}

              <div className="divider" />

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: "var(--success-dim)", border: "1px solid rgba(15,123,69,0.15)", borderRadius: "var(--radius2)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Me&apos;yoriy sarf</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>{costNorms.length}</div>
                </div>
                <div style={{ flex: 1, background: "var(--accent-dim)", border: "1px solid rgba(26,110,235,0.15)", borderRadius: "var(--radius2)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Shartnomalar</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{contracts.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─────────── BOSH SAHIFA: Norma-rasxodlar ro'yxati ─────────── */
  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <h1
          className="font-head-itm"
          style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.5, color: "var(--text)", textTransform: "uppercase" }}
        >
          Birja
        </h1>

        <div className="search-wrap" style={{ maxWidth: 300 }}>
          <SearchIcon />
          <input
            className="search-input"
            placeholder="Norma-rasxod qidirish..."
            value={normSearch}
            onChange={(e) => setNormSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Norma-rasxodlar ro'yxati */}
      {filteredNorms.length === 0 ? (
        <div className="itm-card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ color: "var(--text3)", fontSize: 15 }}>
            {costNorms.length === 0
              ? "Norma-rasxodlar topilmadi"
              : "Qidiruv bo'yicha natija topilmadi"
            }
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
          {filteredNorms.map((s) => {
            const hasDeficit = s.deficitCount > 0 || s.notFoundCount > 0;
            return (
              <button
                key={s.norm.id}
                onClick={() => handleSelectNorm(s.norm.id)}
                style={{
                  display: "flex", flexDirection: "column", gap: 12,
                  padding: "20px 22px",
                  background: "var(--surface)",
                  border: hasDeficit ? "1.5px solid #d97706" : "1px solid var(--border)",
                  borderRadius: "var(--radius2)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "none";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                {/* Sarlavha */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div className={`icon-bg ${hasDeficit ? "ib-danger" : "ib-green"}`} style={{ flexShrink: 0, marginTop: 2 }}>
                    {hasDeficit ? <AlertIcon /> : <ClipboardIcon />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                      {s.norm.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                      Shartnoma: {s.contractNo}
                    </div>
                  </div>
                </div>

                {/* Statistika */}
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{
                    flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "center",
                    background: "var(--accent-dim)",
                  }}>
                    <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Jami</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{s.totalItems}</div>
                  </div>
                  {s.deficitCount > 0 && (
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "center",
                      background: "var(--warn-dim)",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--warn)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Kam</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--warn)" }}>{s.deficitCount}</div>
                    </div>
                  )}
                  {s.notFoundCount > 0 && (
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "center",
                      background: "var(--danger-dim)",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--danger)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Topilmadi</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--danger)" }}>{s.notFoundCount}</div>
                    </div>
                  )}
                  {s.okCount > 0 && (
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "center",
                      background: "var(--success-dim)",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Yetarli</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>{s.okCount}</div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
