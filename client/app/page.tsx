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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSections = async () => {
      try {
        const res = await fetch("http://localhost:8000/sections");
        if (!res.ok) throw new Error("Failed to load sections");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSections(data.map((section: any) => ({ id: section.id, name: section.name, status: "Active" as const })));
        } else {
          setSections(defaultSections);
        }
      } catch {
        setSections(defaultSections);
      } finally {
        setLoading(false);
      }
    };
    loadSections();
  }, []);

  const addSection = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (sections.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;

    try {
      const res = await fetch("http://localhost:8000/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const section = await res.json();
        setSections((prev) => [...prev, { id: section.id, name: section.name, status: "Active" }] );
        setNewName("");
        return;
      }
    } catch {}

    // Fallback local add when API fails
    const nextId = sections.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    setSections((prev) => [...prev, { id: nextId, name: trimmed, status: "Active" }]);
    setNewName("");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-3xl font-bold">Boshqaruv paneli</h1>
          <p className="text-slate-500 mt-1">Bu sahifada hozir hech qanday bo'lim ko'rsatilmaydi.</p>
          <p className="text-xs mt-2 text-slate-400">Bo‘limlar ro‘yxati “Bo'limlar” naviga o'tgach ko‘rinadi.</p>
        </div>
      </div>
    </main>
  );
}
