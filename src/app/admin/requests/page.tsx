"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import { formatISODate, getWeekDates, getWeekKey, getWeekStartMonday } from "@/lib/attendanceUtils";
import type { UserProfile } from "@/services/firebase/types";

type FirestoreUser = UserProfile & {
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  profilePhoto?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
};

type HourRequestStatus = "pending" | "approved" | "rejected";

type AdminRequestItem = {
  id: string;
  uid: string;
  type?: string;
  status: HourRequestStatus;
  createdAt: string;
  date?: string;
  endDate?: string;
  weekKey: string;
  hours?: number;
  reason?: string;
  source: "hourRequest" | "extraActivity";
  documentPath: string;
};

const REQUEST_SOURCES = [
  { key: "hourRequests:root", collectionName: "hourRequests", mode: "root" as const },
  { key: "hourRequests:group", collectionName: "hourRequests", mode: "group" as const },
  { key: "extraActivities:root", collectionName: "extraActivities", mode: "root" as const },
  { key: "extraActivities:group", collectionName: "extraActivities", mode: "group" as const },
];

const EXTRA_ACTIVITY_TYPE = "EXTRA_ACTIVIDAD";
const PERMIT_TYPES = new Set(["DIA_LIBRE", "PERMISO_HORAS", "VACACIONES", "MEDICO", "HOURS", "PERMISO"]);

const normalizeStatus = (value: unknown): HourRequestStatus => {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "pending" || lower === "approved" || lower === "rejected") return lower;
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

const normalizeRequestType = (type: string | undefined) => (typeof type === "string" ? type.toUpperCase() : "");

const getRequestCategory = (request: AdminRequestItem): "permit" | "extra" => {
  const normalizedType = normalizeRequestType(request.type);
  if (normalizedType === EXTRA_ACTIVITY_TYPE || request.source === "extraActivity") return "extra";
  if (PERMIT_TYPES.has(normalizedType)) return "permit";
  return "permit";
};

const getRequestTitle = (request: AdminRequestItem) =>
  getRequestCategory(request) === "extra" ? "Actividad extra" : "Libre / Permiso";

