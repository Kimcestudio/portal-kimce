import { Clock } from "lucide-react";
import AppShell from "@/components/AppShell";
import SidebarNav from "@/components/SidebarNav";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import LineChartCard from "@/components/LineChartCard";
import SchedulePanel from "@/components/SchedulePanel";
import TreatmentPhasesCard from "@/components/TreatmentPhasesCard";
import {
  appointments,
  dailyVisits,
  dateChips,
  metrics,
  timeSlots,
  treatmentPhases,
} from "@/lib/mockData";

export default function DashboardPage() {
  const rightPanel = (
    <div className="h-full rounded-2xl bg-white px-4 py-6 shadow-soft">
      <SchedulePanel
        dates={dateChips}
        slots={timeSlots}
        appointments={appointments}
      />
    </div>
  );

  return (
    <AppShell sidebar={<SidebarNav />} rightPanel={rightPanel}>
      <div className="flex flex-col gap-6">
        <PageHeader
          userName="Alondra"
          rightSlot={
            <div className="flex items-center gap-2 text-sm text-muted">
              <Clock size={16} />
              <span>Your today’s shift:</span>
              <span className="font-semibold text-primary">8:00 am - 4:00 pm</span>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Visits today"
            value={`${metrics.visitsToday.value}`}
            subtitle={`/ ${metrics.visitsToday.max} today`}
            progress={metrics.visitsToday.progress}
            badge={`${metrics.visitsToday.progress}%`}
            variant="primary"
          />
          <MetricCard
            title="Visits per month"
            value={`${metrics.visitsMonth.value}`}
            subtitle={`/ ${metrics.visitsMonth.max} in July`}
            progress={metrics.visitsMonth.progress}
            badge={`${metrics.visitsMonth.progress}%`}
          />
          <MetricCard
            title="Net Promoter SC"
            value={`~${metrics.nps.value}%`}
            subtitle="in July"
            progress={metrics.nps.progress}
          />
        </div>

        <LineChartCard data={dailyVisits} />

        <TreatmentPhasesCard phases={treatmentPhases} />

        <div className="xl:hidden">
          <div className="rounded-2xl bg-white px-4 py-6 shadow-soft">
            <SchedulePanel
              dates={dateChips}
              slots={timeSlots}
              appointments={appointments}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
