"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ClipboardList, Users, UserX } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminAttendanceMonitorTabs from "@/app/admin/attendance/AdminAttendanceMonitorTabs";
import AdminWeeklyAlerts, { type EnrichedAlertItem } from "@/app/admin/attendance/AdminWeeklyAlerts";
import AdminAttendanceWorkspaceHeader from "@/app/admin/attendance/AdminAttendanceWorkspaceHeader";
import AdminAttendanceWorkspaceFilters from "@/app/admin/attendance/AdminAttendanceWorkspaceFilters";
import AdminAttendanceWorkspaceSubject from "@/app/admin/attendance/AdminAttendanceWorkspaceSubject";
import { getUserDisplayName } from "@/app/admin/hours/useAdminHoursMonitor";
import { formatISODate, getWeekStartMonday, minutesToHHMM } from "@/lib/attendanceUtils";
import type { AdminHoursSummaryRow } from "@/lib/attendanceUtils";
import { useAdminHoursMonitor } from "@/app/admin/hours/useAdminHoursMonitor";
import { useAdminRequestsMonitor } from "@/app/admin/requests/useAdminRequestsMonitor";

function hoursAlertType(id: string): EnrichedAlertItem["alertType"] {
  if (id.startsWith("attendance-open-")) return "open-shift";
  if (id.startsWith("attendance-missing-")) return "missing-hours";
  return "credit-only";
}

function requestsAlertType(id: string): EnrichedAlertItem["alertType"] {
  if (id.startsWith("requests-pending-")) return "pending-request";
  return "extra-activity";
}

function buildHoursChips(
  alertType: EnrichedAlertItem["alertType"],
  summary: AdminHoursSummaryRow,
): NonNullable<EnrichedAlertItem["chips"]> {
  if (alertType === "open-shift") {
    const openCount = summary.weekRecords.filter((r) => r.status === "OPEN").length;
    return [{ label: "Jornadas sin cerrar", value: String(openCount), tone: "rose" }];
  }
  if (alertType === "missing-hours") {
    const chips: NonNullable<EnrichedAlertItem["chips"]> = [
      {
        label: "Trabajadas",
        value: minutesToHHMM(summary.totalMinutes),
        tone: summary.totalMinutes > 0 ? "emerald" : "slate",
      },
      { label: "Esperadas", value: minutesToHHMM(summary.expectedMinutes), tone: "slate" },
    ];
    if (summary.diffMinutes < 0) {
      chips.push({ label: "Déficit", value: minutesToHHMM(Math.abs(summary.diffMinutes)), tone: "rose" });
    }
    return chips;
  }
  if (alertType === "credit-only") {
    return [{ label: "Ajustes registrados", value: String(summary.weekCredits?.length ?? 0), tone: "sky" }];
  }
  return [];
}

