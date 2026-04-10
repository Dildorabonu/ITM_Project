"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const defaultSections = [
  { id: 1, name: "Mexanika" },
  { id: 2, name: "Himoya" },
  { id: 3, name: "Optika" },
  { id: 4, name: "Tikuv" },
  { id: 5, name: "Antidron" },
];

export default function InventoryPage() {
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSections = async () => {
      try {
        const res = await fetch("http://localhost:8000/sections");
        if (!res.ok) throw new Error("load failed");
        let data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSections(data);
          setLoading(false);
          return;
        }

        // If API returns empty list, create default sections once
        const created: { id: number; name: string }[] = [];
        for (const section of defaultSections) {
          const post = await fetch("http://localhost:8000/sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: section.name }),
          });
          if (post.ok) {
            created.push(await post.json());
          }
        }
        if (created.length > 0) {
          setSections(created);
          setLoading(false);
          return;
        }
      } catch {
        // fallback to defaults if API unavailable
      }

      setSections(defaultSections);
      setLoading(false);
    };

    loadSections();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-4xl mx-auto p-6 bg-white rounded-xl">Yuklanmoqda...</div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-transition">
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
