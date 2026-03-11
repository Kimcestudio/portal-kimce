"use client";

import TeamCard from "@/components/home/TeamCard";
import EventsCard from "@/components/home/EventsCard";
import ActionsCard from "@/components/home/ActionsCard";
import RequestsCard from "@/components/home/RequestsCard";
import WelcomeHeader from "@/components/home/WelcomeHeader";
import NewEmployeesCard from "@/components/home/NewEmployeesCard";
import CelebrationsCard from "@/components/home/CelebrationsCard";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatISODate, getWeekStartMonday, minutesToHHMM } from "@/lib/attendanceUtils";
import { listAllRecords } from "@/lib/storage/attendanceStorage";
import {
  homeEvents,
  homeRequests,
  homeTeamMembers,
  homeCelebrations,
  homeQuickActions,
  homeNewEmployees,
} from "@/lib/homeDashboardMocks";

export default function DashboardPage() {
  const { user } = useAuth();
  const records = user ? listAllRecords(user.uid) : [];

  const weekStart = formatISODate(getWeekStartMonday(new Date()));
  const monthStart = formatISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const weeklyMinutes = records
    .filter((record) => record.date >= weekStart)
    .reduce((sum, record) => sum + record.totalMinutes, 0);

  const monthlyMinutes = records
    .filter((record) => record.date >= monthStart)
    .reduce((sum, record) => sum + record.totalMinutes, 0);

  const historicMinutes = records.reduce((sum, record) => sum + record.totalMinutes, 0);
  const completedShifts = records.filter((record) => record.status === "CLOSED").length;

  const userName = user?.displayName ?? user?.email ?? "Colaborador";

  return (
    <div className="flex flex-col gap-5">
      <WelcomeHeader
        userName={userName}
        weeklyMinutes={weeklyMinutes}
        historicMinutes={historicMinutes}
        monthlyMinutes={monthlyMinutes}
        completedShifts={completedShifts}
        formatMinutes={minutesToHHMM}
      />

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <TeamCard members={homeTeamMembers} />
        </div>
        <div className="xl:col-span-3">
          <CelebrationsCard items={homeCelebrations} />
        </div>
        <div className="xl:col-span-3">
          <ActionsCard items={homeQuickActions} />
        </div>

        <div className="xl:col-span-7">
          <NewEmployeesCard items={homeNewEmployees} />
        </div>
        <div className="xl:col-span-5">
          <RequestsCard items={homeRequests} />
        </div>

        <div className="xl:col-span-8">
          <EventsCard items={homeEvents} />
        </div>
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-[0_10px_28px_rgba(79,70,229,0.08)]">
            <h3 className="text-lg font-semibold text-slate-900">KPIs de horarios</h3>
            <p className="text-xs text-slate-500">Métricas ampliadas para monitoreo rápido.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-100/70 p-3">
                <p className="text-xs text-indigo-700">Semana</p>
                <p className="text-xl font-semibold text-indigo-900">{minutesToHHMM(weeklyMinutes)}</p>
              </div>
              <div className="rounded-xl bg-violet-100/70 p-3">
                <p className="text-xs text-violet-700">Mes</p>
                <p className="text-xl font-semibold text-violet-900">{minutesToHHMM(monthlyMinutes)}</p>
              </div>
              <div className="rounded-xl bg-cyan-100/70 p-3">
                <p className="text-xs text-cyan-700">Histórico</p>
                <p className="text-xl font-semibold text-cyan-900">{minutesToHHMM(historicMinutes)}</p>
              </div>
              <div className="rounded-xl bg-emerald-100/70 p-3">
                <p className="text-xs text-emerald-700">Jornadas cerradas</p>
                <p className="text-xl font-semibold text-emerald-900">{completedShifts}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
