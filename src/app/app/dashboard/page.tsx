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
import {
  buildAttendanceRecordsFromTimeEntries,
  formatISODate,
  getFirstRecordDateISO,
  getWeekDates,
  getWeekKey,
  getWeekStartMonday,
  expectedMinutesForDatesFromStart,
  minutesToHHMM,
  type AttendanceTimeEntryEvent,
} from "@/lib/attendanceUtils";
import {
  homeQuickActions,
  type HomeCelebration,
  type HomeEvent,
  type HomeNewEmployee,
  type HomeRequest,
  type HomeTeamMember,
} from "@/lib/homeDashboardMocks";
import { db } from "@/services/firebase/client";
import { connectGoogleCalendar } from "@/services/firebase/auth";
import { readStorage, writeStorage } from "@/services/firebase/storage";
import type { UserProfile } from "@/services/firebase/types";
import type { WorkSchedule } from "@/services/firebase/types";
import { DEFAULT_WORK_SCHEDULES, DEFAULT_WORK_SCHEDULE_ID } from "@/services/firebase/workSchedules";
import { subscribeCalendarEvents, type CalendarEventRecord } from "@/services/calendar";

type FirestoreTimestamp = { toDate?: () => Date };

type TimeRecord = {
  id: string;
  userId: string;
  date: string;
  totalMinutes: number;
  status: "OPEN" | "CLOSED";
};

type DashboardRequestItem = {
  id: string;
  uid: string;
  type: string;
  status: "Pendiente" | "Aprobada" | "Observada";
  createdAt: string;
};

type NewEmployeeCandidate = HomeNewEmployee & {
  sortTime: number;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

type GoogleCalendarErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type StoredCalendarState = {
  connected: boolean;
  status: string | null;
  events: HomeEvent[];
  email?: string;
  updatedAt?: string;
};

const CALENDAR_STORAGE_PREFIX = "dashboard_google_calendar";

function parseISODate(value?: string) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
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

function normalizeTimestamp(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as FirestoreTimestamp;
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
}

function getActiveFlag(person: UserProfile) {
  return person.active !== false && person.isActive !== false;
}

function getPrimaryRole(person: UserProfile) {
  return (person.area ?? person.position ?? "").trim() || "Sin asignar";
}

function mapRequestStatus(status: string | undefined): DashboardRequestItem["status"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "approved") return "Aprobada";
  if (normalized === "rejected") return "Observada";
  return "Pendiente";
}

function formatEventDateLabel(value: string) {
  const date = parseISODate(value);
  if (!date) return value;
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  });
}

