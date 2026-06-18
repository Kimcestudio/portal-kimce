"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  ChartColumnBig,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Sun,
  TrendingUp,
  User,
  UserX,
  Users,
} from "lucide-react";
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
import CollaboratorDashboard from "@/components/attendance/CollaboratorDashboard";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminWeeklyAlerts from "@/app/admin/attendance/AdminWeeklyAlerts";
import AdminAttendanceMonitorTabs from "@/app/admin/attendance/AdminAttendanceMonitorTabs";
import {
  formatISODate,
  formatTime,
  getWeekStartMonday,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { getUserDisplayName, useAdminHoursMonitor } from "@/app/admin/hours/useAdminHoursMonitor";

type AdminHoursTab = "dashboard" | "team" | "individual" | "reports";

const SHORT_DAY = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const DAY_LABEL = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const STATUS_DOT: Record<string, string> = {
  "Sin inicio": "bg-slate-400",
  "En riesgo": "bg-rose-500",
  "En curso": "bg-amber-400",
  "Al día": "bg-emerald-500",
};

const STATUS_BADGE: Record<string, string> = {
  "Sin inicio": "bg-slate-100 text-slate-500",
  "En riesgo": "bg-rose-100 text-rose-700",
  "En curso": "bg-amber-100 text-amber-700",
  "Al día": "bg-emerald-100 text-emerald-700",
};

function barColor(pct: number) {
  return pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-rose-500";
}

function barGradient(pct: number) {
  return pct >= 100
    ? "linear-gradient(to right, #34d399, #059669)"
    : pct >= 70
      ? "linear-gradient(to right, #fcd34d, #f59e0b)"
      : "linear-gradient(to right, #fb7185, #e11d48)";
}

const GlobalHoursTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; workedLabel: string; expectedLabel: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{row.name}</p>
      <p className="text-white/70">Trabajadas: {row.workedLabel}</p>
      <p className="text-white/70">Objetivo: {row.expectedLabel}</p>
    </div>
  );
};

const TAB_ITEMS: { id: AdminHoursTab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
  { id: "team", label: "Equipo", icon: <Users size={14} /> },
  { id: "individual", label: "Individual", icon: <User size={14} /> },
  { id: "reports", label: "Reportes", icon: <BarChart2 size={14} /> },
];

