"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, doc, onSnapshot, query, updateDoc, type DocumentData } from "firebase/firestore";
import PageHeader from "@/components/PageHeader";
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
  documentPath: string;
  source: "hourRequest";
};

const REQUEST_SOURCES = [
  { key: "hourRequests:root", collectionName: "hourRequests", mode: "root" as const },
  { key: "hourRequests:group", collectionName: "hourRequests", mode: "group" as const },
  { key: "attendanceRequests:root", collectionName: "attendanceRequests", mode: "root" as const },
  { key: "requests:root", collectionName: "requests", mode: "root" as const },
];

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

const getUserDisplayName = (user: FirestoreUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

const getUserPhoto = (user: FirestoreUser | null) =>
  user?.photoURL || user?.avatarUrl || user?.profilePhoto || "";

const getInitials = (user: FirestoreUser | null, fallback = "C") => {
  const name = user ? getUserDisplayName(user) : "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

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
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);
  const weekEnd = useMemo(() => weekDates[6] ?? weekStart, [weekDates, weekStart]);

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
            avatarUrl: data.avatarUrl,
            profilePhoto: data.profilePhoto,
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
    const hoursRef = collection(db, "timeEntries");
    const unsubscribe = onSnapshot(
      hoursRef,
      (snapshot) => {
        if (process.env.NODE_ENV === "development") {
          const uidSet = new Set<string>();
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const userId = data.uid ?? data.userId ?? "unknown";
            uidSet.add(userId);
          });
          console.log("[admin/hours] hours docs", snapshot.size);
          console.log("[admin/hours] hours uids", Array.from(uidSet));
          const firstDoc = snapshot.docs[0]?.data() as DocumentData | undefined;
          if (firstDoc) {
            console.log("[admin/hours] hours sample keys", Object.keys(firstDoc));
          }
        }
        const events: TimeEntryEvent[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = data.uid ?? data.userId;
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
              ? Math.max(0, Math.round((new Date(checkOutEvent.ts).getTime() - new Date(checkInEvent.ts).getTime()) / 60000))
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
        console.error("[admin/hours] Error loading hours", error);
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const unsubscribers = REQUEST_SOURCES.map(({ key, collectionName, mode }) => {
      const ref = mode === "group" ? collectionGroup(db, collectionName) : collection(db, collectionName);
      const q = query(ref);
      return onSnapshot(
        q,
        (snapshot) => {
          if (process.env.NODE_ENV === "development") {
            console.log(`[admin/hours] ${key} docs`, snapshot.size);
            const firstDoc = snapshot.docs[0]?.data() as DocumentData | undefined;
            if (firstDoc) {
              console.log(`[admin/hours] ${key} sample keys`, Object.keys(firstDoc));
            }
          }
          const nextRequests = snapshot.docs
            .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const parentUserId = docSnap.ref.parent.parent?.id;
            const uid = data.uid ?? data.userId ?? data.createdBy ?? parentUserId ?? "unknown";
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
            const isExtraActivity = collectionName === "extraActivities";
            return {
              id: docSnap.id,
              uid,
              weekKey: weekKeyValue,
              status: normalizeStatus(data.status ?? data.state),
              createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
              type: data.type ?? data.requestType,
              reason: data.reason ?? data.motivo ?? data.note,
              hours: typeof data.hours === "number" ? data.hours : undefined,
              date: data.date,
              endDate: data.endDate,
              collection: collectionName,
              documentPath: docSnap.ref.path,
              source: "hourRequest",
            } satisfies HourRequest;
          })
            .filter(Boolean) as HourRequest[];
          setRequestSources((prev) => ({ ...prev, [key]: nextRequests }));
          setRequestsLoading(false);
        },
        (error) => {
          console.error(`[admin/hours] Error loading ${key}`, error);
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
    () =>
      records.filter(
        (record) => record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))
      ),
    [records, weekDateSet, weekKey]
  );

  const requests = useMemo(() => {
    const merged = Object.values(requestSources).flat();
    const deduped = new Map<string, HourRequest>();
    merged.forEach((request) => {
      deduped.set(request.documentPath, request);
    });
    return Array.from(deduped.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestSources]);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      const matchesStatus = requestFilter === "all" || item.status === requestFilter;
      const dateISO = typeof item.date === "string" ? item.date.slice(0, 10) : "";
      const matchesWeek = item.weekKey === weekKey || (dateISO && weekDateSet.has(dateISO));
      const matchesUser = selectedUserId === "all" || item.uid === selectedUserId;
      return matchesStatus && matchesWeek && matchesUser;
    });
  }, [requestFilter, requests, selectedUserId, weekDateSet, weekKey]);

  const pendingRequests = useMemo(
    () => filteredRequests.filter((item) => item.status === "pending"),
    [filteredRequests]
  );

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

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[admin/hours] activeWeekKey", weekKey);
      console.log("[admin/hours] weekRange", formatISODate(weekStart), formatISODate(weekEnd));
      console.log("[admin/hours] hours read", records.length);
      console.log(
        "[admin/hours] collaborator uids",
        summaries.map((item) => item.user.uid)
      );
      console.log("[admin/hours] docs after week filter", filteredRecords.length);
      console.log("[admin/hours] requests read", requests.length);
    }
  }, [filteredRecords.length, records.length, requests.length, summaries, weekEnd, weekKey, weekStart]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const hourRequestsCount = (requestSources["hourRequests:root"]?.length ?? 0) +
        (requestSources["hourRequests:group"]?.length ?? 0);
      console.log("[admin/hours] users count", users.length);
      console.log("[admin/hours] hourRequests count", hourRequestsCount);
    }
  }, [requestSources, users.length]);

  const detailUser = detailUserId
    ? collaboratorUsers.find((item) => item.uid === detailUserId) ?? null
    : null;

  const detailRecords = detailUser
    ? records.filter(
        (record) =>
          record.userId === detailUser.uid &&
          (record.weekKey === weekKey || (record.date && weekDateSet.has(record.date)))
      )
    : [];

  const handleUpdateRequest = async (request: HourRequest, status: HourRequestStatus) => {
    if (user?.role !== "admin") return;
    try {
      await updateDoc(doc(db, request.documentPath), {
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
                <div className="flex items-center gap-2">
                  {getUserPhoto(item.user) ? (
                    <img
                      src={getUserPhoto(item.user)}
                      alt={getUserDisplayName(item.user)}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {getInitials(item.user)}
                    </div>
                  )}
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
            const createdBy = collaboratorUsers.find((item) => item.uid === request.uid) ?? null;
            const statusLabel =
              request.status === "pending"
                ? "Pendiente"
                : request.status === "approved"
                ? "Aprobada"
                : "Rechazada";
            return (
              <div
                key={request.documentPath}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {request.type ?? (request.source === "extraActivity" ? "Actividad extra" : "Solicitud de horas") }
                  </p>
                  <p className="text-xs text-slate-500">
                    {request.date ?? request.weekKey}
                    {request.endDate ? ` - ${request.endDate}` : ""} ·{" "}
                    {request.hours ? `${request.hours}h` : "Jornada completa"} ·{" "}
                    {request.reason ?? "Sin motivo"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    {getUserPhoto(createdBy) ? (
                      <img
                        src={getUserPhoto(createdBy)}
                        alt={createdBy ? getUserDisplayName(createdBy) : request.uid}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {getInitials(createdBy, "U")}
                      </div>
                    )}
                    <span>
                      {getUserDisplayName(createdBy ?? {
                        uid: request.uid,
                        email: "",
                        displayName: "",
                        photoURL: "",
                        role: "collab",
                        position: "",
                        active: true,
                      })} · {new Date(request.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>
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
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                {getUserPhoto(detailUser) ? (
                  <img
                    src={getUserPhoto(detailUser)}
                    alt={getUserDisplayName(detailUser)}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {getInitials(detailUser)}
                  </div>
                )}
                <span>{getUserDisplayName(detailUser)} · {detailUser.position}</span>
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
