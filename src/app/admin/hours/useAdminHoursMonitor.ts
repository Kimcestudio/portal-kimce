"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  buildAdminWeeklyAttendanceAlerts,
  buildAdminWeeklyAttendanceDetail,
  buildAdminWeeklyAttendanceSummaries,
  buildApprovedAttendanceCredits,
  buildAttendanceRecordsFromTimeEntries,
  computeLiveMinutes,
  formatISODate,
  getWeekDates,
  getWeekKey,
  getWeekStartMonday,
  mergeAttendanceRecords,
  minutesToHHMM,
  type AdminHoursDetailModel,
  type AdminHoursSummaryRow,
  type ApprovedAttendanceExtra,
  type ApprovedAttendanceRequest,
  type AttendanceTimeEntryEvent,
} from "@/lib/attendanceUtils";
import { db } from "@/services/firebase/client";
import { DEFAULT_WORK_SCHEDULES } from "@/services/firebase/workSchedules";
import type { AdminAttendanceRecord, UserProfile, WorkSchedule } from "@/services/firebase/types";
import { subscribeCalendarHolidays, type CalendarHolidayRecord } from "@/services/calendar";

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

export type FirestoreUser = UserProfile & {
  uid: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  profilePhoto?: string;
  orgTeam?: string;
  orgParentId?: string;
  orgNodeType?: "root" | "leader" | "member";
};

type HourRecord = AdminAttendanceRecord & {
  weekKey: string;
};

export type DeleteMode = "ALL" | "TIME_ONLY" | "REQUESTS_ONLY";

const MAX_DELETE_BATCH = 400;

const normalizeTimestamp = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as FirestoreTimestamp;
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
};

export const getUserDisplayName = (user: FirestoreUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

async function deleteByField(collectionName: string, field: "uid" | "userId", targetUid: string) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await getDocs(query(collection(db, collectionName), where(field, "==", targetUid)));
    if (snapshot.empty) break;

    const docs = snapshot.docs.slice(0, MAX_DELETE_BATCH);
    const batch = writeBatch(db);
    docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    totalDeleted += docs.length;
    if (snapshot.size <= MAX_DELETE_BATCH) break;
  }

  return totalDeleted;
}

async function deleteUserSubcollectionDocs(targetUid: string, subcollectionName: string) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await getDocs(collection(db, "users", targetUid, subcollectionName));
    if (snapshot.empty) break;

    const docs = snapshot.docs.slice(0, MAX_DELETE_BATCH);
    const batch = writeBatch(db);
    docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    totalDeleted += docs.length;
    if (snapshot.size <= MAX_DELETE_BATCH) break;
  }

  return totalDeleted;
}

async function directDeleteCollaboratorData(targetUid: string, mode: DeleteMode) {
  const deleted = {
    timeEntries: 0,
    hourRequests: 0,
    extraActivities: 0,
    usersHours: 0,
    usersHourRequests: 0,
    usersExtraActivities: 0,
  };

  if (mode === "ALL" || mode === "TIME_ONLY") {
    deleted.timeEntries += await deleteByField("timeEntries", "uid", targetUid);
    deleted.timeEntries += await deleteByField("timeEntries", "userId", targetUid);
    deleted.usersHours += await deleteUserSubcollectionDocs(targetUid, "hours");
  }

  if (mode === "ALL" || mode === "REQUESTS_ONLY") {
    deleted.hourRequests += await deleteByField("hourRequests", "uid", targetUid);
    deleted.hourRequests += await deleteByField("hourRequests", "userId", targetUid);
    deleted.extraActivities += await deleteByField("extraActivities", "uid", targetUid);
    deleted.extraActivities += await deleteByField("extraActivities", "userId", targetUid);
    deleted.usersHourRequests += await deleteUserSubcollectionDocs(targetUid, "hourRequests");
    deleted.usersExtraActivities += await deleteUserSubcollectionDocs(targetUid, "extraActivities");
  }

  return deleted;
}

