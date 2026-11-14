import type { AdminAttendanceRecord, UserProfile, WorkSchedule, WorkScheduleDays } from "@/services/firebase/types";

const TIME_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const WEEKDAY_EXPECTED_MINUTES = {
  0: 0,
  1: 480,
  2: 480,
  3: 480,
  4: 480,
  5: 480,
  6: 240,
} as const;

const DEFAULT_SCHEDULE_DAYS: WorkScheduleDays = {
  mon: 480,
  tue: 480,
  wed: 480,
  thu: 480,
  fri: 480,
  sat: 240,
  sun: 0,
};

const DAY_KEY: Record<number, keyof WorkScheduleDays> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export function minutesToHHMM(minutes: number) {
  const normalizedMinutes = Number.isFinite(minutes) ? minutes : 0;
  const safeMinutes = Math.max(0, Math.round(normalizedMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function getWeekStartMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getWeekDates(weekStart: Date) {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + i);
    dates.push(next);
  }
  return dates;
}

export function expectedMinutesForDate(
  date: Date,
  schedule?: WorkSchedule | null,
  holidayDates?: Set<string>,
) {
  if (holidayDates?.has(formatISODate(date))) return 0;
  if (schedule?.days) {
    const key = DAY_KEY[date.getDay()];
    const minutes = schedule.days[key];
    if (typeof minutes === "number") return minutes;
  }
  return DEFAULT_SCHEDULE_DAYS[DAY_KEY[date.getDay()]];
}

export function getFirstRecordDateISO(
  records: Array<{ date?: string | null }>,
  credits?: Array<{ date?: string | null }>,
) {
  const allDates = [
    ...records.map((r) => r.date?.slice(0, 10) ?? ""),
    ...(credits ?? []).map((c) => c.date?.slice(0, 10) ?? ""),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return allDates[0] ?? null;
}

export function isDateOnOrAfterStart(dateISO: string, firstRecordDateISO?: string | null) {
  return typeof firstRecordDateISO === "string" && firstRecordDateISO.length > 0 && dateISO >= firstRecordDateISO;
}

export function expectedMinutesForDatesFromStart(
  dates: Date[],
  schedule?: WorkSchedule | null,
  firstRecordDateISO?: string | null,
  holidayDates?: Set<string>,
) {
  return dates.reduce((total, date) => {
    const dateISO = formatISODate(date);
    if (!isDateOnOrAfterStart(dateISO, firstRecordDateISO)) return total;
    return total + expectedMinutesForDate(date, schedule, holidayDates);
  }, 0);
}

export function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekKey(dateISO: string) {
  const parsed = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatISODate(getWeekStartMonday(parsed));
}

export function formatTime(dateISO: string | null) {
  if (!dateISO) return "--:--";
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return "--:--";
  return TIME_FORMATTER.format(date);
}

export type AttendanceTimeEntryEvent = {
  uid: string;
  dayKey: string;
  weekKey: string;
  type: string;
  ts: string;
  totalMinutes?: number;
};

export type ApprovedAttendanceExtra = {
  uid: string;
  date: string;
  minutes: number;
  type?: string;
  note?: string | null;
};

export type ApprovedAttendanceRequest = {
  uid: string;
  type: string;
  date: string;
  endDate?: string | null;
  hours?: number | null;
  reason?: string | null;
};

export type AttendanceCreditDetail = {
  uid: string;
  date: string;
  minutes: number;
  source: "REQUEST" | "EXTRA";
  type: string;
  note?: string | null;
};

export type AdminRequestStatus = "pending" | "approved" | "rejected";

export type AttendanceRequestMonitorItem = {
  uid: string;
  type?: string;
  status: AdminRequestStatus;
  date?: string;
  endDate?: string;
  weekKey: string;
  hours?: number;
  source: "hourRequest" | "extraActivity";
};

export type WeeklyRequestMonitorSummary = {
  user: AttendanceMonitorUser;
  requests: AttendanceRequestMonitorItem[];
  permitRequests: AttendanceRequestMonitorItem[];
  extraRequests: AttendanceRequestMonitorItem[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type AdminWeeklyAlert = {
  id: string;
  uid: string;
  level: "warning" | "info";
  title: string;
  description: string;
  actionLabel?: string;
};

export type WeeklyAttendanceDayRow = {
  dateISO: string;
  date: Date;
  records: AdminAttendanceRecord[];
  credits: AttendanceCreditDetail[];
  hasRecord: boolean;
  hasCredits: boolean;
  totalWorkedMinutes: number;
  totalCreditMinutes: number;
  totalBreakMinutes: number;
};

export const EXTRA_ACTIVITY_TYPE = "EXTRA_ACTIVIDAD";
export const REQUEST_PERMIT_TYPES = new Set([
  "DIA_LIBRE",
  "PERMISO_HORAS",
  "VACACIONES",
  "MEDICO",
  "HOURS",
  "PERMISO",
]);

export type AttendanceMonitorUser = UserProfile & {
  uid: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  profilePhoto?: string;
  orgTeam?: string;
  orgParentId?: string;
  orgNodeType?: "root" | "leader" | "member";
};

export type AdminHoursSummaryRow = {
  user: AttendanceMonitorUser;
  weekRecords: AdminAttendanceRecord[];
  totalMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  status: "Sin inicio" | "En riesgo" | "En curso" | "Al día";
  schedule: WorkSchedule;
  approvedExtraMinutes: number;
  approvedRequestMinutes: number;
  weekCredits: AttendanceCreditDetail[];
  firstRecordDateISO: string | null;
  hasStarted: boolean;
};

export type WeeklyBalanceEntry = {
  weekKey: string;
  weekStart: Date;
  workedMinutes: number;
  creditMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
};

export type AdminHoursDetailModel = {
  user: AttendanceMonitorUser;
  schedule: WorkSchedule | null;
  rows: WeeklyAttendanceDayRow[];
  credits: AttendanceCreditDetail[];
  records: AdminAttendanceRecord[];
  chartData: Array<{ label: string; hours: number; target: number }>;
  expectedMinutesWeek: number;
  workedMinutesWeek: number;
  workedMinutesWeekBase: number;
  approvedExtraMinutesWeek: number;
  approvedRequestMinutesWeek: number;
  diffMinutesWeek: number;
  progressRate: number;
  recordedDays: number;
  completedDays: number;
  totalBalanceMinutes: number;
  weeklyBalances: WeeklyBalanceEntry[];
};

export function computeLiveMinutes(
  record: Pick<AdminAttendanceRecord, "status" | "checkInAt" | "totalMinutes" | "breaks">,
  now: Date = new Date(),
): number {
  if (record.status !== "OPEN" || !record.checkInAt) return record.totalMinutes;
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - new Date(record.checkInAt).getTime()) / 60000));
  const breakMinutes = record.breaks.reduce((total, b) => {
    if (!b.endAt) return total;
    return total + Math.max(0, Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000));
  }, 0);
  return Math.max(0, elapsedMinutes - breakMinutes);
}

