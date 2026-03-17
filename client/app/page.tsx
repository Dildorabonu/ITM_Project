"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings, Shield, Eye, Scissors, Plane } from "lucide-react";

interface SectionItem { id: number; name: string; status: "Active" | "Delayed" | "Completed"; }
const SECTION_STORAGE_KEY = "itm-sections-v1";
const defaultSections: SectionItem[] = [
  { id: 1, name: "Mexanika", status: "Active" },
  { id: 2, name: "Himoya", status: "Active" },
  { id: 3, name: "Optika", status: "Delayed" },
  { id: 4, name: "Tikuv", status: "Active" },
  { id: 5, name: "Antidron", status: "Completed" },
];

const icons: Record<number, React.ReactNode> = {
  1: <Settings size={28} />,
  2: <Shield size={28} />,
  3: <Eye size={28} />,
  4: <Scissors size={28} />,
  5: <Plane size={28} />,
};

export default function Home() {
  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (raw) {
      try { const parsed = JSON.parse(raw) as SectionItem[]; if (Array.isArray(parsed) && parsed.length > 0) setSections(parsed); }
      catch { setSections(defaultSections); }
    }
  }, []);

  useEffect(() => { localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections)); }, [sections]);

  const addSection = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (sections.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    const nextId = sections.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    setSections((prev) => [...prev, { id: nextId, name: trimmed, status: "Active" }]);
    setNewName("");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-3xl font-bold">Boshqaruv paneli</h1>
        </div>
      </div>
    </main>
  );
}
