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

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Horas semana</p>
        <p className="text-lg font-semibold text-ink">
          {minutesToHHMM(workedMinutes)} / {minutesToHHMM(expectedMinutes)}
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Balance</p>
        <p className="text-lg font-semibold text-ink">
          {balanceLabel} {balanceValue}
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Días completados</p>
        <p className="text-lg font-semibold text-ink">{completedDays}/6</p>
      </div>
    </div>
  );
}
