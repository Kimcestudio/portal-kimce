"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
  type DocumentData,
} from "firebase/firestore";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
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

type RequestBase = {
  id: string;
  uid: string;
  type: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  createdAt: string;
  date?: string | null;
  endDate?: string | null;
  weekKey: string;
  minutes?: number | null;
  hours?: number | null;
  reason?: string | null;
  note?: string | null;
  source: "hourRequests" | "extraActivities";
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

const EXTRA_ACTIVITY_TYPE = "EXTRA_ACTIVIDAD";
const PERMIT_TYPES = new Set([
  "DIA_LIBRE",
  "PERMISO_HORAS",
  "VACACIONES",
  "MEDICO",
  "HOURS",
  "PERMISO",
]);

const normalizeRequestType = (type: string | undefined | null) =>
  typeof type === "string" ? type.toUpperCase() : "";

const getRequestCategory = (request: Pick<RequestBase, "type" | "source">): "permit" | "extra" => {
  // Si viene de extraActivities, siempre es "extra"
  if (request.source === "extraActivities") return "extra";
  const normalizedType = normalizeRequestType(request.type);
  if (normalizedType === EXTRA_ACTIVITY_TYPE) return "extra";
  if (PERMIT_TYPES.has(normalizedType)) return "permit";
  return "permit";
};

const getRequestTitle = (request: Pick<RequestBase, "type" | "source">) =>
  getRequestCategory(request) === "extra" ? "Actividad extra" : "Libre / Permiso";

function computeBreakMinutes(record: AdminAttendanceRecord | null) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

function safeISODate(value?: string | null) {
  if (!value) return null;
  // si ya es YYYY-MM-DD
  if (value.length >= 10 && value[4] === "-" && value[7] === "-") return value.slice(0, 10);
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function deriveWeekKey(dateISO: string | null) {
  if (!dateISO) return "";
  return getWeekKey(dateISO);
}

function normalizeRequestDoc(
  docId: string,
  data: DocumentData,
  source: RequestBase["source"],
): RequestBase | null {
  const uid = (data.uid ?? data.userId) as string | undefined;
  if (!uid) return null;

  const createdAt =
    normalizeTimestamp(data.createdAt) ??
    normalizeTimestamp(data.ts) ??
    normalizeTimestamp(data.date) ??
    new Date().toISOString();

  const dateISO = safeISODate(data.date ?? data.startDate ?? data.fecha ?? null);
  const endDateISO = safeISODate(data.endDate ?? data.fechaFin ?? null);

  const weekKey =
    (typeof data.weekKey === "string" && data.weekKey.length > 0 ? data.weekKey : "") ||
    deriveWeekKey(dateISO);

  const type = typeof data.type === "string" ? data.type : source === "extraActivities" ? EXTRA_ACTIVITY_TYPE : "REQUEST";

  return {
    id: docId,
    uid,
    type,
    status: (data.status as string) ?? "pending",
    createdAt,
    date: dateISO,
    endDate: endDateISO,
    weekKey,
    minutes: typeof data.minutes === "number" ? data.minutes : typeof data.totalMinutes === "number" ? data.totalMinutes : null,
    hours: typeof data.hours === "number" ? data.hours : null,
    reason: (data.reason as string) ?? (data.motivo as string) ?? null,
    note: (data.note as string) ?? (data.notas as string) ?? (data.description as string) ?? null,
    source,
  };
}

export default function AdminHoursPage() {
  const { user } = useAuth();

  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [records, setRecords] = useState<HourRecord[]>([]);
  const [requests, setRequests] = useState<RequestBase[]>([]);
  const [loading, setLoading] = useState(true);

  const scheduleOptions = workSchedules.length > 0 ? workSchedules : DEFAULT_WORK_SCHEDULES;

  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((schedule) => [schedule.id, schedule])),
    [scheduleOptions],
  );

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);
  const weekEnd = useMemo(() => weekDates[6] ?? weekStart, [weekDates, weekStart]);

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

  // ---- REQUESTS (hourRequests + extraActivities) root + group
  useEffect(() => {
    if (user?.role !== "admin") return;

    const unsubscribers: Array<() => void> = [];

    const mergeAndSet = (partial: { source: RequestBase["source"]; items: RequestBase[] }) => {
      setRequests((prev) => {
        // Reemplaza por source
        const filteredPrev = prev.filter((x) => x.source !== partial.source);
        // Dedup por (source + id)
        const map = new Map<string, RequestBase>();
        [...filteredPrev, ...partial.items].forEach((r) => map.set(`${r.source}:${r.id}`, r));
        return Array.from(map.values());
      });
    };

    // hourRequests root
    unsubscribers.push(
      onSnapshot(
        collection(db, "hourRequests"),
        (snap) => {
          const items = snap.docs
            .map((d) => normalizeRequestDoc(d.id, d.data() as DocumentData, "hourRequests"))
            .filter(Boolean) as RequestBase[];

          if (process.env.NODE_ENV === "development") {
            console.log("[admin/hours] hourRequests(root) docs", snap.size);
          }
          mergeAndSet({ source: "hourRequests", items });
        },
        (err) => console.error("[admin/hours] hourRequests(root) error", err),
      ),
    );

    // hourRequests group
    unsubscribers.push(
      onSnapshot(
        query(collectionGroup(db, "hourRequests")),
        (snap) => {
          const items = snap.docs
            .map((d) => normalizeRequestDoc(d.id, d.data() as DocumentData, "hourRequests"))
            .filter(Boolean) as RequestBase[];

          if (process.env.NODE_ENV === "development") {
            console.log("[admin/hours] hourRequests(group) docs", snap.size);
          }
          // Los agregamos al mismo source "hourRequests" (se dedupea por id)
          mergeAndSet({ source: "hourRequests", items });
        },
        (err) => console.error("[admin/hours] hourRequests(group) error", err),
      ),
    );

    // extraActivities root
    unsubscribers.push(
      onSnapshot(
        collection(db, "extraActivities"),
        (snap) => {
          const items = snap.docs
            .map((d) => normalizeRequestDoc(d.id, d.data() as DocumentData, "extraActivities"))
            .filter(Boolean) as RequestBase[];

          if (process.env.NODE_ENV === "development") {
            console.log("[admin/hours] extraActivities(root) docs", snap.size);
          }
          mergeAndSet({ source: "extraActivities", items });
        },
        (err) => console.error("[admin/hours] extraActivities(root) error", err),
      ),
    );

    // extraActivities group
    unsubscribers.push(
      onSnapshot(
        query(collectionGroup(db, "extraActivities")),
        (snap) => {
          const items = snap.docs
            .map((d) => normalizeRequestDoc(d.id, d.data() as DocumentData, "extraActivities"))
            .filter(Boolean) as RequestBase[];

          if (process.env.NODE_ENV === "development") {
            console.log("[admin/hours] extraActivities(group) docs", snap.size);
          }
          mergeAndSet({ source: "extraActivities", items });
        },
        (err) => console.error("[admin/hours] extraActivities(group) error", err),
      ),
    );

    return () => unsubscribers.forEach((fn) => fn());
  }, [user?.role]);

  const collaboratorUsers = useMemo(() => users.filter((item) => item.role !== "admin"), [users]);

  const userById = useMemo(() => {
    const map = new Map<string, FirestoreUser>();
    users.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users]);

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

  // ---- REQUESTS FILTERED + SPLIT
  const weekRequests = useMemo(() => {
    const scoped =
      selectedUserId === "all"
        ? requests
        : requests.filter((r) => r.uid === selectedUserId);

    return scoped.filter((r) => {
      // match weekKey OR match within dates range of week
      if (r.weekKey && r.weekKey === weekKey) return true;
      if (r.date && weekDateSet.has(r.date)) return true;
      return false;
    });
  }, [requests, selectedUserId, weekDateSet, weekKey]);

  const pendingRequests = useMemo(
    () => weekRequests.filter((r) => (r.status ?? "").toLowerCase() === "pending"),
    [weekRequests],
  );

  const permitRequests = useMemo(
    () => pendingRequests.filter((r) => getRequestCategory(r) === "permit"),
    [pendingRequests],
  );

  const extraRequests = useMemo(
    () => pendingRequests.filter((r) => getRequestCategory(r) === "extra"),
    [pendingRequests],
  );

  const historyItems = useMemo(() => {
    // historial = todo (pendiente + no pendiente) para esa semana
    const items = weekRequests.slice();
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }, [weekRequests]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const uniqueTypes = Array.from(new Set(weekRequests.map((r) => r.type).filter(Boolean)));
    console.log("[admin/hours] activeWeekKey", weekKey);
    console.log("[admin/hours] weekRange", formatISODate(weekStart), formatISODate(weekEnd));
    console.log("[admin/hours] records total", records.length);
    console.log("[admin/hours] records after week filter", filteredRecords.length);
    console.log("[admin/hours] requests week total", weekRequests.length);
    console.log("[admin/hours] requests pending permit", permitRequests.length);
    console.log("[admin/hours] requests pending extra", extraRequests.length);
    console.log("[admin/hours] requests unique types", uniqueTypes);
  }, [
    weekKey,
    weekStart,
    weekEnd,
    records.length,
    filteredRecords.length,
    weekRequests.length,
    permitRequests.length,
    extraRequests.length,
  ]);

  const detailUser = detailUserId ? collaboratorUsers.find((item) => item.uid === detailUserId) ?? null : null;

  const detailRecords = detailUser
    ? records.filter(
        (record) =>
          record.userId === detailUser.uid &&
          (record.weekKey === weekKey || (record.date && weekDateSet.has(record.date))),
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      {/* ----------------------- HORARIOS ----------------------- */}
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

      {/* ----------------------- DETALLE ----------------------- */}
      {detailUser ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
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
        </div>
      ) : null}

      {/* ----------------------- SOLICITUDES (2 CARDS + HISTORIAL) ----------------------- */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Solicitudes</h2>
            <p className="text-xs text-slate-500">Pendientes y historial (por semana).</p>
          </div>
          <div className="text-xs text-slate-500">
            Semana {formatISODate(weekStart)} — {formatISODate(weekEnd)}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Libre / Permiso */}
          <div className="rounded-2xl border border-slate-200/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Libre / Permiso</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {permitRequests.length} pendientes
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {permitRequests.slice(0, 6).map((req) => {
                const u = userById.get(req.uid);
                return (
                  <div key={`${req.source}:${req.id}`} className="flex items-center justify-between rounded-xl border border-slate-200/60 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={u ? getUserDisplayName(u) : "Colaborador"}
                        photoURL={u?.photoURL ?? ""}
                        avatarUrl={u?.avatarUrl}
                        profilePhoto={u?.profilePhoto}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{u ? getUserDisplayName(u) : "Colaborador"}</p>
                        <p className="text-xs text-slate-500">
                          {getRequestTitle(req)} · {req.date ?? "—"} {req.endDate ? `→ ${req.endDate}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">Pendiente</span>
                  </div>
                );
              })}

              {permitRequests.length === 0 ? (
                <p className="text-xs text-slate-400">Sin pendientes.</p>
              ) : null}
            </div>
          </div>

          {/* Actividades extra */}
          <div className="rounded-2xl border border-slate-200/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Actividades extra</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {extraRequests.length} pendientes
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {extraRequests.slice(0, 6).map((req) => {
                const u = userById.get(req.uid);
                const minutes = req.minutes ?? (typeof req.hours === "number" ? Math.round(req.hours * 60) : 0);
                return (
                  <div key={`${req.source}:${req.id}`} className="flex items-center justify-between rounded-xl border border-slate-200/60 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={u ? getUserDisplayName(u) : "Colaborador"}
                        photoURL={u?.photoURL ?? ""}
                        avatarUrl={u?.avatarUrl}
                        profilePhoto={u?.profilePhoto}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{u ? getUserDisplayName(u) : "Colaborador"}</p>
                        <p className="text-xs text-slate-500">
                          {req.date ?? "—"} · {minutesToHHMM(minutes)}
                          {req.reason ? ` · ${req.reason}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">Pendiente</span>
                  </div>
                );
              })}

              {extraRequests.length === 0 ? (
                <p className="text-xs text-slate-400">Sin pendientes.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className="mt-6 rounded-2xl border border-slate-200/60">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Historial</h3>
            <span className="text-xs text-slate-500">{historyItems.length} items</span>
          </div>

          <div className="border-t border-slate-200/60">
            {historyItems.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Sin solicitudes en esta semana.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {historyItems.slice(0, 20).map((req) => {
                  const u = userById.get(req.uid);
                  const category = getRequestCategory(req);
                  const minutes = req.minutes ?? (typeof req.hours === "number" ? Math.round(req.hours * 60) : null);

                  const status = (req.status ?? "").toLowerCase();
                  const pill =
                    status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : status === "approved"
                        ? "bg-green-100 text-green-700"
                        : status === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-600";

                  return (
                    <div key={`${req.source}:${req.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={u ? getUserDisplayName(u) : "Colaborador"}
                          photoURL={u?.photoURL ?? ""}
                          avatarUrl={u?.avatarUrl}
                          profilePhoto={u?.profilePhoto}
                        />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {u ? getUserDisplayName(u) : "Colaborador"}{" "}
                            <span className="text-xs font-normal text-slate-500">
                              · {category === "extra" ? "Actividad extra" : "Libre / Permiso"}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {req.date ?? "—"} {req.endDate ? `→ ${req.endDate}` : ""}{" "}
                            {minutes !== null ? `· ${minutesToHHMM(minutes)}` : ""}{" "}
                            {req.reason ? `· ${req.reason}` : ""}
                            {req.note ? `· ${req.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pill}`}>{req.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {historyItems.length > 20 ? (
            <p className="px-4 py-3 text-xs text-slate-400">Mostrando 20 de {historyItems.length} (puedes ampliar luego).</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
