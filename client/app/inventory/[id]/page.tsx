"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const SECTION_STORAGE_KEY = "itm-sections-v1";
const PRODUCT_STORAGE_KEY = "itm-products-v1";
const defaultSections = [
  { id: 1, name: "Mexanika" },
  { id: 2, name: "Himoya" },
  { id: 3, name: "Optika" },
  { id: 4, name: "Tikuv" },
  { id: 5, name: "Antidron" },
];
const defaultProducts: Record<number, string[]> = {
  1: ["Motor bo'lagi", "G'ildirak", "Transmissiya"],
  2: ["Qalpoq", "Ko'krak plastinka"],
  3: ["Linza", "Kamera sensori"],
  4: ["Ip", "Tikuv mashinasi"],
  5: ["Datchik", "Propeller"],
};

interface SectionItem { id: number; name: string; }

export default function InventoryDetailPage() {
  const params = useParams();
  const id = Number(params.id ?? 1);
  const sectionId = Number.isFinite(id) && id > 0 ? id : 1;

  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [productsBySection, setProductsBySection] = useState<Record<number, string[]>>(defaultProducts);
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const parsedSections = parsed
            .filter((s: any) => s && typeof s.id === "number" && typeof s.name === "string")
            .map((s: any) => ({ id: s.id, name: s.name }));
          if (parsedSections.length > 0) setSections(parsedSections);
        }
      } catch {
        setSections(defaultSections);
      }
    }

    const rawProducts = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (rawProducts) {
      try {
        const parsed = JSON.parse(rawProducts);
        if (parsed && typeof parsed === "object") setProductsBySection(parsed);
      } catch {
        setProductsBySection(defaultProducts);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(productsBySection));
  }, [productsBySection]);

  const selectedSection = sections.find((s) => s.id === sectionId) ?? sections[0] ?? defaultSections[0];
  const sectionName = selectedSection.name;
  const products = productsBySection[selectedSection.id] ?? [];

  const addProduct = () => {
    const trimmed = newProduct.trim();
    if (!trimmed) return;
    setProductsBySection((prev) => {
      const next = { ...prev, [sectionId]: [...(prev[sectionId] ?? []), trimmed] };
      localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setNewProduct("");
    setShowAdd(false);
  };

  const updateProduct = (index: number) => {
    if (editingText.trim().length === 0) return;
    setProductsBySection((prev) => {
      const sectionItems = [...(prev[sectionId] ?? [])];
      sectionItems[index] = editingText.trim();
      const next = { ...prev, [sectionId]: sectionItems };
      localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setEditingIndex(null);
    setEditingText("");
  };

  const removeProduct = (index: number) => {
    setProductsBySection((prev) => {
      const sectionItems = [...(prev[sectionId] ?? [])];
      sectionItems.splice(index, 1);
      const next = { ...prev, [sectionId]: sectionItems };
      localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{sectionName} bo&apos;limi mahsulotlari</h1>
          <p className="text-slate-500 mt-1">Tanlangan bo&apos;lim ichidagi mahsulot ro&apos;yxati va + ikonka bilan qo&apos;shish.</p>
        </div>
        <Link href="/">
          <button className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
            Orqaga
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {sections.map((section) => (
          <Link key={section.id} href={`/inventory/${section.id}`}>
            <div className={`rounded-xl border p-3 text-center text-sm font-medium ${section.id === selectedSection.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"}`}>
              {section.name}
            </div>
          </Link>
        ))}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold">{sectionName} mahsulotlar ro&apos;yxati</h2>
            <p className="text-slate-500 text-sm">Faol bo&apos;limdagi mahsulotlar</p>
          </div>
          <button onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 transition">
            {showAdd ? "Bekor qilish" : "Yangi mahsulot +"}
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 flex flex-col gap-2">
            <input
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              placeholder="Mahsulot nomi"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button onClick={addProduct} className="self-start rounded-lg bg-blue-600 px-3 py-2 text-white text-sm font-medium hover:bg-blue-700 transition">
              Qo'shish
            </button>
          </div>
        )}

        {products.length > 0 ? (
          <ul className="space-y-2">
            {products.map((p, i) => (
              <li key={`${p}-${i}`} className="rounded-lg border border-slate-200 p-3 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{p}</p>
                  <p className="text-xs text-slate-500">Mahsulot #{i + 1}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingIndex === i ? (
                    <>
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        placeholder="Yangilash"
                      />
                      <button onClick={() => updateProduct(i)} className="rounded-md bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 transition">Saqlash</button>
                      <button onClick={() => { setEditingIndex(null); setEditingText(""); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs">Bekor</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingIndex(i); setEditingText(p); }} className="rounded-md border border-indigo-400 bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800 hover:scale-105 hover:bg-indigo-200 transition-transform duration-150">Tahrirlash</button>
                      <button onClick={() => removeProduct(i)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:scale-105 hover:border-slate-500 hover:text-slate-900 transition-all duration-150">O'chirish</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">Bu bo&apos;limda mahsulotlar yo&apos;q. Yangi mahsulot qo&apos;shing.</p>
        )}
      </section>
    </div>
  );
}