export function useAdminHoursMonitor(userRole?: string) {
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [deleteTargetUserId, setDeleteTargetUserId] = useState<string>("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [records, setRecords] = useState<HourRecord[]>([]);
  const [approvedExtraActivities, setApprovedExtraActivities] = useState<ApprovedAttendanceExtra[]>([]);
  const [approvedHourRequests, setApprovedHourRequests] = useState<ApprovedAttendanceRequest[]>([]);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCollaboratorData, setDeletingCollaboratorData] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("ALL");
  const detailSectionRef = useRef<HTMLDivElement | null>(null);

  const scheduleOptions = workSchedules.length > 0 ? workSchedules : DEFAULT_WORK_SCHEDULES;
  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((schedule) => [schedule.id, schedule])),
    [scheduleOptions],
  );

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);
  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  useEffect(() => {
    if (userRole !== "admin") return;

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: (data.uid ?? docSnap.id) as string,
            email: (data.email ?? "") as string,
            displayName: (data.displayName ?? "") as string,
            name: data.name as string | undefined,
            fullName: data.fullName as string | undefined,
            photoURL: (data.photoURL ?? "") as string,
            avatarUrl: data.avatarUrl as string | undefined,
            profilePhoto: data.profilePhoto as string | undefined,
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: (data.position ?? "") as string,
            workScheduleId: data.workScheduleId as string | undefined,
            orgTeam: data.orgTeam as string | undefined,
            orgParentId: data.orgParentId as string | undefined,
            orgNodeType: data.orgNodeType as FirestoreUser["orgNodeType"],
            active: (data.active ?? data.isActive ?? true) as boolean,
            approved: data.approved as boolean | undefined,
            isActive: data.isActive as boolean | undefined,
            createdAt: normalizeTimestamp(data.createdAt) ?? undefined,
          } as FirestoreUser;
        });

        setUsers(nextUsers);
        setLoading(false);
      },
      (error) => {
        console.error("[admin/hours] Error loading users", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userRole]);

  useEffect(() => {
    if (userRole !== "admin") return;

    const schedulesRef = collection(db, "workSchedules");
    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        if (snapshot.empty) {
          setWorkSchedules(DEFAULT_WORK_SCHEDULES);
          return;
        }

        setWorkSchedules(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            return {
              id: docSnap.id,
              name: (data.name as string) ?? "Jornada",
              weeklyMinutes: (data.weeklyMinutes as number) ?? DEFAULT_WORK_SCHEDULES[0].weeklyMinutes,
              days: (data.days as WorkSchedule["days"]) ?? DEFAULT_WORK_SCHEDULES[0].days,
            };
          }),
        );
      },
      (error) => {
        console.error("[admin/hours] Error loading work schedules", error);
        setWorkSchedules(DEFAULT_WORK_SCHEDULES);
      },
    );

    return () => unsubscribe();
  }, [userRole]);

  useEffect(() => {
    if (userRole !== "admin") return;

    let persistedRecords: AdminAttendanceRecord[] = [];
    let timeEntryFallbackRecords: AdminAttendanceRecord[] = [];

    const syncMergedRecords = () => {
      const merged = mergeAttendanceRecords(persistedRecords, timeEntryFallbackRecords).map((record) => ({
        ...record,
        weekKey: getWeekKey(record.date),
      }));
      setRecords(merged);
    };

    const unsubscribeHours = onSnapshot(
      collectionGroup(db, "hours"),
      (snapshot) => {
        persistedRecords = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = (data.uid ?? docSnap.ref.parent.parent?.id) as string | undefined;
            const date = (data.date as string | undefined) ?? "";
            if (!uid || !date) return null;

            return {
              id: docSnap.id,
              userId: uid,
              date,
              checkInAt: normalizeTimestamp(data.checkInAt) ?? (typeof data.checkInAt === "string" ? data.checkInAt : null),
              checkOutAt: normalizeTimestamp(data.checkOutAt) ?? (typeof data.checkOutAt === "string" ? data.checkOutAt : null),
              breaks: Array.isArray(data.breaks) ? data.breaks : [],
              notes: typeof data.notes === "string" ? data.notes : null,
              totalMinutes: typeof data.totalMinutes === "number" ? data.totalMinutes : 0,
              status: (data.status as AdminAttendanceRecord["status"] | undefined) ?? "CLOSED",
            } satisfies AdminAttendanceRecord;
          })
          .filter(Boolean) as AdminAttendanceRecord[];

        syncMergedRecords();
      },
      (error) => console.error("[admin/hours] Error loading persisted hours", error),
    );

    const unsubscribeTimeEntries = onSnapshot(
      collection(db, "timeEntries"),
      (snapshot) => {
        const events: AttendanceTimeEntryEvent[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = (data.uid ?? data.userId) as string | undefined;
            const tsISO = normalizeTimestamp(data.ts) ?? normalizeTimestamp(data.createdAt) ?? "";
            const dayKey =
              (typeof data.dayKey === "string" ? data.dayKey : "") ||
              (tsISO ? tsISO.slice(0, 10) : "");

            if (!uid || !dayKey || !tsISO) return null;

            return {
              uid,
              dayKey,
              weekKey: typeof data.weekKey === "string" && data.weekKey.length > 0 ? data.weekKey : getWeekKey(dayKey),
              type: typeof data.type === "string" ? data.type : "manual",
              ts: tsISO,
              totalMinutes: typeof data.totalMinutes === "number" ? data.totalMinutes : undefined,
            } satisfies AttendanceTimeEntryEvent;
          })
          .filter(Boolean) as AttendanceTimeEntryEvent[];

        timeEntryFallbackRecords = buildAttendanceRecordsFromTimeEntries(events);
        syncMergedRecords();
      },
      (error) => console.error("[admin/hours] Error loading timeEntries", error),
    );

    return () => {
      unsubscribeHours();
      unsubscribeTimeEntries();
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole !== "admin") return;

    const unsubscribe = onSnapshot(
      collection(db, "extraActivities"),
      (snapshot) => {
        const approved = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
            if (status !== "approved") return null;

            const uid = (data.uid ?? data.userId) as string | undefined;
            const dateValue =
              (typeof data.date === "string" ? data.date : "") ||
              (normalizeTimestamp(data.createdAt)?.slice(0, 10) ?? "");
            const minutes =
              typeof data.minutes === "number"
                ? data.minutes
                : typeof data.hours === "number"
                  ? Math.round(data.hours * 60)
                  : 0;

            if (!uid || !dateValue) return null;
            return {
              uid,
              date: dateValue,
              minutes,
              type: typeof data.type === "string" ? data.type : "EXTRA_ACTIVIDAD",
              note: (data.note ?? data.reason) as string | null | undefined,
            } satisfies ApprovedAttendanceExtra;
          })
          .filter(Boolean) as ApprovedAttendanceExtra[];

        setApprovedExtraActivities(approved);
      },
      (error) => console.error("[admin/hours] Error loading approved extra activities", error),
    );

    return () => unsubscribe();
  }, [userRole]);

  useEffect(() => {
    if (userRole !== "admin") return;

    const unsubscribe = onSnapshot(
      collection(db, "hourRequests"),
      (snapshot) => {
        const approved = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
            if (status !== "approved") return null;

            const uid = (data.uid ?? data.userId) as string | undefined;
            const date = typeof data.date === "string" ? data.date : "";
            if (!uid || !date) return null;

            return {
              uid,
              type: typeof data.type === "string" ? data.type : "DIA_LIBRE",
              date,
              endDate: typeof data.endDate === "string" ? data.endDate : null,
              hours: typeof data.hours === "number" ? data.hours : null,
              reason: typeof data.reason === "string" ? data.reason : null,
            } satisfies ApprovedAttendanceRequest;
          })
          .filter(Boolean) as ApprovedAttendanceRequest[];

        setApprovedHourRequests(approved);
      },
      (error) => console.error("[admin/hours] Error loading approved hour requests", error),
    );

    return () => unsubscribe();
  }, [userRole]);

  useEffect(() => {
    if (userRole !== "admin") return;
    return subscribeCalendarHolidays(setHolidays);
  }, [userRole]);

  const collaboratorUsers = useMemo(
    () =>
      users.filter(
        (item) =>
          item.role !== "admin" &&
          item.approved === true &&
          (item.isActive ?? item.active ?? true) !== false,
      ),
    [users],
  );

  const credits = useMemo(
    () =>
      buildApprovedAttendanceCredits({
        extras: approvedExtraActivities,
        requests: approvedHourRequests,
        getScheduleForUser: (uid) => {
          const collaborator = collaboratorUsers.find((item) => item.uid === uid);
          if (!collaborator) return scheduleOptions[0] ?? null;
          return scheduleById.get(collaborator.workScheduleId ?? "") ?? scheduleOptions[0] ?? null;
        },
      }),
    [approvedExtraActivities, approvedHourRequests, collaboratorUsers, scheduleById, scheduleOptions],
  );

  const LIVE_STALE_THRESHOLD_MS = 20 * 60 * 60 * 1000; // 20 hours — beyond this, an OPEN record is a stuck bug

  const liveRecords = useMemo(() => {
    const now = new Date();
    return records.map((record) => {
      if (record.status !== "OPEN" || !record.checkInAt) return record;
      const age = now.getTime() - new Date(record.checkInAt).getTime();
      if (age > LIVE_STALE_THRESHOLD_MS) return record;
      return { ...record, totalMinutes: computeLiveMinutes(record, now) };
    });
  }, [records]);

  const filteredRecords = useMemo(
    () => liveRecords.filter((record) => record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))),
    [liveRecords, weekDateSet, weekKey],
  );

  const summaries = useMemo<AdminHoursSummaryRow[]>(() => {
    return buildAdminWeeklyAttendanceSummaries({
      users: collaboratorUsers,
      selectedUserId,
      records: filteredRecords,
      allRecords: liveRecords,
      weekDates,
      weekDateSet,
      credits,
      holidayDates: holidayDateSet,
      getScheduleForUser: (uid) => scheduleById.get(collaboratorUsers.find((item) => item.uid === uid)?.workScheduleId ?? "") ?? scheduleOptions[0] ?? null,
    });
  }, [collaboratorUsers, credits, filteredRecords, holidayDateSet, liveRecords, scheduleById, scheduleOptions, selectedUserId, weekDateSet, weekDates]);

  const globalKpis = useMemo(() => {
    const totalCollaborators = summaries.length;
    const pendingCount = summaries.filter((item) => !item.hasStarted || item.diffMinutes < 0).length;
    const onTrackCount = totalCollaborators - pendingCount;
    const totalWorkedMinutes = summaries.reduce((sum, item) => sum + item.totalMinutes, 0);
    const totalExpectedMinutes = summaries.reduce((sum, item) => sum + item.expectedMinutes, 0);
    const totalDiffMinutes = totalWorkedMinutes - totalExpectedMinutes;
    const completionRate =
      totalExpectedMinutes > 0 ? Math.round((totalWorkedMinutes / totalExpectedMinutes) * 100) : 0;

    return {
      totalCollaborators,
      pendingCount,
      onTrackCount,
      totalWorkedMinutes,
      totalExpectedMinutes,
      totalDiffMinutes,
      completionRate,
    };
  }, [summaries]);

  const globalChartData = useMemo(
    () =>
      summaries
        .map((item) => {
          const completion = item.expectedMinutes > 0 ? Math.round((item.totalMinutes / item.expectedMinutes) * 100) : 0;
          return {
            uid: item.user.uid,
            name: getUserDisplayName(item.user),
            workedHours: Math.round((item.totalMinutes / 60) * 10) / 10,
            expectedHours: Math.round((item.expectedMinutes / 60) * 10) / 10,
            workedLabel: minutesToHHMM(item.totalMinutes),
            expectedLabel: minutesToHHMM(item.expectedMinutes),
            completionRate: completion,
            workedColor: completion >= 100 ? "#10b981" : completion >= 70 ? "#4f46e5" : "#f59e0b",
          };
        })
        .sort((a, b) => b.workedHours - a.workedHours)
        .slice(0, 10),
    [summaries],
  );

  const weeklyAlerts = useMemo(
    () =>
      buildAdminWeeklyAttendanceAlerts({
        summaries,
        weekDates,
      }),
    [summaries, weekDates],
  );

  useEffect(() => {
    if (selectedUserId === "all") {
      setDetailUserId(null);
      setDeleteTargetUserId("all");
      return;
    }

    setDetailUserId(selectedUserId);
    setDeleteTargetUserId(selectedUserId);
  }, [selectedUserId]);

  const detailUser = detailUserId ? collaboratorUsers.find((item) => item.uid === detailUserId) ?? null : null;

  const detail = useMemo<AdminHoursDetailModel | null>(() => {
    if (!detailUser) return null;

    const detailRecords = liveRecords.filter(
      (record) =>
        record.userId === detailUser.uid &&
        (record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))),
    );

    const detailSchedule = scheduleById.get(detailUser.workScheduleId ?? "") ?? scheduleOptions[0] ?? null;
    const detailAllRecords = liveRecords.filter((record) => record.userId === detailUser.uid);
    const detailWeekCredits = credits.filter((credit) => credit.uid === detailUser.uid && weekDateSet.has(credit.date));
    return buildAdminWeeklyAttendanceDetail({
      user: detailUser,
      records: detailRecords,
      allRecords: detailAllRecords,
      weekDates,
      weekDateSet,
      weekCredits: detailWeekCredits,
      allCredits: credits.filter((credit) => credit.uid === detailUser.uid),
      schedule: detailSchedule,
      holidayDates: holidayDateSet,
    });
  }, [collaboratorUsers, credits, detailUser, holidayDateSet, liveRecords, scheduleById, scheduleOptions, weekDateSet, weekDates, weekKey]);

  const handleSelectCollaborator = (clickedUid: string) => {
    setDetailUserId(clickedUid);
    setDeleteTargetUserId(clickedUid);

    requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openRecordsCount = useMemo(
    () => records.filter((r) => r.status === "OPEN").length,
    [records],
  );

  const [cleaningOpenShifts, setCleaningOpenShifts] = useState(false);

  const handleCleanOpenShifts = async () => {
    const confirmed = window.confirm(
      `Se eliminarán ${openRecordsCount} fichaje(s) abierto(s) (con entrada pero sin salida) de todos los colaboradores y semanas. Esta acción es irreversible.`,
    );
    if (!confirmed) return;

    setCleaningOpenShifts(true);
    try {
      // Collect open uid+date pairs from two sources:
      // 1. hours subdocs in Firestore (real persisted records)
      // 2. in-memory records (covers OPEN records reconstructed from timeEntries with no hours subdoc)
      const uidDateMap = new Map<string, { uid: string; date: string }>();

      records
        .filter((r) => r.status === "OPEN")
        .forEach((r) => {
          if (r.userId && r.date) uidDateMap.set(`${r.userId}_${r.date}`, { uid: r.userId, date: r.date });
        });

      // Step 1: delete open hours subdocs
      const allHoursSnapshot = await getDocs(collectionGroup(db, "hours"));
      const openHoursDocs = allHoursSnapshot.docs.filter(
        (docSnap) => (docSnap.data() as DocumentData).status === "OPEN",
      );

      let currentBatch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of openHoursDocs) {
        const data = docSnap.data() as DocumentData;
        const uid = (data.uid ?? docSnap.ref.parent.parent?.id) as string | undefined;
        const date = data.date as string | undefined;
        if (uid && date) uidDateMap.set(`${uid}_${date}`, { uid, date });
        currentBatch.delete(docSnap.ref);
        batchCount++;
        if (batchCount >= 400) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) await currentBatch.commit();

      // Step 2: delete timeEntries for all open uid+date pairs (both sources)
      for (const { uid, date } of uidDateMap.values()) {
        for (const field of ["uid", "userId"] as const) {
          const teSnapshot = await getDocs(
            query(
              collection(db, "timeEntries"),
              where(field, "==", uid),
              where("dayKey", "==", date),
            ),
          );
          if (teSnapshot.empty) continue;
          const teBatch = writeBatch(db);
          teSnapshot.docs.forEach((d) => teBatch.delete(d.ref));
          await teBatch.commit();
        }
      }

      window.alert(
        `Se eliminaron ${uidDateMap.size} fichaje(s) abierto(s) y sus eventos de reloj correspondientes.`,
      );
    } catch (error) {
      console.error("[admin/hours] Error cleaning open shifts", error);
      window.alert("Ocurrió un error al limpiar los fichajes abiertos. Intenta nuevamente.");
    } finally {
      setCleaningOpenShifts(false);
    }
  };

  const handleDeleteCollaboratorData = async (actingUserUid: string | undefined, mode: DeleteMode) => {
    if (!actingUserUid) return;
    if (deleteTargetUserId === "all") return;

    const collaborator = collaboratorUsers.find((item) => item.uid === deleteTargetUserId) ?? null;
    const collaboratorName = collaborator ? getUserDisplayName(collaborator) : deleteTargetUserId;
    const confirmed = window.confirm(
      `Se eliminará ${
        mode === "TIME_ONLY"
          ? "solo fichajes de horas"
          : mode === "REQUESTS_ONLY"
            ? "solo solicitudes y actividades"
            : "todos los datos (horas + solicitudes + actividades)"
      } del colaborador ${collaboratorName}. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeleteModalOpen(false);
    setDeletingCollaboratorData(true);
    try {
      const functions = getFunctions();
      const deleteCallable = httpsCallable<
        { targetUid: string; mode?: DeleteMode },
        { ok: boolean; deleted?: Record<string, number> }
      >(functions, "adminDeleteUserData");

      const response = await deleteCallable({ targetUid: deleteTargetUserId, mode });
      if (!response.data?.ok) {
        window.alert("No se pudo confirmar la eliminación de datos.");
        return;
      }

      await directDeleteCollaboratorData(deleteTargetUserId, mode);
      window.alert("Datos del colaborador eliminados correctamente y sincronizados en la base de datos activa.");
    } catch (error) {
      const firebaseCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown";
      console.error(`[admin/hours] Error eliminando datos del colaborador (code: ${firebaseCode})`, error);

      try {
        await directDeleteCollaboratorData(deleteTargetUserId, mode);
        window.alert("Cloud Function no respondió correctamente, pero se aplicó eliminación directa en la base actual.");
      } catch (directError) {
        console.error("[admin/hours] Fallback direct delete failed", directError);
        if (firebaseCode.includes("permission-denied")) {
          window.alert("Tu usuario no tiene permisos de admin o reglas/roles no están correctos.");
        } else {
          window.alert("No se pudieron eliminar los datos del colaborador. Intenta nuevamente.");
        }
      }
    } finally {
      setDeletingCollaboratorData(false);
    }
  };

  return {
    weekStart,
    setWeekStart,
    weekKey,
    weekDates,
    selectedUserId,
    setSelectedUserId,
    deleteTargetUserId,
    setDeleteTargetUserId,
    detailUserId,
    setDetailUserId,
    detailSectionRef,
    collaboratorUsers,
    loading,
    deleteModalOpen,
    setDeleteModalOpen,
    deleteMode,
    setDeleteMode,
    deletingCollaboratorData,
    summaries,
    weeklyAlerts,
    globalKpis,
    globalChartData,
    detail,
    holidays,
    holidayDateSet,
    openRecordsCount,
    cleaningOpenShifts,
    handleCleanOpenShifts,
    handleSelectCollaborator,
    handleDeleteCollaboratorData,
  };
}