export default function AdminAttendanceAlertsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const hoursMonitor = useAdminHoursMonitor(user?.role);
  const requestsMonitor = useAdminRequestsMonitor(user);

  const {
    weekStart,
    selectedUserId,
    weeklyAlerts: hoursWeeklyAlerts,
    summaries,
    loading,
    setWeekStart: setHoursWeekStart,
    setSelectedUserId: setHoursSelectedUserId,
    setDetailUserId,
    setDeleteTargetUserId,
  } = hoursMonitor;

  const {
    weeklyAlerts: requestsWeeklyAlerts,
    weeklySummaries: reqWeeklySummaries,
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
  const totalPendingRequests = reqWeeklySummaries.reduce((sum, item) => sum + item.pendingCount, 0);

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
  const selectedLeader = selectedCollaborator?.orgParentId
    ? hoursMonitor.collaboratorUsers.find((item) => item.uid === selectedCollaborator.orgParentId) ?? null
    : null;
  const selectedSchedule = selectedCollaborator?.workScheduleId
    ? (hoursMonitor.scheduleById.get(selectedCollaborator.workScheduleId) ?? null)
    : null;

  const summaryByUid = useMemo(
    () => new Map(summaries.map((s) => [s.user.uid, s])),
    [summaries],
  );
  const reqSummaryByUid = useMemo(
    () => new Map(reqWeeklySummaries.map((s) => [s.user.uid, s])),
    [reqWeeklySummaries],
  );

  const enrichedHoursAlerts = useMemo<EnrichedAlertItem[]>(() =>
    hoursWeeklyAlerts.map((alert): EnrichedAlertItem => {
      const summary = summaryByUid.get(alert.uid);
      const u = summary?.user;
      const alertType = hoursAlertType(alert.id);
      const pct = summary && summary.expectedMinutes > 0
        ? Math.min(100, Math.round((summary.totalMinutes / summary.expectedMinutes) * 100))
        : null;

      return {
        id: alert.id,
        uid: alert.uid,
        level: alert.level,
        source: "hours",
        alertType,
        title: alert.title,
        description: alert.description,
        personName: u ? (u.displayName ?? u.fullName ?? u.name ?? u.email ?? "Colaborador") : undefined,
        personPhotoURL: u?.photoURL ?? undefined,
        personAvatarUrl: u?.avatarUrl,
        personProfilePhoto: u?.profilePhoto,
        personArea: u?.area ?? undefined,
        chips: summary ? buildHoursChips(alertType, summary) : [],
        progressBar: alertType === "missing-hours" && pct !== null ? { pct } : undefined,
        actionLabel: alert.actionLabel ?? "Ver asistencia",
        actionHref: `/admin/hours?user=${encodeURIComponent(alert.uid)}&week=${encodeURIComponent(week)}`,
      };
    }),
    [hoursWeeklyAlerts, summaryByUid, week],
  );

  const enrichedRequestsAlerts = useMemo<EnrichedAlertItem[]>(() =>
    requestsWeeklyAlerts.map((alert): EnrichedAlertItem => {
      const summary = summaryByUid.get(alert.uid);
      const u = summary?.user;
      const reqSummary = reqSummaryByUid.get(alert.uid);
      const chips: EnrichedAlertItem["chips"] = [];

      if (reqSummary) {
        if (reqSummary.pendingCount > 0) {
          chips.push({ label: "Pendientes", value: String(reqSummary.pendingCount), tone: "amber" });
        }
        if (reqSummary.approvedCount > 0) {
          chips.push({ label: "Aprobadas", value: String(reqSummary.approvedCount), tone: "emerald" });
        }
        if (reqSummary.extraRequests.length > 0) {
          chips.push({ label: "Extra", value: String(reqSummary.extraRequests.length), tone: "teal" });
        }
      }

      return {
        id: alert.id,
        uid: alert.uid,
        level: alert.level,
        source: "requests",
        alertType: requestsAlertType(alert.id),
        title: alert.title,
        description: alert.description,
        personName: u ? (u.displayName ?? u.fullName ?? u.name ?? u.email ?? "Colaborador") : undefined,
        personPhotoURL: u?.photoURL ?? undefined,
        personAvatarUrl: u?.avatarUrl,
        personProfilePhoto: u?.profilePhoto,
        personArea: u?.area ?? undefined,
        chips,
        actionLabel: alert.actionLabel ?? "Ver solicitudes",
        actionHref: `/admin/requests?user=${encodeURIComponent(alert.uid)}&week=${encodeURIComponent(week)}`,
      };
    }),
    [requestsWeeklyAlerts, summaryByUid, reqSummaryByUid, week],
  );

  const allEnrichedAlerts = useMemo(
    () => [...enrichedHoursAlerts, ...enrichedRequestsAlerts],
    [enrichedHoursAlerts, enrichedRequestsAlerts],
  );

  const peopleWithAlerts = useMemo(
    () => new Set(allEnrichedAlerts.map((a) => a.uid)).size,
    [allEnrichedAlerts],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <AdminAttendanceMonitorTabs current="alerts" week={week} selectedUserId={selectedUserId} />

      <AdminAttendanceWorkspaceHeader
        metrics={[
          {
            label: "Colaboradores",
            value: String(hoursMonitor.globalKpis.totalCollaborators),
            tone: "indigo",
            helper: "Supervisados esta semana",
            icon: Users,
          },
          {
            label: "Alertas activas",
            value: String(totalAlerts),
            tone: totalAlerts > 0 ? "amber" : "emerald",
            helper: totalAlerts > 0 ? "Requieren revisión" : "Todo en orden",
            icon: AlertTriangle,
          },
          {
            label: "Personas afectadas",
            value: String(peopleWithAlerts),
            tone: peopleWithAlerts > 0 ? "rose" : "emerald",
            helper: peopleWithAlerts > 0
              ? `de ${hoursMonitor.globalKpis.totalCollaborators} colaboradores`
              : "Nadie con alertas",
            icon: UserX,
          },
          {
            label: "Solicitudes pend.",
            value: String(totalPendingRequests),
            tone: totalPendingRequests > 0 ? "amber" : "emerald",
            helper: totalPendingRequests > 0 ? "Por revisar" : "Sin pendientes",
            icon: ClipboardList,
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
          secondaryMeta={[
            selectedSchedule ? `Jornada ${selectedSchedule.name}` : "Sin jornada",
            selectedCollaborator.orgTeam?.trim() ? `Equipo ${selectedCollaborator.orgTeam.trim()}` : "Sin equipo",
            selectedLeader ? `Líder ${getUserDisplayName(selectedLeader)}` : "Sin líder asignado",
          ]}
          chips={[
            {
              label: "Alertas asistencia",
              value: String(selectedAttendanceAlerts.length),
              tone: selectedAttendanceAlerts.length > 0 ? "amber" : "emerald",
            },
            {
              label: "Alertas solicitudes",
              value: String(selectedRequestAlerts.length),
              tone: selectedRequestAlerts.length > 0 ? "amber" : "emerald",
            },
          ]}
          actions={[
            {
              label: "Ver asistencia",
              href: `/admin/hours?user=${encodeURIComponent(selectedCollaborator.uid)}&week=${encodeURIComponent(week)}`,
              tone: "primary",
            },
            {
              label: "Ver solicitudes",
              href: `/admin/requests?user=${encodeURIComponent(selectedCollaborator.uid)}&week=${encodeURIComponent(week)}`,
              tone: "secondary",
            },
          ]}
        />
      ) : null}

      <AdminWeeklyAlerts alerts={allEnrichedAlerts} loading={loading} />
    </div>
  );
}
