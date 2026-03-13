"use client";

import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
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
import { listUsers } from "@/services/firebase/db";
import {
  homeEvents,
  homeRequests,
  homeTeamMembers,
  homeQuickActions,
  homeNewEmployees,
  type HomeCelebration,
} from "@/lib/homeDashboardMocks";
import { db } from "@/services/firebase/client";
import type { UserProfile } from "@/services/firebase/types";

function parseISODate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatLabel(date: Date) {
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function getYearsSince(date: Date) {
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  const dayDiff = now.getDate() - date.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  return years;
}

function getNextOccurrenceDistance(month: number, day: number) {
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month, day);
  if (target < current) target = new Date(now.getFullYear() + 1, month, day);
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<UserProfile[]>(() => listUsers());
  const records = user ? listAllRecords(user.uid) : [];

  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "",
            displayName: data.displayName ?? "Usuario",
            photoURL: data.photoURL ?? "",
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: data.position ?? "",
            active: data.active ?? data.isActive ?? true,
            workScheduleId: data.workScheduleId,
            birthDate: data.birthDate ?? "",
            employmentStartDate: data.employmentStartDate ?? "",
          } as UserProfile;
        });
        setPeople(next);
      },
      () => undefined,
    );
    return () => unsubscribe();
  }, []);

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

  const dynamicCelebrations = useMemo<HomeCelebration[]>(() => {
    const events: Array<HomeCelebration & { sortDistance: number }> = [];

    people.forEach((person) => {
      const birthday = parseISODate(person.birthDate);
      if (birthday) {
        const month = birthday.getMonth();
        const day = birthday.getDate();
        const distance = getNextOccurrenceDistance(month, day);
        events.push({
          id: `birthday-${person.uid}`,
          name: person.displayName,
          photoURL: person.photoURL,
          type: "birthday",
          dateLabel: formatLabel(new Date(new Date().getFullYear(), month, day)),
          hint: "Cumpleaños",
          sortDistance: distance,
        });
      }

      const startDate = parseISODate(person.employmentStartDate);
      if (startDate) {
        const month = startDate.getMonth();
        const day = startDate.getDate();
        const distance = getNextOccurrenceDistance(month, day);
        const years = Math.max(getYearsSince(startDate), 0);
        events.push({
          id: `anniversary-${person.uid}`,
          name: person.displayName,
          photoURL: person.photoURL,
          type: "anniversary",
          dateLabel: formatLabel(new Date(new Date().getFullYear(), month, day)),
          hint: years > 0 ? `${years} año${years > 1 ? "s" : ""}` : "Aniversario laboral",
          sortDistance: distance,
        });
      }
    });

    return events.sort((a, b) => a.sortDistance - b.sortDistance).slice(0, 12).map(({ sortDistance, ...item }) => item);
  }, [people]);

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
          <CelebrationsCard items={dynamicCelebrations} />
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
