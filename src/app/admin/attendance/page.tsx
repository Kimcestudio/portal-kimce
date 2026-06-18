"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminAttendanceMonitorTabs from "@/app/admin/attendance/AdminAttendanceMonitorTabs";
import AdminWeeklyAlerts from "@/app/admin/attendance/AdminWeeklyAlerts";
import AdminAttendanceWorkspaceHeader from "@/app/admin/attendance/AdminAttendanceWorkspaceHeader";
import AdminAttendanceWorkspaceFilters from "@/app/admin/attendance/AdminAttendanceWorkspaceFilters";
import AdminAttendanceWorkspaceSubject from "@/app/admin/attendance/AdminAttendanceWorkspaceSubject";
import { DEFAULT_WORK_SCHEDULES } from "@/services/firebase/workSchedules";
import { getUserDisplayName } from "@/app/admin/hours/useAdminHoursMonitor";
import { formatISODate, getWeekStartMonday } from "@/lib/attendanceUtils";
import { useAdminHoursMonitor } from "@/app/admin/hours/useAdminHoursMonitor";
import { useAdminRequestsMonitor } from "@/app/admin/requests/useAdminRequestsMonitor";

export default function AdminAttendanceAlertsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const hoursMonitor = useAdminHoursMonitor(user?.role);
  const requestsMonitor = useAdminRequestsMonitor(user);

  const {
    weekStart,
    selectedUserId,
    weeklyAlerts: hoursWeeklyAlerts,
    setWeekStart: setHoursWeekStart,
    setSelectedUserId: setHoursSelectedUserId,
    setDetailUserId,
    setDeleteTargetUserId,
  } = hoursMonitor;

  const {
    weeklyAlerts: requestsWeeklyAlerts,
    setWeekStart: setRequestsWeekStart,
    setSelectedUserId: setRequestsSelectedUserId,
  } = requestsMonitor;

  useEffect(() => {
    const weekParam = searchParams.get("week");
    const userParam = searchParams.get("user");

    if (weekParam) {
      const nextWeek = new Date(weekParam);
      if (!Number.isNaN(nextWeek.getTime())) {
        const normalizedWeek = getWeekStartMonday(nextWeek);
        setHoursWeekStart(normalizedWeek);
        setRequestsWeekStart(normalizedWeek);
      }
    }

    if (userParam) {
      setHoursSelectedUserId(userParam);
      setDetailUserId(userParam);
      setDeleteTargetUserId(userParam);
      setRequestsSelectedUserId(userParam);
    }
  }, [
    searchParams,
    setDeleteTargetUserId,
    setDetailUserId,
    setHoursSelectedUserId,
    setHoursWeekStart,
    setRequestsSelectedUserId,
    setRequestsWeekStart,
  ]);

  const week = formatISODate(weekStart);
  const totalAlerts = hoursWeeklyAlerts.length + requestsWeeklyAlerts.length;
  const totalPendingRequests = requestsMonitor.weeklySummaries.reduce((sum, item) => sum + item.pendingCount, 0);
  const selectedCollaborator =
    selectedUserId !== "all"
      ? hoursMonitor.collaboratorUsers.find((item) => item.uid === selectedUserId) ?? null
      : null;
  const selectedAttendanceAlerts = selectedCollaborator
    ? hoursWeeklyAlerts.filter((item) => item.uid === selectedCollaborator.uid)
    : [];
  const selectedRequestAlerts = selectedCollaborator
    ? requestsWeeklyAlerts.filter((item) => item.uid === selectedCollaborator.uid)
    : [];
  const selectedLeader =
    selectedCollaborator?.orgParentId
      ? hoursMonitor.collaboratorUsers.find((item) => item.uid === selectedCollaborator.orgParentId) ?? null
      : null;
  const selectedSchedule =
    selectedCollaborator?.workScheduleId
      ? DEFAULT_WORK_SCHEDULES.find((item) => item.id === selectedCollaborator.workScheduleId) ?? null
      : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <AdminAttendanceMonitorTabs
        current="alerts"
        week={week}
        selectedUserId={selectedUserId}
      />

      <AdminAttendanceWorkspaceHeader
        title="Alertas"
        subtitle="Centro de control semanal para revisar rápido qué exige acción en asistencia y solicitudes."
        contextLabel={`Semana ${week}`}
        metrics={[
          {
            label: "Colaboradores visibles",
            value: String(hoursMonitor.globalKpis.totalCollaborators),
            tone: "indigo",
            helper: selectedUserId === "all" ? "Supervisión general activa" : "Filtro por colaborador activo",
          },
          {
            label: "Alertas activas",
            value: String(totalAlerts),
            tone: totalAlerts > 0 ? "amber" : "emerald",
            helper: totalAlerts > 0 ? "Asistencia + solicitudes" : "Todo en orden esta semana",
          },
          {
            label: "Horas pendientes",
            value: String(hoursMonitor.globalKpis.pendingCount),
            tone: hoursMonitor.globalKpis.pendingCount > 0 ? "amber" : "emerald",
            helper: `${hoursMonitor.globalKpis.onTrackCount} colaboradores al día`,
          },
          {
            label: "Solicitudes pendientes",
            value: String(totalPendingRequests),
            tone: totalPendingRequests > 0 ? "amber" : "emerald",
            helper: `${requestsWeeklyAlerts.length} alerta(s) de solicitudes`,
          },
        ]}
      />

      <AdminAttendanceWorkspaceFilters
        weekStart={weekStart}
        selectedUserId={selectedUserId}
        users={hoursMonitor.collaboratorUsers}
        onWeekChange={(nextWeek) => {
          setHoursWeekStart(nextWeek);
          setRequestsWeekStart(nextWeek);
        }}
        onUserChange={(uid) => {
          setHoursSelectedUserId(uid);
          setDetailUserId(uid === "all" ? null : uid);
          setDeleteTargetUserId(uid);
          setRequestsSelectedUserId(uid);
        }}
      />

      {selectedCollaborator ? (
        <AdminAttendanceWorkspaceSubject
          user={selectedCollaborator}
          weekLabel={`Semana ${week}`}
          description="Ficha breve para revisar alertas de asistencia y solicitudes sin perder el foco del colaborador."
          secondaryMeta={[
            selectedSchedule ? `Jornada ${selectedSchedule.name}` : "Sin jornada",
            selectedCollaborator.orgTeam?.trim() ? `Equipo ${selectedCollaborator.orgTeam.trim()}` : "Sin equipo",
            selectedLeader ? `Líder ${getUserDisplayName(selectedLeader)}` : "Sin líder asignado",
          ]}
          chips={[
            { label: "Alertas asistencia", value: String(selectedAttendanceAlerts.length), tone: selectedAttendanceAlerts.length > 0 ? "amber" : "emerald" },
            { label: "Alertas solicitudes", value: String(selectedRequestAlerts.length), tone: selectedRequestAlerts.length > 0 ? "amber" : "emerald" },
            { label: "Total alertas", value: String(selectedAttendanceAlerts.length + selectedRequestAlerts.length), tone: selectedAttendanceAlerts.length + selectedRequestAlerts.length > 0 ? "rose" : "emerald" },
          ]}
          actions={[
            {
              label: "Abrir asistencia",
              href: `/admin/hours?user=${encodeURIComponent(selectedCollaborator.uid)}&week=${encodeURIComponent(week)}`,
              tone: "primary",
            },
            {
              label: "Abrir solicitudes",
              href: `/admin/requests?user=${encodeURIComponent(selectedCollaborator.uid)}&week=${encodeURIComponent(week)}`,
              tone: "secondary",
            },
            {
              label: "Perfil laboral",
              href: `/admin/users?user=${encodeURIComponent(selectedCollaborator.uid)}&tab=laboral&from=attendance&week=${encodeURIComponent(week)}`,
              tone: "neutral",
            },
          ]}
        />
      ) : null}

      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Alertas semanales</h2>
            <p className="text-xs text-slate-500">
              Vista unificada para detectar rápido qué revisar en asistencia y solicitudes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
              Semana {week}
            </span>
            <span className={`rounded-full px-3 py-1 font-semibold ${totalAlerts > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {totalAlerts > 0 ? `${totalAlerts} alerta(s) activas` : "Sin alertas activas"}
            </span>
          </div>
        </div>
      </div>

      <AdminWeeklyAlerts
        title="Alertas de asistencia"
        subtitle="Jornadas abiertas, horas pendientes y ajustes aprobados sin fichaje."
        alerts={hoursWeeklyAlerts}
        buildHref={(uid) => `/admin/hours?user=${encodeURIComponent(uid)}&week=${encodeURIComponent(week)}`}
      />

      <AdminWeeklyAlerts
        title="Alertas de solicitudes"
        subtitle="Solicitudes pendientes y actividad extra que merece revisión esta semana."
        alerts={requestsWeeklyAlerts}
        buildHref={(uid) => `/admin/requests?user=${encodeURIComponent(uid)}&week=${encodeURIComponent(week)}`}
      />
    </div>
  );
}
