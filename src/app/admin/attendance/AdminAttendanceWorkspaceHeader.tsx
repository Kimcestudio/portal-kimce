"use client";

type WorkspaceMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "indigo" | "amber" | "emerald" | "rose";
  helper?: string;
};

const toneClasses: Record<NonNullable<WorkspaceMetric["tone"]>, string> = {
  neutral: "border-slate-200/70 bg-slate-50/70 text-slate-900",
  indigo: "border-indigo-200/70 bg-indigo-50/80 text-indigo-950",
  amber: "border-amber-200/70 bg-amber-50/80 text-amber-950",
  emerald: "border-emerald-200/70 bg-emerald-50/80 text-emerald-950",
  rose: "border-rose-200/70 bg-rose-50/80 text-rose-950",
};

type AdminAttendanceWorkspaceHeaderProps = {
  title: string;
  subtitle: string;
  contextLabel: string;
  metrics: WorkspaceMetric[];
};

export default function AdminAttendanceWorkspaceHeader({
  title,
  subtitle,
  contextLabel,
  metrics,
}: AdminAttendanceWorkspaceHeaderProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Supervisión semanal
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {contextLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`rounded-2xl border px-4 py-4 ${toneClasses[metric.tone ?? "neutral"]}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/70">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            {metric.helper ? (
              <p className="mt-1 text-xs text-current/70">{metric.helper}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
