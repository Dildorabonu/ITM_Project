import { type ScanSource } from "@/lib/userService";

interface Props {
  scanSources: ScanSource[];
  scanSourcesLoading: boolean;
  scanSourcesError: string;
  selectedSourceId: string;
  setSelectedSourceId: (id: string) => void;
  scanColorMode: string;
  setScanColorMode: (v: string) => void;
  scanDpi: number;
  setScanDpi: (v: number) => void;
  scanning: boolean;
  scanError: string;
  handleScanDocument: () => void;
  onClose: () => void;
}

export function ScanModal({
  scanSources, scanSourcesLoading, scanSourcesError,
  selectedSourceId, setSelectedSourceId,
  scanColorMode, setScanColorMode,
  scanDpi, setScanDpi,
  scanning, scanError,
  handleScanDocument, onClose,
}: Props) {
  return (
    <div className="modal-overlay" onClick={() => { if (!scanning) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                <rect x="2" y="7" width="20" height="10" rx="2" />
                <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                <circle cx="12" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
                <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Hujjatni skanerlash</span>
          </div>
          <button onClick={() => { if (!scanning) onClose(); }}
            style={{ background: "none", border: "1.5px solid var(--danger)", cursor: "pointer", color: "var(--danger)", fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: "var(--radius)", transition: "background 0.14s, transform 0.14s", opacity: scanning ? 0.4 : 1 }}
            onMouseEnter={e => { if (!scanning) (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            onMouseDown={e => { if (!scanning) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}>✕</button>
        </div>

        {/* Skanerlar ro'yxati */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Skaner tanlang</label>
          {scanSourcesLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)", padding: "10px 0" }}>Skanerlar qidirilmoqda...</div>
          ) : scanSourcesError ? (
            <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "var(--danger-dim)", borderRadius: 8, border: "1px solid var(--danger)33" }}>
              {scanSourcesError}
            </div>
          ) : scanSources.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text3)", padding: "10px 12px", background: "var(--bg3)", borderRadius: 8, border: "1.5px dashed var(--border)" }}>
              Ulangan skaner topilmadi. Printer/skaner ulangan va yoniqligini tekshiring.
            </div>
          ) : (
            <select className="form-input" value={selectedSourceId}
              onChange={e => setSelectedSourceId(e.target.value)}
              style={{ width: "100%", cursor: "pointer" }}>
              {scanSources.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sifat sozlamalari */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Rang rejimi</label>
            <select className="form-input" value={scanColorMode}
              onChange={e => setScanColorMode(e.target.value)}
              style={{ width: "100%", cursor: "pointer" }}>
              <option value="color">Rangli</option>
              <option value="gray">Kulrang (grayscale)</option>
              <option value="bw">Qora-oq</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Sifat (DPI)</label>
            <select className="form-input" value={scanDpi}
              onChange={e => setScanDpi(Number(e.target.value))}
              style={{ width: "100%", cursor: "pointer" }}>
              <option value={100}>100 DPI (tez)</option>
              <option value={150}>150 DPI</option>
              <option value={200}>200 DPI (standart)</option>
              <option value={300}>300 DPI (yuqori)</option>
              <option value={600}>600 DPI (maksimal)</option>
            </select>
          </div>
        </div>

        {scanError && (
          <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "var(--danger-dim)", borderRadius: 8, border: "1px solid var(--danger)33" }}>
            {scanError}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={scanning}
            style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
            Bekor
          </button>
          <button onClick={handleScanDocument}
            disabled={scanning || !selectedSourceId || scanSources.length === 0}
            style={{
              padding: "9px 24px", background: scanning ? "var(--bg3)" : "var(--accent)",
              border: "none", borderRadius: "var(--radius)", cursor: scanning || !selectedSourceId ? "not-allowed" : "pointer",
              color: scanning ? "var(--text3)" : "#fff", fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
            {scanning ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Skanerlayapti...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="7" width="20" height="10" rx="2" />
                  <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                  <path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
                </svg>
                Skanerlash
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
