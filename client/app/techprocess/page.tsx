"use client";

import Link from "next/link";

const steps = [
  { num: 1, title: "Xom ashyo tayyorlash",    desc: "Qora metall listni o'lchov bo'yicha kesish. Ish vaqti: 4 soat. Gilotina va o'lchov lentasi." },
  { num: 2, title: "Payvandlash",              desc: "MMA payvandlash. Elektrood E-46, tok 120-160A. Ish vaqti: 8 soat." },
  { num: 3, title: "Tozalash va gruntlash",   desc: "Metall yuzasini qumlash. Gruntovka R-7 qo'llash. 24 soat quritish." },
  { num: 4, title: "Boltlash va yig'ish",     desc: "M4×20 bolt bilan konstruktsiya birlashtirish. Gidravlik kalit." },
  { num: 5, title: "Nazorat va qadoqlash",    desc: "OTK nazorat tekshiruvi. Standart qadoqlash. Omborga topshirish." },
];

const materials = [
  { name: "Qora metall 2mm", unit: "kg",   per1: "1.7",  per500: "850" },
  { name: "M4×20 bolt",      unit: "ta",   per1: "5",    per500: "2 500" },
  { name: "Elektrood E-46",  unit: "kg",   per1: "0.1",  per500: "50" },
  { name: "Gruntovka R-7",   unit: "litr", per1: "0.24", per500: "120" },
];

export default function TechProcessPage() {
  return (
    <>
      <div>
        <div className="breadcrumb">
          <Link href="/contracts" className="crumb">Shartnomalar</Link>
          <span className="sep">›</span>
          <span>SH-2025-047</span>
          <span className="sep">›</span>
          <span style={{ color: "var(--text2)" }}>Tex Protsess</span>
        </div>
        <div className="page-header" style={{ marginTop: 6 }}>
          <div className="ph-title">Metall Konstruktsiya — Tex Protsess</div>
          <span className="status s-warn">Tasdiqlanmagan</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="step-indicator">
        <div className="step-item done"><div className="step-circle">✓</div><span>Shartnoma</span></div>
        <div className="step-line done" />
        <div className="step-item done"><div className="step-circle">✓</div><span>Tex Tahlil</span></div>
        <div className="step-line done" />
        <div className="step-item active"><div className="step-circle">3</div><span>Tex Protsess</span></div>
        <div className="step-line" />
        <div className="step-item"><div className="step-circle">4</div><span>Ombor Tekshiruv</span></div>
        <div className="step-line" />
        <div className="step-item"><div className="step-circle">5</div><span>Tasdiqlash</span></div>
      </div>

      <div className="two-col">
        {/* Production steps */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
            </div>
            <span className="itm-card-title">Ishlab Chiqarish Bosqichlari</span>
          </div>
          <div className="itm-card-body">
            <div className="process-steps">
              {steps.map(s => (
                <div key={s.num} className="process-step">
                  <div className="process-num">{s.num}</div>
                  <div>
                    <div className="process-title">{s.title}</div>
                    <div className="process-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Materials table */}
          <div className="itm-card">
            <div className="itm-card-header">
              <div className="icon-bg ib-warn">
                <svg width="14" height="14" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><circle cx="9" cy="20" r="1"/><circle cx="20" cy="20" r="1"/></svg>
              </div>
              <span className="itm-card-title">Normalangan Rasxod</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="itm-table">
                <thead><tr><th>Material</th><th>Birlik</th><th>1 ta</th><th>500 ta</th></tr></thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.name}>
                      <td className="mono">{m.name}</td>
                      <td className="mono">{m.unit}</td>
                      <td className="mono">{m.per1}</td>
                      <td className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{m.per500}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Time plan */}
          <div className="itm-card">
            <div className="itm-card-header">
              <div className="icon-bg ib-blue">
                <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              </div>
              <span className="itm-card-title">Vaqt Rejasi</span>
            </div>
            <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Jami ish vaqti",  value: "38 soat" },
                { label: "Ishchilar soni",  value: "6 nafar" },
                { label: "Taxminiy muddat", value: "7 ish kuni" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{r.label}</span>
                  <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
              <div className="divider" />
              <Link href="/deficit" className="btn btn-warn" style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Ombor Tekshiruv
              </Link>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                Tasdiqlash va Yuborish
              </button>
            </div>
          </div>

          {/* Contract template */}
          <div className="itm-card">
            <div className="itm-card-header">
              <div className="icon-bg ib-blue">
                <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              </div>
              <span className="itm-card-title">Shartnoma Shablon</span>
            </div>
            <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>Deficit ma&apos;lumotlari shartnoma shabloniga qo&apos;shiladi va bug&apos;alteriyaga uzatiladi.</div>
              <button className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>Shablonga qo&apos;shish</button>
              <button className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>Bug&apos;alteriyaga yuborish</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