const getUserDisplayName = (user: FirestoreUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [requestSources, setRequestSources] = useState<Record<string, AdminRequestItem[]>>({});
  const [permitFilter, setPermitFilter] = useState<HourRequestStatus | "all">("all");
  const [extraFilter, setExtraFilter] = useState<HourRequestStatus | "all">("all");
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<AdminRequestItem[]>([]);
  const [historyCursorHourRequests, setHistoryCursorHourRequests] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [historyCursorExtraActivities, setHistoryCursorExtraActivities] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
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
          active: data.active ?? data.isActive ?? true,
          workScheduleId: data.workScheduleId,
        } as FirestoreUser;
      });
      setUsers(nextUsers);
    });
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
              return {
                id: docSnap.id,
                uid,
                type: data.type ?? data.requestType,
                status: normalizeStatus(data.status ?? data.state),
                createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
                date: data.date,
                endDate: data.endDate,
                weekKey: weekKeyValue,
                hours: typeof data.hours === "number"
                  ? data.hours
                  : typeof data.minutes === "number"
                    ? Math.round((data.minutes / 60) * 10) / 10
                    : undefined,
                reason: data.reason ?? data.motivo ?? data.note,
                source: collectionName === "extraActivities" ? "extraActivity" : "hourRequest",
                documentPath: docSnap.ref.path,
              } satisfies AdminRequestItem;
            });
          setRequestSources((prev) => ({ ...prev, [key]: nextRequests }));
          setRequestsLoading(false);
        },
        () => setRequestsLoading(false)
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.role]);

  const requests = useMemo(() => {
    const merged = Object.values(requestSources).flat();
    const deduped = new Map<string, AdminRequestItem>();
    merged.forEach((item) => deduped.set(item.documentPath, item));
    return Array.from(deduped.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestSources]);

  const weeklyFiltered = useMemo(() => {
    return requests.filter((item) => {
      const dateISO = typeof item.date === "string" ? item.date.slice(0, 10) : "";
      const matchesWeek = item.weekKey === weekKey || (dateISO && weekDateSet.has(dateISO));
      const matchesUser = selectedUserId === "all" || item.uid === selectedUserId;
      return matchesWeek && matchesUser;
    });
  }, [requests, selectedUserId, weekDateSet, weekKey]);

  const freePermissionRequests = useMemo(
    () => weeklyFiltered.filter((item) => getRequestCategory(item) === "permit"),
    [weeklyFiltered]
  );
  const extraActivityRequests = useMemo(
    () => weeklyFiltered.filter((item) => getRequestCategory(item) === "extra"),
    [weeklyFiltered]
  );

  const freePermissionRequestsFilteredByTab = useMemo(() => {
    if (permitFilter === "all") return freePermissionRequests;
    return freePermissionRequests.filter((item) => item.status === permitFilter);
  }, [freePermissionRequests, permitFilter]);

  const extraRequestsFilteredByTab = useMemo(() => {
    if (extraFilter === "all") return extraActivityRequests;
    return extraActivityRequests.filter((item) => item.status === extraFilter);
  }, [extraActivityRequests, extraFilter]);

  const mapDocToRequest = (collectionName: string, docSnap: QueryDocumentSnapshot<DocumentData>) => {
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
    return {
      id: docSnap.id,
      uid,
      type: data.type ?? data.requestType,
      status: normalizeStatus(data.status ?? data.state),
      createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
      date: data.date,
      endDate: data.endDate,
      weekKey: weekKeyValue,
      hours: typeof data.hours === "number"
        ? data.hours
        : typeof data.minutes === "number"
          ? Math.round((data.minutes / 60) * 10) / 10
          : undefined,
      reason: data.reason ?? data.motivo ?? data.note,
      source: collectionName === "extraActivities" ? "extraActivity" : "hourRequest",
      documentPath: docSnap.ref.path,
    } satisfies AdminRequestItem;
  };

  const loadMoreHistory = async (reset = false) => {
    if (user?.role !== "admin" || historyLoading) return;
    setHistoryLoading(true);
    try {
      const hourBase = selectedUserId === "all"
        ? query(collection(db, "hourRequests"), orderBy("createdAt", "desc"), limit(20))
        : query(collection(db, "hourRequests"), where("uid", "==", selectedUserId), orderBy("createdAt", "desc"), limit(20));
      const extraBase = selectedUserId === "all"
        ? query(collection(db, "extraActivities"), orderBy("createdAt", "desc"), limit(20))
        : query(collection(db, "extraActivities"), where("uid", "==", selectedUserId), orderBy("createdAt", "desc"), limit(20));

      const hourQuery = reset || !historyCursorHourRequests
        ? hourBase
        : query(
            collection(db, "hourRequests"),
            ...(selectedUserId === "all" ? [] : [where("uid", "==", selectedUserId)]),
            orderBy("createdAt", "desc"),
            startAfter(historyCursorHourRequests),
            limit(20)
          );
      const extraQuery = reset || !historyCursorExtraActivities
        ? extraBase
        : query(
            collection(db, "extraActivities"),
            ...(selectedUserId === "all" ? [] : [where("uid", "==", selectedUserId)]),
            orderBy("createdAt", "desc"),
            startAfter(historyCursorExtraActivities),
            limit(20)
          );

      const [hourSnapshot, extraSnapshot] = await Promise.all([getDocs(hourQuery), getDocs(extraQuery)]);
      const merged = [
        ...hourSnapshot.docs.map((docSnap) => mapDocToRequest("hourRequests", docSnap)),
        ...extraSnapshot.docs.map((docSnap) => mapDocToRequest("extraActivities", docSnap)),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setHistoryItems((prev) => {
        const base = reset ? [] : prev;
        const deduped = new Map<string, AdminRequestItem>();
        [...base, ...merged].forEach((item) => deduped.set(item.documentPath, item));
        return Array.from(deduped.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });

      setHistoryCursorHourRequests(hourSnapshot.docs[hourSnapshot.docs.length - 1] ?? null);
      setHistoryCursorExtraActivities(extraSnapshot.docs[extraSnapshot.docs.length - 1] ?? null);
      setHistoryHasMore(hourSnapshot.docs.length === 20 || extraSnapshot.docs.length === 20);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadMoreHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, user?.role]);

  const handleUpdateRequest = async (request: AdminRequestItem, status: HourRequestStatus) => {
    if (!user || user.role !== "admin") return;
    await updateDoc(doc(db, request.documentPath), {
      status,
      reviewedBy: user.uid,
      reviewedAt: new Date().toISOString(),
    });
  };

  const handleDeleteRequest = async (request: AdminRequestItem) => {
    if (!user || user.role !== "admin") return;
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm("¿Seguro que deseas eliminar esta solicitud? Esta acción no se puede deshacer.");
    if (!confirmed) return;

    await deleteDoc(doc(db, request.documentPath));

    setHistoryItems((prev) => prev.filter((item) => item.documentPath !== request.documentPath));
    setRequestSources((prev) => {
      const next: Record<string, AdminRequestItem[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.filter((item) => item.documentPath !== request.documentPath);
      });
      return next;
    });
  };

  const collaboratorUsers = useMemo(() => users.filter((item) => item.role !== "admin"), [users]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[admin] hourRequests total:", requests.length);
      console.log("[admin] unique types:", Array.from(new Set(requests.map((r) => r.type).filter(Boolean))));
      console.log("[admin] freePermission:", freePermissionRequests.length);
      console.log("[admin] extras:", extraActivityRequests.length);
      console.log("[admin] history count:", historyItems.length);
    }
  }, [extraActivityRequests.length, freePermissionRequests.length, historyItems.length, requests]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Solicitudes</h2>
            <p className="text-xs text-slate-500">Revisión por semana y colaborador.</p>
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            title: "Libre / Permiso",
            list: freePermissionRequestsFilteredByTab,
            total: freePermissionRequests.length,
            pending: freePermissionRequests.filter((item) => item.status === "pending").length,
            filter: permitFilter,
            setFilter: setPermitFilter,
          },
          {
            title: "Actividades extra",
            list: extraRequestsFilteredByTab,
            total: extraActivityRequests.length,
            pending: extraActivityRequests.filter((item) => item.status === "pending").length,
            filter: extraFilter,
            setFilter: setExtraFilter,
          },
        ].map((section) => (
          <div key={section.title} className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                <p className="text-xs text-slate-500">
                  {section.pending} pendientes · {section.total} en semana {weekKey}
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
                    key={`${section.title}-${item.value}`}
                    type="button"
                    onClick={() => section.setFilter(item.value as HourRequestStatus | "all")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      section.filter === item.value
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
              {section.list.map((request) => {
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
                      <p className="font-semibold text-slate-900">{getRequestTitle(request)}</p>
                      <p className="text-xs text-slate-500">
                        {request.date ?? request.weekKey}
                        {request.endDate ? ` - ${request.endDate}` : ""} · {" "}
                        {request.hours ? `${request.hours}h` : "Jornada completa"} · {" "}
                        {request.reason ?? "Sin motivo"}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <UserAvatar
                          name={createdBy ? getUserDisplayName(createdBy) : "Usuario desconocido"}
                          photoURL={createdBy?.photoURL}
                          avatarUrl={createdBy?.avatarUrl}
                          profilePhoto={createdBy?.profilePhoto}
                        />
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
                      {user?.role === "admin" ? (
                        <button
                          className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:-translate-y-0.5"
                          onClick={() => void handleDeleteRequest(request)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {section.list.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {requestsLoading ? "Cargando solicitudes..." : "Sin solicitudes."}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Historial (Siempre)</h3>
            <p className="text-xs text-slate-500">{historyItems.length} registros</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {historyItems.map((request) => {
            const createdBy = collaboratorUsers.find((item) => item.uid === request.uid) ?? null;
            const statusLabel =
              request.status === "pending"
                ? "Pendiente"
                : request.status === "approved"
                ? "Aprobada"
                : "Rechazada";
            return (
              <div
                key={`history-${request.documentPath}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{request.type ?? "Solicitud"}</p>
                  <p className="text-xs text-slate-500">
                    {request.date ?? request.weekKey} · {request.reason ?? "Sin motivo"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <UserAvatar
                      name={createdBy ? getUserDisplayName(createdBy) : "Usuario desconocido"}
                      photoURL={createdBy?.photoURL}
                      avatarUrl={createdBy?.avatarUrl}
                      profilePhoto={createdBy?.profilePhoto}
                    />
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
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {getRequestCategory(request) === "extra" ? "Extra" : "Libre/Permiso"}
                  </span>
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
                  {request.status === "pending" ? (
                    <>
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
                    </>
                  ) : null}
                  {user?.role === "admin" ? (
                    <button
                      className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:-translate-y-0.5"
                      onClick={() => void handleDeleteRequest(request)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">{historyLoading ? "Cargando historial..." : "Sin historial."}</p>
          ) : null}
          {historyHasMore ? (
            <button
              type="button"
              onClick={() => void loadMoreHistory(false)}
              className="rounded-full border border-slate-200/60 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              {historyLoading ? "Cargando..." : "Ver más"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
