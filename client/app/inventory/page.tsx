"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SECTION_STORAGE_KEY = "itm-sections-v1";

export default function InventoryPage() {
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    const defaults = [{ id: 1, name: "Mexanika" }, { id: 2, name: "Himoya" }, { id: 3, name: "Optika" }, { id: 4, name: "Tikuv" }, { id: 5, name: "Antidron" }];
    if (!raw) {
      setSections(defaults);
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(defaults));
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter((s: any) => s && typeof s.id === "number" && typeof s.name === "string")
          .map((s: any) => ({ id: s.id, name: s.name }));
        if (valid.length > 0) {
          setSections(valid);
          return;
        }
      }
    } catch {
      // ignore
    }

    setSections(defaults);
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(defaults));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white p-4 rounded-xl border"><h1 className="text-2xl font-bold">Bo'limlar</h1></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((s) => (
            <Link key={s.id} href={`/inventory/${s.id}`}>
              <div className="border rounded-xl p-3 bg-white hover:border-blue-500 cursor-pointer">{s.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
