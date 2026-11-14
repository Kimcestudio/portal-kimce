"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import {
  checkOut,
  createCheckIn,
  endBreak,
  getTodayRecord,
  listAllRecords,
  saveNote,
  startBreak,
  type AttendanceRecord,
  upsertAttendanceRecord,
} from "@/lib/storage/attendanceStorage";
import {
  buildApprovedAttendanceCredits,
  type AttendanceCreditDetail,
  type ApprovedAttendanceRequest,
  expectedMinutesForDate,
  expectedMinutesForDatesFromStart,
  formatISODate,
  getFirstRecordDateISO,
  getWeekDates,
  getWeekKey,
  getWeekStartMonday,
  isDateOnOrAfterStart,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { db } from "@/services/firebase/client";
import type { WorkSchedule } from "@/services/firebase/types";
import { DEFAULT_WORK_SCHEDULES, DEFAULT_WORK_SCHEDULE_ID } from "@/services/firebase/workSchedules";
import { subscribeCalendarHolidays, type CalendarHolidayRecord } from "@/services/calendar";

type AttendanceStatus = "OFF" | "IN_SHIFT" | "ON_BREAK" | "CLOSED";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const LOCAL_SYNC_KEY_PREFIX = "attendance_time_entries_synced";

type TimeEntryType = "clock_in" | "clock_out" | "manual";
type AttendanceUserRef = {
  uid: string;
  workScheduleId?: string;
} | null | undefined;

type AttendanceHookInput = {
  user: AttendanceUserRef;
  approvedExtraActivities: { date: string; minutes: number }[];
  approvedHourRequests: ApprovedAttendanceRequest[];
};

function computeBreakMinutes(record: AttendanceRecord | null) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

function computeStatus(record: AttendanceRecord | null): AttendanceStatus {
  if (!record) return "OFF";
  if (record.checkOutAt) return "CLOSED";
  const hasOpenBreak = record.breaks.some((item) => !item.endAt);
  return hasOpenBreak ? "ON_BREAK" : "IN_SHIFT";
}

async function upsertTimeEntry(params: {
  uid: string;
  type: TimeEntryType;
  tsISO: string;
  totalMinutes?: number;
}) {
  const dayKey = formatISODate(new Date(params.tsISO));
  const weekKey = getWeekKey(dayKey);
  const timeEntryId = `${params.uid}_${dayKey}_${params.type}`;
  await setDoc(
    doc(db, "timeEntries", timeEntryId),
    {
      uid: params.uid,
      type: params.type,
      ts: params.tsISO,
      dayKey,
      weekKey,
      totalMinutes: typeof params.totalMinutes === "number" ? params.totalMinutes : null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function persistAttendanceRecord(uid: string, record: AttendanceRecord) {
  const weekKey = getWeekKey(record.date);
  const hoursValue = Math.round((record.totalMinutes / 60) * 10) / 10;
  const hoursDocId = record.id || `${uid}_${record.date}`;

  // Never write checkInAt: null with merge:true — it would silently overwrite a valid value in Firestore.
  // Only include the field when it has a value.
  // Never write checkInAt/checkOutAt as null with merge:true — it would silently overwrite
  // a valid timestamp already in Firestore (e.g. checkout done from another device).
  const payload: Record<string, unknown> = {
    uid,
    date: record.date,
    weekKey,
    hours: hoursValue,
    totalMinutes: record.totalMinutes,
    breaks: record.breaks ?? [],
    status: record.status,
    notes: record.notes ?? null,
    updatedAt: serverTimestamp(),
  };
  if (record.checkInAt) {
    payload.checkInAt = record.checkInAt;
  }
  if (record.checkOutAt) {
    payload.checkOutAt = record.checkOutAt;
  }

  await setDoc(
    doc(db, "users", uid, "hours", hoursDocId),
    payload,
    { merge: true },
  );
}

export function useAttendanceSession({
  user,
  approvedExtraActivities,
  approvedHourRequests,
}: AttendanceHookInput) {
  const [currentDateKey, setCurrentDateKey] = useState(() => formatISODate(new Date()));
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);
  const [persistedRecords, setPersistedRecords] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULES[0]);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [hasLoadedHolidays, setHasLoadedHolidays] = useState(false);
  const [todayEntrySnapshot, setTodayEntrySnapshot] = useState<{
    checkInAt: string | null;
    checkOutAt: string | null;
  }>({ checkInAt: null, checkOutAt: null });
  const [firestoreError, setFirestoreError] = useState(false);
  const recoveryAttemptedRef = useRef(false);
  const repairAttemptedRef = useRef(false);
  // Hasta que ambos listeners (hours + timeEntries) entreguen su primera respuesta, no sabemos si
  // ya existe un turno abierto en Firestore. Mostrar "Marcar entrada" antes de eso permite, en una
  // recarga rapida, crear un check-in nuevo que sobreescribe (via merge) la hora real ya guardada.
  const [hasLoadedHours, setHasLoadedHours] = useState(false);
  const [hasLoadedEntries, setHasLoadedEntries] = useState(false);
  const hasLoadedToday = hasLoadedHours && hasLoadedEntries;

  const weekStart = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekStartMonday(base);
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const todayKey = DAY_KEYS[new Date().getDay()];
  const dailyGoalMinutes = schedule.days[todayKey] ?? DEFAULT_WORK_SCHEDULES[0].days[todayKey];
  const weeklyGoalMinutes = schedule.weeklyMinutes ?? DEFAULT_WORK_SCHEDULES[0].weeklyMinutes;
  const approvedCredits = useMemo<AttendanceCreditDetail[]>(
    () =>
      user?.uid
        ? buildApprovedAttendanceCredits({
            extras: approvedExtraActivities.map((item) => ({
              uid: user.uid,
              date: item.date,
              minutes: item.minutes,
            })),
            requests: approvedHourRequests,
            getScheduleForUser: () => schedule,
          }).filter((credit) => credit.uid === user.uid)
        : [],
    [approvedExtraActivities, approvedHourRequests, schedule, user?.uid],
  );

  useEffect(() => {
    if (!user?.uid) return;
    let isMounted = true;
    const loadSchedule = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);
        const userData = userSnapshot.exists() ? userSnapshot.data() : null;
        const scheduleId =
          (userData?.workScheduleId as string | undefined) ??
          user.workScheduleId ??
          DEFAULT_WORK_SCHEDULE_ID;
        const scheduleRef = doc(db, "workSchedules", scheduleId);
        const scheduleSnapshot = await getDoc(scheduleRef);
        if (!isMounted) return;
        if (scheduleSnapshot.exists()) {
          const data = scheduleSnapshot.data();
          setSchedule({
            id: scheduleSnapshot.id,
            name: (data.name as string) ?? "Jornada",
            weeklyMinutes: (data.weeklyMinutes as number) ?? DEFAULT_WORK_SCHEDULES[0].weeklyMinutes,
            days: (data.days as WorkSchedule["days"]) ?? DEFAULT_WORK_SCHEDULES[0].days,
          });
        } else {
          setSchedule(DEFAULT_WORK_SCHEDULES[0]);
        }
      } catch (error) {
        console.error("[attendance] Error loading work schedule", error);
        if (isMounted) {
          setSchedule(DEFAULT_WORK_SCHEDULES[0]);
        }
      }
    };
    void loadSchedule();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.workScheduleId]);

  // Actualiza la fecha al pasar medianoche para que los listeners usen el día correcto
  useEffect(() => {
    const msUntilMidnight = new Date(new Date().setHours(24, 0, 0, 0)).getTime() - Date.now();
    const timer = setTimeout(() => {
      setCurrentDateKey(formatISODate(new Date()));
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [currentDateKey]);

  useEffect(() => {
    recoveryAttemptedRef.current = false;
    repairAttemptedRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeCalendarHolidays((records) => {
      setHolidays(records);
      setHasLoadedHolidays(true);
    });
  }, [user?.uid]);

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  useEffect(() => {
    if (!user?.uid) return;
    const syncKey = `${LOCAL_SYNC_KEY_PREFIX}:${user.uid}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(syncKey) === "true") return;
    const syncLocalEntries = async () => {
      try {
        const storedRecords = listAllRecords(user.uid);
        for (const record of storedRecords) {
          if (record.checkInAt) {
            await upsertTimeEntry({ uid: user.uid, type: "clock_in", tsISO: record.checkInAt });
          }
          if (record.checkOutAt) {
            await upsertTimeEntry({
              uid: user.uid,
              type: "clock_out",
              tsISO: record.checkOutAt,
              totalMinutes: record.totalMinutes,
            });
          }
        }
        window.localStorage.setItem(syncKey, "true");
      } catch (error) {
        console.error("[attendance] Error syncing local attendance to timeEntries", error);
      }
    };
    void syncLocalEntries();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setPersistedRecords([]);
      setHasLoadedHours(false);
      return;
    }

    const hoursRef = collection(db, "users", user.uid, "hours");
    const unsubscribe = onSnapshot(
      hoursRef,
      (snapshot) => {
        const mapped = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              uid?: string;
              date?: string;
              checkInAt?: string | null;
              checkOutAt?: string | null;
              breaks?: AttendanceRecord["breaks"];
              notes?: string | null;
              totalMinutes?: number;
              status?: AttendanceRecord["status"];
            };

            if (!data.date) return null;

            return {
              id: docSnap.id,
              userId: (data.uid as string | undefined) ?? user.uid,
              date: data.date,
              checkInAt: data.checkInAt ?? null,
              checkOutAt: data.checkOutAt ?? null,
              breaks: Array.isArray(data.breaks) ? data.breaks : [],
              notes: data.notes ?? null,
              totalMinutes: typeof data.totalMinutes === "number" ? data.totalMinutes : 0,
              status: (data.status as AttendanceRecord["status"] | undefined) ?? "CLOSED",
            } satisfies AttendanceRecord;
          })
          .filter(Boolean) as AttendanceRecord[];

        mapped.sort((a, b) => a.date.localeCompare(b.date));
        setPersistedRecords(mapped);
        setHasLoadedHours(true);
        setFirestoreError(false);
      },
      (error) => {
        console.error("[attendance] Error loading persisted hour records", error);
        setPersistedRecords([]);
        setHasLoadedHours(true);
        setFirestoreError(true);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setTodayEntrySnapshot({ checkInAt: null, checkOutAt: null });
      setHasLoadedEntries(false);
      return;
    }

    const entriesRef = query(
      collection(db, "timeEntries"),
      where("uid", "==", user.uid),
      where("dayKey", "==", currentDateKey),
    );

    const unsubscribe = onSnapshot(
      entriesRef,
      (snapshot) => {
        let checkInAt: string | null = null;
        let checkOutAt: string | null = null;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as { type?: string; ts?: string | null };
          if (!data.ts) return;
          if (data.type === "clock_in") {
            checkInAt = checkInAt ? (checkInAt < data.ts ? checkInAt : data.ts) : data.ts;
          }
          if (data.type === "clock_out") {
            checkOutAt = checkOutAt ? (checkOutAt > data.ts ? checkOutAt : data.ts) : data.ts;
          }
        });

        setTodayEntrySnapshot({ checkInAt, checkOutAt });
        setHasLoadedEntries(true);
      },
      (error) => {
        console.error("[attendance] Error loading today's time entries", error);
        setTodayEntrySnapshot({ checkInAt: null, checkOutAt: null });
        setHasLoadedEntries(true);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, currentDateKey]);

  useEffect(() => {
    if (!user?.uid) return;
    const todayISO = formatISODate(new Date());
    const localToday = getTodayRecord(user.uid, todayISO);
    const persistedToday = persistedRecords.find((record) => record.date === todayISO) ?? null;

    if (!localToday || localToday.status === "CLOSED" || persistedToday) return;

    void persistAttendanceRecord(user.uid, localToday).catch((error) => {
      console.error("[attendance] Error migrating open local shift", error);
    });
  }, [persistedRecords, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (recoveryAttemptedRef.current) return;
    const todayISO = formatISODate(new Date());
    const persistedToday = persistedRecords.find((record) => record.date === todayISO) ?? null;
    const localToday = getTodayRecord(user.uid, todayISO);
    const canRecoverOpenShift =
      Boolean(todayEntrySnapshot.checkInAt) &&
      !todayEntrySnapshot.checkOutAt &&
      !persistedToday &&
      !localToday;

    if (!canRecoverOpenShift || !todayEntrySnapshot.checkInAt) return;

    recoveryAttemptedRef.current = true;
    const recoveredRecord: AttendanceRecord = {
      id: `${user.uid}_${todayISO}`,
      userId: user.uid,
      date: todayISO,
      checkInAt: todayEntrySnapshot.checkInAt,
      checkOutAt: null,
      breaks: [],
      notes: null,
      totalMinutes: 0,
      status: "OPEN",
    };

    upsertAttendanceRecord(recoveredRecord);
    void persistAttendanceRecord(user.uid, recoveredRecord).catch((error) => {
      console.error("[attendance] Error persisting recovered open shift", error);
    });
    setTodayRecord(recoveredRecord);
  }, [persistedRecords, todayEntrySnapshot, user?.uid]);

  const reloadToday = () => {
    if (!user) return;
    const todayISO = formatISODate(new Date());
    const localRecord = getTodayRecord(user.uid, todayISO);
    const persistedRecord = persistedRecords.find((record) => record.date === todayISO) ?? null;

    // If Firestore record has null checkInAt but timeEntries has it, use the repaired version.
    const repairedPersistedRecord =
      persistedRecord && !persistedRecord.checkInAt && todayEntrySnapshot.checkInAt
        ? { ...persistedRecord, checkInAt: todayEntrySnapshot.checkInAt }
        : persistedRecord;

    const reconstructedRecord =
      !repairedPersistedRecord &&
      !localRecord &&
      todayEntrySnapshot.checkInAt &&
      !todayEntrySnapshot.checkOutAt
        ? ({
            id: `${user.uid}_${todayISO}`,
            userId: user.uid,
            date: todayISO,
            checkInAt: todayEntrySnapshot.checkInAt,
            checkOutAt: null,
            breaks: [],
            notes: null,
            totalMinutes: 0,
            status: "OPEN",
          } satisfies AttendanceRecord)
        : null;
    const record =
      repairedPersistedRecord ??
      (localRecord && localRecord.status !== "CLOSED" ? localRecord : null) ??
      reconstructedRecord;
    setTodayRecord(record);
    setNote(record?.notes ?? "");
  };

  const reloadWeek = () => {
    if (!user) return;
    const localToday = getTodayRecord(user.uid, formatISODate(new Date()));
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const baseRecords = [...persistedRecords];
    if (
      localToday &&
      localToday.status !== "CLOSED" &&
      !baseRecords.some((record) => record.id === localToday.id)
    ) {
      baseRecords.push(localToday);
    }
    const filtered = baseRecords.filter((record) => {
      const date = new Date(`${record.date}T00:00:00`);
      return date >= weekStart && date < end;
    });
    setWeekRecords(filtered);
  };

  // Repair: if the Firestore hours record exists but checkInAt is null,
  // and timeEntries has the clock-in timestamp, fix it in Firestore so it survives future sessions.
  useEffect(() => {
    if (!user?.uid) return;
    if (repairAttemptedRef.current) return;
    const todayISO = formatISODate(new Date());
    const persistedToday = persistedRecords.find((r) => r.date === todayISO) ?? null;
    if (!persistedToday || persistedToday.checkInAt || !todayEntrySnapshot.checkInAt) return;
    repairAttemptedRef.current = true;
    const repaired = { ...persistedToday, checkInAt: todayEntrySnapshot.checkInAt };
    void persistAttendanceRecord(user.uid, repaired).catch((error) => {
      console.error("[attendance] Error repairing checkInAt from timeEntries", error);
    });
  }, [persistedRecords, todayEntrySnapshot, user?.uid]);

  useEffect(() => {
    reloadToday();
  }, [persistedRecords, user, todayEntrySnapshot]);

  useEffect(() => {
    reloadWeek();
  }, [persistedRecords, weekStart, user]);

  const status = computeStatus(todayRecord);
  const breakMinutes = computeBreakMinutes(todayRecord);

  // Bloquear cierre de pestaña si el turno está abierto
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (status === "IN_SHIFT" || status === "ON_BREAK") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [status]);
  const totalMinutes = todayRecord?.totalMinutes ?? 0;

  const allUserRecords = useMemo(() => {
    if (!user) return [];
    const localToday = getTodayRecord(user.uid, formatISODate(new Date()));
    const baseRecords = [...persistedRecords];
    if (
      localToday &&
      localToday.status !== "CLOSED" &&
      !baseRecords.some((record) => record.id === localToday.id)
    ) {
      baseRecords.push(localToday);
    }
    return baseRecords.sort((a, b) => a.date.localeCompare(b.date));
  }, [persistedRecords, user]);
  const firstRecordDateISO = getFirstRecordDateISO(allUserRecords, approvedCredits);
  const expectedMinutesWeek = expectedMinutesForDatesFromStart(weekDates, schedule, firstRecordDateISO, holidayDateSet);
  const weekDateSet = new Set(weekDates.map((date) => formatISODate(date)));
  const workedMinutesWeekBase = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);
  const approvedExtraMinutesWeek = approvedCredits
    .filter((credit) => credit.source === "EXTRA" && weekDateSet.has(credit.date))
    .reduce((total, credit) => total + credit.minutes, 0);
  const approvedRequestMinutesWeek = approvedCredits
    .filter((credit) => credit.source === "REQUEST" && weekDateSet.has(credit.date))
    .reduce((total, credit) => total + credit.minutes, 0);
  const workedMinutesWeek = workedMinutesWeekBase + approvedExtraMinutesWeek + approvedRequestMinutesWeek;
  const diffMinutes = workedMinutesWeek - expectedMinutesWeek;
  const totalBalanceMinutes = useMemo(() => {
    if (!user || !firstRecordDateISO) return 0;
    const todayISO = formatISODate(new Date());
    const recordsByDate = new Map(allUserRecords.map((r) => [r.date, r]));
    const creditsByDate = new Map<string, number>();
    approvedCredits.forEach((credit) => {
      creditsByDate.set(credit.date, (creditsByDate.get(credit.date) ?? 0) + credit.minutes);
    });
    let balance = 0;
    const cursor = new Date(`${firstRecordDateISO}T00:00:00`);
    while (true) {
      const dateISO = formatISODate(cursor);
      if (dateISO > todayISO) break;
      const record = recordsByDate.get(dateISO);
      if (dateISO === todayISO && record?.status !== "CLOSED") break;
      const expected = expectedMinutesForDate(cursor, schedule, holidayDateSet);
      const worked = record?.totalMinutes ?? 0;
      const credits = creditsByDate.get(dateISO) ?? 0;
      balance += worked + credits - expected;
      cursor.setDate(cursor.getDate() + 1);
    }
    return balance;
  }, [allUserRecords, approvedCredits, firstRecordDateISO, holidayDateSet, schedule, user]);
  const completedDays = weekRecords.filter((record) => {
    if (record.status !== "CLOSED") return false;
    const date = new Date(`${record.date}T00:00:00`);
    return expectedMinutesForDate(date, schedule, holidayDateSet) > 0;
  }).length;
  const expectedWorkDays = weekDates.filter(
    (date) => expectedMinutesForDate(date, schedule, holidayDateSet) > 0,
  ).length;

  const chartData = weekDates
    .filter((date) => expectedMinutesForDate(date, schedule, holidayDateSet) > 0)
    .map((date) => {
      const dateISO = formatISODate(date);
      const record = weekRecords.find((item) => item.date === dateISO);
      const targetHours = isDateOnOrAfterStart(dateISO, firstRecordDateISO)
        ? expectedMinutesForDate(date, schedule, holidayDateSet) / 60
        : 0;
      const dayCreditMinutes = approvedCredits
        .filter((credit) => credit.date === dateISO)
        .reduce((sum, credit) => sum + credit.minutes, 0);
      const totalMinutesDay = (record?.totalMinutes ?? 0) + dayCreditMinutes;
      return {
        label: date.toLocaleDateString("es-ES", { weekday: "short" }),
        hours: Math.round((totalMinutesDay / 60) * 10) / 10,
        target: targetHours,
      };
    });

  const handleInvalid = (text: string, ms = 2500) => {
    setMessage(text);
    setTimeout(() => setMessage(null), ms);
  };

  const handleCheckIn = async () => {
    if (status !== "OFF") {
      handleInvalid("Ya existe un registro abierto hoy.");
      return;
    }
    if (!user) return;
    const record = createCheckIn(user.uid, new Date());
    if (record) {
      // Write timeEntry first — lightweight record that powers the recovery effect.
      // Even if persistAttendanceRecord fails, the next session can reconstruct the shift.
      if (record.checkInAt) {
        try {
          await upsertTimeEntry({ uid: user.uid, type: "clock_in", tsISO: record.checkInAt });
        } catch (teError) {
          console.error("[attendance] Failed to write timeEntry for check-in", teError);
        }
      }
      try {
        await persistAttendanceRecord(user.uid, record);
      } catch (error) {
        console.error("[attendance] Error saving open shift after check-in", error);
        handleInvalid("Se marcó la entrada, pero no se pudo sincronizar el turno abierto.");
      }
    }
    reloadToday();
    reloadWeek();
  };

  // Always write todayRecord (from Firestore) into localStorage before any mutation.
  // Checking existence-only is insufficient: the local record can be stale (e.g., breaks added on
  // another device won't be present), causing checkOut / endBreak to silently operate on stale data.
  const ensureLocalRecord = () => {
    if (!todayRecord) return;
    upsertAttendanceRecord(todayRecord);
  };

  const handleStartBreak = async () => {
    if (status !== "IN_SHIFT") {
      handleInvalid("No puedes iniciar descanso ahora.");
      return;
    }
    if (!user) return;
    ensureLocalRecord();
    const record = startBreak(user.uid, new Date());
    if (record) {
      try {
        await persistAttendanceRecord(user.uid, record);
      } catch (error) {
        console.error("[attendance] Error persisting break start", error);
        handleInvalid("Se inició el descanso, pero no se pudo sincronizar el cambio.");
      }
    }
    reloadToday();
  };

  const handleEndBreak = async () => {
    if (status !== "ON_BREAK") {
      handleInvalid("No hay descanso activo.");
      return;
    }
    if (!user) return;
    ensureLocalRecord();
    const record = endBreak(user.uid, new Date());
    if (record) {
      setTodayRecord(record);
      try {
        await persistAttendanceRecord(user.uid, record);
      } catch (error) {
        console.error("[attendance] Error persisting break end", error);
        handleInvalid("Se finalizó el descanso, pero no se pudo sincronizar el cambio.");
      }
    }
  };

  const [lunchConfirmPending, setLunchConfirmPending] = useState(false);
  const pendingCheckoutAtRef = useRef<Date | null>(null);

  const cancelLunchConfirm = () => {
    setLunchConfirmPending(false);
    pendingCheckoutAtRef.current = null;
  };

  // Lógica de cierre real — separada para poder llamarla desde los dos caminos de confirmación
  const doCheckOut = async (at: Date) => {
    setLunchConfirmPending(false);
    pendingCheckoutAtRef.current = null;
    const record = checkOut(user!.uid, at);
    if (!record) {
      handleInvalid("No se encontró la hora de entrada. Solicita una corrección al administrador.", 6000);
      return;
    }
    // Defensive: checkOut may return the record unchanged if something unexpected blocked it.
    if (!record.checkOutAt) {
      handleInvalid("No se pudo cerrar el turno. Recarga la página e intenta de nuevo.", 6000);
      return;
    }
    try {
      await persistAttendanceRecord(user!.uid, record);
      if (record.checkOutAt) {
        await upsertTimeEntry({
          uid: user!.uid,
          type: "clock_out",
          tsISO: record.checkOutAt,
          totalMinutes: record.totalMinutes,
        });
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error("[attendance] Error saving hours record", err?.code, err?.message, error);
      handleInvalid("No se pudo guardar el registro de horas. Verifica tus permisos.", 5000);
    }
    setTodayRecord(record);
    setNote(record.notes ?? "");
    reloadWeek();
  };

  // Salir sin registrar → auto-asigna 1:15 h retroactivo
  const confirmCheckOutAutoLunch = async () => {
    if (!user || !todayRecord) return;
    const at = pendingCheckoutAtRef.current ?? new Date();
    const breakEndISO   = at.toISOString();
    const breakStartISO = new Date(at.getTime() - 75 * 60000).toISOString();
    const withBreak: AttendanceRecord = {
      ...todayRecord,
      breaks: [...todayRecord.breaks, { startAt: breakStartISO, endAt: breakEndISO }],
    };
    upsertAttendanceRecord(withBreak);
    try {
      await persistAttendanceRecord(user.uid, withBreak);
    } catch (error) {
      console.error("[attendance] Error persisting auto lunch on exit", error);
    }
    await doCheckOut(at);
  };

  // Registrar el almuerzo con tiempos reales proporcionados por el usuario y salir
  const confirmCheckOutWithCustomLunch = async (startISO: string, endISO: string) => {
    if (!user || !todayRecord) return;
    const at = pendingCheckoutAtRef.current ?? new Date();
    const withBreak: AttendanceRecord = {
      ...todayRecord,
      breaks: [...todayRecord.breaks, { startAt: startISO, endAt: endISO }],
    };
    upsertAttendanceRecord(withBreak);
    try {
      await persistAttendanceRecord(user.uid, withBreak);
    } catch (error) {
      console.error("[attendance] Error persisting custom lunch on checkout", error);
    }
    await doCheckOut(at);
  };

  const handleCheckOut = async () => {
    if (status !== "IN_SHIFT" && status !== "ON_BREAK") {
      handleInvalid("No hay turno activo para cerrar.");
      return;
    }
    if (!user) return;

    // Si quedó en pausa abierta (e.g. browser cerrado a mitad), cerrar la pausa antes de salir
    if (status === "ON_BREAK") {
      ensureLocalRecord();
      const breakRecord = endBreak(user.uid, new Date());
      if (breakRecord) {
        try {
          await persistAttendanceRecord(user.uid, breakRecord);
        } catch (error) {
          console.error("[attendance] Error auto-closing break before checkout", error);
        }
      }
    }

    ensureLocalRecord();

    const now = new Date();
    const isSaturday = now.getDay() === 6;

    // Si trabajaron ≥4h sin almuerzo registrado y NO es sábado → pedir confirmación en lugar de auto-asignar
    if (!isSaturday && status === "IN_SHIFT" && todayRecord?.checkInAt) {
      const elapsedMinutes = (now.getTime() - new Date(todayRecord.checkInAt).getTime()) / 60000;
      if (elapsedMinutes >= 240 && breakMinutes < 30) {
        pendingCheckoutAtRef.current = now;
        setLunchConfirmPending(true);
        return; // Esperar respuesta del usuario
      }
    }

    await doCheckOut(now);
  };

  const handleSaveNote = () => {
    const dateISO = formatISODate(new Date());
    if (!todayRecord) {
      handleInvalid("Primero marca tu entrada.");
      return;
    }
    if (!user) return;
    const record = saveNote(user.uid, dateISO, note.trim());
    if (record) {
      void persistAttendanceRecord(user.uid, record).catch((error) => {
        console.error("[attendance] Error persisting note", error);
        handleInvalid("La nota se guardó, pero no se pudo sincronizar.");
      });
    }
    reloadToday();
  };

  return {
    todayRecord,
    hasLoadedToday,
    hasLoadedHolidays,
    firestoreError,
    note,
    setNote,
    message,
    setMessage,
    weekOffset,
    setWeekOffset,
    weekStart,
    weekDates,
    weekRecords,
    schedule,
    dailyGoalMinutes,
    weeklyGoalMinutes,
    status,
    breakMinutes,
    totalMinutes,
    workedMinutesWeek,
    expectedMinutesWeek,
    diffMinutes,
    totalBalanceMinutes,
    completedDays,
    expectedWorkDays,
    chartData,
    approvedCredits,
    approvedExtraMinutesWeek,
    approvedRequestMinutesWeek,
    handleCheckIn,
    handleStartBreak,
    handleEndBreak,
    handleCheckOut,
    handleSaveNote,
    lunchConfirmPending,
    cancelLunchConfirm,
    confirmCheckOutAutoLunch,
    confirmCheckOutWithCustomLunch,
  };
}