export function computeBreakMinutes(
  record: Pick<AdminAttendanceRecord, "breaks"> | null | undefined,
) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

export function buildAttendanceRecordsFromTimeEntries(events: AttendanceTimeEntryEvent[]) {
  const grouped = new Map<string, AttendanceTimeEntryEvent[]>();

  events.forEach((event) => {
    const key = `${event.uid}_${event.dayKey}`;
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
  });

  return Array.from(grouped.entries()).map(([key, dayEvents]) => {
    const checkInEvent = dayEvents
      .filter((event) => event.type === "clock_in")
      .sort((a, b) => a.ts.localeCompare(b.ts))[0];
    const checkOutEvent = dayEvents
      .filter((event) => event.type === "clock_out")
      .sort((a, b) => b.ts.localeCompare(a.ts))[0];

    const userId = dayEvents[0]?.uid ?? "";
    const date = dayEvents[0]?.dayKey ?? "";
    const derivedMinutes =
      checkInEvent && checkOutEvent
        ? Math.max(
            0,
            Math.round((new Date(checkOutEvent.ts).getTime() - new Date(checkInEvent.ts).getTime()) / 60000),
          )
        : 0;

    return {
      id: key,
      userId,
      date,
      checkInAt: checkInEvent?.ts ?? null,
      checkOutAt: checkOutEvent?.ts ?? null,
      breaks: [],
      notes: null,
      totalMinutes: checkOutEvent?.totalMinutes ?? derivedMinutes,
      status: checkOutEvent ? "CLOSED" : "OPEN",
    } satisfies AdminAttendanceRecord;
  });
}

