"use client";

const items = [
  { num: "001", name: "Elektrood E-46",        cat: "Payvandlash", unit: "kg",   qty: 75,  min: 30,   status: "ok",     statusLabel: "Yetarli", pct: 100 },
  { num: "002", name: "Gruntovka R-7",          cat: "Kimyo",       unit: "litr", qty: 80,  min: 60,   status: "warn",   statusLabel: "Oz",      pct: 55 },
  { num: "003", name: "M4×20 bolt",             cat: "Qismlar",     unit: "ta",   qty: 400, min: 1000, status: "danger", statusLabel: "Kritik",  pct: 16 },
  { num: "004", name: "Qora metall list 2mm",   cat: "Metall",      unit: "kg",   qty: 200, min: 500,  status: "danger", statusLabel: "Kritik",  pct: 24 },
  { num: "005", name: "Alyuminiy profil 40×40", cat: "Metall",      unit: "m",    qty: 340, min: 100,  status: "ok",     statusLabel: "Yetarli", pct: 85 },
  { num: "006", name: "Gidravlik yog' HM-32",  cat: "Kimyo",       unit: "litr", qty: 150, min: 50,   status: "ok",     statusLabel: "Yetarli", pct: 90 },
];

const statusClass: Record<string, string> = { ok: "s-ok", warn: "s-warn", danger: "s-danger" };
const pfClass: Record<string, string>     = { ok: "pf-green", warn: "pf-warn", danger: "pf-danger" };
const qtyColor: Record<string, string>    = { ok: "var(--success)", warn: "var(--warn)", danger: "var(--danger)" };

export default function WarehousePage() {
  return (
    <>
      <div className="page-header">
        <div className="ph-title">Ombor Zaxirasi</div>
        <div className="search-wrap" style={{ maxWidth: 260 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Material qidirish..." />
        </div>
        <select className="form-select" style={{ width: 140 }}>
          <option>Barcha holat</option>
          <option>Yetarli</option>
          <option>Kam</option>
          <option>Kritik</option>
        </select>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Kirim
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card blue"><div className="stat-label">Jami pozitsiya</div><div className="stat-value">247</div><div className="stat-meta">Aktiv materiallar</div></div>
        <div className="stat-card green"><div className="stat-label">Yetarli</div><div className="stat-value">224</div><div className="stat-meta">Normada</div></div>
        <div className="stat-card warn"><div className="stat-label">Kam qoldi</div><div className="stat-value">18</div><div className="stat-meta">Zakaz kerak</div></div>
        <div className="stat-card danger"><div className="stat-label">Kritik</div><div className="stat-value">5</div><div className="stat-meta">Darhol zakaz</div></div>
      </div>

      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-blue">
            <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </div>
          <span className="itm-card-title">Ombor Zaxirasi</span>
          <span className="itm-card-subtitle">247 ta pozitsiya</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr>
                <th>#</th><th>Material nomi</th><th>Kategoriya</th><th>Birlik</th>
                <th>Miqdori</th><th>Min. norma</th><th>Holat</th><th>Zaxira</th><th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.num}>
                  <td className="mono" style={{ color: "var(--text3)" }}>{item.num}</td>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="tag">{item.cat}</span></td>
                  <td className="mono">{item.unit}</td>
                  <td className="mono" style={{ color: qtyColor[item.status], fontWeight: 600 }}>{item.qty}</td>
                  <td className="mono" style={{ color: "var(--text3)" }}>{item.min}</td>
                  <td><span className={`status ${statusClass[item.status]}`}>{item.statusLabel}</span></td>
                  <td>
                    <div className="progress-wrap">
                      <div className="progress-bar">
                        <div className={`progress-fill ${pfClass[item.status]}`} style={{ width: `${item.pct}%` }} />
                      </div>
                      <span className="progress-pct">{item.pct}%</span>
                    </div>
                  </td>
                  <td><button className="btn btn-sm btn-outline">Chiqim</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
