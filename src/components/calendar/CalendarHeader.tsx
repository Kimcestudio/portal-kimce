import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ViewMode = "month" | "week";

interface CalendarHeaderProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  subtitle?: string;
  actions?: ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function CalendarHeader({
  label,
  onPrev,
  onNext,
  onToday,
  subtitle,
  actions,
  viewMode = "month",
  onViewModeChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Calendario</h1>
        <p className="text-sm text-muted">
          {subtitle ?? "Feriados, eventos internos y ausencias aprobadas."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}

        {/* View toggle */}
        {onViewModeChange && (
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onViewModeChange("month")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === "month"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("week")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === "week"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Semana
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label={viewMode === "week" ? "Semana anterior" : "Mes anterior"}
          onClick={onPrev}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          Hoy
        </button>
        <div className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-soft border border-slate-200/80">
          {label}
        </div>
        <button
          type="button"
          aria-label={viewMode === "week" ? "Semana siguiente" : "Mes siguiente"}
          onClick={onNext}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
