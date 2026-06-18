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
import { db } from "@/services/firebase/client";
import {
  buildAdminWeeklyRequestAlerts,
  buildAdminWeeklyRequestSummaries,
  filterWeeklyAttendanceRequests,
  formatISODate,
  getAttendanceRequestCategory,
  getWeekDates,
  getWeekKey,
  getWeekStartMonday,
  type AttendanceRequestMonitorItem,
} from "@/lib/attendanceUtils";
import type { UserProfile } from "@/services/firebase/types";

export type FirestoreUser = UserProfile & {
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  profilePhoto?: string;
  orgTeam?: string;
  orgParentId?: string;
  orgNodeType?: "root" | "leader" | "member";
};

type FirestoreTimestamp = {
  toDate?: () => Date;
};

export type HourRequestStatus = "pending" | "approved" | "rejected";

export type CorrectionAdminItem = {
  docId: string;
  uid: string;
  date: string;
  attendanceId: string;
  proposedChanges: string;
  reason: string;
  status: HourRequestStatus;
  createdAt: string;
  weekKey: string;
  documentPath: string;
};

export type AdminRequestItem = {
  docId: string;
  uid: string;
  type?: string;
  status: HourRequestStatus;
  createdAt: string;
  date?: string;
  endDate?: string;
  weekKey: string;
  hours?: number;
  reason?: string;
  project?: string;
  note?: string;
  source: "hourRequest" | "extraActivity";
  collectionPath: "hourRequests" | "extraActivities";
  sourceTag: string;
  documentPath: string;
};

const REQUEST_SOURCES = [
  { key: "hourRequests:root", collectionName: "hourRequests", mode: "root" as const },
  { key: "hourRequests:group", collectionName: "hourRequests", mode: "group" as const },
  { key: "extraActivities:root", collectionName: "extraActivities", mode: "root" as const },
  { key: "extraActivities:group", collectionName: "extraActivities", mode: "group" as const },
];

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

export const getRequestCategory = (request: AdminRequestItem): "permit" | "extra" => {
  return getAttendanceRequestCategory(request);
};

export const getRequestTitle = (request: AdminRequestItem) =>
  getRequestCategory(request) === "extra" ? "Actividad extra" : "Libre / Permiso";

export const getRequestTypeLabel = (request: AdminRequestItem) => {
  const normalizedType = normalizeRequestType(request.type);
  if (getRequestCategory(request) === "extra") return request.type || "Actividad extra";
  if (normalizedType === "DIA_LIBRE") return "Día libre";
  if (normalizedType === "PERMISO_HORAS" || normalizedType === "HOURS") return "Permiso por horas";
  if (normalizedType === "VACACIONES") return "Vacaciones";
  if (normalizedType === "MEDICO") return "Permiso médico";
  if (request.type) return request.type;
  return "Solicitud";
};

export const getRequestSummaryLines = (request: AdminRequestItem) => {
  const lines: string[] = [];

  if (getRequestCategory(request) === "extra") {
    lines.push(`Tipo: ${getRequestTypeLabel(request)}`);
    if (request.date) lines.push(`Fecha: ${request.date}`);
    if (request.hours) lines.push(`Duración: ${request.hours}h`);
    if (request.project?.trim()) lines.push(`Proyecto: ${request.project.trim()}`);
    if (request.note?.trim()) lines.push(`Detalle: ${request.note.trim()}`);
    else if (request.reason?.trim()) lines.push(`Detalle: ${request.reason.trim()}`);
    return lines;
  }

  lines.push(`Tipo: ${getRequestTypeLabel(request)}`);
  if (request.date && request.endDate) lines.push(`Rango: ${request.date} → ${request.endDate}`);
  else if (request.date) lines.push(`Fecha: ${request.date}`);
  if (request.hours) lines.push(`Horas solicitadas: ${request.hours}h`);
  if (request.reason?.trim()) lines.push(`Motivo: ${request.reason.trim()}`);
  return lines;
};

export const getUserDisplayName = (user: FirestoreUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

export const getRequestKey = (request: Pick<AdminRequestItem, "documentPath">) => request.documentPath;
const getRequestRef = (request: Pick<AdminRequestItem, "documentPath">) => doc(db, request.documentPath);

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
  const weekKeyValue =
    typeof data.weekKey === "string" && data.weekKey.length > 0 ? data.weekKey : dateISO ? getWeekKey(dateISO) : "";

  return {
    docId: docSnap.id,
    uid,
    type: data.type ?? data.requestType,
    status: normalizeStatus(data.status ?? data.state),
    createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
    date: data.date,
    endDate: data.endDate,
    weekKey: weekKeyValue,
    hours:
      typeof data.hours === "number"
        ? data.hours
        : typeof data.minutes === "number"
          ? Math.round((data.minutes / 60) * 10) / 10
          : undefined,
    reason: data.reason ?? data.motivo ?? data.note,
    project: data.project ?? null,
    note: data.note ?? null,
    source: collectionName === "extraActivities" ? "extraActivity" : "hourRequest",
    collectionPath: collectionName === "extraActivities" ? "extraActivities" : "hourRequests",
    sourceTag: `history:${collectionName}`,
    documentPath: docSnap.ref.path,
  } satisfies AdminRequestItem;
};