function isRecentlyOnline(person: UserProfile) {
  if (person.onlineStatus !== "online" || !person.lastSeenAt) return false;
  const lastSeen = new Date(person.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return Date.now() - lastSeen <= 5 * 60 * 1000;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>(DEFAULT_WORK_SCHEDULES);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [approvedExtraActivities, setApprovedExtraActivities] = useState<{ uid: string; date: string; minutes: number }[]>([]);
  const [requestItems, setRequestItems] = useState<DashboardRequestItem[]>([]);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState<HomeEvent[]>([]);
  const [portalCalendarEvents, setPortalCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setGoogleCalendarEvents([]);
      setCalendarStatus(null);
      setCalendarConnected(false);
      return;
    }

    const stored = readStorage<StoredCalendarState | null>(`${CALENDAR_STORAGE_PREFIX}:${user.uid}`, null);
    if (!stored) {
      setGoogleCalendarEvents([]);
      setCalendarStatus(null);
      setCalendarConnected(false);
      return;
    }

    setGoogleCalendarEvents(stored.events ?? []);
    setCalendarStatus(stored.status ?? null);
    setCalendarConnected(Boolean(stored.connected));
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeCalendarEvents(setPortalCalendarEvents);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = collection(db, "userDirectory");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const firestoreUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "",
            displayName: data.displayName ?? "Usuario",
            photoURL: data.photoURL ?? "",
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: data.position ?? "",
            area: data.area ?? null,
            active: data.active ?? data.isActive ?? true,
            isActive: data.isActive ?? data.active ?? true,
            workScheduleId: data.workScheduleId,
            birthDate: data.birthDate ?? "",
            employmentStartDate: data.employmentStartDate ?? "",
            onlineStatus: data.onlineStatus,
            lastSeenAt: normalizeTimestamp(data.lastSeenAt) ?? data.lastSeenAt,
          } as UserProfile;
        });
        setPeople(firestoreUsers);
      },
      () => {
        setPeople([]);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const schedulesRef = collection(db, "workSchedules");
    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        if (snapshot.empty) {
          setWorkSchedules(DEFAULT_WORK_SCHEDULES);
          return;
        }

        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: (data.name as string) ?? "Jornada",
            weeklyMinutes:
              typeof data.weeklyMinutes === "number"
                ? data.weeklyMinutes
                : DEFAULT_WORK_SCHEDULES[0].weeklyMinutes,
            days: (data.days as WorkSchedule["days"]) ?? DEFAULT_WORK_SCHEDULES[0].days,
          } satisfies WorkSchedule;
        });

        setWorkSchedules(next.length > 0 ? next : DEFAULT_WORK_SCHEDULES);
      },
      () => setWorkSchedules(DEFAULT_WORK_SCHEDULES),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timeEntriesRef = collection(db, "timeEntries");
    const unsubscribe = onSnapshot(
      timeEntriesRef,
      (snapshot) => {
        const nextEvents = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = (data.uid ?? data.userId) as string | undefined;
            const ts = normalizeTimestamp(data.ts) ?? normalizeTimestamp(data.createdAt) ?? "";
            const dayKey =
              (typeof data.dayKey === "string" ? data.dayKey : "") || (ts ? ts.slice(0, 10) : "");

            if (!uid || !ts || !dayKey) return null;

            return {
              uid,
              dayKey,
              weekKey:
                typeof data.weekKey === "string" && data.weekKey.length > 0
                  ? data.weekKey
                  : getWeekKey(dayKey),
              type: typeof data.type === "string" ? data.type : "manual",
              ts,
              totalMinutes: typeof data.totalMinutes === "number" ? data.totalMinutes : undefined,
            } satisfies AttendanceTimeEntryEvent;
          })
          .filter(Boolean) as AttendanceTimeEntryEvent[];

        setTimeRecords(
          buildAttendanceRecordsFromTimeEntries(nextEvents).map((record) => ({
            id: record.id,
            userId: record.userId,
            date: record.date,
            totalMinutes: record.totalMinutes,
            status: record.status,
          })),
        );
      },
      () => setTimeRecords([]),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const extraActivitiesRef = collection(db, "extraActivities");
    const unsubscribe = onSnapshot(
      extraActivitiesRef,
      (snapshot) => {
        const approved: { uid: string; date: string; minutes: number }[] = [];
        const requests: DashboardRequestItem[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const uid = (data.uid ?? data.userId) as string | undefined;
          const createdAt = normalizeTimestamp(data.createdAt) ?? new Date().toISOString();
          const date =
            (typeof data.date === "string" ? data.date : "") || (createdAt ? createdAt.slice(0, 10) : "");
          const minutes =
            typeof data.minutes === "number"
              ? data.minutes
              : typeof data.hours === "number"
                ? Math.round(data.hours * 60)
                : 0;
          const status = typeof data.status === "string" ? data.status : "";

          if (uid && status.toLowerCase() === "approved" && date) {
            approved.push({ uid, date, minutes });
          }

          if (!uid) return;
          requests.push({
            id: `extra-${docSnap.id}`,
            uid,
            type: typeof data.type === "string" ? data.type : "Actividad extra",
            status: mapRequestStatus(status),
            createdAt,
          });
        });

        setApprovedExtraActivities(approved);
        setRequestItems((prev) => {
          const hourRequests = prev.filter((item) => item.id.startsWith("hour-"));
          return [...hourRequests, ...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
        });
      },
      () => undefined,
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const hourRequestsRef = collection(db, "hourRequests");
    const unsubscribe = onSnapshot(
      hourRequestsRef,
      (snapshot) => {
        const hourRequests: DashboardRequestItem[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = (data.uid ?? data.userId) as string | undefined;
            if (!uid) return null;

            return {
              id: `hour-${docSnap.id}`,
              uid,
              type: typeof data.type === "string" ? data.type : "Solicitud",
              status: mapRequestStatus(typeof data.status === "string" ? data.status : ""),
              createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
            } satisfies DashboardRequestItem;
          })
          .filter(Boolean) as DashboardRequestItem[];

        setRequestItems((prev) => {
          const extras = prev.filter((item) => item.id.startsWith("extra-"));
          return [...hourRequests, ...extras].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
        });
      },
      () => undefined,
    );

    return () => unsubscribe();
  }, []);

  const weekStart = formatISODate(getWeekStartMonday(new Date()));
  const monthStart = formatISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const weekDates = getWeekDates(getWeekStartMonday(new Date()));
  const weekDateSet = new Set(weekDates.map((date) => formatISODate(date)));
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth();
  const records = useMemo(() => {
    if (!user?.uid) return [];
    return timeRecords.filter((record) => record.userId === user.uid);
  }, [timeRecords, user?.uid]);
  const currentSchedule =
    workSchedules.find((schedule) => schedule.id === (user?.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID)) ??
    DEFAULT_WORK_SCHEDULES.find((schedule) => schedule.id === DEFAULT_WORK_SCHEDULE_ID) ??
    DEFAULT_WORK_SCHEDULES[0];

  const approvedExtraMinutesWeek = approvedExtraActivities.reduce((sum, item) => {
    if (item.uid !== user?.uid || !weekDateSet.has(item.date)) return sum;
    return sum + item.minutes;
  }, 0);
  const approvedExtraMinutesMonth = approvedExtraActivities.reduce((sum, item) => {
    if (item.uid !== user?.uid || item.date < monthStart) return sum;
    return sum + item.minutes;
  }, 0);
  const approvedExtraMinutesHistoric = approvedExtraActivities.reduce((sum, item) => {
    if (item.uid !== user?.uid) return sum;
    return sum + item.minutes;
  }, 0);

  const weeklyMinutes = records
    .filter((record) => record.date >= weekStart)
    .reduce((sum, record) => sum + record.totalMinutes, 0) + approvedExtraMinutesWeek;

  const monthlyMinutes = records
    .filter((record) => record.date >= monthStart)
    .reduce((sum, record) => sum + record.totalMinutes, 0) + approvedExtraMinutesMonth;

  const historicMinutes = records.reduce((sum, record) => sum + record.totalMinutes, 0) + approvedExtraMinutesHistoric;
  const completedShifts = records.filter((record) => record.status === "CLOSED").length;
  const firstRecordDateISO = getFirstRecordDateISO(records);
  const expectedWeeklyMinutes = expectedMinutesForDatesFromStart(weekDates, currentSchedule, firstRecordDateISO);

  const userName = user?.displayName ?? user?.email ?? "Colaborador";
  const activeCollaborators = useMemo(
    () => people.filter((person) => person.role === "collab" && getActiveFlag(person)),
    [people],
  );

  const teamMembers = useMemo<HomeTeamMember[]>(
    () =>
      activeCollaborators.map((person) => ({
        id: person.uid,
        name: person.displayName,
        role: getPrimaryRole(person),
        photoURL: person.photoURL,
        isOnline: person.uid !== user?.uid && isRecentlyOnline(person),
        lastSeenAt: person.lastSeenAt,
      })),
    [activeCollaborators, user?.uid],
  );

  const dynamicCelebrations = useMemo<HomeCelebration[]>(() => {
    const events: Array<HomeCelebration & { sortDistance: number }> = [];

    activeCollaborators.forEach((person) => {
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
  }, [activeCollaborators]);

  const newEmployees = useMemo<HomeNewEmployee[]>(() => {
    return activeCollaborators
      .map<NewEmployeeCandidate | null>((person) => {
        const startDate = parseISODate(person.employmentStartDate);
        if (!startDate) return null;
        const diffDays = Math.max(
          0,
          Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const period = startDate.getFullYear() === new Date().getFullYear() && startDate.getMonth() === currentMonth
          ? "Este mes"
          : currentYear;

        return {
          id: person.uid,
          name: person.displayName,
          role: getPrimaryRole(person),
          startDate: formatLabel(startDate),
          elapsedDays: diffDays,
          period,
          photoURL: person.photoURL,
          sortTime: startDate.getTime(),
        };
      })
      .filter((item): item is NewEmployeeCandidate => item !== null)
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 12)
      .map(({ sortTime, ...item }) => item);
  }, [activeCollaborators, currentMonth, currentYear]);

  const dashboardRequests = useMemo<HomeRequest[]>(() => {
    return requestItems
      .map((item) => {
        const person = people.find((candidate) => candidate.uid === item.uid);
        const createdAtDate = parseISODate(item.createdAt);
        const period =
          createdAtDate && createdAtDate.getFullYear() === new Date().getFullYear() && createdAtDate.getMonth() === currentMonth
            ? "Este mes"
            : currentYear;

        return {
          id: item.id,
          name: person?.displayName ?? "Colaborador",
          type: item.type,
          status: item.status,
          period,
          photoURL: person?.photoURL,
        } satisfies HomeRequest;
      })
      .slice(0, 12);
  }, [currentMonth, currentYear, people, requestItems]);

  const dashboardEvents = useMemo<HomeEvent[]>(() => {
    const todayISO = formatISODate(new Date());
    const internalEvents = portalCalendarEvents
      .filter((item) => item.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        dateLabel: new Date(`${item.date}T00:00:00`).toLocaleDateString("es-PE"),
        title: item.title,
        description: item.description || "Calendario corporativo",
        source: "Portal KIMCE",
        sortKey: item.date,
      }));

    return [...googleCalendarEvents, ...internalEvents]
      .sort((a, b) => (a.sortKey ?? a.dateLabel).localeCompare(b.sortKey ?? b.dateLabel))
      .slice(0, 8);
  }, [googleCalendarEvents, portalCalendarEvents]);

  const handleConnectCalendar = async () => {
    try {
      setCalendarLoading(true);
      setCalendarStatus("Conectando con Google Calendar...");
      const { accessToken, email } = await connectGoogleCalendar();
      if (user?.email && email && email.toLowerCase() !== user.email.toLowerCase()) {
        setCalendarStatus(`Calendario vinculado desde ${email}.`);
      }

      const params = new URLSearchParams({
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "12",
      });
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as GoogleCalendarErrorResponse | null;
        const googleMessage = errorBody?.error?.message;
        const googleStatus = errorBody?.error?.status;
        const detail = googleMessage || googleStatus || response.statusText;
        throw new Error(`Google Calendar respondió ${response.status}: ${detail}`);
      }

      const data = (await response.json()) as GoogleCalendarEventsResponse;
      const nextEvents = (data.items ?? [])
        .map((item) => {
          const start = item.start?.dateTime ?? item.start?.date ?? "";
          if (!start) return null;

          return {
            id: `google-${item.id ?? start}-${item.summary ?? "evento"}`,
            title: item.summary ?? "Evento sin titulo",
            description: item.description || "Google Calendar",
            dateLabel: formatEventDateLabel(start),
            source: "Google Calendar",
            sortKey: start,
            href: item.htmlLink,
            location: item.location,
            meetingUrl: item.hangoutLink,
          } satisfies HomeEvent;
        })
        .filter(Boolean) as HomeEvent[];

      setGoogleCalendarEvents(nextEvents);
      setCalendarConnected(true);
      const nextStatus =
        nextEvents.length > 0
          ? `${nextEvents.length} evento(s) de Google Calendar vinculados.`
          : "Google Calendar vinculado, sin eventos próximos.";
      setCalendarStatus(nextStatus);
      if (user?.uid) {
        writeStorage<StoredCalendarState>(`${CALENDAR_STORAGE_PREFIX}:${user.uid}`, {
          connected: true,
          status: nextStatus,
          events: nextEvents,
          email,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo vincular Google Calendar.";
      setCalendarStatus(message);
    } finally {
      setCalendarLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <WelcomeHeader
        userName={userName}
        weeklyMinutes={weeklyMinutes}
        weeklyTargetMinutes={expectedWeeklyMinutes}
        historicMinutes={historicMinutes}
        monthlyMinutes={monthlyMinutes}
        completedShifts={completedShifts}
        formatMinutes={minutesToHHMM}
      />

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <TeamCard members={teamMembers} />
        </div>
        <div className="xl:col-span-3">
          <CelebrationsCard items={dynamicCelebrations} />
        </div>
        <div className="xl:col-span-3">
          <ActionsCard items={homeQuickActions} />
        </div>

        <div className="xl:col-span-7">
          <NewEmployeesCard items={newEmployees} />
        </div>
        <div className="xl:col-span-5">
          <RequestsCard items={dashboardRequests} />
        </div>

        <div className="xl:col-span-8">
          <EventsCard
            items={dashboardEvents}
            onConnectCalendar={handleConnectCalendar}
            isConnectingCalendar={calendarLoading}
            calendarStatus={calendarStatus}
            calendarConnected={calendarConnected}
          />
        </div>
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-[0_10px_28px_rgba(79,70,229,0.08)]">
            <h3 className="text-lg font-semibold text-slate-900">KPIs de horarios</h3>
            <p className="text-xs text-slate-500">Métricas ampliadas según el horario asignado.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-100/70 p-3">
                <p className="text-xs text-indigo-700">Semana</p>
                <p className="text-xl font-semibold text-indigo-900">{minutesToHHMM(weeklyMinutes)}</p>
              </div>
              <div className="rounded-xl bg-violet-100/70 p-3">
                <p className="text-xs text-violet-700">Objetivo semanal</p>
                <p className="text-xl font-semibold text-violet-900">{minutesToHHMM(expectedWeeklyMinutes)}</p>
              </div>
              <div className="rounded-xl bg-cyan-100/70 p-3">
                <p className="text-xs text-cyan-700">Mes</p>
                <p className="text-xl font-semibold text-cyan-900">{minutesToHHMM(monthlyMinutes)}</p>
              </div>
              <div className="rounded-xl bg-emerald-100/70 p-3">
                <p className="text-xs text-emerald-700">Jornadas cerradas</p>
                <p className="text-xl font-semibold text-emerald-900">{completedShifts}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs text-slate-600">Horario</p>
                <p className="text-xl font-semibold text-slate-900">{currentSchedule.name}</p>
              </div>
              <div className="rounded-xl bg-amber-100/70 p-3">
                <p className="text-xs text-amber-700">Histórico</p>
                <p className="text-xl font-semibold text-amber-900">{minutesToHHMM(historicMinutes)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
