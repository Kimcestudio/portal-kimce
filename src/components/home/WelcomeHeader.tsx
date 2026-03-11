interface WelcomeHeaderProps {
  userName: string;
  weeklyMinutes: number;
  historicMinutes: number;
  formatMinutes: (minutes: number) => string;
}

export default function WelcomeHeader({ userName, weeklyMinutes, historicMinutes, formatMinutes }: WelcomeHeaderProps) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6 shadow-[0_12px_32px_rgba(79,70,229,0.12)]">
      <h1 className="text-3xl font-semibold text-indigo-950">¡Hola, {userName}!</h1>
      <p className="mt-1 text-sm text-slate-600">Bienvenido a tu panel de Inicio. Aquí tienes un vistazo rápido de tu equipo.</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-white/80 p-4">
          <p className="text-xs text-slate-500">Horas trabajadas (semana actual)</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">{formatMinutes(weeklyMinutes)}</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
          <p className="text-xs text-slate-500">Horas trabajadas (histórico)</p>
          <p className="mt-1 text-2xl font-semibold text-violet-700">{formatMinutes(historicMinutes)}</p>
        </div>
      </div>
    </div>
  );
}
