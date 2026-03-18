"use client";

const roles = [
  { cls: "rb-admin", label: "SuperAdmin",      count: 1, desc: "Tizimning to'liq boshqaruvi. Barcha bo'limlarga kirish. Foydalanuvchi va ruxsatlarni boshqarish.", borderColor: "var(--purple)" },
  { cls: "rb-chief", label: "Bo'lim boshlig'i",count: 3, desc: "O'z bo'limini to'liq boshqaradi. Shartnoma, tex protsess, kunlik vazifalar.",                    borderColor: "var(--accent)" },
  { cls: "rb-worker",label: "Ombor xodimi",    count: 4, desc: "Ombordagi kirim-chiqimlarni boshqarish. Zaxira holati ko'rish.",                                   borderColor: "#1558c7" },
  { cls: "rb-staff", label: "Ishchi",          count: 12,desc: "Faqat o'z vazifalarini ko'radi va belgilaydi. Cheklangan o'qish huquqi.",                          borderColor: "var(--warn)" },
];

const perms = [
  { name: "Shartnoma yaratish",      sa: true,  ch: true,  ow: false, wo: false },
  { name: "Tex protsess",            sa: true,  ch: true,  ow: false, wo: false },
  { name: "Ombor kirim",             sa: true,  ch: "~",   ow: true,  wo: false },
  { name: "Ombor chiqim",            sa: true,  ch: "~",   ow: true,  wo: false },
  { name: "Deficit tekshiruv",       sa: true,  ch: true,  ow: true,  wo: false },
  { name: "Vazifa yaratish",         sa: true,  ch: true,  ow: false, wo: false },
  { name: "Vazifa bajarish",         sa: true,  ch: true,  ow: true,  wo: true  },
  { name: "Foydalanuvchi boshqaruv", sa: true,  ch: false, ow: false, wo: false },
  { name: "Hisobot export",          sa: true,  ch: true,  ow: "~",   wo: false },
  { name: "Bildirishnoma yuborish",  sa: true,  ch: true,  ow: true,  wo: false },
];

function PermCell({ val }: { val: boolean | string }) {
  if (val === true)  return <span className="perm-check p-yes">✓</span>;
  if (val === false) return <span className="perm-check p-no">✗</span>;
  return <span className="perm-check p-partial">~</span>;
}

export default function RolesPage() {
  return (
    <>
      <div className="page-header">
        <div className="ph-title">Rollar &amp; Ruxsatlar</div>
      </div>

      <div className="two-col">
        {/* Roles list */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span className="itm-card-title">Rollar Ro&apos;yxati</span>
          </div>
          <div className="itm-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {roles.map(r => (
              <div key={r.label} style={{
                background: "var(--bg3)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)", padding: 14,
                borderLeft: `3px solid ${r.borderColor}`,
                cursor: "pointer", transition: "all 0.14s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className={`role-badge ${r.cls}`}>{r.label}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text3)", marginLeft: "auto" }}>{r.count} nafar</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Permission matrix */}
        <div className="itm-card">
          <div className="itm-card-header">
            <div className="icon-bg ib-blue">
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <span className="itm-card-title">Ruxsatlar Matritsasi</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Amal</th>
                  <th style={{ textAlign: "center" }}>SuperAdmin</th>
                  <th style={{ textAlign: "center" }}>Bo&apos;lim b.</th>
                  <th style={{ textAlign: "center" }}>Ombor x.</th>
                  <th style={{ textAlign: "center" }}>Ishchi</th>
                </tr>
              </thead>
              <tbody>
                {perms.map(p => (
                  <tr key={p.name}>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</td>
                    <td style={{ textAlign: "center" }}><PermCell val={p.sa} /></td>
                    <td style={{ textAlign: "center" }}><PermCell val={p.ch} /></td>
                    <td style={{ textAlign: "center" }}><PermCell val={p.ow} /></td>
                    <td style={{ textAlign: "center" }}><PermCell val={p.wo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1.5px solid var(--border)", display: "flex", gap: 14 }} className="mono" >
            <span style={{ fontSize: 10, color: "var(--text3)" }}><span style={{ color: "var(--success)" }}>✓</span> To&apos;liq ruxsat</span>
            <span style={{ fontSize: 10, color: "var(--text3)" }}><span style={{ color: "var(--warn)" }}>~</span> Cheklangan</span>
            <span style={{ fontSize: 10, color: "var(--text3)" }}><span style={{ color: "var(--danger)" }}>✗</span> Taqiqlangan</span>
          </div>
        </div>
      </div>
    </>
  );
}