export function useAdminRequestsMonitor(user: { uid?: string; role?: string } | null | undefined) {
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
  const [deletingRequestKey, setDeletingRequestKey] = useState<string | null>(null);
  const [updatingRequestKey, setUpdatingRequestKey] = useState<string | null>(null);
  const [correctionItems, setCorrectionItems] = useState<CorrectionAdminItem[]>([]);
  const [correctionFilter, setCorrectionFilter] = useState<HourRequestStatus | "all">("all");

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(formatISODate(weekStart)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDates.map((date) => formatISODate(date))), [weekDates]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(
        snapshot.docs.map((docSnap) => {
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
            orgTeam: data.orgTeam,
            orgParentId: data.orgParentId,
            orgNodeType: data.orgNodeType as FirestoreUser["orgNodeType"],
          } as FirestoreUser;
        }),
      );
    });
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const unsubscribe = onSnapshot(
      collection(db, "correctionRequests"),
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const uid = (data.uid ?? data.userId ?? "unknown") as string;
            return {
              docId: docSnap.id,
              uid,
              date: (data.date as string | undefined) ?? "",
              attendanceId: (data.attendanceId as string | undefined) ?? "",
              proposedChanges: (data.proposedChanges as string | undefined) ?? "",
              reason: (data.reason as string | undefined) ?? "",
              status: normalizeStatus(data.status),
              createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
              weekKey: (data.weekKey as string | undefined) ?? "",
              documentPath: docSnap.ref.path,
            } satisfies CorrectionAdminItem;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCorrectionItems(items);
      },
      (error) => console.error("[admin/requests] Error loading correction requests", error),
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const unsubscribers = REQUEST_SOURCES.map(({ key, collectionName, mode }) => {
      const ref = mode === "group" ? collectionGroup(db, collectionName) : collection(db, collectionName);
      return onSnapshot(
        query(ref),
        (snapshot) => {
          const nextRequests = snapshot.docs.map((docSnap) => mapDocToRequest(collectionName, docSnap));
          setRequestSources((prev) => ({ ...prev, [key]: nextRequests }));
          setRequestsLoading(false);
        },
        () => setRequestsLoading(false),
      );
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user?.role]);

  const requests = useMemo(() => {
    const deduped = new Map<string, AdminRequestItem>();
    Object.values(requestSources)
      .flat()
      .forEach((item) => deduped.set(getRequestKey(item), item));
    return Array.from(deduped.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requestSources]);

  const weeklyFiltered = useMemo(
    () =>
      filterWeeklyAttendanceRequests({
        requests: requests as AttendanceRequestMonitorItem[],
        selectedUserId,
        weekKey,
        weekDateSet,
      }) as AdminRequestItem[],
    [requests, selectedUserId, weekDateSet, weekKey],
  );

  const weeklySummaries = useMemo(
    () =>
      buildAdminWeeklyRequestSummaries({
        users: users.filter((item) => item.role !== "admin"),
        requests: requests as AttendanceRequestMonitorItem[],
        selectedUserId,
        weekKey,
        weekDateSet,
      }),
    [requests, selectedUserId, users, weekDateSet, weekKey],
  );

  const weeklyAlerts = useMemo(
    () => buildAdminWeeklyRequestAlerts(weeklySummaries),
    [weeklySummaries],
  );

  const freePermissionRequests = useMemo(
    () => weeklyFiltered.filter((item) => getRequestCategory(item) === "permit"),
    [weeklyFiltered],
  );
  const extraActivityRequests = useMemo(
    () => weeklyFiltered.filter((item) => getRequestCategory(item) === "extra"),
    [weeklyFiltered],
  );

  const allPendingRequests = useMemo(
    () =>
      requests
        .filter((item) => item.status === "pending")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [requests],
  );

  const freePermissionRequestsFilteredByTab = useMemo(() => {
    if (permitFilter === "all") return freePermissionRequests;
    return freePermissionRequests.filter((item) => item.status === permitFilter);
  }, [freePermissionRequests, permitFilter]);

  const extraRequestsFilteredByTab = useMemo(() => {
    if (extraFilter === "all") return extraActivityRequests;
    return extraActivityRequests.filter((item) => item.status === extraFilter);
  }, [extraActivityRequests, extraFilter]);

  const loadMoreHistory = async (reset = false) => {
    if (user?.role !== "admin" || historyLoading) return;
    setHistoryLoading(true);
    try {
      const hourBase =
        selectedUserId === "all"
          ? query(collection(db, "hourRequests"), orderBy("createdAt", "desc"), limit(20))
          : query(collection(db, "hourRequests"), where("uid", "==", selectedUserId), orderBy("createdAt", "desc"), limit(20));
      const extraBase =
        selectedUserId === "all"
          ? query(collection(db, "extraActivities"), orderBy("createdAt", "desc"), limit(20))
          : query(collection(db, "extraActivities"), where("uid", "==", selectedUserId), orderBy("createdAt", "desc"), limit(20));

      const hourQuery =
        reset || !historyCursorHourRequests
          ? hourBase
          : query(
              collection(db, "hourRequests"),
              ...(selectedUserId === "all" ? [] : [where("uid", "==", selectedUserId)]),
              orderBy("createdAt", "desc"),
              startAfter(historyCursorHourRequests),
              limit(20),
            );
      const extraQuery =
        reset || !historyCursorExtraActivities
          ? extraBase
          : query(
              collection(db, "extraActivities"),
              ...(selectedUserId === "all" ? [] : [where("uid", "==", selectedUserId)]),
              orderBy("createdAt", "desc"),
              startAfter(historyCursorExtraActivities),
              limit(20),
            );

      const [hourSnapshot, extraSnapshot] = await Promise.all([getDocs(hourQuery), getDocs(extraQuery)]);
      const merged = [
        ...hourSnapshot.docs.map((docSnap) => mapDocToRequest("hourRequests", docSnap)),
        ...extraSnapshot.docs.map((docSnap) => mapDocToRequest("extraActivities", docSnap)),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setHistoryItems((prev) => {
        const base = reset ? [] : prev;
        const deduped = new Map<string, AdminRequestItem>();
        [...base, ...merged].forEach((item) => deduped.set(getRequestKey(item), item));
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
    if (!user?.uid || user.role !== "admin") return;
    const requestKey = getRequestKey(request);
    setUpdatingRequestKey(requestKey);
    try {
      await updateDoc(getRequestRef(request), {
        status,
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setRequestSources((prev) => {
        const next: Record<string, AdminRequestItem[]> = {};
        Object.entries(prev).forEach(([key, items]) => {
          next[key] = items.map((item) => (getRequestKey(item) === requestKey ? { ...item, status } : item));
        });
        return next;
      });

      setHistoryItems((prev) => prev.map((item) => (getRequestKey(item) === requestKey ? { ...item, status } : item)));
    } catch (error) {
      const firebaseCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown";
      console.error(`[admin/requests] No se pudo actualizar la solicitud a ${status} (code: ${firebaseCode})`, error);
      if (typeof window !== "undefined") window.alert("No se pudo actualizar la solicitud. Intenta nuevamente.");
    } finally {
      setUpdatingRequestKey(null);
    }
  };

  const handleDeleteRequest = async (request: AdminRequestItem) => {
    if (user?.role !== "admin") return;
    const confirmed = typeof window === "undefined" ? true : window.confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.");
    if (!confirmed) return;

    const requestKey = getRequestKey(request);
    setDeletingRequestKey(requestKey);
    try {
      await deleteDoc(doc(db, request.documentPath));
      setHistoryItems((prev) => prev.filter((item) => getRequestKey(item) !== requestKey));
      setRequestSources((prev) => {
        const next: Record<string, AdminRequestItem[]> = {};
        Object.entries(prev).forEach(([key, items]) => {
          next[key] = items.filter((item) => getRequestKey(item) !== requestKey);
        });
        return next;
      });
    } catch (error) {
      const firebaseCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown";
      console.error(`[admin/requests] No se pudo eliminar la solicitud (code: ${firebaseCode})`, error);
      if (typeof window !== "undefined") window.alert("No se pudo eliminar la solicitud. Intenta nuevamente.");
    } finally {
      setDeletingRequestKey(null);
    }
  };

  const handleUpdateCorrection = async (item: CorrectionAdminItem, status: HourRequestStatus) => {
    if (!user?.uid || user.role !== "admin") return;
    try {
      await updateDoc(doc(db, item.documentPath), {
        status,
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setCorrectionItems((prev) =>
        prev.map((c) => (c.docId === item.docId ? { ...c, status } : c)),
      );
    } catch (error) {
      console.error("[admin/requests] Error updating correction", error);
      if (typeof window !== "undefined") window.alert("No se pudo actualizar la corrección.");
    }
  };

  const collaboratorUsers = useMemo(() => users.filter((item) => item.role !== "admin"), [users]);

  const correctionsPendingCount = correctionItems.filter((c) => c.status === "pending").length;

  return {
    weekStart,
    setWeekStart,
    weekKey,
    selectedUserId,
    setSelectedUserId,
    collaboratorUsers,
    requestsLoading,
    permitFilter,
    setPermitFilter,
    extraFilter,
    setExtraFilter,
    allPendingRequests,
    freePermissionRequests,
    extraActivityRequests,
    freePermissionRequestsFilteredByTab,
    extraRequestsFilteredByTab,
    weeklySummaries,
    weeklyAlerts,
    historyItems,
    historyHasMore,
    historyLoading,
    deletingRequestKey,
    updatingRequestKey,
    loadMoreHistory,
    handleUpdateRequest,
    handleDeleteRequest,
    correctionItems,
    correctionFilter,
    setCorrectionFilter,
    handleUpdateCorrection,
    correctionsPendingCount,
  };
}
