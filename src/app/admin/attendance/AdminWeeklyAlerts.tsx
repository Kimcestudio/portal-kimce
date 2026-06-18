"use client";

import Link from "next/link";
import type { AdminWeeklyAlert } from "@/lib/attendanceUtils";

type AdminWeeklyAlertsProps = {
  title: string;
  subtitle: string;
  alerts: AdminWeeklyAlert[];
  buildHref: (uid: string) => string;
};

export default function AdminWeeklyAlerts({
  title,
  subtitle,
  alerts,
  buildHref,
}: AdminWeeklyAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Sin alertas
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
          Esta semana no hay alertas que requieran revisión inmediata.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          {alerts.length} alerta(s)
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const tone =
            alert.level === "warning"
              ? "border-amber-200 bg-amber-50/70 text-amber-900"
              : "border-sky-200 bg-sky-50/70 text-sky-900";
          const badgeTone =
            alert.level === "warning"
              ? "bg-amber-100 text-amber-700"
              : "bg-sky-100 text-sky-700";

          return (
            <div key={alert.id} className={`rounded-2xl border px-4 py-4 ${tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeTone}`}>
                      {alert.level === "warning" ? "Atención" : "Info"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{alert.title}</p>
                  <p className="mt-1 text-xs opacity-80">{alert.description}</p>
                </div>
                <Link
                  href={buildHref(alert.uid)}
                  className="rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5"
                >
                  {alert.actionLabel ?? "Abrir"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
