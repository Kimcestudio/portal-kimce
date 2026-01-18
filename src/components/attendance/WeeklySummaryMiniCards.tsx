import { minutesToHHMM } from "@/lib/attendanceUtils";

interface WeeklySummaryMiniCardsProps {
  workedMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  completedDays: number;
}

export default function WeeklySummaryMiniCards({
  workedMinutes,
  expectedMinutes,
  diffMinutes,
  completedDays,
}: WeeklySummaryMiniCardsProps) {
  const balanceLabel = diffMinutes < 0 ? "Debes" : "A favor";
  const balanceValue = minutesToHHMM(Math.abs(diffMinutes));
  const progress = expectedMinutes === 0 ? 0 : Math.min(100, (workedMinutes / expectedMinutes) * 100);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Horas semana</p>
        <p className="text-lg font-semibold text-ink">
          {minutesToHHMM(workedMinutes)} / {minutesToHHMM(expectedMinutes)}
        </p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-line">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Balance</p>
        <p className="text-lg font-semibold text-ink">
          {balanceLabel} {balanceValue}
        </p>
        <span className="mt-3 inline-flex rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-semibold text-primary">
          {diffMinutes >= 0 ? "A favor" : "Pendiente"}
        </span>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Días completados</p>
        <p className="text-lg font-semibold text-ink">{completedDays}/6</p>
        <span className="mt-3 inline-flex rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-semibold text-[#15803d]">
          Objetivo semanal
        </span>
      </div>
    </div>
  );
}
