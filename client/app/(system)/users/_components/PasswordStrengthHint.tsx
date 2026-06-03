"use client";

const checks = [
  { label: "Kamida 8 ta belgi", test: (p: string) => p.length >= 8 },
  { label: "Katta harf (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Kichik harf (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Raqam (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "Maxsus belgi (!@#$...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordStrong(password: string): boolean {
  return checks.every(c => c.test(password));
}

interface PasswordStrengthHintProps {
  password: string;
}

export function PasswordStrengthHint({ password }: PasswordStrengthHintProps) {
  const passed = checks.filter(c => c.test(password)).length;
  const ratio = passed / checks.length;
  const barColor = ratio < 0.4 ? "var(--danger)" : ratio < 1 ? "var(--warn)" : "var(--success)";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 7, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${ratio * 100}%`,
          background: barColor,
          borderRadius: 2,
          transition: "width 0.25s, background 0.25s",
        }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {checks.map(({ label, test }) => {
          const ok = test(password);
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: ok ? "var(--success)" : "var(--text3)" }}>
              <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1 }}>{ok ? "✓" : "○"}</span>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
