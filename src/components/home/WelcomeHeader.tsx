import { BarChart3, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

interface WelcomeHeaderProps {
  userName: string;
  weeklyMinutes: number;
  historicMinutes: number;
  monthlyMinutes: number;
  completedShifts: number;
  formatMinutes: (minutes: number) => string;
}

export default function WelcomeHeader({
  userName,
  weeklyMinutes,
  historicMinutes,
  monthlyMinutes,
  completedShifts,
  formatMinutes,
}: WelcomeHeaderProps) {
  const weeklyTargetMinutes = 2400;
  const weeklyProgress = Math.min(100, Math.round((weeklyMinutes / weeklyTargetMinutes) * 100));

  return (
    <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6 shadow-[0_16px_34px_rgba(79,70,229,0.14)]">
      <h1 className="text-3xl font-semibold text-indigo-950">¡Hola, {userName}!</h1>
      <p className="mt-1 text-sm text-slate-600">Bienvenido a tu panel de Inicio. Revisa tus métricas y actividad del equipo.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-indigo-100 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <Clock3 className="h-4 w-4" />
            <p className="text-xs font-semibold">Horas semanales</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">{formatMinutes(weeklyMinutes)}</p>
        </article>

        <article className="rounded-xl border border-violet-100 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-violet-600">
            <BarChart3 className="h-4 w-4" />
            <p className="text-xs font-semibold">Horas históricas</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-violet-700">{formatMinutes(historicMinutes)}</p>
        </article>

        <article className="rounded-xl border border-cyan-100 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-cyan-700">
            <CalendarClock className="h-4 w-4" />
            <p className="text-xs font-semibold">Horas del mes</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-cyan-700">{formatMinutes(monthlyMinutes)}</p>
        </article>

        <article className="rounded-xl border border-emerald-100 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-semibold">Jornadas completadas</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{completedShifts}</p>
        </article>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-100 bg-white/80 p-3">
        <div className="flex items-center justify-between text-xs font-medium text-indigo-700">
          <span>Progreso semanal de horas</span>
          <span>{weeklyProgress}% · Objetivo 40:00</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${weeklyProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
