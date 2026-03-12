import { CalendarDays } from "lucide-react";
import DashboardCard from "@/components/home/DashboardCard";
import type { HomeEvent } from "@/lib/homeDashboardMocks";

interface EventsCardProps {
  items: HomeEvent[];
}

export default function EventsCard({ items }: EventsCardProps) {
  return (
    <DashboardCard title="Eventos" subtitle="Próximas actividades del calendario" className="lg:col-span-2">
      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay eventos próximos.</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-200 hover:bg-indigo-50/40">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-100 p-2 text-indigo-600">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.description ?? "Sin descripción"}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-600">{item.dateLabel}</p>
            </article>
          ))
        )}
      </div>
    </DashboardCard>
  );
}
