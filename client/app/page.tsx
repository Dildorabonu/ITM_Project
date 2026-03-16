"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
// Ikonkalar uchun lucide-react kutubxonasidan foydalanishni tavsiya qilaman
// npm install lucide-react
import { Settings, Shield, Eye, Scissors, Plane } from "lucide-react";

interface Department {
  id: number;
  name: string;
  icon: React.ReactNode;
  status: "Active" | "Delayed" | "Completed";
}

// Static ma'lumotlar (Backend tayyor bo'lguncha mock data sifatida)
const defaultDepartments: Department[] = [
  { id: 1, name: "Mexanika", icon: <Settings size={32} />, status: "Active" },
  { id: 2, name: "Himoya", icon: <Shield size={32} />, status: "Active" },
  { id: 3, name: "Optika", icon: <Eye size={32} />, status: "Delayed" },
  { id: 4, name: "Tikuv", icon: <Scissors size={32} />, status: "Active" },
  { id: 5, name: "Antidron", icon: <Plane size={32} />, status: "Completed" },
];

export default function Home() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/departments")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          // Vaqtincha: Backend ikonka va status qaytarmagani uchun mock data bilan birlashtiramiz yoki backend ma'lumotlariga default qiymatlar qoshamiz.
          const mergedData = data.map(dbDept => {
             const mockMatch = defaultDepartments.find(d => d.id === dbDept.id);
             return {
               ...dbDept,
               icon: mockMatch?.icon || <Settings size={32} />,
               status: mockMatch?.status || "Active"
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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            ITM Ishlab chiqarishni monitoring qilish tizimi
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            {/* Barcha bo'limlar bo'ylab ishlab chiqarish ko'rsatkichlari, inventar va KPI'larni real vaqt rejimida kuzatish. */}
          </p>
        </header>

        {/* Statistics Overview (Bosh sahifada qo'shimcha ma'lumot) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg">
            <h3 className="text-sm font-medium opacity-80 uppercase">Umumiy jarayon</h3>
            <p className="text-3xl font-bold mt-1">78%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Faol vazifalar</h3>
            <p className="text-3xl font-bold mt-1 text-slate-800">24</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Kutilayotgan hisobotlar</h3>
            <p className="text-3xl font-bold mt-1 text-red-500">3</p>
          </div>
        </section>

        {/* Departments Grid */}
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Ishlab chiqarish bo'limlari</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {departments.map((dept) => (
            <Link key={dept.id} href={`/departments/${dept.id}`}>
              <div className="group bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300 h-full flex flex-col justify-between">
                <div>
                  <div className="text-blue-600 mb-4 group-hover:scale-110 transition-transform duration-300">
                    {dept.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">{dept.name}</h3>
                </div>
                
                <div className="flex items-center justify-between mt-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    dept.status === 'Active' ? 'bg-green-100 text-green-700' : 
                    dept.status === 'Delayed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {dept.status === 'Active' ? 'Faol' : dept.status === 'Delayed' ? 'Kechikkan' : 'Tugallangan'}
                  </span>
                  <span className="text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
                    Batafsil →
                  </span>
                </div>
              </div>
            </Link>
          ))}
          
          {/* Yangi bo'lim qo'shish */}
          <div className="group bg-blue-50/50 p-8 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 h-full flex flex-col justify-center items-center cursor-pointer text-center min-h-[250px]">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">Yangi bo'lim</h3>
            <p className="text-slate-500 text-sm">Tizimga yangi bo'lim qo'shish</p>
          </div>

        </div>
      </div>
    </main>
  );
}