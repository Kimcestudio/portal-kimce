"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
import CollaboratorDashboard from "@/components/dashboard/CollaboratorDashboard";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  expectedMinutesForDate,
  formatISODate,
  formatTime,
  getWeekDates,
  getWeekKey,
  getWeekStartMonday,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { db } from "@/services/firebase/client";
import { DEFAULT_WORK_SCHEDULES } from "@/services/firebase/workSchedules";
import type { AdminAttendanceRecord, UserProfile, WorkSchedule } from "@/services/firebase/types";

type FirestoreUser = UserProfile & {
  uid: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  profilePhoto?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

type HourRecord = AdminAttendanceRecord & {
  weekKey: string;
};

type TimeEntryEvent = {
  uid: string;
  dayKey: string;
  weekKey: string;
  type: string;
  ts: string;
  totalMinutes?: number;
};

const GlobalHoursTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{row.name}</p>
      <p className="text-white/80">Trabajadas: {row.workedLabel}</p>
      <p className="text-white/80">Objetivo: {row.expectedLabel}</p>
    </div>
  );
};


const normalizeTimestamp = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as FirestoreTimestamp;
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
};

const getUserDisplayName = (user: FirestoreUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

function computeBreakMinutes(record: AdminAttendanceRecord | null) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

export default function AdminHoursPage() {
  const { user } = useAuth();

  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [deleteTargetUserId, setDeleteTargetUserId] = useState<string>("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [records, setRecords] = useState<HourRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCollaboratorData, setDeletingCollaboratorData] = useState(false);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);

  const scheduleOptions = workSchedules.length > 0 ? workSchedules : DEFAULT_WORK_SCHEDULES;

  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((schedule) => [schedule.id, schedule])),
    [scheduleOptions],
  );

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);

  // ---- USERS
  useEffect(() => {
    if (user?.role !== "admin") return;

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
            active: (data.active ?? data.isActive ?? true) as boolean,
            approved: data.approved as boolean | undefined,
            isActive: data.isActive as boolean | undefined,
            createdAt: normalizeTimestamp(data.createdAt) ?? undefined,
          } as FirestoreUser;
        });

        if (process.env.NODE_ENV === "development") {
          nextUsers.forEach((profile) => {
            if (!profile.displayName && !profile.fullName && !profile.name) {
              console.warn("[admin/hours] Missing displayName for user", profile.uid);
            }
          });
        }

        setUsers(nextUsers);
        setLoading(false);
      },
      (error) => {
        console.error("[admin/hours] Error loading users", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.role]);

  // ---- WORK SCHEDULES
  useEffect(() => {
    if (user?.role !== "admin") return;

    const schedulesRef = collection(db, "workSchedules");
    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        if (snapshot.empty) {
          setWorkSchedules(DEFAULT_WORK_SCHEDULES);
          return;
        }
        const nextSchedules = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: (data.name as string) ?? "Jornada",
            weeklyMinutes: (data.weeklyMinutes as number) ?? DEFAULT_WORK_SCHEDULES[0].weeklyMinutes,
            days: (data.days as WorkSchedule["days"]) ?? DEFAULT_WORK_SCHEDULES[0].days,
          };
        });
        setWorkSchedules(nextSchedules);
      },
      (error) => {
        console.error("[admin/hours] Error loading work schedules", error);
        setWorkSchedules(DEFAULT_WORK_SCHEDULES);
      },
    );

    return () => unsubscribe();
  }, [user?.role]);

  // ---- TIME ENTRIES → RECORDS
  useEffect(() => {
    if (user?.role !== "admin") return;

    const hoursRef = collection(db, "timeEntries");
    const unsubscribe = onSnapshot(
      hoursRef,
      (snapshot) => {
        if (process.env.NODE_ENV === "development") {
          const uidSet = new Set<string>();
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const userId = (data.uid ?? data.userId ?? "unknown") as string;
            uidSet.add(userId);
          });
          console.log("[admin/hours] timeEntries docs", snapshot.size);
          console.log("[admin/hours] timeEntries uids sample", Array.from(uidSet).slice(0, 10));
          const firstDoc = snapshot.docs[0]?.data() as DocumentData | undefined;
          if (firstDoc) console.log("[admin/hours] timeEntries sample keys", Object.keys(firstDoc));
        }

        const events: TimeEntryEvent[] = snapshot.docs
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
            } satisfies TimeEntryEvent;
          })
          .filter(Boolean) as TimeEntryEvent[];

        const grouped = new Map<string, TimeEntryEvent[]>();
        events.forEach((event) => {
          const key = `${event.uid}_${event.dayKey}`;
          const current = grouped.get(key) ?? [];
          current.push(event);
          grouped.set(key, current);
        });

        const nextRecords = Array.from(grouped.entries()).map(([key, dayEvents]) => {
          const checkInEvent = dayEvents
            .filter((event) => event.type === "clock_in")
            .sort((a, b) => a.ts.localeCompare(b.ts))[0];

          const checkOutEvent = dayEvents
            .filter((event) => event.type === "clock_out")
            .sort((a, b) => b.ts.localeCompare(a.ts))[0];

          const userId = dayEvents[0]?.uid ?? "unknown";
          const dateISO = dayEvents[0]?.dayKey ?? "";
          const weekKeyValue = dayEvents[0]?.weekKey ?? (dateISO ? getWeekKey(dateISO) : "");

          const derivedMinutes =
            checkInEvent && checkOutEvent
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(checkOutEvent.ts).getTime() - new Date(checkInEvent.ts).getTime()) / 60000,
                  ),
                )
              : 0;

          const totalMinutes = checkOutEvent?.totalMinutes ?? derivedMinutes;

          return {
            id: key,
            userId,
            date: dateISO,
            checkInAt: checkInEvent?.ts ?? null,
            checkOutAt: checkOutEvent?.ts ?? null,
            breaks: [],
            notes: null,
            totalMinutes,
            status: checkOutEvent ? "CLOSED" : "OPEN",
            weekKey: weekKeyValue,
          } satisfies HourRecord;
        });

        setRecords(nextRecords);
      },
      (error) => {
        console.error("[admin/hours] Error loading timeEntries", error);
      },
    );

    return () => unsubscribe();
  }, [user?.role]);

  const collaboratorUsers = useMemo(() => users.filter((item) => item.role !== "admin"), [users]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))),
    [records, weekDateSet, weekKey],
  );

  const summaries = useMemo(() => {
    const scopedUsers =
      selectedUserId === "all"
        ? collaboratorUsers
        : collaboratorUsers.filter((item) => item.uid === selectedUserId);

    return scopedUsers.map((item) => {
      const schedule = scheduleById.get(item.workScheduleId ?? "") ?? scheduleOptions[0];
      const weekRecords = filteredRecords.filter((record) => record.userId === item.uid);
      const totalMinutes = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);

      const expectedMinutes = weekDates.reduce((total, date) => total + expectedMinutesForDate(date, schedule), 0);
      const diffMinutes = totalMinutes - expectedMinutes;
      const status = diffMinutes < 0 ? "Pendiente" : "Al día";

      return {
        user: item,
        weekRecords,
        totalMinutes,
        expectedMinutes,
        diffMinutes,
        status,
        schedule,
      };
    });
  }, [collaboratorUsers, filteredRecords, scheduleById, scheduleOptions, selectedUserId, weekDates]);

  const globalKpis = useMemo(() => {
    const totalCollaborators = summaries.length;
    const pendingCount = summaries.filter((item) => item.diffMinutes < 0).length;
    const onTrackCount = totalCollaborators - pendingCount;
    const totalWorkedMinutes = summaries.reduce((sum, item) => sum + item.totalMinutes, 0);
    const totalExpectedMinutes = summaries.reduce((sum, item) => sum + item.expectedMinutes, 0);
    const totalDiffMinutes = totalWorkedMinutes - totalExpectedMinutes;
    const completionRate = totalExpectedMinutes > 0
      ? Math.round((totalWorkedMinutes / totalExpectedMinutes) * 100)
      : 0;

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
        .map((item) => ({
          uid: item.user.uid,
          name: getUserDisplayName(item.user),
          workedHours: Math.round((item.totalMinutes / 60) * 10) / 10,
          expectedHours: Math.round((item.expectedMinutes / 60) * 10) / 10,
          workedLabel: minutesToHHMM(item.totalMinutes),
          expectedLabel: minutesToHHMM(item.expectedMinutes),
        }))
        .sort((a, b) => b.workedHours - a.workedHours)
        .slice(0, 10),
    [summaries],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.log("[admin/hours] activeWeekKey", weekKey);
    console.log("[admin/hours] records total", records.length);
    console.log("[admin/hours] records after week filter", filteredRecords.length);
  }, [
    weekKey,
    records.length,
    filteredRecords.length,
  ]);

  const detailUser = detailUserId ? collaboratorUsers.find((item) => item.uid === detailUserId) ?? null : null;

  const detailRecords = detailUser
    ? records.filter(
        (record) =>
          record.userId === detailUser.uid &&
          (record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))),
      )
    : [];

  useEffect(() => {
    if (selectedUserId === "all") {
      setDetailUserId(null);
      setDeleteTargetUserId("all");
      return;
    }

    setDetailUserId(selectedUserId);
    setDeleteTargetUserId(selectedUserId);
  }, [selectedUserId]);

  const detailSchedule = detailUser
    ? scheduleById.get(detailUser.workScheduleId ?? "") ?? scheduleOptions[0]
    : null;

  const detailExpectedMinutesWeek = detailSchedule
    ? weekDates.reduce((total, date) => total + expectedMinutesForDate(date, detailSchedule), 0)
    : 0;

  const detailWorkedMinutesWeek = detailRecords.reduce((total, record) => total + record.totalMinutes, 0);
  const detailDiffMinutesWeek = detailWorkedMinutesWeek - detailExpectedMinutesWeek;

  const detailCompletedDays = detailRecords.filter((record) => {
    if (record.status !== "CLOSED") return false;
    return new Date(`${record.date}T00:00:00`).getDay() !== 0;
  }).length;

  const detailTotalBalanceMinutes = detailUser && detailSchedule
    ? records
        .filter((record) => record.userId === detailUser.uid)
        .reduce((sum, record) => {
          const recordDate = new Date(`${record.date}T00:00:00`);
          return sum + (record.totalMinutes - expectedMinutesForDate(recordDate, detailSchedule));
        }, 0)
    : 0;

  const detailChartData = detailSchedule
    ? weekDates
        .filter((date) => date.getDay() !== 0)
        .map((date) => {
          const dateISO = formatISODate(date);
          const record = detailRecords.find((item) => item.date === dateISO);
          const targetHours = expectedMinutesForDate(date, detailSchedule) / 60;

          return {
            label: date.toLocaleDateString("es-ES", { weekday: "short" }),
            hours: record ? Math.round((record.totalMinutes / 60) * 10) / 10 : 0,
            target: targetHours,
          };
        })
    : [];


  const handleSelectCollaboratorFromHours = (clickedUid: string) => {
    setDetailUserId(clickedUid);
    setDeleteTargetUserId((current) => {
      console.log("[admin/hours] collaborator selected from hours list", {
        clickedUid,
        before: current,
        after: clickedUid,
      });
      return clickedUid;
    });

    requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDeleteCollaboratorData = async () => {
    if (!user || user.role !== "admin") return;
    if (deleteTargetUserId === "all") return;

    const collaborator = collaboratorUsers.find((item) => item.uid === deleteTargetUserId) ?? null;
    const collaboratorName = collaborator ? getUserDisplayName(collaborator) : deleteTargetUserId;

    const confirmed = window.confirm(
      `Esto eliminará horarios y solicitudes del colaborador ${collaboratorName}. No se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingCollaboratorData(true);
    try {
      const functions = getFunctions();
      const deleteCallable = httpsCallable<
        { targetUid: string; mode?: "ALL" | "TIME_ONLY" },
        { ok: boolean; deleted?: Record<string, number> }
      >(functions, "adminDeleteUserData");

      const response = await deleteCallable({
        targetUid: deleteTargetUserId,
        mode: "ALL",
      });

      if (response.data?.ok) {
        window.alert("Datos del colaborador eliminados correctamente.");
      } else {
        window.alert("No se pudo confirmar la eliminación de datos.");
      }
    } catch (error) {
      const firebaseCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown";
      const firebaseMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";
      console.error(
        `[admin/hours] Error eliminando datos del colaborador (code: ${firebaseCode}, message: ${firebaseMessage})`,
        error,
      );
      if (firebaseCode.includes("permission-denied")) {
        window.alert("Tu usuario no tiene permisos de admin o reglas/roles no están correctos.");
      } else if (firebaseCode.includes("functions/internal") || firebaseCode === "internal") {
        window.alert("Error interno del servidor. Revisa los logs de Cloud Functions.");
      } else {
        window.alert("No se pudieron eliminar los datos del colaborador. Intenta nuevamente.");
      }
    } finally {
      setDeletingCollaboratorData(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      {/* ----------------------- HORARIOS ----------------------- */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Horarios</h2>
            <p className="text-xs text-slate-500">Vista semanal por colaborador (solo horarios).</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Semana
              <input
                className="mt-2 block rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                type="date"
                value={formatISODate(weekStart)}
                onChange={(event) => {
                  const next = new Date(event.target.value);
                  if (!Number.isNaN(next.getTime())) setWeekStart(getWeekStartMonday(next));
                }}
              />
            </label>

            <label className="text-xs font-semibold text-slate-500">
              Colaborador
              <select
                className="mt-2 block rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="all">Todos</option>
                {collaboratorUsers.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {getUserDisplayName(item)}
                  </option>
                ))}
              </select>
            </label>

          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-500">Colaboradores evaluados</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{globalKpis.totalCollaborators}</p>
            <p className="text-xs text-slate-500">Semana {formatISODate(weekStart)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-500">Cumpliendo meta semanal</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{globalKpis.onTrackCount}</p>
            <p className="text-xs text-slate-500">{globalKpis.pendingCount} con horas pendientes</p>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-500">Horas registradas globales</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{minutesToHHMM(globalKpis.totalWorkedMinutes)}</p>
            <p className="text-xs text-slate-500">Objetivo {minutesToHHMM(globalKpis.totalExpectedMinutes)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-500">Balance global</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {globalKpis.totalDiffMinutes < 0 ? "Deben" : "A favor"} {minutesToHHMM(Math.abs(globalKpis.totalDiffMinutes))}
            </p>
            <p className="text-xs text-slate-500">Avance total {globalKpis.completionRate}%</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200/60 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Top colaboradores por horas registradas</h3>
            <span className="text-xs text-slate-500">Click en una tarjeta para abrir su dashboard</span>
          </div>

          <div className="h-64">
            {globalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={globalChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<GlobalHoursTooltip />} />
                  <Bar dataKey="expectedHours" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="workedHours" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                No hay datos suficientes para el gráfico esta semana.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {summaries.map((item) => (
            <button
              key={item.user.uid}
              type="button"
              className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${detailUserId === item.user.uid ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200/60"}`}
              onClick={() => handleSelectCollaboratorFromHours(item.user.uid)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={getUserDisplayName(item.user)}
                    photoURL={item.user.photoURL}
                    avatarUrl={item.user.avatarUrl}
                    profilePhoto={item.user.profilePhoto}
                  />
                  <p className="font-semibold text-slate-900">{getUserDisplayName(item.user)}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {item.user.position} · Semana {formatISODate(weekStart)}
                </p>
                {item.weekRecords.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin registros</p>
                ) : null}
              </div>

              <div className="text-xs text-slate-500">
                {minutesToHHMM(item.totalMinutes)} ·{" "}
                {item.diffMinutes < 0
                  ? `Debes ${minutesToHHMM(Math.abs(item.diffMinutes))}`
                  : `A favor ${minutesToHHMM(item.diffMinutes)}`}
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "Pendiente" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                }`}
              >
                {item.status}
              </span>
            </button>
          ))}

          {summaries.length === 0 ? (
            <p className="text-sm text-slate-500">{loading ? "Cargando horarios..." : "No hay registros para esta semana."}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Gestión avanzada</h3>
            <p className="text-xs text-rose-700">
              Esto elimina horarios, solicitudes y actividades. No se puede deshacer.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Elegir colaborador a eliminar datos
              <select
                className="mt-2 block min-w-[240px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
                value={deleteTargetUserId ?? "all"}
                onChange={(event) => setDeleteTargetUserId(event.target.value)}
              >
                <option value="all">Selecciona colaborador</option>
                {collaboratorUsers.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {getUserDisplayName(item)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={deleteTargetUserId === "all" || deletingCollaboratorData}
              onClick={() => void handleDeleteCollaboratorData()}
            >
              {deletingCollaboratorData ? "Eliminando..." : "Borrar datos del colaborador"}
            </button>
          </div>
        </div>
      </div>

      {/* ----------------------- DETALLE ----------------------- */}
      {detailUser ? (
        <div ref={detailSectionRef} className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Detalle semanal</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <UserAvatar
                  name={getUserDisplayName(detailUser)}
                  photoURL={detailUser.photoURL}
                  avatarUrl={detailUser.avatarUrl}
                  profilePhoto={detailUser.profilePhoto}
                />
                <span>
                  {getUserDisplayName(detailUser)} · {detailUser.position}
                </span>
              </div>
            </div>
            <button
              className="rounded-full border border-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-500"
              onClick={() => setDetailUserId(null)}
              type="button"
            >
              Cerrar detalle
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {weekDates.map((date) => {
              const dateISO = formatISODate(date);
              const dayRecords = detailRecords.filter((item) => item.date === dateISO);

              if (dayRecords.length === 0) {
                return (
                  <div
                    key={dateISO}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200/60 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{dateISO}</p>
                      <p className="text-xs text-slate-500">Sin registros</p>
                    </div>
                  </div>
                );
              }

              return dayRecords.map((record, index) => {
                const breakMinutes = computeBreakMinutes(record);
                return (
                  <div
                    key={`${dateISO}-${record.id}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{dateISO}</p>
                      <p className="text-xs text-slate-500">
                        Entrada {formatTime(record?.checkInAt ?? null)} · Salida {formatTime(record?.checkOutAt ?? null)}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Descanso {minutesToHHMM(breakMinutes)} · Total {minutesToHHMM(record?.totalMinutes ?? 0)}
                    </div>
                    <span className="text-xs text-slate-500">{record?.notes ?? "Sin notas"}</span>
                  </div>
                );
              });
            })}
          </div>

          <CollaboratorDashboard
            collaboratorName={getUserDisplayName(detailUser)}
            workedMinutes={detailWorkedMinutesWeek}
            expectedMinutes={detailExpectedMinutesWeek}
            diffMinutes={detailDiffMinutesWeek}
            completedDays={detailCompletedDays}
            totalBalanceMinutes={detailTotalBalanceMinutes}
            chartData={detailChartData}
          />
        </div>
      ) : null}

    </div>
  );
}
