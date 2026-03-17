"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SectionItem {
  id: number;
  name: string;
  status: "Active" | "Delayed" | "Completed";
}

const defaultSections: SectionItem[] = [
  { id: 1, name: "Mexanika", status: "Active" },
  { id: 2, name: "Himoya", status: "Active" },
  { id: 3, name: "Optika", status: "Delayed" },
  { id: 4, name: "Tikuv", status: "Active" },
  { id: 5, name: "Antidron", status: "Completed" },
];

export default function DepartmentsPage() {
  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSections = async () => {
    try {
      const res = await fetch("http://localhost:8000/sections");
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSections(data.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name, status: "Active" }))); 
      } else {
        setSections(defaultSections);
      }
    } catch {
      setSections(defaultSections);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        const created = await res.json();
        setSections((prev) => [...prev, { id: created.id, name: created.name, status: "Active" }]);
        setNewName("");
        return;
      }
    } catch {
      // fallback
    }

    const nextId = sections.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    setSections((prev) => [...prev, { id: nextId, name: trimmed, status: "Active" }]);
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Bo&apos;limlar</h1>
            <p className="text-slate-500 mt-1">Saytning bo&apos;limlari sahifasi. Bu yerda barcha bo&apos;limlar ro&apos;yxati mavjud.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        {loading ? (
          <p className="text-slate-500">Yuklanmoqda...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map((section) => (
              <Link key={section.id} href={`/inventory/${section.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-blue-300 transition">
                <div className="font-semibold">{section.name}</div>
                <div className="text-xs text-slate-500 mt-1">{section.status}</div>
              </Link>
            ))}
            <button
              onClick={() => setShowAdd((prev) => !prev)}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50 p-3 text-blue-600 hover:bg-blue-100 transition"
            >
              +
            </button>
          </div>
        )}

        {showAdd && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Yangi bo&apos;lim nomi"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button onClick={addSection} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition">Qo&apos;shish</button>
          </div>
        )}
      </div>
    </div>
  );
}
