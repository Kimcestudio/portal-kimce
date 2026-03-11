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

  const weeklyMinutes = records
    .filter((record) => record.date >= weekStart)
    .reduce((sum, record) => sum + record.totalMinutes, 0);

  const historicMinutes = records.reduce((sum, record) => sum + record.totalMinutes, 0);

  const userName = user?.displayName ?? user?.email ?? "Colaborador";

  return (
    <div className="flex flex-col gap-4">
      <WelcomeHeader
        userName={userName}
        weeklyMinutes={weeklyMinutes}
        historicMinutes={historicMinutes}
        formatMinutes={minutesToHHMM}
      />

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <TeamCard members={homeTeamMembers} />
          <NewEmployeesCard items={homeNewEmployees} />
          <EventsCard items={homeEvents} />
        </div>

        <div className="space-y-4 xl:col-span-4">
          <CelebrationsCard items={homeCelebrations} />
          <ActionsCard items={homeQuickActions} />
          <RequestsCard items={homeRequests} />
        </div>
      </section>
    </div>
  );
}
