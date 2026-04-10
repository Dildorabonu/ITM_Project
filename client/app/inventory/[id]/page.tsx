"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const defaultSections = [
  { id: 1, name: "Mexanika" },
  { id: 2, name: "Himoya" },
  { id: 3, name: "Optika" },
  { id: 4, name: "Tikuv" },
  { id: 5, name: "Antidron" },
];

interface SectionItem {
  id: number;
  name: string;
}

interface ProductItem {
  id: number;
  name: string;
  unit: string;
  section_id: number;
}

export default function InventoryDetailPage() {
  const params = useParams();
  const id = Number(params.id ?? 1);
  const sectionId = Number.isFinite(id) && id > 0 ? id : 1;

  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sectionsRes = await fetch("http://localhost:8000/sections");
        if (!sectionsRes.ok) throw new Error("sections fetch failed");
        const sectionsData = await sectionsRes.json();
        if (Array.isArray(sectionsData) && sectionsData.length > 0) {
          setSections(sectionsData);
        } else {
          setSections(defaultSections);
        }
      } catch {
        setSections(defaultSections);
      }

      try {
        const productsRes = await fetch(`http://localhost:8000/sections/${sectionId}/products`);
        if (!productsRes.ok) {
          setProducts([]);
        } else {
          const productData = await productsRes.json();
          setProducts(Array.isArray(productData) ? productData : []);
        }
      } catch {
        setProducts([]);
      }

      setLoading(false);
    };

    loadData();
  }, [sectionId]);

  const selectedSection = sections.find((s) => s.id === sectionId) ?? sections[0] ?? defaultSections[0];
  const sectionName = selectedSection?.name ?? "Bo'lim";

  const refreshProducts = async () => {
    try {
      const productsRes = await fetch(`http://localhost:8000/sections/${sectionId}/products`);
      if (productsRes.ok) {
        const productData = await productsRes.json();
        setProducts(Array.isArray(productData) ? productData : []);
      }
    } catch {
      setProducts([]);
    }
  };

  const addProduct = async () => {
    const trimmed = newProduct.trim();
    if (!trimmed) return;
    await fetch(`http://localhost:8000/sections/${sectionId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, name: trimmed, unit: "pcs" }),
    });
    setNewProduct("");
    setShowAdd(false);
    await refreshProducts();
  };

  const updateProduct = async (productId: number) => {
    if (editingText.trim().length === 0) return;
    await fetch(`http://localhost:8000/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingText.trim() }),
    });
    setEditingIndex(null);
    setEditingText("");
    await refreshProducts();
  };

  const removeProduct = async (productId: number) => {
    await fetch(`http://localhost:8000/products/${productId}`, { method: "DELETE" });
    await refreshProducts();
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-4xl mx-auto p-6 bg-white rounded-xl">Yuklanmoqda...</div></div>;
  }

  return (
    <div className="space-y-6 page-transition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{sectionName} bo&apos;limi mahsulotlari</h1>
          <p className="text-slate-500 mt-1">Tanlangan bo&apos;lim ichidagi mahsulot ro&apos;yxati.</p>
        </div>
        <Link href="/inventory">
          <button className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Orqaga</button>
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
            <button onClick={addProduct} className="self-start rounded-lg bg-blue-600 px-3 py-2 text-white text-sm font-medium hover:bg-blue-700 transition">Qo'shish</button>
          </div>
        )}

        {products.length > 0 ? (
          <ul className="space-y-2">
            {products.map((p, i) => (
              <li key={p.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name}</p>
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
                      <button onClick={() => updateProduct(p.id)} className="rounded-md bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 transition">Saqlash</button>
                      <button onClick={() => { setEditingIndex(null); setEditingText(""); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs">Bekor</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingIndex(i); setEditingText(p.name); }} className="rounded-md border border-indigo-400 bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800 hover:scale-105 hover:bg-indigo-200 transition-transform duration-150">Tahrirlash</button>
                      <button onClick={() => removeProduct(p.id)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:scale-105 hover:border-slate-500 hover:text-slate-900 transition-all duration-150">O'chirish</button>
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
