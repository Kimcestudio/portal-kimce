import { BarChart3, CheckCheck, Megaphone, PlusCircle, UserPlus } from "lucide-react";
import DashboardCard from "@/components/home/DashboardCard";
import type { HomeAction } from "@/lib/homeDashboardMocks";

interface ActionsCardProps {
  items: HomeAction[];
}

const iconByIndex = [UserPlus, CheckCheck, BarChart3, Megaphone, PlusCircle];

export default function ActionsCard({ items }: ActionsCardProps) {
  return (
    <DashboardCard title="Acciones" subtitle="Accesos rápidos del sistema">
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay acciones configuradas.</p>
        ) : (
          items.map((item, index) => {
            const Icon = iconByIndex[index % iconByIndex.length];
            return (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </DashboardCard>
  );
}
