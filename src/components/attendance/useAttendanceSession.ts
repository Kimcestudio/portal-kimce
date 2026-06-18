"use client";

import { useEffect, useMemo, useState } from "react";
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
  const dayKey = params.tsISO.slice(0, 10);
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
  const payload: Record<string, unknown> = {
    uid,
    date: record.date,
    weekKey,
    hours: hoursValue,
    totalMinutes: record.totalMinutes,
    checkOutAt: record.checkOutAt ?? null,
    breaks: record.breaks ?? [],
    status: record.status,
    notes: record.notes ?? null,
    updatedAt: serverTimestamp(),
  };
  if (record.checkInAt) {
    payload.checkInAt = record.checkInAt;
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
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);
  const [persistedRecords, setPersistedRecords] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULES[0]);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [todayEntrySnapshot, setTodayEntrySnapshot] = useState<{
    checkInAt: string | null;
    checkOutAt: string | null;
  }>({ checkInAt: null, checkOutAt: null });

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

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeCalendarHolidays(setHolidays);
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
      },
      (error) => {
        console.error("[attendance] Error loading persisted hour records", error);
        setPersistedRecords([]);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setTodayEntrySnapshot({ checkInAt: null, checkOutAt: null });
      return;
    }

    const todayISO = formatISODate(new Date());
    const entriesRef = query(
      collection(db, "timeEntries"),
      where("uid", "==", user.uid),
      where("dayKey", "==", todayISO),
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
      },
      (error) => {
        console.error("[attendance] Error loading today's time entries", error);
        setTodayEntrySnapshot({ checkInAt: null, checkOutAt: null });
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

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
    const todayISO = formatISODate(new Date());
    const persistedToday = persistedRecords.find((record) => record.date === todayISO) ?? null;
    const localToday = getTodayRecord(user.uid, todayISO);
    const canRecoverOpenShift =
      Boolean(todayEntrySnapshot.checkInAt) &&
      !todayEntrySnapshot.checkOutAt &&
      !persistedToday &&
      !localToday;

    if (!canRecoverOpenShift || !todayEntrySnapshot.checkInAt) return;

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
    const todayISO = formatISODate(new Date());
    const persistedToday = persistedRecords.find((r) => r.date === todayISO) ?? null;
    if (!persistedToday || persistedToday.checkInAt || !todayEntrySnapshot.checkInAt) return;
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

  const handleInvalid = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleCheckIn = async () => {
    if (status !== "OFF") {
      handleInvalid("Ya existe un registro abierto hoy.");
      return;
    }
    if (!user) return;
    const record = createCheckIn(user.uid, new Date());
    if (record) {
      try {
        await persistAttendanceRecord(user.uid, record);
        if (record.checkInAt) {
          await upsertTimeEntry({ uid: user.uid, type: "clock_in", tsISO: record.checkInAt });
        }
      } catch (error) {
        console.error("[attendance] Error saving open shift after check-in", error);
        setMessage("Se marcó la entrada, pero no se pudo sincronizar el turno abierto.");
      }
    }
    reloadToday();
    reloadWeek();
  };

  const handleStartBreak = async () => {
    if (status !== "IN_SHIFT") {
      handleInvalid("No puedes iniciar descanso ahora.");
      return;
    }
    if (!user) return;
    const record = startBreak(user.uid, new Date());
    if (record) {
      try {
        await persistAttendanceRecord(user.uid, record);
      } catch (error) {
        console.error("[attendance] Error persisting break start", error);
        setMessage("Se inició el descanso, pero no se pudo sincronizar el cambio.");
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
    const record = endBreak(user.uid, new Date());
    if (record) {
      try {
        await persistAttendanceRecord(user.uid, record);
      } catch (error) {
        console.error("[attendance] Error persisting break end", error);
        setMessage("Se finalizó el descanso, pero no se pudo sincronizar el cambio.");
      }
    }
    reloadToday();
  };

  const handleCheckOut = async () => {
    if (status !== "IN_SHIFT") {
      handleInvalid("Debes finalizar descanso antes de salir.");
      return;
    }
    if (!user) return;
    const record = checkOut(user.uid, new Date());
    if (!record) return;
    try {
      await persistAttendanceRecord(user.uid, record);
      if (record.checkOutAt) {
        await upsertTimeEntry({
          uid: user.uid,
          type: "clock_out",
          tsISO: record.checkOutAt,
          totalMinutes: record.totalMinutes,
        });
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error("[attendance] Error saving hours record", err?.code, err?.message, error);
      setMessage("No se pudo guardar el registro de horas. Verifica tus permisos.");
    }
    reloadToday();
    reloadWeek();
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
        setMessage("La nota se guardó, pero no se pudo sincronizar.");
      });
    }
    reloadToday();
  };

  return {
    todayRecord,
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
    chartData,
    approvedCredits,
    approvedExtraMinutesWeek,
    approvedRequestMinutesWeek,
    handleCheckIn,
    handleStartBreak,
    handleEndBreak,
    handleCheckOut,
    handleSaveNote,
  };
}
