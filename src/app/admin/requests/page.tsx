"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BellDot,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileClock,
  History,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminAttendanceMonitorTabs from "@/app/admin/attendance/AdminAttendanceMonitorTabs";
import { formatISODate, getWeekStartMonday } from "@/lib/attendanceUtils";
import {
  getRequestCategory,
  getRequestKey,
  getRequestSummaryLines,
  getRequestTitle,
  getUserDisplayName,
  useAdminRequestsMonitor,
  type AdminRequestItem,
} from "@/app/admin/requests/useAdminRequestsMonitor";

type RequestWorkspaceTab = "pending" | "permits" | "extras" | "corrections" | "history";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
} as const;

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
} as const;

const TAB_META: Record<RequestWorkspaceTab, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  pending: { label: "Pendientes", icon: BellDot },
  permits: { label: "Permisos", icon: CalendarRange },
  extras: { label: "Extras", icon: Sparkles },
  corrections: { label: "Correcciones", icon: PenLine },
  history: { label: "Historial", icon: History },
};

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const {
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
  } = useAdminRequestsMonitor(user);

  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [activeTab, setActiveTab] = useState<RequestWorkspaceTab>("pending");
  const [selectedRequestKey, setSelectedRequestKey] = useState<string | null>(null);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(getWeekStartMonday(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(getWeekStartMonday(d));
  };

  useEffect(() => {
    const weekParam = searchParams.get("week");
    const userParam = searchParams.get("user");

    if (weekParam) {
      const nextWeekDate = new Date(weekParam);
      if (!Number.isNaN(nextWeekDate.getTime())) {
        setWeekStart(getWeekStartMonday(nextWeekDate));
      }
    }

    if (userParam) {
      setSelectedUserId(userParam);
    }
  }, [searchParams, setSelectedUserId, setWeekStart]);

  const summaryByUid = useMemo(
    () => new Map(weeklySummaries.map((item) => [item.user.uid, item])),
    [weeklySummaries],
  );

  const visibleCollaborators = useMemo(() => {
    const query = collaboratorQuery.trim().toLowerCase();
    if (!query) return collaboratorUsers;
    return collaboratorUsers.filter((item) => {
      const haystack = [
        getUserDisplayName(item),
        item.position,
        item.email,
        item.orgTeam,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [collaboratorQuery, collaboratorUsers]);

  const pendingRequests = allPendingRequests;

  const activeList = useMemo<AdminRequestItem[]>(() => {
    switch (activeTab) {
      case "permits":
        return freePermissionRequestsFilteredByTab;
      case "extras":
        return extraRequestsFilteredByTab;
      case "history":
        return historyItems;
      case "corrections":
        return [];
      case "pending":
      default:
        return pendingRequests;
    }
  }, [
    activeTab,
    extraRequestsFilteredByTab,
    freePermissionRequestsFilteredByTab,
    historyItems,
    pendingRequests,
  ]);

  useEffect(() => {
    if (activeTab === "corrections") {
      setSelectedRequestKey((current) => {
        if (current && correctionItems.some((c) => c.docId === current)) return current;
        return correctionItems[0]?.docId ?? null;
      });
      return;
    }
    setSelectedRequestKey((current) => {
      if (current && activeList.some((item) => getRequestKey(item) === current)) return current;
      return activeList[0] ? getRequestKey(activeList[0]) : null;
    });
  }, [activeList, activeTab, correctionItems]);

  const selectedRequest = useMemo(
    () => activeList.find((item) => getRequestKey(item) === selectedRequestKey) ?? activeList[0] ?? null,
    [activeList, selectedRequestKey],
  );

  const selectedRequestOwner = selectedRequest
    ? collaboratorUsers.find((item) => item.uid === selectedRequest.uid) ?? null
    : null;

  const selectedCorrection = activeTab === "corrections"
    ? correctionItems.find((c) => c.docId === selectedRequestKey) ?? null
    : null;
  const selectedCorrectionOwner = selectedCorrection
    ? collaboratorUsers.find((u) => u.uid === selectedCorrection.uid) ?? null
    : null;

  const tabCounts: Record<RequestWorkspaceTab, number> = {
    pending: pendingRequests.length,
    permits: freePermissionRequests.length,
    extras: extraActivityRequests.length,
    corrections: correctionsPendingCount,
    history: historyItems.length,
  };

  const showFilterPills = activeTab === "permits" || activeTab === "extras" || activeTab === "corrections";
  const currentFilter =
    activeTab === "permits" ? permitFilter :
    activeTab === "extras" ? extraFilter :
    correctionFilter;
  const setCurrentFilter =
    activeTab === "permits" ? setPermitFilter :
    activeTab === "extras" ? setExtraFilter :
    setCorrectionFilter;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <AdminAttendanceMonitorTabs
        current="requests"
        week={formatISODate(weekStart)}
        selectedUserId={selectedUserId}
      />

      {/* ── Compact toolbar: week nav + user filter + stat chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Week navigation */}
        <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-1">
          <button
            type="button"
            onClick={prevWeek}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[100px] text-center text-xs font-semibold text-slate-700">
            {weekKey}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* User filter */}
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="all">Todos los colaboradores</option>
          {collaboratorUsers.map((u) => (
            <option key={u.uid} value={u.uid}>
              {getUserDisplayName(u)}
            </option>
          ))}
        </select>

        {/* Stat chips */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${pendingRequests.length > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"}`}>
            <BellDot size={11} />
            Pendientes · {pendingRequests.length}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            <CalendarRange size={11} />
            Permisos · {freePermissionRequests.length}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
            <Sparkles size={11} />
            Extras · {extraActivityRequests.length}
          </span>
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${correctionsPendingCount > 0 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-400"}`}>
            <PenLine size={11} />
            Correcciones · {correctionsPendingCount}
          </span>
        </div>
      </div>

      {/* ── 3-column flat workspace ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid min-h-[600px] divide-x divide-slate-200 xl:grid-cols-[240px_1fr_320px]">

          {/* LEFT: collaborator list */}
          <aside className="flex flex-col bg-slate-50">
            {/* Header */}
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={12} className="text-slate-400" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Equipo</span>
                <span className="ml-auto text-[11px] font-semibold text-slate-400">{visibleCollaborators.length}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <Search size={11} className="shrink-0 text-slate-400" />
                <input
                  value={collaboratorQuery}
                  onChange={(e) => setCollaboratorQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Rows */}
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {visibleCollaborators.map((item) => {
                const summary = summaryByUid.get(item.uid);
                const isActive = selectedUserId === item.uid;
                const hasPending = (summary?.pendingCount ?? 0) > 0;
                return (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => setSelectedUserId(item.uid)}
                    className={`flex w-full items-center gap-2.5 px-4 py-3 text-left transition ${
                      isActive
                        ? "border-l-2 border-indigo-500 bg-indigo-50 pl-[14px]"
                        : "border-l-2 border-transparent hover:bg-white"
                    }`}
                  >
                    <UserAvatar
                      name={getUserDisplayName(item)}
                      photoURL={item.photoURL}
                      avatarUrl={item.avatarUrl}
                      profilePhoto={item.profilePhoto}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasPending ? "bg-amber-400" : summary?.approvedCount ? "bg-emerald-400" : "bg-slate-300"}`} />
                        <p className={`truncate text-sm font-semibold ${isActive ? "text-indigo-700" : "text-slate-800"}`}>
                          {getUserDisplayName(item)}
                        </p>
                      </div>
                      <p className="truncate text-[11px] text-slate-400">{item.position || "Sin puesto"}</p>
                    </div>
                    {hasPending ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {summary?.pendingCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {visibleCollaborators.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-400">
                  {requestsLoading ? "Cargando..." : "Sin resultados."}
                </p>
              ) : null}
            </div>
          </aside>

          {/* CENTER: request list */}
          <div className="flex flex-col">
            {/* Tab pills */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2.5">
              {(Object.entries(TAB_META) as [RequestWorkspaceTab, typeof TAB_META[RequestWorkspaceTab]][]).map(([key, meta]) => {
                const count = tabCounts[key];
                const isActive = activeTab === key;
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <Icon size={11} />
                    {meta.label}
                    {count > 0 ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"}`}>
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Filter pills */}
            {showFilterPills ? (
              <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2">
                {([
                  { label: "Todas", value: "all" },
                  { label: "Pendientes", value: "pending" },
                  { label: "Aprobadas", value: "approved" },
                  { label: "Rechazadas", value: "rejected" },
                ] as const).map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setCurrentFilter(f.value)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      currentFilter === f.value
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Request rows */}
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {activeTab === "corrections" ? (
                <>
                  {(currentFilter === "all" ? correctionItems : correctionItems.filter((c) => c.status === currentFilter)).map((item) => {
                    const owner = collaboratorUsers.find((u) => u.uid === item.uid) ?? null;
                    const isSelected = selectedRequestKey === item.docId;
                    return (
                      <button
                        key={item.docId}
                        type="button"
                        onClick={() => setSelectedRequestKey(item.docId)}
                        className={`flex w-full items-center gap-3 border-l-2 px-5 py-3.5 text-left transition ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Corrección</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-slate-900">Fecha: {item.date}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.proposedChanges}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {owner ? getUserDisplayName(owner) : "Desconocido"} · {new Date(item.createdAt).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <ChevronRight size={13} className={`shrink-0 ${isSelected ? "text-indigo-400" : "text-slate-300"}`} />
                      </button>
                    );
                  })}
                  {correctionItems.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-400">No hay correcciones.</p>
                  ) : null}
                </>
              ) : (
                <>
                  {activeList.map((request) => {
                    const createdBy = collaboratorUsers.find((item) => item.uid === request.uid) ?? null;
                    const isSelected = selectedRequest && getRequestKey(selectedRequest) === getRequestKey(request);
                    const category = getRequestCategory(request);
                    return (
                      <button
                        key={getRequestKey(request)}
                        type="button"
                        onClick={() => setSelectedRequestKey(getRequestKey(request))}
                        className={`flex w-full items-center gap-3 border-l-2 px-5 py-3.5 text-left transition ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${category === "extra" ? "bg-cyan-100 text-cyan-700" : "bg-indigo-100 text-indigo-700"}`}>
                              {category === "extra" ? "Extra" : "Permiso"}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[request.status]}`}>
                              {STATUS_LABELS[request.status]}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-slate-900">{getRequestTitle(request)}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {getRequestSummaryLines(request)[0] ?? ""}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {createdBy ? getUserDisplayName(createdBy) : "Desconocido"} · {new Date(request.createdAt).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <ChevronRight size={13} className={`shrink-0 ${isSelected ? "text-indigo-400" : "text-slate-300"}`} />
                      </button>
                    );
                  })}
                  {activeList.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-400">
                      {requestsLoading ? "Cargando..." : "Sin elementos para esta vista."}
                    </p>
                  ) : null}

                  {activeTab === "history" && historyHasMore ? (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => void loadMoreHistory(false)}
                        className="w-full rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                      >
                        {historyLoading ? "Cargando..." : "Cargar más historial"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* RIGHT: inspector */}
          <aside className="flex flex-col overflow-y-auto">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <FileClock size={12} className="text-slate-400" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Inspector</span>
              </div>
            </div>

            <div className="flex-1 p-5">
              {selectedCorrection && selectedCorrectionOwner ? (
                <>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={getUserDisplayName(selectedCorrectionOwner)}
                      photoURL={selectedCorrectionOwner.photoURL}
                      avatarUrl={selectedCorrectionOwner.avatarUrl}
                      profilePhoto={selectedCorrectionOwner.profilePhoto}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{getUserDisplayName(selectedCorrectionOwner)}</p>
                      <p className="text-xs text-slate-400">{selectedCorrectionOwner.position || "Sin puesto"}</p>
                    </div>
                  </div>

                  <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[selectedCorrection.status]}`}>
                    {STATUS_LABELS[selectedCorrection.status]}
                  </span>

                  <div className="mt-4 space-y-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Fecha del registro</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCorrection.date}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cambios propuestos</p>
                      <p className="mt-1 text-sm text-slate-700">{selectedCorrection.proposedChanges}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Motivo</p>
                      <p className="mt-1 text-sm text-slate-700">{selectedCorrection.reason}</p>
                    </div>
                  </div>

                  {selectedCorrection.status === "pending" ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateCorrection(selectedCorrection, "approved")}
                        className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateCorrection(selectedCorrection, "rejected")}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : null}
                </>
              ) : selectedRequest && selectedRequestOwner ? (
                <>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={getUserDisplayName(selectedRequestOwner)}
                      photoURL={selectedRequestOwner.photoURL}
                      avatarUrl={selectedRequestOwner.avatarUrl}
                      profilePhoto={selectedRequestOwner.profilePhoto}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{getUserDisplayName(selectedRequestOwner)}</p>
                      <p className="text-xs text-slate-400">{selectedRequestOwner.position || "Sin puesto"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[selectedRequest.status]}`}>
                      {STATUS_LABELS[selectedRequest.status]}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRequestCategory(selectedRequest) === "extra" ? "bg-cyan-100 text-cyan-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {getRequestCategory(selectedRequest) === "extra" ? "Extra" : "Permiso"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Detalle</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{getRequestTitle(selectedRequest)}</p>
                    <div className="mt-2 space-y-1">
                      {getRequestSummaryLines(selectedRequest).map((line) => (
                        <p key={`detail-${getRequestKey(selectedRequest)}-${line}`} className="text-sm text-slate-600">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Creada</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {new Date(selectedRequest.createdAt).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Semana</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRequest.weekKey}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedRequest.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleUpdateRequest(selectedRequest, "approved")}
                          disabled={updatingRequestKey === getRequestKey(selectedRequest)}
                          className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
                        >
                          {updatingRequestKey === getRequestKey(selectedRequest) ? "Guardando..." : "Aprobar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdateRequest(selectedRequest, "rejected")}
                          disabled={updatingRequestKey === getRequestKey(selectedRequest)}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </>
                    ) : null}
                    {user?.role === "admin" ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteRequest(selectedRequest)}
                        disabled={deletingRequestKey === getRequestKey(selectedRequest)}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {deletingRequestKey === getRequestKey(selectedRequest) ? "Eliminando..." : "Eliminar"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4 flex flex-wrap gap-x-4 gap-y-2">
                    <Link
                      href={`/admin/hours?user=${encodeURIComponent(selectedRequestOwner.uid)}&week=${encodeURIComponent(formatISODate(weekStart))}`}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Ver en Horas →
                    </Link>
                    <Link
                      href={`/admin/users?user=${encodeURIComponent(selectedRequestOwner.uid)}&tab=laboral&from=requests&week=${encodeURIComponent(formatISODate(weekStart))}`}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Perfil laboral →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-center text-sm text-slate-400">
                    Selecciona una solicitud<br />para ver el detalle.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
