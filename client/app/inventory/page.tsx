"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Shield, Eye, Scissors, Plane, Package } from "lucide-react";

interface Department {
  id: number;
  name: string;
  icon: React.ReactNode;
  status: "Active" | "Delayed" | "Completed";
}

const defaultDepartments: Department[] = [
  { id: 1, name: "Mexanika", icon: <Settings size={32} />, status: "Active" },
  { id: 2, name: "Himoya", icon: <Shield size={32} />, status: "Active" },
  { id: 3, name: "Optika", icon: <Eye size={32} />, status: "Delayed" },
  { id: 4, name: "Tikuv", icon: <Scissors size={32} />, status: "Active" },
  { id: 5, name: "Antidron", icon: <Plane size={32} />, status: "Completed" },
];

export default function InventoryPage() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/departments")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const mergedData = data.map(dbDept => {
             const mockMatch = defaultDepartments.find(d => d.id === dbDept.id);
             return {
               ...dbDept,
               icon: mockMatch?.icon || <Package size={32} />,
               status: mockMatch?.status || "Active",
             };
          });
          setDepartments(mergedData);
        } else {
          setDepartments(defaultDepartments);
        }
      })
      .catch((err) => {
        console.warn("Backend not connected yet, using local data.", err);
        setDepartments(defaultDepartments);
      });
  }, []);

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Omborxona Bo'limlari
        </h1>
        <p className="mt-2 text-slate-600">
          Kerakli bo'limni tanlang va o'sha bo'limga tegishli barcha xom-ashyo va mahsulotlar ro'yxatini ko'ring.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <Link key={dept.id} href={`/inventory/${dept.id}`}>
            <div className="group bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300 h-full flex flex-col justify-between cursor-pointer">
              <div>
                <div className="text-blue-600 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  {dept.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{dept.name} omborxonasi</h3>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-slate-400 font-medium">Mahsulotlarni ko'rish</span>
                <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
