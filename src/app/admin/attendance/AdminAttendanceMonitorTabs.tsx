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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(17,24,39,0.05)]">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
          Semana {week}
        </span>
        {selectedUserId && selectedUserId !== "all" ? (
          <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-600">
            Colaborador filtrado
          </span>
        ) : null}
      </div>
    </div>
  );
}
