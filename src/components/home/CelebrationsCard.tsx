"use client";

import { useMemo, useState } from "react";
import { Cake, PartyPopper } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";
import DashboardCard from "@/components/home/DashboardCard";
import type { CelebrationType, HomeCelebration } from "@/lib/homeDashboardMocks";

interface CelebrationsCardProps {
  items: HomeCelebration[];
}

const tabs: Array<{ label: string; value: CelebrationType | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Cumpleaños", value: "birthday" },
  { label: "Aniversarios", value: "anniversary" },
];

export default function CelebrationsCard({ items }: CelebrationsCardProps) {
  const [activeTab, setActiveTab] = useState<CelebrationType | "all">("all");
  const filtered = useMemo(
    () => items.filter((item) => activeTab === "all" || item.type === activeTab),
    [items, activeTab],
  );

  return (
    <DashboardCard title="Celebraciones" subtitle="Fechas importantes del equipo">
      <div className="mb-3 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${activeTab === tab.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Sin celebraciones para este filtro.</p>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="flex items-center justify-between rounded-xl border border-indigo-100 p-3 transition hover:bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <UserAvatar name={item.name} photoURL={item.photoURL} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {item.type === "birthday" ? <Cake className="h-4 w-4 text-fuchsia-500" /> : <PartyPopper className="h-4 w-4 text-indigo-500" />}
                <span>{item.dateLabel}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </DashboardCard>
  );
}
