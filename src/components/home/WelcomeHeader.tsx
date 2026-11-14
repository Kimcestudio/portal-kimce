import { BarChart3, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

interface WelcomeHeaderProps {
  userName: string;
  weeklyMinutes: number;
  weeklyTargetMinutes: number;
  historicMinutes: number;
  monthlyMinutes: number;
  completedShifts: number;
  formatMinutes: (minutes: number) => string;
}

export default function WelcomeHeader({
  userName,
  weeklyMinutes,
  weeklyTargetMinutes,
  historicMinutes,
  monthlyMinutes,
  completedShifts,
  formatMinutes,
}: WelcomeHeaderProps) {
  const hasWeeklyTarget = weeklyTargetMinutes > 0;
  const weeklyProgress = hasWeeklyTarget
    ? Math.min(100, Math.round((weeklyMinutes / weeklyTargetMinutes) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-canvas to-white p-6 shadow-card">
      <h1 className="text-3xl font-semibold text-ink">Hola, {userName}</h1>
      <p className="mt-1 text-sm text-muted">Bienvenido a tu panel de Inicio. Revisa tus métricas y actividad del equipo.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-primary">
            <Clock3 className="h-4 w-4" />
            <p className="text-xs font-semibold text-muted">Horas semanales</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMinutes(weeklyMinutes)}</p>
        </article>

        <article className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="h-4 w-4" />
            <p className="text-xs font-semibold text-muted">Horas históricas</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMinutes(historicMinutes)}</p>
        </article>

        <article className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-primary">
            <CalendarClock className="h-4 w-4" />
            <p className="text-xs font-semibold text-muted">Horas del mes</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMinutes(monthlyMinutes)}</p>
        </article>

        <article className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-semibold text-muted">Jornadas completadas</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-ink">{completedShifts}</p>
        </article>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>Progreso semanal de horas</span>
          <span className="text-primary">
            {hasWeeklyTarget
              ? `${weeklyProgress}% · Objetivo ${formatMinutes(weeklyTargetMinutes)}`
              : "Objetivo 00:00"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${weeklyProgress}%` }} />
        </div>
        {!hasWeeklyTarget ? (
          <p className="mt-2 text-[11px] font-medium text-muted">
            El objetivo empezará a contarse desde tu primer fichaje.
          </p>
        ) : null}
      </div>
    </div>
  );
}
