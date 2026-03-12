"use client";

import { useMemo, useState } from "react";
import UserAvatar from "@/components/common/UserAvatar";
import DashboardCard from "@/components/home/DashboardCard";
import type { HomeRequest } from "@/lib/homeDashboardMocks";

interface RequestsCardProps {
  items: HomeRequest[];
}

const periods: HomeRequest["period"][] = ["Este mes", "2025"];

const statusTone: Record<HomeRequest["status"], string> = {
  Pendiente: "bg-amber-100 text-amber-700",
  Aprobada: "bg-emerald-100 text-emerald-700",
  Observada: "bg-rose-100 text-rose-700",
};

export default function RequestsCard({ items }: RequestsCardProps) {
  const [period, setPeriod] = useState<HomeRequest["period"]>("Este mes");
  const filtered = useMemo(() => items.filter((item) => item.period === period), [items, period]);

  return (
    <DashboardCard title={`Solicitudes (${filtered.length})`} subtitle="Solicitudes recientes y pendientes">
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
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay solicitudes para este filtro.</p>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <div className="flex items-center gap-2">
                <UserAvatar name={item.name} photoURL={item.photoURL} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.type}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[item.status]}`}>{item.status}</span>
            </article>
          ))
        )}
      </div>
    </DashboardCard>
  );
}
