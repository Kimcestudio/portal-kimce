"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  expectedMinutesForDate,
  formatISODate,
  formatTime,
  getWeekDates,
  getWeekStartMonday,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { db } from "@/services/firebase/client";
import { DEFAULT_WORK_SCHEDULES } from "@/services/firebase/workSchedules";
import type { AdminAttendanceRecord, UserProfile, WorkSchedule } from "@/services/firebase/types";

type FirestoreUser = UserProfile & {
  name?: string;
  fullName?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

type HourRecord = AdminAttendanceRecord & {
  weekKey: string;
};

type HourRequestStatus = "pending" | "approved" | "rejected";

type HourRequest = {
  id: string;
  uid: string;
  weekKey: string;
  status: HourRequestStatus;
  createdAt: string;
  type?: string;
  reason?: string;
  hours?: number;
  date?: string;
  endDate?: string;
  collection: string;
};

const REQUEST_COLLECTIONS = ["hourRequests", "attendanceRequests", "requests"];

const normalizeStatus = (value: unknown): HourRequestStatus => {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "pending" || lower === "approved" || lower === "rejected") {
      return lower;
    }
  }
  return "pending";
};

const normalizeTimestamp = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as FirestoreTimestamp;
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
};

const getWeekKey = (dateISO: string) => {
  const parsed = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatISODate(getWeekStartMonday(parsed));
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
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [records, setRecords] = useState<HourRecord[]>([]);
  const [requestSources, setRequestSources] = useState<Record<string, HourRequest[]>>({});
  const [requestFilter, setRequestFilter] = useState<HourRequestStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const scheduleOptions = workSchedules.length > 0 ? workSchedules : DEFAULT_WORK_SCHEDULES;
  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((schedule) => [schedule.id, schedule])),
    [scheduleOptions]
  );
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => formatISODate(weekStart), [weekStart]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "",
            displayName: data.displayName ?? "",
            name: data.name,
            fullName: data.fullName,
            photoURL: data.photoURL ?? "",
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: data.position ?? "",
            workScheduleId: data.workScheduleId,
            active: data.active ?? data.isActive ?? true,
            approved: data.approved,
            isActive: data.isActive,
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
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

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
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const hoursRef = collectionGroup(db, "hours");
    const unsubscribe = onSnapshot(
      hoursRef,
      (snapshot) => {
        const nextRecords = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const parentUserId = docSnap.ref.parent.parent?.id;
          const userId = data.userId ?? data.uid ?? parentUserId ?? "unknown";
          const dateValue =
            (typeof data.date === "string" ? data.date : null) ??
            (typeof data.day === "string" ? data.day : null) ??
            normalizeTimestamp(data.date) ??
            normalizeTimestamp(data.checkInAt) ??
            normalizeTimestamp(data.createdAt) ??
            "";
          const dateISO = dateValue ? dateValue.slice(0, 10) : "";
          const weekKeyValue = typeof data.weekKey === "string" && data.weekKey.length > 0
            ? data.weekKey
            : dateISO
              ? getWeekKey(dateISO)
              : "";
          const totalMinutes = typeof data.totalMinutes === "number"
            ? data.totalMinutes
            : typeof data.minutes === "number"
              ? data.minutes
              : typeof data.hours === "number"
                ? Math.round(data.hours * 60)
                : 0;
          return {
            id: docSnap.id,
            userId,
            date: dateISO,
            checkInAt: normalizeTimestamp(data.checkInAt),
            checkOutAt: normalizeTimestamp(data.checkOutAt),
            breaks: Array.isArray(data.breaks)
              ? data.breaks.map((item: DocumentData) => ({
                  startAt: normalizeTimestamp(item.startAt) ?? "",
                  endAt: normalizeTimestamp(item.endAt),
                }))
              : [],
            notes: data.notes ?? null,
            totalMinutes,
            status: (data.status as AdminAttendanceRecord["status"]) ?? (data.checkOutAt ? "CLOSED" : "OPEN"),
            weekKey: weekKeyValue,
          };
        });
        setRecords(nextRecords);
      },
      (error) => {
        console.error("[admin/hours] Error loading hours", error);
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const unsubscribers = REQUEST_COLLECTIONS.map((collectionName) => {
      const ref = collection(db, collectionName);
      const q = query(ref);
      return onSnapshot(
        q,
        (snapshot) => {
          const nextRequests = snapshot.docs
            .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = data.uid ?? data.userId ?? data.createdBy ?? "unknown";
            const dateValue =
              (typeof data.date === "string" ? data.date : null) ??
              normalizeTimestamp(data.date) ??
              normalizeTimestamp(data.createdAt) ??
              "";
            const dateISO = dateValue ? dateValue.slice(0, 10) : "";
            const weekKeyValue = typeof data.weekKey === "string" && data.weekKey.length > 0
              ? data.weekKey
              : dateISO
                ? getWeekKey(dateISO)
                : "";
            if (
              collectionName === "requests" &&
              !data.hours &&
              data.type !== "PERMISO_HORAS" &&
              data.type !== "HOURS"
            ) {
              return null;
            }
            return {
              id: docSnap.id,
              uid,
              weekKey: weekKeyValue,
              status: normalizeStatus(data.status ?? data.state),
              createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
              type: data.type ?? data.requestType,
              reason: data.reason ?? data.motivo,
              hours: typeof data.hours === "number" ? data.hours : undefined,
              date: data.date,
              endDate: data.endDate,
              collection: collectionName,
            } satisfies HourRequest;
          })
            .filter((item): item is HourRequest => Boolean(item));
          setRequestSources((prev) => ({ ...prev, [collectionName]: nextRequests }));
          setRequestsLoading(false);
        },
        (error) => {
          console.error(`[admin/hours] Error loading ${collectionName}`, error);
          setRequestsLoading(false);
        }
      );
    });
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.role]);

  const collaboratorUsers = useMemo(
    () => users.filter((item) => item.role !== "admin"),
    [users]
  );

  const filteredRecords = useMemo(
    () => records.filter((record) => record.weekKey === weekKey),
    [records, weekKey]
  );

  const requests = useMemo(() => {
    const merged = Object.values(requestSources).flat();
    return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestSources]);

  const pendingRequests = useMemo(
    () => requests.filter((item) => item.status === "pending"),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (requestFilter === "all") return requests;
    return requests.filter((item) => item.status === requestFilter);
  }, [requestFilter, requests]);

  const summaries = useMemo(() => {
    const scopedUsers = selectedUserId === "all"
      ? collaboratorUsers
      : collaboratorUsers.filter((item) => item.uid === selectedUserId);
    return scopedUsers.map((item) => {
      const schedule = scheduleById.get(item.workScheduleId ?? "") ?? scheduleOptions[0];
      const weekRecords = filteredRecords.filter((record) => {
        if (record.userId !== item.uid) return false;
        return true;
      });
      const totalMinutes = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);
      const expectedMinutes = weekDates.reduce(
        (total, date) => total + expectedMinutesForDate(date, schedule),
        0
      );
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
  }, [
    collaboratorUsers,
    filteredRecords,
    scheduleById,
    scheduleOptions,
    selectedUserId,
    weekDates,
  ]);

  const detailUser = detailUserId
    ? collaboratorUsers.find((item) => item.uid === detailUserId) ?? null
    : null;

  const detailRecords = detailUser
    ? records.filter(
        (record) =>
          record.userId === detailUser.uid &&
          record.weekKey === weekKey
      )
    : [];

  const handleUpdateRequest = async (request: HourRequest, status: HourRequestStatus) => {
    if (user?.role !== "admin") return;
    try {
      await updateDoc(doc(db, request.collection, request.id), {
        status,
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[admin/hours] Error updating request", error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Horarios</h2>
            <p className="text-xs text-slate-500">Vista semanal por colaborador.</p>
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
                  if (!Number.isNaN(next.getTime())) {
                    setWeekStart(getWeekStartMonday(next));
                  }
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
        <div className="mt-4 space-y-3">
          {summaries.map((item) => (
            <button
              key={item.user.uid}
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
              onClick={() => setDetailUserId(item.user.uid)}
            >
              <div>
                <p className="font-semibold text-slate-900">{getUserDisplayName(item.user)}</p>
                <p className="text-xs text-slate-500">
                  {item.user.position} · Semana {formatISODate(weekStart)}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {minutesToHHMM(item.totalMinutes)} ·{" "}
                {item.diffMinutes < 0
                  ? `Debes ${minutesToHHMM(Math.abs(item.diffMinutes))}`
                  : `A favor ${minutesToHHMM(item.diffMinutes)}`}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "Pendiente"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {item.status}
              </span>
            </button>
          ))}
          {summaries.length === 0 ? (
            <p className="text-sm text-slate-500">
              {loading ? "Cargando horarios..." : "No hay registros para esta semana."}
            </p>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Solicitudes de horas</h3>
            <p className="text-xs text-slate-500">
              {pendingRequests.length} pendientes · Semana {weekKey}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Todas", value: "all" },
              { label: "Pendientes", value: "pending" },
              { label: "Aprobadas", value: "approved" },
              { label: "Rechazadas", value: "rejected" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRequestFilter(item.value as HourRequestStatus | "all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  requestFilter === item.value
                    ? "bg-indigo-600 text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)]"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {filteredRequests.map((request) => {
            const createdBy = collaboratorUsers.find((item) => item.uid === request.uid);
            const statusLabel =
              request.status === "pending"
                ? "Pendiente"
                : request.status === "approved"
                ? "Aprobada"
                : "Rechazada";
            return (
              <div
                key={`${request.collection}-${request.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {request.type ?? "Solicitud de horas"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {request.date ?? request.weekKey}
                    {request.endDate ? ` - ${request.endDate}` : ""} ·{" "}
                    {request.hours ? `${request.hours}h` : "Jornada completa"} ·{" "}
                    {request.reason ?? "Sin motivo"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {getUserDisplayName(createdBy ?? {
                      uid: request.uid,
                      email: "",
                      displayName: "",
                      photoURL: "",
                      role: "collab",
                      position: "",
                      active: true,
                    })}{" "}
                    · {new Date(request.createdAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      request.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : request.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <button
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 transition hover:-translate-y-0.5"
                    onClick={() => handleUpdateRequest(request, "approved")}
                    type="button"
                  >
                    Aprobar
                  </button>
                  <button
                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5"
                    onClick={() => handleUpdateRequest(request, "rejected")}
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
          {filteredRequests.length === 0 ? (
            <p className="text-sm text-slate-500">
              {requestsLoading ? "Cargando solicitudes..." : "No hay solicitudes para este filtro."}
            </p>
          ) : null}
        </div>
      </div>
      {detailUser ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Detalle semanal</h3>
              <p className="text-xs text-slate-500">
                {getUserDisplayName(detailUser)} · {detailUser.position}
              </p>
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
                        Entrada {formatTime(record?.checkInAt ?? null)} · Salida{" "}
                        {formatTime(record?.checkOutAt ?? null)}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Descanso {minutesToHHMM(breakMinutes)} · Total{" "}
                      {minutesToHHMM(record?.totalMinutes ?? 0)}
                    </div>
                    <span className="text-xs text-slate-500">{record?.notes ?? "Sin notas"}</span>
                  </div>
                );
              });
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