export default function AdminHoursPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const {
    weekStart,
    setWeekStart,
    selectedUserId,
    deleteTargetUserId,
    setDeleteTargetUserId,
    detailUserId,
    setDetailUserId,
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
  } = useAdminHoursMonitor(user?.role);

  const [activeTab, setActiveTab] = useState<AdminHoursTab>("dashboard");
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showTeamChart, setShowTeamChart] = useState(false);
  const [showCollabView, setShowCollabView] = useState(false);

  const toggleSection = (key: string) =>
    setExpandedSection((prev) => (prev === key ? null : key));

  const openIndividual = (uid: string) => {
    handleSelectCollaborator(uid);
    setExpandedSection(null);
    setActiveTab("individual");
  };

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

  const visibleSummaries = useMemo(() => {
    let result = summaries;
    const q = collaboratorQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((item) =>
        [getUserDisplayName(item.user), item.user.position, item.user.email, item.user.orgTeam]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }
    return result;
  }, [summaries, collaboratorQuery, statusFilter]);

  const focusedSummary = useMemo(() => {
    if (detailUserId) return summaries.find((item) => item.user.uid === detailUserId) ?? null;
    return summaries[0] ?? null;
  }, [detailUserId, summaries]);

  const selectedDetailRow = useMemo(() => {
    if (!detail?.rows.length) return null;
    if (!selectedDayISO) return detail.rows[0] ?? null;
    return detail.rows.find((row) => row.dateISO === selectedDayISO) ?? detail.rows[0] ?? null;
  }, [detail, selectedDayISO]);


  const selectedDetailRecord = selectedDetailRow?.records[0] ?? null;
  const selectedDetailCredits = selectedDetailRow?.credits ?? [];
  const selectedDetailBreaks = selectedDetailRecord?.breaks ?? [];
  const hasOpenBreak = selectedDetailBreaks.some((b) => !b.endAt);
  const openBreakElapsedMinutes = selectedDetailBreaks
    .filter((b) => !b.endAt)
    .reduce((total, b) => total + Math.max(0, Math.round((Date.now() - new Date(b.startAt).getTime()) / 60000)), 0);
  const displayBreakMinutes = (selectedDetailRow?.totalBreakMinutes ?? 0) + openBreakElapsedMinutes;

  const openShiftsCount = summaries.filter((item) =>
    item.weekRecords.some((r) => r.status === "OPEN"),
  ).length;
  const totalDeficitMinutes = summaries
    .filter((s) => s.diffMinutes < 0)
    .reduce((sum, s) => sum + Math.abs(s.diffMinutes), 0);
  const notStartedCount = summaries.filter((s) => !s.hasStarted).length;
  const atRiskCount = summaries.filter((s) => s.status === "En riesgo").length;
  const teamTotalWorked = summaries.reduce((s, i) => s + i.totalMinutes, 0);
  const teamTotalExpected = summaries.reduce((s, i) => s + i.expectedMinutes, 0);
  const teamPct = teamTotalExpected > 0 ? Math.min(100, Math.round((teamTotalWorked / teamTotalExpected) * 100)) : 0;

  const indivWeekPct = focusedSummary
    ? focusedSummary.expectedMinutes > 0
      ? Math.min(100, Math.round((focusedSummary.totalMinutes / focusedSummary.expectedMinutes) * 100))
      : 0
    : 0;
  const indivWeekDiff = focusedSummary?.diffMinutes ?? 0;
  const indivBalance = detail?.totalBalanceMinutes ?? 0;
  const indivRecordedDays = detail?.recordedDays ?? 0;
  const indivCompletedDays = detail?.completedDays ?? 0;
  const indivWeekCreditMinutes =
    focusedSummary?.weekCredits.reduce((s, c) => s + c.minutes, 0) ?? 0;
  const indivAvgDaily =
    indivRecordedDays > 0
      ? Math.round((focusedSummary?.totalMinutes ?? 0) / indivRecordedDays)
      : null;
  const indivWeekWorkedOnly =
    detail?.rows.reduce((s, r) => s + r.totalWorkedMinutes, 0) ?? 0;
  const indivWeekCreditsOnly =
    detail?.rows.reduce((s, r) => s + r.totalCreditMinutes, 0) ?? 0;
  const indivWeekRemaining = Math.max(
    0,
    (focusedSummary?.expectedMinutes ?? 0) - (focusedSummary?.totalMinutes ?? 0),
  );

  const pctTone = indivWeekPct >= 100 ? "emerald" : indivWeekPct >= 70 ? "amber" : "rose";
  const pctBarGradient =
    pctTone === "emerald"
      ? "linear-gradient(to right, #34d399, #059669)"
      : pctTone === "amber"
        ? "linear-gradient(to right, #fcd34d, #f59e0b)"
        : "linear-gradient(to right, #fb7185, #e11d48)";
  const pctTrackCls =
    pctTone === "emerald" ? "bg-emerald-100" : pctTone === "amber" ? "bg-amber-100" : "bg-rose-100";
  const pctTextCls =
    pctTone === "emerald" ? "text-emerald-700" : pctTone === "amber" ? "text-amber-700" : "text-rose-700";

  const expectedPerDay =
    detail && detail.rows.length > 0
      ? Math.round((focusedSummary?.expectedMinutes ?? 0) / detail.rows.length)
      : 0;

  const collabChartData = useMemo(() =>
    detail?.rows.map((row) => ({
      label: SHORT_DAY.format(row.date),
      hours: Math.round(((row.totalWorkedMinutes + row.totalCreditMinutes) / 60) * 10) / 10,
      target: expectedPerDay / 60,
    })) ?? [],
  [detail, expectedPerDay]);

  useEffect(() => {
    const weekParam = searchParams.get("week");
    const userParam = searchParams.get("user");
    if (weekParam) {
      const d = new Date(weekParam);
      if (!Number.isNaN(d.getTime())) setWeekStart(getWeekStartMonday(d));
    }
    if (userParam) {
      setDetailUserId(userParam);
      setDeleteTargetUserId(userParam);
      setActiveTab("individual");
    }
  }, [searchParams, setDeleteTargetUserId, setDetailUserId, setWeekStart]);

  useEffect(() => {
    if (!detail?.rows.length) return;
    setSelectedDayISO((current) => {
      if (current && detail.rows.some((row) => row.dateISO === current)) return current;
      return detail.rows[0]?.dateISO ?? null;
    });
  }, [detail]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <AdminAttendanceMonitorTabs
        current="hours"
        week={formatISODate(weekStart)}
        selectedUserId={selectedUserId}
      />

      {/* Tab nav + week nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-2xl bg-white p-1 shadow-sm">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevWeek}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[96px] text-center text-sm font-medium text-slate-700">
            {formatISODate(weekStart)}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ─── DASHBOARD ─── */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* KPI panel — 4 gradient-icon cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: "Cumplimiento",
                value: `${globalKpis.completionRate}%`,
                sub: `${globalKpis.onTrackCount} de ${globalKpis.totalCollaborators} al día`,
                iconBg: "bg-gradient-to-br from-blue-400 to-indigo-600",
                icon: <TrendingUp size={18} className="text-white" />,
                chipBg: globalKpis.completionRate >= 100 ? "bg-emerald-100 text-emerald-700" : globalKpis.completionRate >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                chipLabel: globalKpis.completionRate >= 100 ? "Al día" : globalKpis.completionRate >= 70 ? "En curso" : "En riesgo",
              },
              {
                label: "Déficit acumulado",
                value: totalDeficitMinutes > 0 ? minutesToHHMM(totalDeficitMinutes) : "—",
                sub: `${atRiskCount} colaborador${atRiskCount !== 1 ? "es" : ""} en riesgo`,
                iconBg: "bg-gradient-to-br from-orange-400 to-rose-500",
                icon: <AlertTriangle size={18} className="text-white" />,
                chipBg: totalDeficitMinutes > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                chipLabel: atRiskCount > 0 ? `${atRiskCount} en riesgo` : "Sin déficit",
              },
              {
                label: "En jornada",
                value: String(openShiftsCount),
                sub: openShiftsCount > 0 ? "fichajes activos ahora" : "sin jornadas activas",
                iconBg: "bg-gradient-to-br from-teal-400 to-emerald-600",
                icon: <Clock size={18} className="text-white" />,
                chipBg: openShiftsCount > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500",
                chipLabel: openShiftsCount > 0 ? "LIVE" : "Inactivo",
              },
              {
                label: "Sin fichaje",
                value: String(notStartedCount),
                sub: notStartedCount > 0 ? "sin inicio esta semana" : "todos han registrado",
                iconBg: "bg-gradient-to-br from-violet-400 to-purple-600",
                icon: <UserX size={18} className="text-white" />,
                chipBg: notStartedCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                chipLabel: notStartedCount > 0 ? `${notStartedCount} pendiente${notStartedCount !== 1 ? "s" : ""}` : "OK",
              },
            ].map((m) => (
              <div key={m.label} className="flex flex-col gap-3 rounded-2xl bg-white shadow-md p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${m.iconBg}`}>
                    {m.icon}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${m.chipBg}`}>
                    {m.chipLabel}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{m.value}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">{m.label}</p>
                </div>
                <p className="text-[11px] text-slate-400">{m.sub}</p>
              </div>
            ))}
          </div>

          {weeklyAlerts.length > 0 && (
            <AdminWeeklyAlerts
              title="Alertas"
              subtitle=""
              alerts={weeklyAlerts}
              buildHref={(uid) =>
                `/admin/hours?user=${encodeURIComponent(uid)}&week=${encodeURIComponent(formatISODate(weekStart))}`
              }
            />
          )}

          {/* Team quick view — compact list */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Vista del equipo</h2>
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Ver todos →
              </button>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Cargando...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summaries.slice(0, 8).map((item) => {
                  const pct =
                    item.expectedMinutes > 0
                      ? Math.min(100, Math.round((item.totalMinutes / item.expectedMinutes) * 100))
                      : 0;
                  const isLive = item.weekRecords.some((r) => r.status === "OPEN");
                  const diff = item.diffMinutes;
                  return (
                    <button
                      key={item.user.uid}
                      type="button"
                      onClick={() => openIndividual(item.user.uid)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                    >
                      <UserAvatar
                        name={getUserDisplayName(item.user)}
                        photoURL={item.user.photoURL}
                        avatarUrl={item.user.avatarUrl}
                        profilePhoto={item.user.profilePhoto}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? "bg-slate-300"}`}
                          />
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {getUserDisplayName(item.user)}
                          </p>
                          {isLive && (
                            <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: barGradient(pct) }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-800">
                          {minutesToHHMM(item.totalMinutes)}
                        </p>
                        <p
                          className={`text-[11px] font-semibold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {diff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(diff))}
                        </p>
                      </div>
                      <ChevronRight size={13} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── EQUIPO ─── */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {/* KPI summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Horas totales",
                value: minutesToHHMM(teamTotalWorked),
                sub: `de ${minutesToHHMM(teamTotalExpected)} esperadas`,
                iconBg: "bg-gradient-to-br from-blue-400 to-indigo-600",
                icon: <Clock size={16} className="text-white" />,
                chipBg: teamPct >= 100 ? "bg-emerald-100 text-emerald-700" : teamPct >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                chipLabel: `${teamPct}%`,
              },
              {
                label: "Cumplimiento",
                value: `${globalKpis.completionRate}%`,
                sub: "promedio del equipo",
                iconBg: "bg-gradient-to-br from-violet-400 to-purple-600",
                icon: <TrendingUp size={16} className="text-white" />,
                chipBg: globalKpis.completionRate >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                chipLabel: globalKpis.completionRate >= 80 ? "Bien" : "Revisar",
              },
              {
                label: "Al día",
                value: String(globalKpis.onTrackCount),
                sub: `de ${globalKpis.totalCollaborators} colaboradores`,
                iconBg: "bg-gradient-to-br from-teal-400 to-emerald-600",
                icon: <Users size={16} className="text-white" />,
                chipBg: "bg-emerald-100 text-emerald-700",
                chipLabel: globalKpis.onTrackCount === globalKpis.totalCollaborators ? "Todos" : `${globalKpis.onTrackCount}/${globalKpis.totalCollaborators}`,
              },
              {
                label: "En riesgo",
                value: String(atRiskCount),
                sub: atRiskCount > 0 ? "necesitan atención" : "sin alertas activas",
                iconBg: "bg-gradient-to-br from-orange-400 to-rose-500",
                icon: <AlertTriangle size={16} className="text-white" />,
                chipBg: atRiskCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                chipLabel: atRiskCount > 0 ? "Revisar" : "OK",
              },
            ].map((m) => (
              <div key={m.label} className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md">
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.iconBg}`}>
                    {m.icon}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.chipBg}`}>
                    {m.chipLabel}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{m.value}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">{m.label}</p>
                </div>
                <p className="text-[10px] text-slate-400">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                value={collaboratorQuery}
                onChange={(e) => setCollaboratorQuery(e.target.value)}
                placeholder="Buscar colaborador..."
                className="w-44 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
            {(["all", "Al día", "En curso", "En riesgo", "Sin inicio"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                }`}
              >
                {s !== "all" && (
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s] ?? "bg-slate-300"}`}
                  />
                )}
                {s === "all" ? "Todos" : s}
                {s !== "all" && (
                  <span className="opacity-60">
                    ({summaries.filter((x) => x.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Team list */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-semibold text-slate-400">
                {visibleSummaries.length} colaborador
                {visibleSummaries.length !== 1 ? "es" : ""}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleSummaries.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  {loading ? "Cargando..." : "Sin resultados para este filtro."}
                </div>
              ) : (
                visibleSummaries.map((item) => {
                  const pct =
                    item.expectedMinutes > 0
                      ? Math.min(100, Math.round((item.totalMinutes / item.expectedMinutes) * 100))
                      : 0;
                  const isLive = item.weekRecords.some((r) => r.status === "OPEN");
                  const diff = item.diffMinutes;
                  return (
                    <button
                      key={item.user.uid}
                      type="button"
                      onClick={() => openIndividual(item.user.uid)}
                      className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50"
                    >
                      <UserAvatar
                        name={getUserDisplayName(item.user)}
                        photoURL={item.user.photoURL}
                        avatarUrl={item.user.avatarUrl}
                        profilePhoto={item.user.profilePhoto}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? "bg-slate-300"}`}
                          />
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {getUserDisplayName(item.user)}
                          </p>
                          {isLive && (
                            <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                              LIVE
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.user.position || "Sin puesto"}
                        </p>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: barGradient(pct) }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToHHMM(item.totalMinutes)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          / {minutesToHHMM(item.expectedMinutes)}
                        </p>
                      </div>
                      <span
                        className={`hidden shrink-0 text-sm font-bold md:block ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {diff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(diff))}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Analytics toggle */}
          <button
            type="button"
            onClick={() => setShowTeamChart((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ChartColumnBig size={14} />
            {showTeamChart ? "Ocultar" : "Ver"} analítica del equipo
          </button>

          {showTeamChart && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-md p-5">
              <p className="text-sm font-semibold text-slate-900">Horas trabajadas vs objetivo</p>
              <p className="mb-4 mt-0.5 text-xs text-slate-400">Por colaborador — semana actual</p>
              <div className="h-72">
                {globalChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={globalChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 24 }}
                    >
                      <defs>
                        <linearGradient id="blueBarGradTeam" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.95} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-18}
                        textAnchor="end"
                        height={46}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<GlobalHoursTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                      <Bar dataKey="expectedHours" fill="#e0e7ff" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="workedHours" fill="url(#blueBarGradTeam)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                    Sin datos suficientes esta semana.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── INDIVIDUAL ─── */}
      {activeTab === "individual" && (
        <div className="space-y-3">
          {/* Profile selector + toggle vista colaborador */}
          {summaries.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
                {summaries.map((item) => (
                  <button
                    key={item.user.uid}
                    type="button"
                    onClick={() => openIndividual(item.user.uid)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      focusedSummary?.user.uid === item.user.uid
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        focusedSummary?.user.uid === item.user.uid
                          ? "bg-white/60"
                          : (STATUS_DOT[item.status] ?? "bg-slate-300")
                      }`}
                    />
                    {getUserDisplayName(item.user).split(" ")[0]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCollabView((v) => !v)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  showCollabView
                    ? "bg-violet-600 text-white shadow-md"
                    : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                }`}
              >
                {showCollabView ? <EyeOff size={12} /> : <Eye size={12} />}
                Vista colaborador
              </button>
            </div>
          )}

          {/* KPI summary */}
          {focusedSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* KPI 1 — Horas semana + progress bar */}
              <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md">
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${indivWeekPct >= 100 ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : indivWeekPct >= 70 ? "bg-gradient-to-br from-amber-300 to-amber-500" : "bg-gradient-to-br from-rose-400 to-rose-600"}`}>
                    <TrendingUp size={16} className="text-white" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${indivWeekPct >= 100 ? "bg-emerald-100 text-emerald-700" : indivWeekPct >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    {focusedSummary.status}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {minutesToHHMM(focusedSummary.totalMinutes)}
                    <span className="ml-1 text-sm font-normal text-slate-400">/ {minutesToHHMM(focusedSummary.expectedMinutes)}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">Horas semana</p>
                </div>
                <div className={`h-1.5 overflow-hidden rounded-full ${pctTrackCls}`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${indivWeekPct}%`, background: pctBarGradient }} />
                </div>
              </div>

              {/* KPI 2 — Saldo semanal */}
              <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md">
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${indivWeekDiff >= 0 ? "bg-gradient-to-br from-teal-400 to-emerald-600" : "bg-gradient-to-br from-orange-400 to-rose-500"}`}>
                    <BarChart2 size={16} className="text-white" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${indivWeekDiff >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {indivWeekDiff >= 0 ? "Positivo" : "Negativo"}
                  </span>
                </div>
                <div>
                  <p className={`text-xl font-bold ${indivWeekDiff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {indivWeekDiff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(indivWeekDiff))}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">Saldo semanal</p>
                </div>
                <p className="text-[10px] text-slate-400">
                  {indivWeekRemaining > 0 ? `Faltan ${minutesToHHMM(indivWeekRemaining)}` : "Objetivo cumplido"}
                </p>
              </div>

              {/* KPI 3 — Balance total */}
              <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600">
                    <ChartColumnBig size={16} className="text-white" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${indivBalance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {indivBalance >= 0 ? "Superávit" : "Déficit"}
                  </span>
                </div>
                <div>
                  <p className={`text-xl font-bold ${indivBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {indivBalance >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(indivBalance))}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">Balance total</p>
                </div>
                <p className="text-[10px] text-slate-400">acumulado desde inicio</p>
              </div>

              {/* KPI 4 — Días completados */}
              <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600">
                    <Clock size={16} className="text-white" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${indivAvgDaily !== null ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                    {indivAvgDaily !== null ? `${minutesToHHMM(indivAvgDaily)}/día` : "—"}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{indivCompletedDays}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">Días completados</p>
                </div>
                <p className="text-[10px] text-slate-400">de {indivRecordedDays} días registrados</p>
              </div>
            </div>
          )}

          {/* ── Vista colaborador ── */}
          {showCollabView && focusedSummary && (
            <div className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/40 shadow-md">
              <div className="flex items-center gap-2 border-b border-violet-100 px-5 py-3">
                <Eye size={14} className="text-violet-500" />
                <p className="text-sm font-semibold text-violet-700">
                  Vista colaborador — {getUserDisplayName(focusedSummary.user).split(" ")[0]}
                </p>
                <span className="ml-auto text-[10px] font-semibold text-violet-400">
                  Así ve su propio horario
                </span>
              </div>
              <div className="p-5">
                <CollaboratorDashboard
                  collaboratorName={getUserDisplayName(focusedSummary.user)}
                  workedMinutes={focusedSummary.totalMinutes}
                  expectedMinutes={focusedSummary.expectedMinutes}
                  diffMinutes={focusedSummary.diffMinutes}
                  completedDays={indivCompletedDays}
                  totalBalanceMinutes={indivBalance}
                  chartData={collabChartData}
                />
              </div>
            </div>
          )}

          {/* ── Person overview card ── */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            {/* Top bar: back + link */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                <ChevronLeft size={13} /> Equipo
              </button>
              {focusedSummary && (
                <Link
                  href={`/admin/requests?user=${encodeURIComponent(focusedSummary.user.uid)}&week=${encodeURIComponent(formatISODate(weekStart))}`}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Ver solicitudes →
                </Link>
              )}
            </div>

            {focusedSummary ? (
              <>
                {/* Identity */}
                <div className="flex items-center gap-3 px-5 pb-4">
                  <UserAvatar
                    name={getUserDisplayName(focusedSummary.user)}
                    photoURL={focusedSummary.user.photoURL}
                    avatarUrl={focusedSummary.user.avatarUrl}
                    profilePhoto={focusedSummary.user.profilePhoto}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {getUserDisplayName(focusedSummary.user)}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[focusedSummary.status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {focusedSummary.status}
                      </span>
                      {focusedSummary.weekRecords.some((r) => r.status === "OPEN") && (
                        <span className="animate-pulse rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          ● EN VIVO
                        </span>
                      )}
                      {focusedSummary.weekCredits.length > 0 && (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                          {focusedSummary.weekCredits.length} ajuste(s)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">
                      {focusedSummary.user.position || "Sin puesto"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-slate-100 px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {indivWeekRemaining > 0 && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                        Faltan {minutesToHHMM(indivWeekRemaining)}
                      </span>
                    )}
                    {indivWeekCreditMinutes > 0 && (
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-600">
                        +{minutesToHHMM(indivWeekCreditMinutes)} ajustes
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSection("saldo")}
                        className="text-[11px] font-semibold text-indigo-500 hover:underline"
                      >
                        {expandedSection === "saldo" ? "Ocultar" : "Ver"} cálculo{" "}
                        {expandedSection === "saldo" ? "↑" : "↓"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSection("balance")}
                        className="text-[11px] font-semibold text-indigo-500 hover:underline"
                      >
                        {expandedSection === "balance" ? "Ocultar" : "Ver"} historial{" "}
                        {expandedSection === "balance" ? "↑" : "↓"}
                      </button>
                    </span>
                  </div>
                </div>

                {/* Saldo calculation formula */}
                {expandedSection === "saldo" && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Cómo se calcula el saldo semanal
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-sm text-slate-600">Tiempo registrado</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToHHMM(indivWeekWorkedOnly)}
                        </p>
                      </div>
                      {indivWeekCreditsOnly > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-cyan-50 px-4 py-3">
                          <p className="text-sm text-cyan-700">Ajustes aprobados</p>
                          <p className="text-sm font-semibold text-cyan-800">
                            +{minutesToHHMM(indivWeekCreditsOnly)}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-sm text-slate-600">Objetivo semanal</p>
                        <p className="text-sm font-semibold text-slate-900">
                          −{minutesToHHMM(focusedSummary?.expectedMinutes ?? 0)}
                        </p>
                      </div>
                      <div
                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${indivWeekDiff >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}
                      >
                        <p className={`text-sm font-semibold ${indivWeekDiff >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                          Saldo
                        </p>
                        <p className={`text-lg font-bold ${indivWeekDiff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {indivWeekDiff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(indivWeekDiff))}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Fórmula: registrado + ajustes − objetivo = saldo
                    </p>
                  </div>
                )}

                {/* Balance expansion — weekly breakdown */}
                {expandedSection === "balance" &&
                  detail?.weeklyBalances &&
                  detail.weeklyBalances.length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Desglose semanal — (registrado + ajustes) − esperado
                      </p>
                      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                        {[...detail.weeklyBalances].reverse().map((entry, i) => {
                          const isCurrentWeek = i === 0;
                          const weekEnd = new Date(entry.weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          const weekLabel = `${entry.weekStart.toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                          })} – ${weekEnd.toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                          })}`;
                          return (
                            <div
                              key={entry.weekKey}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                                isCurrentWeek
                                  ? "bg-indigo-50 ring-1 ring-indigo-200"
                                  : "bg-slate-50"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-slate-700">
                                    {weekLabel}
                                  </p>
                                  {isCurrentWeek && (
                                    <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
                                      actual
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {minutesToHHMM(entry.workedMinutes + entry.creditMinutes)}{" "}
                                  trabajadas · {minutesToHHMM(entry.expectedMinutes)} esperadas
                                  {entry.creditMinutes > 0 && (
                                    <span className="text-cyan-600">
                                      {" "}· +{minutesToHHMM(entry.creditMinutes)} ajustes
                                    </span>
                                  )}
                                </p>
                              </div>
                              <p
                                className={`shrink-0 text-sm font-bold ${
                                  entry.balanceMinutes >= 0
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {entry.balanceMinutes >= 0 ? "+" : ""}
                                {minutesToHHMM(Math.abs(entry.balanceMinutes))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Selecciona un colaborador desde la pestaña Equipo.
              </div>
            )}
          </div>

          {/* ── Week activity strip ── */}
          {focusedSummary && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-md">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Registro semanal</h3>
              </div>

              {detail?.rows?.length ? (
                <>
                  {/* Day indicator strip */}
                  <div className="flex gap-1.5 px-4 py-4">
                    {detail.rows.map((row) => {
                      const isSelected = selectedDetailRow?.dateISO === row.dateISO;
                      const total = row.totalWorkedMinutes + row.totalCreditMinutes;
                      const isLiveShift = row.records.some((r) => r.status === "OPEN");
                      const isHoliday = holidayDateSet.has(row.dateISO);
                      const holidayRecord = isHoliday
                        ? (holidays.find((h) => h.date === row.dateISO) ?? null)
                        : null;
                      const isComplete =
                        total >= expectedPerDay && expectedPerDay > 0 && (row.hasRecord || row.hasCredits);
                      const isPartial =
                        total > 0 && !isComplete && (row.hasRecord || row.hasCredits);
                      const hasActivity = row.hasRecord || row.hasCredits;

                      const circleCls = isLiveShift
                        ? "bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md shadow-indigo-200"
                        : isComplete
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-200"
                          : isPartial
                            ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md shadow-amber-200"
                            : isHoliday
                              ? "bg-gradient-to-br from-sky-200 to-sky-400 text-white"
                              : "bg-slate-100 text-slate-400";

                      const circleChar = isLiveShift
                        ? "●"
                        : isComplete
                          ? "✓"
                          : isPartial
                            ? "~"
                            : "—";

                      return (
                        <button
                          key={row.dateISO}
                          type="button"
                          onClick={() => setSelectedDayISO(row.dateISO)}
                          className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3 transition ${
                            isSelected
                              ? "border-indigo-200 bg-indigo-50"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {SHORT_DAY.format(row.date)}
                          </p>
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${circleCls} ${isLiveShift ? "animate-pulse" : ""}`}
                          >
                            {isHoliday && !isLiveShift && !hasActivity
                              ? <Sun size={14} />
                              : circleChar
                            }
                          </div>
                          <p
                            className={`text-[11px] font-semibold ${hasActivity ? "text-slate-700" : isHoliday ? "text-sky-400" : "text-slate-400"}`}
                          >
                            {hasActivity ? minutesToHHMM(total) : "—"}
                          </p>
                          {isHoliday && (
                            <p className="text-[9px] font-semibold leading-tight text-sky-500">
                              {holidayRecord?.kind === "DAY_OFF" ? "Día libre" : "Feriado"}
                            </p>
                          )}
                          {!isHoliday && row.records[0]?.checkInAt && (
                            <p className="text-[9px] text-slate-400 leading-tight">
                              {formatTime(row.records[0].checkInAt)}
                              {row.records[0].checkOutAt
                                ? `–${formatTime(row.records[0].checkOutAt)}`
                                : " →"}
                            </p>
                          )}
                          {!isHoliday && !row.records[0]?.checkInAt && row.hasCredits && (
                            <p className="text-[9px] text-cyan-500 leading-tight">ajuste</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected day detail — inline below strip */}
                  {selectedDetailRow && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {DAY_LABEL.format(selectedDetailRow.date)}
                      </p>

                      {/* Holiday banner */}
                      {holidayDateSet.has(selectedDetailRow.dateISO) && (
                        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-sky-50 px-4 py-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-300 to-sky-500">
                            <Sun size={13} className="text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-sky-700">
                              {holidays.find((h) => h.date === selectedDetailRow.dateISO)?.name ??
                                (holidays.find((h) => h.date === selectedDetailRow.dateISO)?.kind === "DAY_OFF"
                                  ? "Día libre"
                                  : "Feriado")}
                            </p>
                            <p className="text-[11px] text-sky-500">No se contabilizan horas este día</p>
                          </div>
                        </div>
                      )}

                      {/* Times row */}
                      <div className="flex flex-wrap gap-5">
                        <div>
                          <p className="text-[11px] text-slate-400">Entrada</p>
                          <p className="mt-0.5 text-base font-semibold text-slate-900">
                            {formatTime(selectedDetailRecord?.checkInAt ?? null)}
                          </p>
                        </div>
                        <div className="self-stretch border-l border-slate-100" />
                        <div>
                          <p className="text-[11px] text-slate-400">Salida</p>
                          <p className="mt-0.5 text-base font-semibold text-slate-900">
                            {formatTime(selectedDetailRecord?.checkOutAt ?? null)}
                          </p>
                        </div>
                        <div className="self-stretch border-l border-slate-100" />
                        <div>
                          <p className="text-[11px] text-slate-400">Descanso</p>
                          <p className={`mt-0.5 text-base font-semibold ${hasOpenBreak ? "text-orange-500" : "text-amber-700"}`}>
                            {minutesToHHMM(displayBreakMinutes)}
                          </p>
                          {hasOpenBreak && (
                            <p className="text-[10px] font-semibold text-orange-400">en curso</p>
                          )}
                        </div>
                        <div className="self-stretch border-l border-slate-100" />
                        <div>
                          <p className="text-[11px] text-slate-400">Total neto</p>
                          <p className="mt-0.5 text-base font-bold text-indigo-700">
                            {minutesToHHMM(
                              selectedDetailRow.totalWorkedMinutes +
                                selectedDetailRow.totalCreditMinutes,
                            )}
                          </p>
                        </div>
                        {selectedDetailRow.totalCreditMinutes > 0 && (
                          <>
                            <div className="self-stretch border-l border-slate-100" />
                            <div>
                              <p className="text-[11px] text-slate-400">Ajustes</p>
                              <p className="mt-0.5 text-base font-semibold text-cyan-700">
                                +{minutesToHHMM(selectedDetailRow.totalCreditMinutes)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Breaks */}
                      {selectedDetailBreaks.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {selectedDetailBreaks.map((b, i) => (
                            <p key={`break-${i}`} className={`text-[11px] ${b.endAt ? "text-slate-500" : "font-semibold text-orange-500"}`}>
                              Descanso {i + 1}: {formatTime(b.startAt)} – {b.endAt ? formatTime(b.endAt) : "en curso"}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Credits */}
                      {selectedDetailCredits.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedDetailCredits.map((credit, i) => (
                            <span
                              key={`credit-${i}`}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                credit.source === "REQUEST"
                                  ? "bg-cyan-100 text-cyan-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {credit.source === "REQUEST" ? "Solicitud" : "Actividad"} ·{" "}
                              {credit.type} · +{minutesToHHMM(credit.minutes)}
                              {credit.note ? ` · ${credit.note}` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {selectedDetailRecord?.notes && (
                        <p className="mt-3 text-sm italic text-slate-500">
                          &ldquo;{selectedDetailRecord.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Expandable: attendance detail per day ── */}
                  <div className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleSection("asistencia")}
                      className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <span>Detalle de asistencia por día</span>
                      <span>{expandedSection === "asistencia" ? "↑" : "↓"}</span>
                    </button>
                    {expandedSection === "asistencia" && detail && (
                      <div className="px-5 pb-4">
                        <div className="space-y-1.5">
                          {detail.rows.map((row) => {
                            const hasActivity = row.hasRecord || row.hasCredits;
                            const total = row.totalWorkedMinutes + row.totalCreditMinutes;
                            const isComplete =
                              hasActivity && total >= expectedPerDay && expectedPerDay > 0;
                            return (
                              <div
                                key={row.dateISO}
                                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                    hasActivity
                                      ? isComplete
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                      : "bg-slate-200 text-slate-400"
                                  }`}
                                >
                                  {hasActivity ? (isComplete ? "✓" : "~") : "✗"}
                                </span>
                                <p className="w-28 shrink-0 text-xs font-semibold capitalize text-slate-600">
                                  {DAY_LABEL.format(row.date)}
                                </p>
                                {hasActivity ? (
                                  <>
                                    <p className="flex-1 text-xs text-slate-500">
                                      {minutesToHHMM(total)} trabajadas
                                      {row.totalCreditMinutes > 0 && (
                                        <span className="ml-1 text-cyan-600">
                                          (+{minutesToHHMM(row.totalCreditMinutes)} ajuste)
                                        </span>
                                      )}
                                    </p>
                                    <span
                                      className={`text-[10px] font-semibold ${isComplete ? "text-emerald-600" : "text-amber-600"}`}
                                    >
                                      {isComplete ? "Completa" : "Incompleta"}
                                    </span>
                                  </>
                                ) : (
                                  <p className="text-xs text-slate-400">Sin registro</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                          <span>
                            <span className="font-semibold text-indigo-700">{indivRecordedDays}</span> con registro
                          </span>
                          <span>
                            <span className="font-semibold text-emerald-700">{indivCompletedDays}</span> jornadas completas
                          </span>
                          <span>
                            <span className="font-semibold text-slate-700">
                              {(detail.rows.length) - indivRecordedDays}
                            </span> sin registro
                          </span>
                          {indivAvgDaily !== null && (
                            <span>
                              Promedio: <span className="font-semibold text-slate-700">{minutesToHHMM(indivAvgDaily)}</span>/día
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Expandable: credits/adjustments this week ── */}
                  {focusedSummary && focusedSummary.weekCredits.length > 0 && (
                    <div className="border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleSection("creditos")}
                        className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        <span>
                          Ajustes aplicados esta semana{" "}
                          <span className="ml-1 rounded-full bg-cyan-100 px-2 py-0.5 text-cyan-700">
                            {focusedSummary.weekCredits.length}
                          </span>
                        </span>
                        <span>{expandedSection === "creditos" ? "↑" : "↓"}</span>
                      </button>
                      {expandedSection === "creditos" && (
                        <div className="px-5 pb-4">
                          <div className="space-y-1.5">
                            {focusedSummary.weekCredits.map((credit, i) => (
                              <div
                                key={`${credit.date}-${credit.source}-${i}`}
                                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs ${
                                  credit.source === "REQUEST"
                                    ? "bg-cyan-50"
                                    : "bg-emerald-50"
                                }`}
                              >
                                <div>
                                  <p
                                    className={`font-semibold ${credit.source === "REQUEST" ? "text-cyan-800" : "text-emerald-800"}`}
                                  >
                                    {credit.source === "REQUEST"
                                      ? "Solicitud aprobada"
                                      : "Actividad extra"}{" "}
                                    · {credit.type}
                                  </p>
                                  <p className="text-slate-500">
                                    {credit.date}
                                    {credit.note ? ` · ${credit.note}` : ""}
                                  </p>
                                </div>
                                <p
                                  className={`font-bold ${credit.source === "REQUEST" ? "text-cyan-700" : "text-emerald-700"}`}
                                >
                                  +{minutesToHHMM(credit.minutes)}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm">
                            <span className="font-semibold text-slate-700">Total ajustes</span>
                            <span className="font-bold text-cyan-700">
                              +{minutesToHHMM(indivWeekCreditMinutes)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  Sin registros en esta semana.
                </div>
              )}
            </div>
          )}

          {/* ── Advanced management ── */}
          {focusedSummary && (
            <details className="group rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-700">
                  <ShieldAlert size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Gestión avanzada</p>
                  <p className="text-xs text-rose-600">Herramientas sensibles</p>
                </div>
                <ChevronRight
                  size={14}
                  className="shrink-0 text-rose-400 transition-transform group-open:rotate-90"
                />
              </summary>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-rose-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Fichajes abiertos sin salida
                      </p>
                      <p className="text-xs text-slate-500">
                        {openRecordsCount > 0
                          ? `${openRecordsCount} fichaje(s) sin salida en todos los períodos`
                          : "No hay fichajes abiertos pendientes"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={openRecordsCount === 0 || cleaningOpenShifts}
                      onClick={() => void handleCleanOpenShifts()}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cleaningOpenShifts
                        ? "Limpiando..."
                        : `Eliminar ${openRecordsCount > 0 ? openRecordsCount : ""} abierto(s)`}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Colaborador a limpiar
                    <select
                      className="mt-1.5 block min-w-[180px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
                      value={deleteTargetUserId ?? "all"}
                      onChange={(e) => setDeleteTargetUserId(e.target.value)}
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
                    className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={deleteTargetUserId === "all" || deletingCollaboratorData}
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    {deletingCollaboratorData ? "Eliminando..." : "Elegir qué borrar"}
                  </button>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ─── REPORTES ─── */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-md p-5">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600">
                <ChartColumnBig size={15} className="text-white" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Analítica del equipo</h3>
            </div>
            <p className="mb-4 text-xs text-slate-400">
              Horas trabajadas vs objetivo — semana {formatISODate(weekStart)}
            </p>
            <div className="h-80">
              {globalChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 28 }}
                  >
                    <defs>
                      <linearGradient id="blueBarGradReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.95} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={50}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GlobalHoursTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                    <Bar dataKey="expectedHours" fill="#e0e7ff" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="workedHours" fill="url(#blueBarGradReports)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                  Sin datos suficientes esta semana.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">Resumen por colaborador</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-3 py-3">Trabajadas</th>
                    <th className="px-3 py-3">Objetivo</th>
                    <th className="px-3 py-3">Balance</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.map((item) => {
                    const diff = item.diffMinutes;
                    const pct =
                      item.expectedMinutes > 0
                        ? Math.min(
                            100,
                            Math.round((item.totalMinutes / item.expectedMinutes) * 100),
                          )
                        : 0;
                    return (
                      <tr
                        key={item.user.uid}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => openIndividual(item.user.uid)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={getUserDisplayName(item.user)}
                              photoURL={item.user.photoURL}
                              avatarUrl={item.user.avatarUrl}
                              profilePhoto={item.user.profilePhoto}
                            />
                            <div>
                              <p className="font-semibold text-slate-900">
                                {getUserDisplayName(item.user)}
                              </p>
                              <p className="text-xs text-slate-400">
                                {item.user.position || "Sin puesto"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">
                            {minutesToHHMM(item.totalMinutes)}
                          </p>
                          <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: barGradient(pct) }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {minutesToHHMM(item.expectedMinutes)}
                        </td>
                        <td
                          className={`px-3 py-3 font-semibold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {diff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(diff))}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? "bg-slate-300"}`}
                            />
                            <span className="text-xs text-slate-600">{item.status}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ChevronRight size={14} className="text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-900">Seleccionar datos a eliminar</h4>
            <p className="mt-1 text-xs text-slate-500">
              Esta acción es irreversible. Selecciona el alcance para el colaborador elegido.
            </p>
            <div className="mt-4 space-y-2">
              {(["TIME_ONLY", "REQUESTS_ONLY", "ALL"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <input
                    checked={deleteMode === mode}
                    className="mt-0.5"
                    name="deleteMode"
                    onChange={() => setDeleteMode(mode)}
                    type="radio"
                  />
                  <span>
                    {mode === "TIME_ONLY"
                      ? "Solo fichajes de horas (timeEntries + users/(uid)/hours)"
                      : mode === "REQUESTS_ONLY"
                        ? "Solo solicitudes y actividades (hourRequests + extraActivities)"
                        : "Todo (horas + solicitudes + actividades)"}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={() => setDeleteModalOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-70"
                disabled={deleteTargetUserId === "all" || deletingCollaboratorData}
                onClick={() => void handleDeleteCollaboratorData(user?.uid, deleteMode)}
                type="button"
              >
                {deletingCollaboratorData ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
