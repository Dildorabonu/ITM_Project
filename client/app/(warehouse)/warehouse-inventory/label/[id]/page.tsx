"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  productService,
  PRODUCT_UNIT_LABELS,
  type ScanLabelResponse,
} from "@/lib/userService";
import { useT } from "@/lib/i18n";

// 58mm termal yorliq sahifasi.
// Ekranda yorliq preview + "Chop etish" tugmasi; @media print da faqat yorliq
// konteyneri (#thermal-label) ko'rinadi — app shell (sidebar/topbar) yashiriladi.
// QR rasmi yuklangach window.print() avtomatik bir marta chaqiriladi.
export default function LabelPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<ScanLabelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await productService.getLabel(id);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setError(t("Yorliq ma'lumotini yuklab bo'lmadi."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const autoPrint = useCallback(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    // Renderdan keyin bir frame kutib chop etamiz.
    setTimeout(() => window.print(), 150);
  }, []);

  // QR bo'lmasa (eski mahsulot) ham yuklangach avtomatik chop etamiz.
  useEffect(() => {
    if (data && !data.qrPngBase64) autoPrint();
  }, [data, autoPrint]);

  const unitLabel = data ? (PRODUCT_UNIT_LABELS[data.unit] ?? "") : "";

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "12px 0" }}>
      {/* Print-only styles: faqat yorliqni ko'rsatib, qolgan hammasi yashiriladi */}
      <style>{`
        @media print {
          @page { size: 58mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          #thermal-label, #thermal-label * { visibility: visible !important; }
          #thermal-label {
            position: absolute !important;
            left: 0; top: 0;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Ekran boshqaruvi — chop etishda yashiriladi */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 360, justifyContent: "space-between" }}>
        <div>
          <div className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {t("Termal yorliq")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{t("58mm termal printer uchun")}</div>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!data}
          className="btn-primary"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius)", border: "none",
            cursor: data ? "pointer" : "not-allowed", opacity: data ? 1 : 0.6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          {t("Chop etish")}
        </button>
      </div>

      {loading ? (
        <div className="no-print" style={{ padding: 40, color: "var(--text2)", fontSize: 13 }}>{t("Yuklanmoqda...")}</div>
      ) : error ? (
        <div className="no-print" style={{ padding: 40, color: "var(--danger)", fontSize: 13 }}>{error}</div>
      ) : data ? (
        // Yorliq konteyneri — 58mm. Termal printer qora/oq bo'lgani uchun
        // ranglar tema'dan qat'i nazar har doim oq fon / qora matn.
        <div
          id="thermal-label"
          style={{
            width: "58mm",
            boxSizing: "border-box",
            background: "#fff",
            color: "#000",
            padding: "3mm 2mm",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "1.5mm",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            fontFamily: "var(--font-inter)",
          }}
        >
          <div style={{ fontSize: "3.4mm", fontWeight: 700, lineHeight: 1.15, wordBreak: "break-word", width: "100%" }}>
            {data.name}
          </div>

          {data.qrPngBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${data.qrPngBase64}`}
              alt={data.code ?? "QR"}
              onLoad={autoPrint}
              style={{ width: "40mm", height: "40mm", imageRendering: "pixelated" }}
            />
          ) : (
            <div style={{ fontSize: "2.6mm", padding: "6mm 0", color: "#555" }}>{t("QR kod mavjud emas")}</div>
          )}

          {data.code && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "3.6mm", fontWeight: 700, letterSpacing: "0.04em" }}>
              {data.code}
            </div>
          )}

          <div style={{ fontSize: "3.6mm", fontWeight: 700 }}>
            {data.quantity} {unitLabel}
          </div>

          {data.departmentName && (
            <div style={{ fontSize: "2.8mm", lineHeight: 1.2, wordBreak: "break-word", width: "100%" }}>
              {data.departmentName}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}