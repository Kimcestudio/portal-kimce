import WeeklyProgressChart from "@/components/attendance/WeeklyProgressChart";
import WeeklySummaryMiniCards from "@/components/attendance/WeeklySummaryMiniCards";

interface CollaboratorDashboardProps {
  collaboratorName: string;
  workedMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  completedDays: number;
  totalBalanceMinutes: number;
  chartData: { label: string; hours: number; target: number }[];
}

export default function CollaboratorDashboard({
  collaboratorName,
  workedMinutes,
  expectedMinutes,
  diffMinutes,
  completedDays,
  totalBalanceMinutes,
  chartData,
}: CollaboratorDashboardProps) {
  return (
    <div className="mt-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Dashboard del colaborador</h3>
        <p className="text-xs text-slate-500">Resumen semanal y acumulado de {collaboratorName}.</p>
      </div>

      <WeeklySummaryMiniCards
        workedMinutes={workedMinutes}
        expectedMinutes={expectedMinutes}
        diffMinutes={diffMinutes}
        completedDays={completedDays}
        totalBalanceMinutes={totalBalanceMinutes}
      />

      <WeeklyProgressChart
        data={chartData}
        totalMinutes={workedMinutes}
        expectedMinutes={expectedMinutes}
        diffMinutes={diffMinutes}
        completedDays={completedDays}
      />
    </div>
  );
}
