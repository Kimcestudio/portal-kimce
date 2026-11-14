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
import dynamic from "next/dynamic";
const HoursBarChart = dynamic(() => import("@/components/attendance/HoursBarChart"), { ssr: false })
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
import CollaboratorDashboard from "@/components/attendance/CollaboratorDashboard";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminWeeklyAlerts, { type EnrichedAlertItem, type AlertType } from "@/app/admin/attendance/AdminWeeklyAlerts";
import AdminAttendanceMonitorTabs from "@/app/admin/attendance/AdminAttendanceMonitorTabs";
import {
  expectedMinutesForDate,
  formatISODate,
  formatTime,
  getWeekKey,
  getWeekStartMonday,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { getUserDisplayName, useAdminHoursMonitor } from "@/app/admin/hours/useAdminHoursMonitor";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/services/firebase/client";
import { createCalendarHoliday, deleteCalendarHoliday } from "@/services/calendar";

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
    applyingLunchFix,
    handleRetroactiveLunchFix,
    revertingLunchFix,
    handleRevertWrongLunchFix,
    todayNoBreak,
  } = useAdminHoursMonitor(user?.role);

  const [activeTab, setActiveTab] = useState<AdminHoursTab>("dashboard");
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [kpiDetail, setKpiDetail] = useState<null | "horas" | "saldo" | "balance" | "dias">(null);
  const [showTeamChart, setShowTeamChart] = useState(false);
  const [showCollabView, setShowCollabView] = useState(false);
  const [dayCtx, setDayCtx] = useState<{
    dateISO: string;
    x: number;
    y: number;
    phase: "menu" | "feriado_name" | "edit_record" | "move_record";
    feriadoName: string;
    editCheckIn: string;
    editCheckOut: string;
    editBreakStart: string;
    editBreakEnd: string;
    moveTargetDate: string;
  } | null>(null);
  const [ctxSaving, setCtxSaving] = useState(false);

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

  useEffect(() => {
    if (!dayCtx) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("day-ctx-menu");
      if (el && !el.contains(e.target as Node)) setDayCtx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [!!dayCtx]);

  const handleDayContextMenu = (e: React.MouseEvent, dateISO: string) => {
    e.preventDefault();
    setDayCtx({ dateISO, x: e.clientX, y: e.clientY, phase: "menu", feriadoName: "", editCheckIn: "", editCheckOut: "", editBreakStart: "", editBreakEnd: "", moveTargetDate: "" });
  };

  // ── Helpers para obtener el registro del día del colaborador enfocado ─────
  const getDayRecord = (dateISO: string) =>
    detail?.rows.find((r) => r.dateISO === dateISO)?.records[0] ?? null;

  const toLocalTime = (iso: string | null | undefined, dateISO: string) => {
    if (!iso) return "";
    // Reconstruct the time in local wall clock (the record timestamp is stored in local ISO)
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const openEditPhase = (dateISO: string) => {
    const record = getDayRecord(dateISO);
    const firstBreak = (record?.breaks ?? []).find((b) => b.startAt);
    setDayCtx((prev) =>
      prev ? {
        ...prev,
        phase: "edit_record",
        editCheckIn: toLocalTime(record?.checkInAt, dateISO),
        editCheckOut: toLocalTime(record?.checkOutAt, dateISO),
        editBreakStart: firstBreak ? toLocalTime(firstBreak.startAt, dateISO) : "",
        editBreakEnd: firstBreak?.endAt ? toLocalTime(firstBreak.endAt, dateISO) : "",
      } : null,
    );
  };

  const handleDeleteDayRecord = async (dateISO: string) => {
    const uid = focusedSummary?.user?.uid;
    const name = focusedSummary ? getUserDisplayName(focusedSummary.user).split(" ")[0] : "colaborador";
    if (!uid) return;
    if (!window.confirm(`¿Eliminar el registro del ${dateISO} para ${name}? Esta acción es irreversible.`)) return;
    setCtxSaving(true);
    try {
      const batch = writeBatch(db);
      const hoursSnap = await getDocs(query(collection(db, "users", uid, "hours"), where("date", "==", dateISO)));
      hoursSnap.docs.forEach((d) => batch.delete(d.ref));
      const teSnap = await getDocs(query(collection(db, "timeEntries"), where("uid", "==", uid), where("dayKey", "==", dateISO)));
      teSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setDayCtx(null);
    } finally {
      setCtxSaving(false);
    }
  };

  const handleSaveEditRecord = async () => {
    if (!dayCtx || dayCtx.phase !== "edit_record") return;
    const uid = focusedSummary?.user?.uid;
    if (!uid || !dayCtx.editCheckIn || !dayCtx.editCheckOut) return;
    const { dateISO, editCheckIn, editCheckOut, editBreakStart, editBreakEnd } = dayCtx;
    const checkInAt = new Date(`${dateISO}T${editCheckIn}:00`).toISOString();
    const checkOutAt = new Date(`${dateISO}T${editCheckOut}:00`).toISOString();
    if (new Date(checkInAt) >= new Date(checkOutAt)) return;
    const elapsedMins = Math.round((new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60000);
    const breaks = (editBreakStart && editBreakEnd)
      ? [{ startAt: new Date(`${dateISO}T${editBreakStart}:00`).toISOString(), endAt: new Date(`${dateISO}T${editBreakEnd}:00`).toISOString() }]
      : [];
    const breakMinutes = breaks.length > 0
      ? Math.max(0, Math.round((new Date(breaks[0].endAt).getTime() - new Date(breaks[0].startAt).getTime()) / 60000))
      : 0;
    const totalMinutes = Math.max(0, elapsedMins - breakMinutes);
    setCtxSaving(true);
    try {
      // Find the real doc (handles IDs that differ from the ${uid}_${date} convention)
      const hoursSnap = await getDocs(query(collection(db, "users", uid, "hours"), where("date", "==", dateISO)));
      const hoursDocRef = hoursSnap.docs[0]?.ref ?? doc(db, "users", uid, "hours", `${uid}_${dateISO}`);
      await setDoc(hoursDocRef, {
        uid, date: dateISO, weekKey: getWeekKey(dateISO),
        checkInAt, checkOutAt, breaks,
        totalMinutes, hours: Math.round((totalMinutes / 60) * 10) / 10,
        status: "CLOSED", updatedAt: serverTimestamp(),
      });
      // Delete stale timeEntries for this day (admin can delete; can't update other users' entries)
      for (const field of ["uid", "userId"] as const) {
        const teSnap = await getDocs(query(collection(db, "timeEntries"), where(field, "==", uid), where("dayKey", "==", dateISO)));
        if (teSnap.empty) continue;
        const teBatch = writeBatch(db);
        teSnap.docs.forEach((d) => teBatch.delete(d.ref));
        await teBatch.commit();
      }
      setDayCtx(null);
    } catch (err) {
      console.error("Error guardando horario:", err);
      window.alert("Error al guardar. Revisa la consola para más detalles.");
    } finally {
      setCtxSaving(false);
    }
  };

  const handleApplyLunchForDay = async (dateISO: string) => {
    const uid = focusedSummary?.user?.uid;
    if (!uid) return;
    // Sábados no tienen almuerzo de 1:15 h (día laboral corto sin break obligatorio)
    if (new Date(`${dateISO}T12:00:00`).getDay() === 6) {
      window.alert("Los sábados no tienen almuerzo de 1:15 h asignado.");
      return;
    }
    const record = getDayRecord(dateISO);
    if (!record?.checkInAt || !record?.checkOutAt) { window.alert("No hay registro cerrado para ese día."); return; }
    const existingBreakMins = (record.breaks ?? []).reduce((t, b) => {
      if (!b.endAt) return t;
      return t + Math.max(0, Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000));
    }, 0);
    if (existingBreakMins >= 30) { window.alert("Este día ya tiene descanso registrado."); return; }
    setCtxSaving(true);
    try {
      const breakEnd = record.checkOutAt;
      const breakStart = new Date(new Date(record.checkOutAt).getTime() - 75 * 60000).toISOString();
      const updatedBreaks = [...(record.breaks ?? []), { startAt: breakStart, endAt: breakEnd }];
      const elapsed = Math.round((new Date(record.checkOutAt).getTime() - new Date(record.checkInAt).getTime()) / 60000);
      const newTotal = Math.max(0, elapsed - 75 - existingBreakMins);
      const hoursSnap = await getDocs(query(collection(db, "users", uid, "hours"), where("date", "==", dateISO)));
      if (hoursSnap.empty) { window.alert("No se encontró el documento en Firestore."); return; }
      await setDoc(hoursSnap.docs[0].ref, {
        breaks: updatedBreaks, totalMinutes: newTotal,
        hours: Math.round((newTotal / 60) * 10) / 10, updatedAt: serverTimestamp(),
      }, { merge: true });
      setDayCtx(null);
    } finally {
      setCtxSaving(false);
    }
  };

  const handleDecreeFeriado = async (dateISO: string, name: string) => {
    if (!name.trim()) return;
    setCtxSaving(true);
    try {
      await createCalendarHoliday({ date: dateISO, name: name.trim(), kind: "HOLIDAY" });
    } finally {
      setCtxSaving(false);
      setDayCtx(null);
    }
  };

  const handleDecreeDayOff = async (dateISO: string) => {
    setCtxSaving(true);
    try {
      await createCalendarHoliday({ date: dateISO, name: "Día libre", kind: "DAY_OFF" });
    } finally {
      setCtxSaving(false);
      setDayCtx(null);
    }
  };

  const handleDeleteHoliday = async (dateISO: string) => {
    const holiday = holidays.find((h) => h.date === dateISO);
    if (!holiday) return;
    setCtxSaving(true);
    try {
      await deleteCalendarHoliday(holiday.id);
    } finally {
      setCtxSaving(false);
      setDayCtx(null);
    }
  };

  const handleMoveRecord = async () => {
    if (!dayCtx || dayCtx.phase !== "move_record" || !dayCtx.moveTargetDate) return;
    const uid = focusedSummary?.user?.uid;
    if (!uid) return;
    const { dateISO, moveTargetDate } = dayCtx;
    if (dateISO === moveTargetDate) { setDayCtx(null); return; }
    const record = getDayRecord(dateISO);
    if (!record) return;
    setCtxSaving(true);
    try {
      // Find and delete all existing hours docs for the source date (handles non-standard IDs)
      const oldHoursSnap = await getDocs(query(collection(db, "users", uid, "hours"), where("date", "==", dateISO)));
      const newHoursRef = doc(db, "users", uid, "hours", `${uid}_${moveTargetDate}`);
      const batch = writeBatch(db);
      if (oldHoursSnap.empty) {
        // Fallback: delete by standard ID in case query missed it
        batch.delete(doc(db, "users", uid, "hours", `${uid}_${dateISO}`));
      } else {
        oldHoursSnap.docs.forEach((d) => batch.delete(d.ref));
      }
      batch.set(newHoursRef, {
        uid,
        date: moveTargetDate,
        weekKey: getWeekKey(moveTargetDate),
        checkInAt: record.checkInAt ?? null,
        checkOutAt: record.checkOutAt ?? null,
        breaks: record.breaks ?? [],
        totalMinutes: record.totalMinutes,
        hours: Math.round((record.totalMinutes / 60) * 10) / 10,
        status: record.checkOutAt ? "CLOSED" : "OPEN",
        notes: record.notes ?? null,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      // Delete stale timeEntries from the old date (admin can delete; can't update other users' entries)
      for (const field of ["uid", "userId"] as const) {
        const teSnap = await getDocs(query(collection(db, "timeEntries"), where(field, "==", uid), where("dayKey", "==", dateISO)));
        if (teSnap.empty) continue;
        const teBatch = writeBatch(db);
        teSnap.docs.forEach((d) => teBatch.delete(d.ref));
        await teBatch.commit();
      }
      setDayCtx(null);
    } catch (err) {
      console.error("Error moviendo registro:", err);
      window.alert("Error al mover el registro. Revisa la consola para más detalles.");
    } finally {
      setCtxSaving(false);
    }
  };

  const handleAssignIndividualDayOff = async (dateISO: string) => {
    const focusedUid = focusedSummary?.user?.uid;
    const focusedName = focusedSummary ? getUserDisplayName(focusedSummary.user) : "Colaborador";
    if (!focusedUid) return;
    setCtxSaving(true);
    try {
      await addDoc(collection(db, "hourRequests"), {
        uid: focusedUid,
        userName: focusedName,
        weekKey: getWeekKey(dateISO),
        weekKeys: [getWeekKey(dateISO)],
        status: "approved",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: "DIA_LIBRE",
        date: dateISO,
        endDate: null,
        hours: null,
        reason: `Asignado por administrador`,
      });
    } finally {
      setCtxSaving(false);
      setDayCtx(null);
    }
  };


  const selectedDetailRecord = selectedDetailRow?.records[0] ?? null;
  const selectedDetailCredits = selectedDetailRow?.credits ?? [];
  const selectedDetailBreaks = selectedDetailRecord?.breaks ?? [];
  const hasOpenBreak = selectedDetailBreaks.some((b) => !b.endAt);
  const openBreakElapsedMinutes = selectedDetailBreaks
    .filter((b) => !b.endAt)
    .reduce((total, b) => total + Math.max(0, Math.round((Date.now() - new Date(b.startAt).getTime()) / 60000)), 0);
  const displayBreakMinutes = (selectedDetailRow?.totalBreakMinutes ?? 0) + openBreakElapsedMinutes;

  const summaryByUid = useMemo(
    () => new Map(summaries.map((s) => [s.user.uid, s])),
    [summaries],
  );

  const enrichedWeeklyAlerts = useMemo((): EnrichedAlertItem[] =>
    weeklyAlerts.map((alert): EnrichedAlertItem => {
      const summary = summaryByUid.get(alert.uid);
      const u = summary?.user;
      const chips: EnrichedAlertItem["chips"] = [];
      if (summary) {
        chips.push({ label: "Trabajadas", value: minutesToHHMM(summary.totalMinutes), tone: summary.totalMinutes > 0 ? "emerald" : "slate" });
        chips.push({ label: "Esperadas", value: minutesToHHMM(summary.expectedMinutes), tone: "slate" });
        if (summary.diffMinutes < 0) {
          chips.push({ label: "Déficit", value: minutesToHHMM(Math.abs(summary.diffMinutes)), tone: "rose" });
        }
      }
      return {
        id: alert.id,
        uid: alert.uid,
        level: alert.level,
        source: "hours" as const,
        alertType: (alert.id.startsWith("attendance-open-") ? "open-shift" : alert.id.startsWith("attendance-missing-") ? "missing-hours" : "credit-only") as AlertType,
        title: alert.title,
        description: alert.description,
        personName: u ? (u.displayName ?? u.fullName ?? u.name ?? u.email ?? "Colaborador") : undefined,
        personPhotoURL: u?.photoURL ?? undefined,
        personAvatarUrl: u?.avatarUrl,
        personProfilePhoto: u?.profilePhoto,
        personArea: u?.area ?? undefined,
        chips,
        actionLabel: alert.actionLabel ?? "Ver asistencia",
        actionHref: `/admin/attendance?user=${encodeURIComponent(alert.uid)}&week=${encodeURIComponent(formatISODate(weekStart))}`,
      };
    }),
    [weeklyAlerts, summaryByUid, weekStart],
  );

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

          {/* Widget: sin almuerzo hoy ≥4h en turno */}
          {todayNoBreak.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-amber-100 px-5 py-3">
                <span className="text-base">☕</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Sin almuerzo registrado hoy</p>
                  <p className="text-xs text-amber-600">{todayNoBreak.length} colaborador{todayNoBreak.length !== 1 ? "es" : ""} con ≥4h en turno sin descanso</p>
                </div>
              </div>
              <div className="divide-y divide-amber-100">
                {todayNoBreak.map(({ record, user }) => {
                  const elapsed = record.checkInAt
                    ? Math.round((Date.now() - new Date(record.checkInAt).getTime()) / 60000)
                    : 0;
                  const name = user ? getUserDisplayName(user) : record.userId;
                  return (
                    <div key={record.userId} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-800">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-slate-800">{name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-700 font-semibold">{minutesToHHMM(elapsed)} en turno</span>
                        <button
                          type="button"
                          onClick={() => { openIndividual(user?.uid ?? record.userId); }}
                          className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600"
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {enrichedWeeklyAlerts.length > 0 && (
            <AdminWeeklyAlerts alerts={enrichedWeeklyAlerts} />
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
                <HoursBarChart data={globalChartData} height={288} bottomMargin={24} gradientId="blueBarGradTeam" />
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
              <div className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md ring-1 transition ${kpiDetail === "horas" ? "ring-indigo-400" : "ring-transparent hover:ring-slate-200"}`} onClick={() => setKpiDetail(p => p === "horas" ? null : "horas")}>
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
              <div className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md ring-1 transition ${kpiDetail === "saldo" ? "ring-indigo-400" : "ring-transparent hover:ring-slate-200"}`} onClick={() => setKpiDetail(p => p === "saldo" ? null : "saldo")}>
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
              <div className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md ring-1 transition ${kpiDetail === "balance" ? "ring-indigo-400" : "ring-transparent hover:ring-slate-200"}`} onClick={() => setKpiDetail(p => p === "balance" ? null : "balance")}>
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
              <div className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-md ring-1 transition ${kpiDetail === "dias" ? "ring-indigo-400" : "ring-transparent hover:ring-slate-200"}`} onClick={() => setKpiDetail(p => p === "dias" ? null : "dias")}>
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

          {/* ── KPI detail panel ── */}
          {kpiDetail && focusedSummary && detail && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {kpiDetail === "horas" && "Detalle horas semana"}
                  {kpiDetail === "saldo" && "Detalle saldo semanal por día"}
                  {kpiDetail === "balance" && "Balance acumulado por semana"}
                  {kpiDetail === "dias" && "Estado de días registrados"}
                </p>
                <button onClick={() => setKpiDetail(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ cerrar</button>
              </div>

              {/* KPI 1 + KPI 2: tabla diaria */}
              {(kpiDetail === "horas" || kpiDetail === "saldo") && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase text-slate-400">
                      <th className="pb-2 pr-3">Día</th>
                      <th className="pb-2 pr-3 text-right">Trabajado</th>
                      {kpiDetail === "horas" && <th className="pb-2 pr-3 text-right">Créditos</th>}
                      <th className="pb-2 pr-3 text-right">Esperado</th>
                      <th className="pb-2 text-right">Saldo día</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((row) => {
                      const exp = expectedMinutesForDate(row.date, detail.schedule, holidayDateSet);
                      const total = row.totalWorkedMinutes + row.totalCreditMinutes;
                      const diff = total - exp;
                      const isToday = row.dateISO === formatISODate(new Date());
                      return (
                        <tr key={row.dateISO} className={`border-b border-slate-50 ${isToday ? "bg-indigo-50/60" : ""}`}>
                          <td className="py-1.5 pr-3 font-medium text-slate-600">
                            {SHORT_DAY.format(row.date).toUpperCase()} {row.date.getDate()}
                            {isToday && <span className="ml-1 text-[9px] font-bold text-indigo-500">HOY</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-right text-slate-700">{row.totalWorkedMinutes > 0 ? minutesToHHMM(row.totalWorkedMinutes) : "—"}</td>
                          {kpiDetail === "horas" && <td className="py-1.5 pr-3 text-right text-teal-600">{row.totalCreditMinutes > 0 ? `+${minutesToHHMM(row.totalCreditMinutes)}` : "—"}</td>}
                          <td className="py-1.5 pr-3 text-right text-slate-400">{exp > 0 ? minutesToHHMM(exp) : "—"}</td>
                          <td className={`py-1.5 text-right font-semibold ${exp === 0 ? "text-slate-300" : diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {exp === 0 ? "—" : `${diff >= 0 ? "+" : ""}${minutesToHHMM(Math.abs(diff))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td className="pt-2 pr-3 text-[10px] font-bold text-slate-500">TOTAL</td>
                      <td className="pt-2 pr-3 text-right text-xs font-bold text-slate-700">{minutesToHHMM(indivWeekWorkedOnly)}</td>
                      {kpiDetail === "horas" && <td className="pt-2 pr-3 text-right text-xs font-bold text-teal-600">{indivWeekCreditsOnly > 0 ? `+${minutesToHHMM(indivWeekCreditsOnly)}` : "—"}</td>}
                      <td className="pt-2 pr-3 text-right text-xs font-bold text-slate-400">{minutesToHHMM(focusedSummary.expectedMinutes)}</td>
                      <td className={`pt-2 text-right text-xs font-bold ${indivWeekDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {indivWeekDiff >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(indivWeekDiff))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* KPI 3: balance por semana */}
              {kpiDetail === "balance" && (
                <div className="space-y-1">
                  <p className="mb-2 text-[10px] text-slate-400">
                    {"Semanas con diferencia entre horas trabajadas y esperadas. Suma acumulada desde el primer registro."}
                    {detail.weeklyBalances.length > 0 && ` Desde ${detail.weeklyBalances[detail.weeklyBalances.length - 1].weekStart.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })} hasta hoy.`}
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase text-slate-400">
                        <th className="pb-2 pr-3">Semana</th>
                        <th className="pb-2 pr-3 text-right">Trabajado</th>
                        <th className="pb-2 pr-3 text-right">Créditos</th>
                        <th className="pb-2 pr-3 text-right">Esperado</th>
                        <th className="pb-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...detail.weeklyBalances].reverse().map((entry) => {
                        const label = entry.weekStart.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
                        const isCurrentWeek = entry.weekKey === getWeekKey(formatISODate(new Date()));
                        return (
                          <tr key={entry.weekKey} className={`border-b border-slate-50 ${isCurrentWeek ? "bg-indigo-50/60" : ""}`}>
                            <td className="py-1.5 pr-3 font-medium text-slate-600">
                              {label}
                              {isCurrentWeek && <span className="ml-1 text-[9px] font-bold text-indigo-500">ACTUAL</span>}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-700">{minutesToHHMM(entry.workedMinutes)}</td>
                            <td className="py-1.5 pr-3 text-right text-teal-600">{entry.creditMinutes > 0 ? `+${minutesToHHMM(entry.creditMinutes)}` : "—"}</td>
                            <td className="py-1.5 pr-3 text-right text-slate-400">{minutesToHHMM(entry.expectedMinutes)}</td>
                            <td className={`py-1.5 text-right font-semibold ${entry.balanceMinutes >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {entry.balanceMinutes >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(entry.balanceMinutes))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200">
                        <td colSpan={4} className="pt-2 pr-3 text-[10px] font-bold text-slate-500">BALANCE TOTAL</td>
                        <td className={`pt-2 text-right text-sm font-bold ${indivBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {indivBalance >= 0 ? "+" : ""}{minutesToHHMM(Math.abs(indivBalance))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* KPI 4: días */}
              {kpiDetail === "dias" && (
                <>
                <div className="space-y-1">
                  {detail.rows.map((row) => {
                    const exp = expectedMinutesForDate(row.date, detail.schedule, holidayDateSet);
                    const rec = row.records[0] ?? null;
                    const total = row.totalWorkedMinutes + row.totalCreditMinutes;
                    const done = rec?.status === "CLOSED" && total >= exp && exp > 0;
                    const open = rec?.status === "OPEN";
                    const free = exp === 0;
                    const missing = !rec && !free;
                    return (
                      <div key={row.dateISO} className="flex items-center gap-2 rounded-lg px-2 py-1.5 even:bg-slate-50">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-emerald-100 text-emerald-700" : open ? "bg-blue-100 text-blue-700" : free ? "bg-slate-100 text-slate-400" : "bg-rose-50 text-rose-400"}`}>
                          {done ? "✓" : open ? "●" : free ? "—" : "○"}
                        </span>
                        <span className="w-20 text-xs font-medium text-slate-600">
                          {SHORT_DAY.format(row.date).toUpperCase()} {row.date.getDate()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {free ? "Libre / feriado" : done ? `${minutesToHHMM(total)} trabajadas` : open ? `En curso · ${minutesToHHMM(rec?.totalMinutes ?? 0)}` : "Sin registro"}
                        </span>
                        {!free && <span className={`ml-auto text-[10px] font-semibold ${done ? "text-emerald-600" : open ? "text-blue-500" : "text-rose-400"}`}>{done ? "Completo" : open ? "Abierto" : "Pendiente"}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span><span className="font-semibold text-indigo-700">{indivRecordedDays}</span> con registro</span>
                  <span><span className="font-semibold text-emerald-700">{indivCompletedDays}</span> jornadas completas</span>
                  <span><span className="font-semibold text-slate-700">{(detail?.rows.length ?? 0) - indivRecordedDays}</span> sin registro</span>
                  {indivAvgDaily !== null && (
                    <span>Promedio: <span className="font-semibold text-slate-700">{minutesToHHMM(indivAvgDaily)}</span>/día</span>
                  )}
                </div>
                </>
              )}
            </div>
          )}

          {/* ── Person overview card ── */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            {/* Top bar: back */}
            <div className="flex items-center px-5 pt-4 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                <ChevronLeft size={13} /> Equipo
              </button>
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
                    <div>
                      <p className="text-sm text-slate-400">
                        {focusedSummary.user.position || "Sin puesto"}
                      </p>
                      {detail?.schedule && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span className="font-medium text-slate-500">{detail.schedule.name}</span>
                          {" · "}{minutesToHHMM(Math.round(detail.schedule.weeklyMinutes / 5))}/día
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ver solicitudes */}
                <div className="border-t border-slate-100 px-5 py-3">
                  <Link
                    href={`/admin/requests?user=${encodeURIComponent(focusedSummary.user.uid)}&week=${encodeURIComponent(formatISODate(weekStart))}`}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Ver solicitudes →
                  </Link>
                </div>
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
                          onContextMenu={(e) => handleDayContextMenu(e, row.dateISO)}
                          className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3 transition ${
                            isSelected
                              ? "border-indigo-200 bg-indigo-50"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {SHORT_DAY.format(row.date)}
                          </p>
                          <p className="text-[9px] font-medium text-slate-300 -mt-1">
                            {row.date.getDate()}
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
                          {selectedDetailBreaks.filter((b) => b.startAt).map((b, i) => (
                            <p key={`break-time-${i}`} className={`text-[10px] leading-tight ${b.endAt ? "text-slate-400" : "font-semibold text-orange-400"}`}>
                              {formatTime(b.startAt)} – {b.endAt ? formatTime(b.endAt) : "en curso"}
                            </p>
                          ))}
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
                  expectedWorkDays={detail?.rows.length ?? 5}
                  totalBalanceMinutes={indivBalance}
                  chartData={collabChartData}
                />
              </div>
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

                <div className="rounded-xl border border-amber-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Corrección retroactiva de almuerzo
                      </p>
                      <p className="text-xs text-slate-500">
                        Asigna 1:15 h de descanso a días cerrados con ≥4h trabajadas y sin almuerzo (excluye sábados y part-time).
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={revertingLunchFix || applyingLunchFix}
                        onClick={() => void handleRevertWrongLunchFix()}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {revertingLunchFix ? "Revirtiendo..." : "Revertir incorrectos"}
                      </button>
                      <button
                        type="button"
                        disabled={applyingLunchFix || revertingLunchFix}
                        onClick={() => void handleRetroactiveLunchFix()}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {applyingLunchFix ? "Aplicando..." : "Aplicar corrección"}
                      </button>
                    </div>
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
              <HoursBarChart data={globalChartData} height={320} bottomMargin={28} gradientId="blueBarGradReports" />
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

      {/* ── Menú contextual de día ── */}
      {dayCtx && (
        <div
          id="day-ctx-menu"
          className="fixed z-[200] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ top: dayCtx.y, left: dayCtx.x }}
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {DAY_LABEL.format(new Date(`${dayCtx.dateISO}T00:00:00`))}
            </p>
          </div>

          {dayCtx.phase === "menu" && (
            <div className="py-1">
              {holidayDateSet.has(dayCtx.dateISO) ? (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                  disabled={ctxSaving}
                  onClick={() => void handleDeleteHoliday(dayCtx.dateISO)}
                  type="button"
                >
                  <span>🗑️</span> Quitar feriado / día libre
                </button>
              ) : (
                <>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    onClick={() => setDayCtx((prev) => prev ? { ...prev, phase: "feriado_name" } : null)}
                    type="button"
                  >
                    <span>🏖️</span> Decretar feriado
                  </button>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-pink-50 hover:text-pink-700 disabled:opacity-50"
                    disabled={ctxSaving}
                    onClick={() => void handleDecreeDayOff(dayCtx.dateISO)}
                    type="button"
                  >
                    <span>🌴</span> Día libre global
                  </button>
                </>
              )}
              {focusedSummary && (
                <>
                  <hr className="my-1 border-slate-100" />
                  <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {getUserDisplayName(focusedSummary.user).split(" ")[0]}
                  </p>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                    disabled={ctxSaving}
                    onClick={() => void handleAssignIndividualDayOff(dayCtx.dateISO)}
                    type="button"
                  >
                    <span>🏖️</span> Asignar día libre
                  </button>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                    disabled={ctxSaving}
                    onClick={() => openEditPhase(dayCtx.dateISO)}
                    type="button"
                  >
                    <span>✏️</span> Editar horario del día
                  </button>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                    disabled={ctxSaving || !getDayRecord(dayCtx.dateISO)}
                    onClick={() => setDayCtx((prev) => prev ? { ...prev, phase: "move_record", moveTargetDate: "" } : null)}
                    type="button"
                  >
                    <span>📅</span> Mover registro a otro día
                  </button>
                  {new Date(`${dayCtx.dateISO}T12:00:00`).getDay() !== 6 && (
                    <button
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                      disabled={ctxSaving}
                      onClick={() => void handleApplyLunchForDay(dayCtx.dateISO)}
                      type="button"
                    >
                      <span>☕</span> Aplicar almuerzo 1:15 h
                    </button>
                  )}
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                    disabled={ctxSaving}
                    onClick={() => void handleDeleteDayRecord(dayCtx.dateISO)}
                    type="button"
                  >
                    <span>🗑️</span> Eliminar registro del día
                  </button>
                </>
              )}
            </div>
          )}

          {dayCtx.phase === "edit_record" && (
            <div className="space-y-2.5 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-semibold text-slate-500">
                  Entrada
                  <input
                    autoFocus
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                    value={dayCtx.editCheckIn}
                    onChange={(e) => setDayCtx((prev) => prev ? { ...prev, editCheckIn: e.target.value } : null)}
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-500">
                  Salida
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                    value={dayCtx.editCheckOut}
                    onChange={(e) => setDayCtx((prev) => prev ? { ...prev, editCheckOut: e.target.value } : null)}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-semibold text-slate-500">
                  Inicio descanso
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                    value={dayCtx.editBreakStart}
                    onChange={(e) => setDayCtx((prev) => prev ? { ...prev, editBreakStart: e.target.value } : null)}
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-500">
                  Fin descanso
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                    value={dayCtx.editBreakEnd}
                    onChange={(e) => setDayCtx((prev) => prev ? { ...prev, editBreakEnd: e.target.value } : null)}
                  />
                </label>
              </div>
              {dayCtx.editCheckIn && dayCtx.editCheckOut && (() => {
                const elapsed = Math.round((new Date(`${dayCtx.dateISO}T${dayCtx.editCheckOut}:00`).getTime() - new Date(`${dayCtx.dateISO}T${dayCtx.editCheckIn}:00`).getTime()) / 60000);
                const breakMins = (dayCtx.editBreakStart && dayCtx.editBreakEnd)
                  ? Math.max(0, Math.round((new Date(`${dayCtx.dateISO}T${dayCtx.editBreakEnd}:00`).getTime() - new Date(`${dayCtx.dateISO}T${dayCtx.editBreakStart}:00`).getTime()) / 60000))
                  : 0;
                return (
                  <p className="text-[11px] text-slate-400">
                    Total: {minutesToHHMM(Math.max(0, elapsed - breakMins))} h netas
                    {breakMins > 0 && <span className="ml-1 text-amber-600">({minutesToHHMM(breakMins)} descanso)</span>}
                  </p>
                );
              })()}
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  onClick={() => setDayCtx(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  disabled={ctxSaving || !dayCtx.editCheckIn || !dayCtx.editCheckOut}
                  onClick={() => void handleSaveEditRecord()}
                  type="button"
                >
                  {ctxSaving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {dayCtx.phase === "move_record" && (
            <div className="space-y-2.5 px-3 py-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Mover registro</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Desde: <span className="font-semibold">{DAY_LABEL.format(new Date(`${dayCtx.dateISO}T00:00:00`))}</span>
                </p>
              </div>
              <label className="block text-[11px] font-semibold text-slate-500">
                Nuevo día
                <input
                  autoFocus
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                  value={dayCtx.moveTargetDate}
                  onChange={(e) => setDayCtx((prev) => prev ? { ...prev, moveTargetDate: e.target.value } : null)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  onClick={() => setDayCtx(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={ctxSaving || !dayCtx.moveTargetDate || dayCtx.moveTargetDate === dayCtx.dateISO}
                  onClick={() => void handleMoveRecord()}
                  type="button"
                >
                  {ctxSaving ? "Moviendo…" : "Mover"}
                </button>
              </div>
            </div>
          )}

          {dayCtx.phase === "feriado_name" && (
            <div className="space-y-2 px-3 py-3">
              <label className="block text-[11px] font-semibold text-slate-500">
                Nombre del feriado
              </label>
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                placeholder="Ej: Fiestas Patrias"
                value={dayCtx.feriadoName}
                onChange={(e) =>
                  setDayCtx((prev) => prev ? { ...prev, feriadoName: e.target.value } : null)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleDecreeFeriado(dayCtx.dateISO, dayCtx.feriadoName);
                  if (e.key === "Escape") setDayCtx(null);
                }}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  onClick={() => setDayCtx(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  disabled={ctxSaving || !dayCtx.feriadoName.trim()}
                  onClick={() => void handleDecreeFeriado(dayCtx.dateISO, dayCtx.feriadoName)}
                  type="button"
                >
                  {ctxSaving ? "Guardando…" : "Decretar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
