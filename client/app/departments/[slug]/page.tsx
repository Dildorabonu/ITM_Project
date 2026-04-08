"use client";

import { useParams } from "next/navigation";

export default function DepartmentPage() {

  const params = useParams();
  const slug = params.slug;

  return (
    <div className="space-y-8 page-transition">

      <div>
        <h1 className="text-3xl font-bold capitalize">
          {slug} Department
        </h1>

        <p className="text-slate-500">
          Department monitoring dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-semibold">Tasks Today</h3>
          <p className="text-3xl font-bold mt-2">12</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-semibold">Completed</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">8</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-semibold">Delayed</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">2</p>
        </div>

      </div>

    </div>
  );
}