export function mergeAttendanceRecords(
  preferred: AdminAttendanceRecord[],
  fallback: AdminAttendanceRecord[],
) {
  const merged = new Map<string, AdminAttendanceRecord>();

  fallback.forEach((record) => {
    merged.set(`${record.userId}_${record.date}`, record);
  });
  preferred.forEach((record) => {
    merged.set(`${record.userId}_${record.date}`, record);
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);
    return a.date.localeCompare(b.date);
  });
}

function eachDateInRange(startISO: string, endISO?: string | null) {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${(endISO || startISO)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as Date[];

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function buildApprovedAttendanceCredits(params: {
  extras?: ApprovedAttendanceExtra[];
  requests?: ApprovedAttendanceRequest[];
  getScheduleForUser: (uid: string) => WorkSchedule | null | undefined;
}) {
  const credits: AttendanceCreditDetail[] = [];

  (params.extras ?? []).forEach((extra) => {
    if (!extra.uid || !extra.date || !Number.isFinite(extra.minutes)) return;
    credits.push({
      uid: extra.uid,
      date: extra.date.slice(0, 10),
      minutes: Math.max(0, Math.round(extra.minutes)),
      source: "EXTRA",
      type: extra.type ?? "EXTRA_ACTIVIDAD",
      note: extra.note ?? null,
    });
  });

  (params.requests ?? []).forEach((request) => {
    if (!request.uid || !request.date) return;
    const normalizedType = request.type.toUpperCase();

    if (normalizedType === "PERMISO_HORAS" || normalizedType === "HOURS" || normalizedType === "PERMISO") {
      const minutes = Math.max(0, Math.round((request.hours ?? 0) * 60));
      if (minutes <= 0) return;
      credits.push({
        uid: request.uid,
        date: request.date.slice(0, 10),
        minutes,
        source: "REQUEST",
        type: normalizedType,
        note: request.reason ?? null,
      });
      return;
    }

    eachDateInRange(request.date.slice(0, 10), request.endDate?.slice(0, 10)).forEach((date) => {
      const schedule = params.getScheduleForUser(request.uid);
      const minutes = expectedMinutesForDate(date, schedule);
      if (minutes <= 0) return;
      credits.push({
        uid: request.uid,
        date: formatISODate(date),
        minutes,
        source: "REQUEST",
        type: normalizedType,
        note: request.reason ?? null,
      });
    });
  });

  return credits;
}

export function buildWeeklyAttendanceRows(params: {
  weekDates: Date[];
  records: AdminAttendanceRecord[];
  credits?: AttendanceCreditDetail[];
}) {
  return params.weekDates.map((date) => {
    const dateISO = formatISODate(date);
    const dayRecords = params.records.filter((record) => record.date === dateISO);
    const dayCredits = (params.credits ?? []).filter((credit) => credit.date === dateISO);

    return {
      dateISO,
      date,
      records: dayRecords,
      credits: dayCredits,
      hasRecord: dayRecords.length > 0,
      hasCredits: dayCredits.length > 0,
      totalWorkedMinutes: dayRecords.reduce((sum, record) => sum + (record.totalMinutes ?? 0), 0),
      totalCreditMinutes: dayCredits.reduce((sum, credit) => sum + credit.minutes, 0),
      totalBreakMinutes: dayRecords.reduce((sum, record) => sum + computeBreakMinutes(record), 0),
    } satisfies WeeklyAttendanceDayRow;
  });
}

export function getAttendanceRequestCategory(request: Pick<AttendanceRequestMonitorItem, "type" | "source">) {
  const normalizedType = typeof request.type === "string" ? request.type.toUpperCase() : "";
  if (normalizedType === EXTRA_ACTIVITY_TYPE || request.source === "extraActivity") return "extra" as const;
  if (REQUEST_PERMIT_TYPES.has(normalizedType)) return "permit" as const;
  return "permit" as const;
}

export function filterWeeklyAttendanceRequests(params: {
  requests: AttendanceRequestMonitorItem[];
  selectedUserId?: string;
  weekKey: string;
  weekDateSet: Set<string>;
}) {
  return params.requests.filter((item) => {
    const dateISO = typeof item.date === "string" ? item.date.slice(0, 10) : "";
    const matchesWeek = item.weekKey === params.weekKey || (dateISO && params.weekDateSet.has(dateISO));
    const matchesUser = !params.selectedUserId || params.selectedUserId === "all" || item.uid === params.selectedUserId;
    return matchesWeek && matchesUser;
  });
}

export function buildAdminWeeklyRequestSummaries(params: {
  users: AttendanceMonitorUser[];
  requests: AttendanceRequestMonitorItem[];
  selectedUserId?: string;
  weekKey: string;
  weekDateSet: Set<string>;
}) {
  const weeklyRequests = filterWeeklyAttendanceRequests({
    requests: params.requests,
    selectedUserId: params.selectedUserId,
    weekKey: params.weekKey,
    weekDateSet: params.weekDateSet,
  });

  const scopedUsers =
    params.selectedUserId && params.selectedUserId !== "all"
      ? params.users.filter((item) => item.uid === params.selectedUserId)
      : params.users;

  return scopedUsers.map((user) => {
    const requests = weeklyRequests.filter((item) => item.uid === user.uid);
    const permitRequests = requests.filter((item) => getAttendanceRequestCategory(item) === "permit");
    const extraRequests = requests.filter((item) => getAttendanceRequestCategory(item) === "extra");

    return {
      user,
      requests,
      permitRequests,
      extraRequests,
      pendingCount: requests.filter((item) => item.status === "pending").length,
      approvedCount: requests.filter((item) => item.status === "approved").length,
      rejectedCount: requests.filter((item) => item.status === "rejected").length,
    } satisfies WeeklyRequestMonitorSummary;
  });
}

export function buildAdminWeeklyRequestAlerts(summaries: WeeklyRequestMonitorSummary[]) {
  return summaries.flatMap((summary) => {
    const alerts: AdminWeeklyAlert[] = [];

    if (summary.pendingCount > 0) {
      alerts.push({
        id: `requests-pending-${summary.user.uid}`,
        uid: summary.user.uid,
        level: "warning",
        title: `${summary.pendingCount} solicitud(es) pendiente(s)`,
        description: `${summary.user.displayName || summary.user.fullName || summary.user.name || summary.user.email || "Colaborador"} tiene solicitudes por revisar esta semana.`,
        actionLabel: "Revisar solicitudes",
      });
    }

    if (summary.extraRequests.length > 0 && summary.pendingCount === 0) {
      alerts.push({
        id: `requests-extra-${summary.user.uid}`,
        uid: summary.user.uid,
        level: "info",
        title: `${summary.extraRequests.length} actividad(es) extra registradas`,
        description: `${summary.user.displayName || summary.user.fullName || summary.user.name || summary.user.email || "Colaborador"} reportó actividades extra en la semana actual.`,
        actionLabel: "Ver detalle",
      });
    }

    return alerts;
  });
}

export function buildAdminWeeklyAttendanceSummaries(params: {
  users: AttendanceMonitorUser[];
  selectedUserId?: string;
  records: AdminAttendanceRecord[];
  allRecords?: AdminAttendanceRecord[];
  weekDates: Date[];
  weekDateSet: Set<string>;
  credits: AttendanceCreditDetail[];
  getScheduleForUser: (uid: string) => WorkSchedule | null | undefined;
  holidayDates?: Set<string>;
}) {
  const scopedUsers =
    params.selectedUserId && params.selectedUserId !== "all"
      ? params.users.filter((item) => item.uid === params.selectedUserId)
      : params.users;

  return scopedUsers.map((item) => {
    const schedule = params.getScheduleForUser(item.uid) ?? null;
    const fallbackSchedule = schedule ?? {
      id: "default",
      name: "Jornada",
      weeklyMinutes: 0,
      days: DEFAULT_SCHEDULE_DAYS,
    };
    const allUserRecords = (params.allRecords ?? params.records).filter((record) => record.userId === item.uid);
    const allUserCredits = params.credits.filter((c) => c.uid === item.uid);
    const firstRecordDateISO = getFirstRecordDateISO(allUserRecords, allUserCredits);
    const weekRecords = params.records.filter((record) => record.userId === item.uid && params.weekDateSet.has(record.date));
    const baseWorkedMinutes = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);
    const weekCredits = params.credits.filter((credit) => credit.uid === item.uid && params.weekDateSet.has(credit.date));
    const approvedExtraMinutes = weekCredits
      .filter((credit) => credit.source === "EXTRA")
      .reduce((total, credit) => total + credit.minutes, 0);
    const approvedRequestMinutes = weekCredits
      .filter((credit) => credit.source === "REQUEST")
      .reduce((total, credit) => total + credit.minutes, 0);
    const totalMinutes = baseWorkedMinutes + approvedExtraMinutes + approvedRequestMinutes;
    const expectedMinutes = expectedMinutesForDatesFromStart(
      params.weekDates,
      fallbackSchedule,
      firstRecordDateISO,
      params.holidayDates,
    );
    const diffMinutes = totalMinutes - expectedMinutes;
    const hasStarted = Boolean(firstRecordDateISO);

    return {
      user: item,
      weekRecords,
      totalMinutes,
      expectedMinutes,
      diffMinutes,
      status: (() => {
        const completionRate = expectedMinutes > 0 ? Math.round((totalMinutes / expectedMinutes) * 100) : 0;
        return !hasStarted
          ? "Sin inicio"
          : completionRate >= 100
            ? "Al día"
            : completionRate >= 70
              ? "En curso"
              : "En riesgo";
      })(),
      schedule: fallbackSchedule,
      approvedExtraMinutes,
      approvedRequestMinutes,
      weekCredits,
      firstRecordDateISO,
      hasStarted,
    } satisfies AdminHoursSummaryRow;
  });
}

export function buildAdminWeeklyAttendanceAlerts(params: {
  summaries: AdminHoursSummaryRow[];
  weekDates: Date[];
}) {
  const weekRowsByUser = new Map<string, WeeklyAttendanceDayRow[]>();

  params.summaries.forEach((summary) => {
    weekRowsByUser.set(
      summary.user.uid,
      buildWeeklyAttendanceRows({
        weekDates: params.weekDates,
        records: summary.weekRecords,
        credits: summary.weekCredits,
      }),
    );
  });

  return params.summaries.flatMap((summary) => {
    const userName =
      summary.user.displayName ||
      summary.user.fullName ||
      summary.user.name ||
      summary.user.email ||
      "Colaborador";
    const alerts: AdminWeeklyAlert[] = [];
    const weekRows = weekRowsByUser.get(summary.user.uid) ?? [];
    const openShiftCount = summary.weekRecords.filter((record) => record.status === "OPEN").length;
    const creditOnlyDays = weekRows.filter((row) => row.hasCredits && !row.hasRecord).length;

    if (openShiftCount > 0) {
      alerts.push({
        id: `attendance-open-${summary.user.uid}`,
        uid: summary.user.uid,
        level: "warning",
        title: `${openShiftCount} fichaje(s) abierto(s)`,
        description: `${userName} tiene jornada(s) iniciada(s) sin salida registrada esta semana.`,
        actionLabel: "Ver en Horas",
      });
    }

    if (summary.hasStarted && summary.diffMinutes < 0) {
      alerts.push({
        id: `attendance-missing-${summary.user.uid}`,
        uid: summary.user.uid,
        level: "warning",
        title: `Horas por debajo del objetivo`,
        description: `${userName} todavía debe ${minutesToHHMM(Math.abs(summary.diffMinutes))} para su meta semanal.`,
        actionLabel: "Abrir detalle",
      });
    }

    if (creditOnlyDays > 0) {
      alerts.push({
        id: `attendance-credit-${summary.user.uid}`,
        uid: summary.user.uid,
        level: "info",
        title: `${creditOnlyDays} día(s) con ajuste sin fichaje`,
        description: `${userName} tiene ajustes aprobados que suman horas, pero sin fichaje base en algunos días de la semana.`,
        actionLabel: "Revisar semana",
      });
    }

    return alerts;
  });
}

export function buildAdminWeeklyAttendanceDetail(params: {
  user: AttendanceMonitorUser | null;
  records: AdminAttendanceRecord[];
  allRecords: AdminAttendanceRecord[];
  weekDates: Date[];
  weekDateSet: Set<string>;
  weekCredits: AttendanceCreditDetail[];
  allCredits: AttendanceCreditDetail[];
  schedule: WorkSchedule | null;
  holidayDates?: Set<string>;
}) {
  if (!params.user) return null;

  const detailFirstRecordDateISO = getFirstRecordDateISO(params.allRecords, params.allCredits);
  const detailExpectedMinutesWeek = params.schedule
    ? expectedMinutesForDatesFromStart(params.weekDates, params.schedule, detailFirstRecordDateISO, params.holidayDates)
    : 0;
  const detailWorkedMinutesWeekBase = params.records.reduce((total, record) => total + record.totalMinutes, 0);
  const detailApprovedExtraMinutesWeek = params.weekCredits
    .filter((credit) => credit.source === "EXTRA")
    .reduce((sum, credit) => sum + credit.minutes, 0);
  const detailApprovedRequestMinutesWeek = params.weekCredits
    .filter((credit) => credit.source === "REQUEST")
    .reduce((sum, credit) => sum + credit.minutes, 0);
  const detailWorkedMinutesWeek =
    detailWorkedMinutesWeekBase + detailApprovedExtraMinutesWeek + detailApprovedRequestMinutesWeek;
  const detailDiffMinutesWeek = detailWorkedMinutesWeek - detailExpectedMinutesWeek;
  const detailCompletedDays = params.records.filter((record) => {
    if (record.status !== "CLOSED") return false;
    const date = new Date(`${record.date}T00:00:00`);
    return expectedMinutesForDate(date, params.schedule, params.holidayDates) > 0;
  }).length;

  const { detailTotalBalanceMinutes, detailWeeklyBalances } = (() => {
    if (!params.schedule || !detailFirstRecordDateISO) {
      return { detailTotalBalanceMinutes: 0, detailWeeklyBalances: [] as WeeklyBalanceEntry[] };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recordsByDate = new Map(params.allRecords.map((r) => [r.date, r]));
    const creditMinutesByDate = new Map<string, number>();
    params.allCredits.forEach((credit) => {
      creditMinutesByDate.set(credit.date, (creditMinutesByDate.get(credit.date) ?? 0) + credit.minutes);
    });

    // Start from Monday of the week containing firstRecordDateISO
    const weekCursor = getWeekStartMonday(new Date(`${detailFirstRecordDateISO}T00:00:00`));
    let totalBalance = 0;
    const weeklyBalances: WeeklyBalanceEntry[] = [];

    while (weekCursor.getTime() <= today.getTime()) {
      const weekStart = new Date(weekCursor);
      let weekWorked = 0;
      let weekExpected = 0;
      let weekCredits = 0;

      for (let d = 0; d < 7; d++) {
        const day = new Date(weekCursor);
        day.setDate(weekCursor.getDate() + d);
        if (day.getTime() > today.getTime()) break;
        const dateISO = formatISODate(day);
        if (dateISO < detailFirstRecordDateISO) continue;
        weekExpected += expectedMinutesForDate(day, params.schedule, params.holidayDates);
        weekWorked += recordsByDate.get(dateISO)?.totalMinutes ?? 0;
        weekCredits += creditMinutesByDate.get(dateISO) ?? 0;
      }

      const weekBalance = weekWorked + weekCredits - weekExpected;
      totalBalance += weekBalance;
      weeklyBalances.push({
        weekKey: formatISODate(weekStart),
        weekStart,
        workedMinutes: weekWorked,
        creditMinutes: weekCredits,
        expectedMinutes: weekExpected,
        balanceMinutes: weekBalance,
      });

      weekCursor.setDate(weekCursor.getDate() + 7);
    }

    return { detailTotalBalanceMinutes: totalBalance, detailWeeklyBalances: weeklyBalances };
  })();

  const detailChartData = params.schedule
    ? params.weekDates
        .filter((date) => expectedMinutesForDate(date, params.schedule, params.holidayDates) > 0)
        .map((date) => {
          const dateISO = formatISODate(date);
          const record = params.records.find((item) => item.date === dateISO);
          const targetHours = isDateOnOrAfterStart(dateISO, detailFirstRecordDateISO)
            ? expectedMinutesForDate(date, params.schedule, params.holidayDates) / 60
            : 0;
          const approvedExtraMinutes = params.weekCredits
            .filter((credit) => credit.source === "EXTRA" && credit.date === dateISO)
            .reduce((sum, credit) => sum + credit.minutes, 0);
          const approvedRequestMinutes = params.weekCredits
            .filter((credit) => credit.source === "REQUEST" && credit.date === dateISO)
            .reduce((sum, credit) => sum + credit.minutes, 0);

          return {
            label: date.toLocaleDateString("es-ES", { weekday: "short" }),
            hours: Math.round((((record?.totalMinutes ?? 0) + approvedExtraMinutes + approvedRequestMinutes) / 60) * 10) / 10,
            target: targetHours,
          };
        })
    : [];

  const detailProgressRate =
    detailExpectedMinutesWeek > 0 ? Math.round((detailWorkedMinutesWeek / detailExpectedMinutesWeek) * 100) : 0;
  const detailRecordedDays = params.weekDates.filter((date) => {
    const dateISO = formatISODate(date);
    const hasRecord = params.records.some((record) => record.date === dateISO && record.totalMinutes > 0);
    const hasCredits = params.weekCredits.some((credit) => credit.date === dateISO && credit.minutes > 0);
    return hasRecord || hasCredits;
  }).length;

  return {
    user: params.user,
    schedule: params.schedule,
    rows: buildWeeklyAttendanceRows({
      weekDates: params.weekDates,
      records: params.records,
      credits: params.weekCredits,
    }),
    credits: params.weekCredits,
    records: params.records,
    chartData: detailChartData,
    expectedMinutesWeek: detailExpectedMinutesWeek,
    workedMinutesWeek: detailWorkedMinutesWeek,
    workedMinutesWeekBase: detailWorkedMinutesWeekBase,
    approvedExtraMinutesWeek: detailApprovedExtraMinutesWeek,
    approvedRequestMinutesWeek: detailApprovedRequestMinutesWeek,
    diffMinutesWeek: detailDiffMinutesWeek,
    progressRate: detailProgressRate,
    recordedDays: detailRecordedDays,
    completedDays: detailCompletedDays,
    totalBalanceMinutes: detailTotalBalanceMinutes,
    weeklyBalances: detailWeeklyBalances,
  } satisfies AdminHoursDetailModel;
}
