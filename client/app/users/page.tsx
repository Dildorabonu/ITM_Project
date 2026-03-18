"use client";

const users = [
  { initials: "SM", bg: "linear-gradient(135deg,#6d4aad,#4a2e8a)", name: "Sarvar Mirzayev",  role: "rb-admin",  roleLabel: "SuperAdmin",     dept: "Boshqaruv",       status: "s-ok",   statusLabel: "Aktiv",   lastSeen: "Hozir online" },
  { initials: "AK", bg: "linear-gradient(135deg,#1a6eeb,#0d3e9e)", name: "Akbar Karimov",    role: "rb-chief",  roleLabel: "Bo'lim boshlig'i",dept: "Ishlab chiqarish",status: "s-ok",   statusLabel: "Aktiv",   lastSeen: "Hozir online" },
  { initials: "JU", bg: "linear-gradient(135deg,#1558c7,#0a2d7a)", name: "Jasur Umarov",      role: "rb-worker", roleLabel: "Ombor xodimi",   dept: "Ombor",           status: "s-ok",   statusLabel: "Aktiv",   lastSeen: "5 daqiqa oldin" },
  { initials: "NR", bg: "linear-gradient(135deg,#e07b00,#b35e00)", name: "Nilufar Rahimova",  role: "rb-chief",  roleLabel: "Bo'lim boshlig'i",dept: "Yig'ish sexi",    status: "s-warn", statusLabel: "Tatilda",  lastSeen: "2 kun oldin" },
];

export default function UsersPage() {
  return (
    <>
      <div className="page-header">
        <div className="ph-title">Foydalanuvchilar</div>
        <div className="search-wrap" style={{ maxWidth: 260 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Qidirish..." />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yangi Foydalanuvchi
        </button>
      </div>

      <div className="itm-card">
        <div className="itm-card-header">
          <div className="icon-bg ib-blue">
            <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <span className="itm-card-title">Foydalanuvchilar</span>
          <span className="itm-card-subtitle">4 ta aktiv</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr><th>F.I.Sh.</th><th>Role</th><th>Bo&apos;lim</th><th>Holat</th><th>So&apos;nggi faollik</th><th>Amal</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: u.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                        fontFamily: "var(--font-head)",
                      }}>{u.initials}</div>
                      {u.name}
                    </div>
                  </td>
                  <td><span className={`role-badge ${u.role}`}>{u.roleLabel}</span></td>
                  <td style={{ color: "var(--text2)" }}>{u.dept}</td>
                  <td><span className={`status ${u.status}`}>{u.statusLabel}</span></td>
                  <td className="mono" style={{ color: "var(--text3)", fontSize: 11 }}>{u.lastSeen}</td>
                  <td><button className="btn btn-sm btn-outline">Tahrirlash</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
