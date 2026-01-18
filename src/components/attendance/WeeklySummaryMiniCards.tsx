import { AlertTriangle, TrendingUp } from "lucide-react";
import PrimaryMetricCard from "@/components/attendance/PrimaryMetricCard";
import { minutesToHHMM } from "@/lib/attendanceUtils";

interface WeeklySummaryMiniCardsProps {
  workedMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  completedDays: number;
  totalBalanceMinutes: number;
}

export default function WeeklySummaryMiniCards({
  workedMinutes,
  expectedMinutes,
  diffMinutes,
  completedDays,
  totalBalanceMinutes,
}: WeeklySummaryMiniCardsProps) {
  const balanceLabel = diffMinutes < 0 ? "Debes" : "A favor";
  const balanceValue = minutesToHHMM(Math.abs(diffMinutes));
  const progress = expectedMinutes === 0 ? 0 : Math.min(100, (workedMinutes / expectedMinutes) * 100);
  const BalanceIcon = diffMinutes < 0 ? AlertTriangle : TrendingUp;
  const balanceStyle = diffMinutes < 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  const totalBalanceLabel = totalBalanceMinutes < 0 ? "Debes" : "A favor";
  const totalBalanceValue = minutesToHHMM(Math.abs(totalBalanceMinutes));
  const totalBalanceStyle = totalBalanceMinutes < 0 ? "bg-rose-100 text-rose-700" : "bg-green-100 text-green-700";

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <PrimaryMetricCard
        title="Horas semana"
        value={minutesToHHMM(workedMinutes)}
        target={minutesToHHMM(expectedMinutes)}
        progress={progress}
        pill={`${Math.round(progress)}%`}
      />
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Balance</p>
        <p className="text-lg font-semibold text-ink">
          {balanceLabel} {balanceValue}
        </p>
        <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${balanceStyle}`}>
          <BalanceIcon size={12} />
          {diffMinutes >= 0 ? "A favor" : "Pendiente"}
        </span>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Días completados</p>
        <p className="text-lg font-semibold text-ink">{completedDays}/6</p>
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${
                index < completedDays ? "bg-[#22c55e]" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-xs text-muted">Balance total</p>
        <p className="text-lg font-semibold text-ink">
          {totalBalanceLabel} {totalBalanceValue}
        </p>
        <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${totalBalanceStyle}`}>
          Acumulado histórico
        </span>
      </div>
    </div>
  );
}
