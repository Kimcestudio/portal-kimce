"use client";

import { useMemo, useState } from "react";
import UserAvatar from "@/components/common/UserAvatar";
import DashboardCard from "@/components/home/DashboardCard";
import type { HomeNewEmployee } from "@/lib/homeDashboardMocks";

interface NewEmployeesCardProps {
  items: HomeNewEmployee[];
}

const periods: HomeNewEmployee["period"][] = ["Este mes", "2025"];

export default function NewEmployeesCard({ items }: NewEmployeesCardProps) {
  const [period, setPeriod] = useState<HomeNewEmployee["period"]>("Este mes");
  const filtered = useMemo(() => items.filter((item) => item.period === period), [items, period]);

  return (
    <DashboardCard title={`Nuevos empleados (${filtered.length})`} subtitle="Ingresos recientes" className="lg:col-span-2">
      <div className="mb-3 flex gap-2">
        {periods.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPeriod(item)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${period === item ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay ingresos en este período.</p>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="flex items-center justify-between rounded-xl border border-indigo-100 p-3">
              <div className="flex items-center gap-2">
                <UserAvatar name={item.name} photoURL={item.photoURL} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{item.startDate}</p>
                <p>{item.elapsedDays} días</p>
              </div>
            </article>
          ))
        )}
      </div>
    </DashboardCard>
  );
}
