import { AlertTriangle, TrendingUp } from "lucide-react";
import PrimaryMetricCard from "@/components/attendance/PrimaryMetricCard";
import Badge from "@/components/ui/Badge";
import { minutesToHHMM } from "@/lib/attendanceUtils";

interface WeeklySummaryMiniCardsProps {
  workedMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  completedDays: number;
  expectedWorkDays?: number;
  totalBalanceMinutes: number;
}

export default function WeeklySummaryMiniCards({
  workedMinutes,
  expectedMinutes,
  diffMinutes,
  completedDays,
  expectedWorkDays = 5,
  totalBalanceMinutes,
}: WeeklySummaryMiniCardsProps) {
  const progress = expectedMinutes === 0 ? 0 : Math.min(100, (workedMinutes / expectedMinutes) * 100);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <PrimaryMetricCard
        title="Horas semana"
        value={minutesToHHMM(workedMinutes)}
        target={minutesToHHMM(expectedMinutes)}
        progress={progress}
        pill={`${Math.round(progress)}%`}
      />

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs text-muted">Balance semanal</p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {diffMinutes < 0 ? "Debes" : "A favor"} {minutesToHHMM(Math.abs(diffMinutes))}
        </p>
        <div className="mt-3">
          <Badge
            tone={diffMinutes < 0 ? "warning" : "success"}
            label={diffMinutes < 0 ? "Pendiente" : "A favor"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs text-muted">Días completados</p>
        <p className="mt-1 text-lg font-semibold text-ink">{completedDays}/{expectedWorkDays}</p>
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: expectedWorkDays }).map((_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${index < completedDays ? "bg-primary" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs text-muted">Balance total</p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {totalBalanceMinutes < 0 ? "Debes" : "A favor"} {minutesToHHMM(Math.abs(totalBalanceMinutes))}
        </p>
        <div className="mt-3">
          <Badge
            tone={totalBalanceMinutes < 0 ? "danger" : "success"}
            label="Acumulado histórico"
          />
        </div>
        <p className="mt-1 text-[10px] text-muted">Excluye el turno abierto de hoy</p>
      </div>
    </div>
  );
}
