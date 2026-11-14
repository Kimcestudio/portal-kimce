"use client";

import type { LucideIcon } from "lucide-react";

type WorkspaceMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "indigo" | "amber" | "emerald" | "rose";
  helper?: string;
  icon?: LucideIcon;
};

const toneClasses: Record<NonNullable<WorkspaceMetric["tone"]>, string> = {
  neutral: "border-slate-200/70 bg-slate-50/70 text-slate-900",
  indigo: "border-indigo-200/70 bg-indigo-50/80 text-indigo-950",
  amber: "border-amber-200/70 bg-amber-50/80 text-amber-950",
  emerald: "border-emerald-200/70 bg-emerald-50/80 text-emerald-950",
  rose: "border-rose-200/70 bg-rose-50/80 text-rose-950",
};

type AdminAttendanceWorkspaceHeaderProps = {
  title?: string;
  subtitle?: string;
  contextLabel?: string;
  metrics: WorkspaceMetric[];
};

export default function AdminAttendanceWorkspaceHeader({
  title,
  subtitle,
  contextLabel,
  metrics,
}: AdminAttendanceWorkspaceHeaderProps) {
  const hasHeader = title || subtitle || contextLabel;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(17,24,39,0.07)]">
      {hasHeader ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title ? <h2 className="text-sm font-semibold text-slate-700">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {contextLabel ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              {contextLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className={`rounded-2xl border px-4 py-4 ${toneClasses[metric.tone ?? "neutral"]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/60">
                  {metric.label}
                </p>
                {Icon ? <Icon size={16} className="shrink-0 opacity-40" /> : null}
              </div>
              <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
              {metric.helper ? (
                <p className="mt-1 text-xs text-current/60">{metric.helper}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
