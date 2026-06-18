"use client";

import Link from "next/link";

type AdminAttendanceMonitorTabsProps = {
  current: "hours" | "requests" | "alerts";
  week: string;
  selectedUserId?: string | null;
};

const buildHref = (path: string, week: string, selectedUserId?: string | null) => {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  if (selectedUserId && selectedUserId !== "all") params.set("user", selectedUserId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export default function AdminAttendanceMonitorTabs({
  current,
  week,
  selectedUserId,
}: AdminAttendanceMonitorTabsProps) {
  const tabs = [
    {
      key: "hours" as const,
      label: "Asistencia",
      description: "Horas, fichajes y alertas semanales.",
      href: buildHref("/admin/hours", week, selectedUserId),
    },
    {
      key: "requests" as const,
      label: "Solicitudes",
      description: "Permisos, extras y aprobaciones.",
      href: buildHref("/admin/requests", week, selectedUserId),
    },
    {
      key: "alerts" as const,
      label: "Alertas",
      description: "Riesgos semanales y seguimiento rápido.",
      href: buildHref("/admin/attendance", week, selectedUserId),
    },
  ];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Centro de supervisión semanal</h2>
          <p className="text-xs text-slate-500">
            Monitorea asistencia y solicitudes con el mismo corte semanal y el mismo colaborador filtrado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
            Semana {week}
          </span>
          {selectedUserId && selectedUserId !== "all" ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
              Colaborador filtrado
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`min-w-[220px] rounded-2xl border px-4 py-3 transition ${
                active
                  ? "border-indigo-200 bg-indigo-50 shadow-[0_12px_24px_rgba(79,70,229,0.14)]"
                  : "border-slate-200 bg-slate-50/70 hover:-translate-y-0.5 hover:bg-white"
              }`}
            >
              <p className={`text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-900"}`}>{tab.label}</p>
              <p className="mt-1 text-xs text-slate-500">{tab.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
