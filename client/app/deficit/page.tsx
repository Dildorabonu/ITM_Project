"use client";

const deficitItems = [
  { name: "M4×20 bolt",          need: "2 500 ta", have: "400 ta",  diff: "−2 100 ta", diffColor: "var(--danger)", status: "s-danger", statusLabel: "Yo'q",    action: true },
  { name: "Qora metall list 2mm", need: "850 kg",   have: "200 kg", diff: "−650 kg",   diffColor: "var(--danger)", status: "s-danger", statusLabel: "Kritik",  action: true },
  { name: "Gruntovka R-7",        need: "120 litr", have: "80 litr",diff: "−40 litr",  diffColor: "var(--warn)",   status: "s-warn",   statusLabel: "Oz",      action: true },
  { name: "Elektrood E-46",       need: "50 kg",    have: "75 kg",  diff: "+25 kg ✓",  diffColor: "var(--success)", status: "s-ok",    statusLabel: "Yetarli", action: false, rowBg: "rgba(15,123,69,0.04)" },
];

export default function DeficitPage() {
  return (
    <>
      <div className="page-header">
        <div className="ph-title">Deficit Tekshiruv</div>
      </div>

      {/* Contract selector */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-warn">
            <svg width="14" height="14" fill="none" stroke="var(--warn)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <span className="itm-card-title">Shartnoma Bo&apos;yicha Tekshiruv</span>
        </div>
        <div className="itm-card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Shartnoma tanlash</label>
            <select className="form-select" style={{ marginTop: 6 }}>
              <option>SH-2025-047 — Metall Konstruktsiya × 500</option>
              <option>SH-2025-046 — Plastik Qoplama × 1200</option>
              <option>SH-2025-043 — Elektr Kabeli × 5000 m</option>
            </select>
          </div>
          <button className="btn btn-primary">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Tekshirish
          </button>
        </div>
      </div>

      {/* Deficit list */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-danger">
            <svg width="14" height="14" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <span className="itm-card-title">Deficit Ro&apos;yxati — SH-2025-047</span>
          <span className="itm-card-subtitle">3 ta yetishmayotgan</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr><th>Material</th><th>Kerak</th><th>Omborda</th><th>Yetishmaydi</th><th>Holat</th><th>Amal</th></tr>
            </thead>
            <tbody>
              {deficitItems.map(item => (
                <tr key={item.name} style={item.rowBg ? { background: item.rowBg } : {}}>
                  <td><strong>{item.name}</strong></td>
                  <td className="mono">{item.need}</td>
                  <td className="mono" style={{ color: item.diffColor }}>{item.have}</td>
                  <td className="mono" style={{ color: item.diffColor, fontWeight: 700 }}>{item.diff}</td>
                  <td><span className={`status ${item.status}`}>{item.statusLabel}</span></td>
                  <td>
                    {item.action
                      ? <button className="btn btn-sm btn-outline">Zakaz</button>
                      : <span className="mono" style={{ color: "var(--text3)", fontSize: 11 }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1.5px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn btn-warn">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
            Barchasini yuborish
          </button>
          <button className="btn btn-outline">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel export
          </button>
          <button className="btn btn-outline" style={{ marginLeft: "auto" }}>
            Shartnoma shabloniga qo&apos;shish
          </button>
        </div>
      </div>
    </>
  );
}
