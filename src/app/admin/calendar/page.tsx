"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import DayPopover, { type PopoverGCalEvent } from "@/components/calendar/DayPopover";
import GCalEventDetailModal, { type DetailGCalEvent } from "@/components/calendar/GCalEventDetailModal";
import MonthGrid, { type MoveEventPayload } from "@/components/calendar/MonthGrid";
import { formatMonthLabel, formatWeekLabel, getMonthMatrix, getWeekStart, isInRange, stripHtml } from "@/lib/calendarUtils";
import WeekGrid, { type WeekGridEvent, type WeekMovePayload, type WeekResizePayload } from "@/components/calendar/WeekGrid";
import {
  createCalendarEvent,
  createCalendarHoliday,
  deleteCalendarEvent,
  deleteCalendarHoliday,
  updateCalendarEvent,
  updateCalendarHoliday,
  subscribeApprovedAbsences,
  subscribeCalendarEvents,
  subscribeCalendarHolidays,
  type CalendarAbsenceRecord,
  type CalendarEventRecord,
  type CalendarHolidayKind,
  type CalendarHolidayRecord,
} from "@/services/calendar";
import {
  gcalGetConfig,
  gcalSaveConfig,
  gcalListEvents,
  gcalCreateEvent,
  gcalUpdateEvent,
  gcalDeleteEvent,
  type GCalConfig,
  type PortalGCalEvent,
} from "@/services/googleCalendar";
import { subscribeMeetings, deleteMeeting, type HubReunion } from "@/services/meetings";

type StatusState = { type: "success" | "error"; message: string } | null;

const PERU_HOLIDAYS_REMAINING_2026: Array<{ date: string; name: string; kind: CalendarHolidayKind }> = [
  { date: "2026-12-08", name: "Inmaculada Concepción", kind: "HOLIDAY" },
  { date: "2026-12-09", name: "Batalla de Ayacucho", kind: "HOLIDAY" },
  { date: "2026-12-25", name: "Navidad del Señor", kind: "HOLIDAY" },
];

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

const legendItems = [
  { label: "Feriado", color: "bg-violet-400" },
  { label: "Día libre global", color: "bg-pink-400" },
  { label: "Evento interno", color: "bg-sky-400" },
  { label: "Google Calendar", color: "bg-cyan-400" },
  { label: "Ausencia aprobada", color: "bg-amber-400" },
  { label: "Grabaciones KIMCE", color: "bg-purple-400" },
];

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [absences, setAbsences] = useState<CalendarAbsenceRecord[]>([]);
  const [meetings, setMeetings] = useState<HubReunion[]>([]);

  // Holiday form state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayKind, setHolidayKind] = useState<CalendarHolidayKind>("HOLIDAY");
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Event form state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  const [status, setStatus] = useState<StatusState>(null);
  const [importingHolidays, setImportingHolidays] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePortalItem, setConfirmDeletePortalItem] = useState<{
    id: string;
    kind: "holiday" | "event";
    title: string;
  } | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  // Google Calendar
  const [gcalConfig, setGcalConfig] = useState<GCalConfig>({ configured: false, calendarId: null, calendarName: null });
  const [gcalEvents, setGcalEvents] = useState<PortalGCalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [gcalCalendarIdInput, setGcalCalendarIdInput] = useState("");
  const [gcalSaving, setGcalSaving] = useState(false);
  const [gcalShowSetup, setGcalShowSetup] = useState(false);
  const [gcalListOpen, setGcalListOpen] = useState(false);
  const [gcalFormOpen, setGcalFormOpen] = useState(false);
  const [gcalEditingId, setGcalEditingId] = useState<string | null>(null);
  const [gcalFormSaving, setGcalFormSaving] = useState(false);
  const [gcalForm, setGcalForm] = useState({
    title: "", description: "", location: "", startDate: "", endDate: "",
    isAllDay: true, startTime: "", endTime: "", attendees: [] as string[],
  });
  const [attendeeInput, setAttendeeInput] = useState("");
  const [gcalDeletingId, setGcalDeletingId] = useState<string | null>(null);
  const [gcalConfirmDeleteId, setGcalConfirmDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // GCal event detail modal
  const [gcalDetailEvent, setGcalDetailEvent] = useState<DetailGCalEvent | null>(null);

  // Meeting delete confirmation
  const [meetingConfirmDeleteId, setMeetingConfirmDeleteId] = useState<string | null>(null);
  const [meetingDeletingId, setMeetingDeletingId] = useState<string | null>(null);
  const gcalLoadedRef = useRef(false);
  const gcalSectionRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss status toast
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const loadGcalEvents = useCallback(async (month?: Date) => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      const base = month ?? new Date();
      const timeMin = new Date(base.getFullYear(), base.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(base.getFullYear(), base.getMonth() + 3, 0, 23, 59, 59).toISOString();
      const evs = await gcalListEvents({ timeMin, timeMax });
      setGcalEvents(evs);
    } catch (err) {
      setGcalError((err as { message?: string })?.message ?? "Error al cargar eventos de Google Calendar.");
    } finally {
      setGcalLoading(false);
    }
  }, []);

  useEffect(() => {
    gcalGetConfig()
      .then((cfg) => {
        setGcalConfig(cfg);
        if (cfg.configured && !gcalLoadedRef.current) {
          gcalLoadedRef.current = true;
          void loadGcalEvents(currentDate);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGcalEvents]);

  const prevMonthRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gcalConfig.configured || viewMode !== "month") return;
    const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (prevMonthRef.current === key) return;
    prevMonthRef.current = key;
    void loadGcalEvents(currentDate);
  }, [currentDate, viewMode, gcalConfig.configured, loadGcalEvents]);

  const prevWeekMonthRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gcalConfig.configured || viewMode !== "week") return;
    const key = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;
    if (prevWeekMonthRef.current === key) return;
    prevWeekMonthRef.current = key;
    void loadGcalEvents(weekStart);
  }, [weekStart, viewMode, gcalConfig.configured, loadGcalEvents]);

  useEffect(() => {
    const unsubH = subscribeCalendarHolidays(setHolidays);
    const unsubE = subscribeCalendarEvents(setEvents);
    const unsubA = subscribeApprovedAbsences(setAbsences);
    const unsubM = subscribeMeetings(setMeetings);
    return () => { unsubH(); unsubE(); unsubA(); unsubM(); };
  }, []);

  async function handleGcalSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    const id = gcalCalendarIdInput.trim();
    if (!id) return;
    setGcalSaving(true);
    setGcalError(null);
    try {
      const result = await gcalSaveConfig(id);
      setGcalConfig({ configured: true, calendarId: id, calendarName: result.calendarName });
      setGcalShowSetup(false);
      setGcalCalendarIdInput("");
      setStatus({ type: "success", message: `Conectado a "${result.calendarName}" correctamente.` });
      gcalLoadedRef.current = true;
      void loadGcalEvents();
    } catch (err) {
      setGcalError((err as { message?: string })?.message ?? "No se pudo conectar al calendario.");
    } finally {
      setGcalSaving(false);
    }
  }

  function openGcalCreate(prefillDate?: string, prefillTime?: string) {
    setGcalEditingId(null);
    const startT = prefillTime ?? "09:00";
    const [sh, sm] = startT.split(":").map(Number);
    const endMin = (sh ?? 9) * 60 + (sm ?? 0) + 60;
    const endT = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    setGcalForm({ title: "", description: "", location: "", startDate: prefillDate ?? "", endDate: prefillDate ?? "", isAllDay: false, startTime: startT, endTime: endT, attendees: [] });
    setAttendeeInput("");
    setGcalFormOpen(true);
  }

  function openGcalEdit(event: PortalGCalEvent) {
    setGcalEditingId(event.id);
    setGcalForm({
      title: event.title,
      description: event.description,
      location: event.location ?? "",
      startDate: event.date,
      endDate: event.endDate,
      isAllDay: event.isAllDay,
      startTime: event.startTime || "09:00",
      endTime: event.endTime || "10:00",
      attendees: event.attendees?.map((a) => a.email) ?? [],
    });
    setAttendeeInput("");
    setGcalFormOpen(true);
  }

  async function handleGcalFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gcalForm.title.trim() || !gcalForm.startDate) return;
    setGcalFormSaving(true);
    setGcalError(null);
    try {
      const attendees = gcalForm.attendees.length > 0
        ? gcalForm.attendees.map((email) => ({ email }))
        : undefined;
      const location = gcalForm.location.trim() || undefined;
      const input = gcalForm.isAllDay
        ? { summary: gcalForm.title.trim(), description: gcalForm.description, location, startDate: gcalForm.startDate, endDate: gcalForm.endDate || gcalForm.startDate, attendees }
        : { summary: gcalForm.title.trim(), description: gcalForm.description, location, startDateTime: `${gcalForm.startDate}T${gcalForm.startTime}:00`, endDateTime: `${gcalForm.endDate || gcalForm.startDate}T${gcalForm.endTime}:00`, timeZone: "America/Lima", attendees };
      if (gcalEditingId) {
        const updated = await gcalUpdateEvent(gcalEditingId, input);
        setGcalEvents((prev) => prev.map((ev) => ev.id === gcalEditingId ? updated : ev));
        setStatus({ type: "success", message: "Evento actualizado en Google Calendar." });
      } else {
        const created = await gcalCreateEvent(input);
        setGcalEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
        setStatus({ type: "success", message: "Evento creado en Google Calendar." });
      }
      setGcalFormOpen(false);
    } catch (err) {
      setGcalError((err as { message?: string })?.message ?? "No se pudo guardar el evento.");
    } finally {
      setGcalFormSaving(false);
    }
  }

  async function handleGcalDelete(eventId: string) {
    setGcalConfirmDeleteId(null);
    setGcalDeletingId(eventId);
    setGcalError(null);
    try {
      await gcalDeleteEvent(eventId);
      setGcalEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      setStatus({ type: "success", message: "Evento eliminado de Google Calendar." });
    } catch (err) {
      setGcalError((err as { message?: string })?.message ?? "No se pudo eliminar el evento.");
    } finally {
      setGcalDeletingId(null);
    }
  }

  async function handleMeetingDelete(meetingId: string) {
    setMeetingConfirmDeleteId(null);
    setMeetingDeletingId(meetingId);
    try {
      await deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      setStatus({ type: "success", message: "Grabación eliminada correctamente." });
    } catch {
      setStatus({ type: "error", message: "No se pudo eliminar la grabación." });
    } finally {
      setMeetingDeletingId(null);
    }
  }

  async function handleCreateHoliday(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      setStatus({ type: "error", message: "Completa la fecha y el nombre del feriado o día libre." });
      return;
    }
    setSavingHoliday(true);
    setStatus(null);
    try {
      await createCalendarHoliday({ date: holidayDate, name: holidayName.trim(), kind: holidayKind });
      setHolidayDate(""); setHolidayName(""); setHolidayKind("HOLIDAY");
      setHolidayModalOpen(false);
      setStatus({ type: "success", message: "Registro global creado correctamente." });
    } catch {
      setStatus({ type: "error", message: "No se pudo guardar el registro global." });
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventDate || !eventTitle.trim()) {
      setStatus({ type: "error", message: "Completa la fecha y el título del evento interno." });
      return;
    }
    setSavingEvent(true);
    setStatus(null);
    try {
      await createCalendarEvent({ date: eventDate, title: eventTitle.trim(), description: eventDescription.trim() });
      setEventDate(""); setEventTitle(""); setEventDescription("");
      setEventModalOpen(false);
      setStatus({ type: "success", message: "Evento interno creado correctamente." });
    } catch {
      setStatus({ type: "error", message: "No se pudo guardar el evento interno." });
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeletePortalItem(id: string, kind: "holiday" | "event") {
    setConfirmDeletePortalItem(null);
    setDeletingId(id);
    setStatus(null);
    try {
      if (kind === "holiday") await deleteCalendarHoliday(id);
      else await deleteCalendarEvent(id);
      setStatus({ type: "success", message: "Registro eliminado correctamente." });
    } catch {
      setStatus({ type: "error", message: "No se pudo eliminar el registro seleccionado." });
    } finally {
      setDeletingId(null);
    }
  }

  function shiftDate(iso: string, days: number): string {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function dateDiffInDays(fromISO: string, toISO: string): number {
    const from = new Date(`${fromISO}T12:00:00`);
    const to = new Date(`${toISO}T12:00:00`);
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  async function handleMoveEvent({ type, id, fromISO, toISO }: MoveEventPayload) {
    if (fromISO === toISO) return;
    const delta = dateDiffInDays(fromISO, toISO);

    if (type === "gcal") {
      const ev = gcalEvents.find((e) => e.id === id);
      if (!ev) return;
      const newStart = shiftDate(ev.date, delta);
      const newEnd = shiftDate(ev.endDate, delta);
      setGcalEvents((prev) => prev.map((e) => e.id === id ? { ...e, date: newStart, endDate: newEnd } : e));
      try {
        const attendees = ev.attendees?.map((a) => ({ email: a.email }));
        const loc = ev.location || undefined;
        const desc = ev.description || undefined;
        if (ev.isAllDay) {
          await gcalUpdateEvent(id, { summary: ev.title, description: desc, location: loc, startDate: newStart, endDate: newEnd, attendees });
        } else {
          const st = ev.startTime || "00:00";
          const et = ev.endTime || "01:00";
          await gcalUpdateEvent(id, {
            summary: ev.title, description: desc, location: loc,
            startDateTime: `${newStart}T${st}:00`,
            endDateTime: `${newEnd}T${et}:00`,
            timeZone: "America/Lima",
            attendees,
          });
        }
      } catch (err) {
        setGcalEvents((prev) => prev.map((e) => e.id === id ? ev : e));
        const msg = err instanceof Error ? err.message : "No se pudo mover el evento en Google Calendar.";
        setStatus({ type: "error", message: msg });
      }
    } else if (type === "event") {
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, date: toISO } : e));
      try {
        await updateCalendarEvent(id, { date: toISO });
      } catch {
        setEvents((prev) => prev.map((e) => e.id === id ? ev : e));
        setStatus({ type: "error", message: "No se pudo mover el evento interno." });
      }
    } else if (type === "holiday" || type === "dayoff") {
      const h = holidays.find((x) => x.id === id);
      if (!h) return;
      setHolidays((prev) => prev.map((x) => x.id === id ? { ...x, date: toISO } : x));
      try {
        await updateCalendarHoliday(id, { date: toISO });
      } catch {
        setHolidays((prev) => prev.map((x) => x.id === id ? h : x));
        setStatus({ type: "error", message: "No se pudo mover el registro." });
      }
    }
  }

  async function importRemainingHolidays() {
    setImportingHolidays(true);
    try {
      const existing = new Set(holidays.map((h) => h.date));
      const toImport = PERU_HOLIDAYS_REMAINING_2026.filter((h) => !existing.has(h.date));
      if (toImport.length === 0) {
        setStatus({ type: "success", message: "Todos los feriados ya estaban registrados." });
        return;
      }
      await Promise.all(toImport.map((h) => createCalendarHoliday(h)));
      setStatus({ type: "success", message: `${toImport.length} feriado(s) importados correctamente.` });
    } catch {
      setStatus({ type: "error", message: "No se pudieron importar algunos feriados." });
    } finally {
      setImportingHolidays(false);
    }
  }

  const monthLabel = viewMode === "week" ? formatWeekLabel(weekStart) : formatMonthLabel(currentDate);
  const monthMatrix = useMemo(
    () => getMonthMatrix(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );

  function navPrev() {
    if (viewMode === "week") {
      const prev = new Date(weekStart);
      prev.setDate(prev.getDate() - 7);
      setWeekStart(prev);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  }

  function navNext() {
    if (viewMode === "week") {
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  }

  function navToday() {
    if (viewMode === "week") {
      setWeekStart(getWeekStart(new Date()));
    } else {
      const now = new Date();
      setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }

  // Build unified WeekGrid events array
  const weekGridEvents = useMemo<WeekGridEvent[]>(() => {
    const all: WeekGridEvent[] = [];
    holidays.forEach((h) => all.push({ id: h.id, date: h.date, title: h.name, type: h.kind === "DAY_OFF" ? "dayoff" : "holiday", isAllDay: true }));
    events.forEach((ev) => all.push({ id: ev.id, date: ev.date, title: ev.title, type: "event", isAllDay: true }));
    absences.forEach((a) => all.push({ id: a.id, date: a.dateStart, endDate: a.dateEnd, title: a.type === "VACATION" ? "Vacaciones" : "Permiso", type: "absence", isAllDay: true }));
    gcalEvents.forEach((ev) => all.push({ id: ev.id ?? "", date: ev.date, endDate: ev.endDate, title: ev.title, startTime: ev.isAllDay ? undefined : ev.startTime, endTime: ev.isAllDay ? undefined : ev.endTime, isAllDay: ev.isAllDay, type: "gcal", organizer: ev.organizer }));
    meetings.filter((m) => !m.gcalEventId || !gcalEvents.some((ev) => ev.id === m.gcalEventId)).forEach((m) => all.push({ id: m.id, date: m.date, title: m.title, startTime: m.time || undefined, type: "meeting", isAllDay: !m.time }));
    return all;
  }, [holidays, events, absences, gcalEvents, meetings]);

  async function handleWeekMoveEvent({ id, type, fromISO, toISO, newStartTime, newEndTime }: WeekMovePayload) {
    if (type === "gcal") {
      const ev = gcalEvents.find((e) => e.id === id);
      if (!ev) return;
      const st = newStartTime ?? ev.startTime ?? "00:00";
      const et = newEndTime ?? ev.endTime ?? "01:00";
      setGcalEvents((prev) => prev.map((e) => e.id === id ? { ...e, date: toISO, endDate: toISO, startTime: st, endTime: et } : e));
      try {
        const attendees = ev.attendees?.map((a) => ({ email: a.email }));
        const updInput = ev.isAllDay
          ? { summary: ev.title, description: ev.description || undefined, location: ev.location || undefined, startDate: toISO, endDate: toISO, attendees }
          : { summary: ev.title, description: ev.description || undefined, location: ev.location || undefined, startDateTime: `${toISO}T${st}:00`, endDateTime: `${toISO}T${et}:00`, timeZone: "America/Lima", attendees };
        await gcalUpdateEvent(id, updInput);
      } catch (err) {
        setGcalEvents((prev) => prev.map((e) => e.id === id ? ev : e));
        const msg = err instanceof Error ? err.message : "No se pudo mover el evento.";
        setStatus({ type: "error", message: msg });
      }
    } else if (type === "event") {
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, date: toISO } : e));
      try { await updateCalendarEvent(id, { date: toISO }); }
      catch { setEvents((prev) => prev.map((e) => e.id === id ? ev : e)); setStatus({ type: "error", message: "No se pudo mover el evento." }); }
    }
  }

  function handleWeekSelectEvent(ev: WeekGridEvent, rect: DOMRect) {
    if (ev.type === "gcal") {
      const gcalEv = gcalEvents.find((e) => e.id === ev.id);
      if (gcalEv) setGcalDetailEvent({ ...gcalEv, source: "kimce" });
    } else {
      setSelectedDate(new Date(`${ev.date}T12:00:00`));
      setPopoverAnchor(rect);
    }
  }

  async function handleWeekResizeEvent({ id, type, date, newEndTime }: WeekResizePayload) {
    if (type !== "gcal") return;
    const ev = gcalEvents.find((e) => e.id === id);
    if (!ev) return;
    setGcalEvents((prev) => prev.map((e) => e.id === id ? { ...e, endTime: newEndTime } : e));
    try {
      const attendees = ev.attendees?.map((a) => ({ email: a.email }));
      await gcalUpdateEvent(id, {
        summary: ev.title,
        description: ev.description || undefined,
        location: ev.location || undefined,
        startDateTime: `${date}T${ev.startTime || "00:00"}:00`,
        endDateTime: `${date}T${newEndTime}:00`,
        timeZone: "America/Lima",
        attendees,
      });
    } catch {
      setGcalEvents((prev) => prev.map((e) => e.id === id ? ev : e));
      setStatus({ type: "error", message: "No se pudo redimensionar el evento." });
    }
  }

  const selectedISO = selectedDate ? selectedDate.toISOString().slice(0, 10) : null;
  const selectedHolidays = selectedISO ? holidays.filter((h) => h.date === selectedISO) : [];
  const selectedEvents = selectedISO ? events.filter((e) => e.date === selectedISO) : [];
  const selectedAbsences = selectedDate
    ? absences.filter((a) => isInRange(selectedDate, a.dateStart, a.dateEnd))
    : [];
  const selectedGcalEvents = selectedDate
    ? gcalEvents.filter((ev) => isInRange(selectedDate, ev.date, ev.endDate))
    : [];
  const selectedMeetings = selectedISO ? meetings.filter((m) => m.date === selectedISO) : [];

  const upcomingSidebarEvents = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return gcalEvents
      .filter((e) => e.endDate >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [gcalEvents]);

  const upcomingTeamAbsences = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return absences
      .filter((a) => a.dateEnd >= todayISO)
      .sort((a, b) => a.dateStart.localeCompare(b.dateStart))
      .slice(0, 4);
  }, [absences]);

  const totalUpcomingGcal = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return gcalEvents.filter((e) => e.endDate >= todayISO).length;
  }, [gcalEvents]);

  return (
    <div className="flex flex-col gap-5 min-h-full">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <CalendarHeader
        label={monthLabel}
        onPrev={navPrev}
        onNext={navNext}
        onToday={navToday}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          if (mode === "week") setWeekStart(getWeekStart(currentDate));
          else setCurrentDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
          setViewMode(mode);
        }}
        actions={
          gcalConfig.configured ? (
            <button
              type="button"
              onClick={() => openGcalCreate()}
              className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors"
            >
              + Nuevo evento GCal
            </button>
          ) : undefined
        }
      />

      {status && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
            status.type === "success"
              ? "bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/60 text-emerald-700"
              : "bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      )}

      {/* ── Main 2-col grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

        {/* ── Left: calendar grid ── */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-[0_4px_24px_rgba(17,24,39,0.06)] p-6">
          <CalendarFilters activeFilters={activeFilters} onChange={setActiveFilters} showMeeting={true} />
          {viewMode === "month" ? (
            <MonthGrid
              weeks={monthMatrix}
              month={currentDate.getMonth()}
              holidays={holidays}
              events={events}
              absences={absences}
              gcalEvents={gcalEvents}
              meetingEvents={meetings
                .filter((m) => !m.gcalEventId || !gcalEvents.some((ev) => ev.id === m.gcalEventId))
                .map((m) => ({ id: m.id, date: m.date, title: m.title }))}
              activeFilters={activeFilters}
              userEmail={user?.email ?? undefined}
              onSelectDate={(date, rect) => {
                setSelectedDate(date);
                setPopoverAnchor(rect ?? null);
              }}
              onMoveEvent={handleMoveEvent}
            />
          ) : (
            <WeekGrid
              weekStart={weekStart}
              events={weekGridEvents}
              activeFilters={activeFilters}
              userEmail={user?.email ?? undefined}
              onSelectSlot={(date, startTime) => { if (gcalConfig.configured) openGcalCreate(date.toISOString().slice(0, 10), startTime); }}
              onSelectEvent={handleWeekSelectEvent}
              onMoveEvent={handleWeekMoveEvent}
              onResizeEvent={handleWeekResizeEvent}
            />
          )}
          {/* Legend pills */}
          <div className="mt-5 pt-4 border-t border-slate-100/80 flex flex-wrap gap-2">
            {legendItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 rounded-full bg-slate-50/80 border border-slate-100 px-2.5 py-1"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${item.color}`} aria-hidden="true" />
                <span className="text-[11px] text-slate-500 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Próximas reuniones */}
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-[0_4px_24px_rgba(17,24,39,0.06)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Próximas reuniones</h2>
                {totalUpcomingGcal > 0 && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    {totalUpcomingGcal}
                  </span>
                )}
              </div>
              {totalUpcomingGcal > 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setGcalListOpen(true);
                    setTimeout(() => gcalSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700"
                >
                  Ver todos ({totalUpcomingGcal})
                </button>
              )}
            </div>

            {!gcalConfig.configured ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Conecta Google Calendar para ver tus próximas reuniones.
              </p>
            ) : gcalLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-xl bg-slate-100/60 animate-pulse" />
                ))}
              </div>
            ) : upcomingSidebarEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No hay reuniones próximas.</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingSidebarEvents.map((ev) => {
                  const clean = ev.description ? stripHtml(ev.description) : "";
                  return (
                    <div
                      key={ev.id}
                      className="group relative flex items-center gap-2.5 rounded-xl bg-white/60 hover:bg-white/90 border border-slate-100/80 px-3 py-2.5 transition-all"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#0ea5e9]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{ev.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {fmtDate(ev.date)}
                          {!ev.isAllDay && ev.startTime ? ` · ${ev.startTime}` : ""}
                        </p>
                        {clean && (
                          <p className="truncate text-[11px] text-slate-400">{clean}</p>
                        )}
                      </div>
                      {/* Hover actions */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          aria-label="Acciones"
                          onClick={() => setOpenMenuId(openMenuId === ev.id ? null : ev.id)}
                          className="rounded-lg p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenuId === ev.id && (
                          <div className="absolute right-0 top-7 z-20 w-28 rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); openGcalEdit(ev); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); setGcalConfirmDeleteId(ev.id); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={12} /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ausencias del equipo */}
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-[0_4px_24px_rgba(17,24,39,0.06)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Ausencias del equipo</h2>
            {upcomingTeamAbsences.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sin ausencias próximas.</p>
            ) : (
              <div className="space-y-2">
                {upcomingTeamAbsences.map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center gap-2.5 rounded-xl bg-white/60 hover:bg-white/90 border border-slate-100/80 px-3 py-2 transition-all"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {initials(absence.personName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{absence.personName}</p>
                      <p className="text-[11px] text-slate-400">
                        {absence.dateStart === absence.dateEnd
                          ? fmtDate(absence.dateStart)
                          : `${fmtDate(absence.dateStart)} – ${fmtDate(absence.dateEnd)}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        absence.type === "VACATION"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {absence.type === "VACATION" ? "Vacaciones" : "Permiso"}
                    </span>
                  </div>
                ))}
                {absences.filter((a) => a.dateEnd >= new Date().toISOString().slice(0, 10)).length > 4 && (
                  <p className="text-center text-[11px] text-slate-400">
                    y {absences.filter((a) => a.dateEnd >= new Date().toISOString().slice(0, 10)).length - 4} más
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-[0_4px_24px_rgba(17,24,39,0.06)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Acciones rápidas</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHolidayModalOpen(true)}
                className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-100/80 transition-colors"
              >
                + Feriado / Día libre
              </button>
              <button
                type="button"
                onClick={() => setEventModalOpen(true)}
                className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-100/80 transition-colors"
              >
                + Evento interno
              </button>
              <button
                type="button"
                disabled={importingHolidays}
                onClick={() => void importRemainingHolidays()}
                className="col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100/80 transition-colors disabled:opacity-50"
              >
                {importingHolidays ? "Importando…" : "Importar feriados Perú dic 2026"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Google Calendar — collapsible management ───────────────────────────── */}
      <div ref={gcalSectionRef} className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-[0_4px_24px_rgba(17,24,39,0.06)] overflow-hidden">
        {/* Header (always visible) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Calendar size={16} className="shrink-0 text-sky-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Google Calendar KIMCE</h2>
                {gcalConfig.configured ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Conectado
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Sin configurar
                  </span>
                )}
              </div>
              {gcalConfig.calendarName && (
                <p className="text-xs text-slate-400">{gcalConfig.calendarName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gcalConfig.configured && (
              <button
                type="button"
                disabled={gcalLoading}
                onClick={() => void loadGcalEvents()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={12} className={gcalLoading ? "animate-spin" : ""} />
                Actualizar
              </button>
            )}
            <button
              type="button"
              onClick={() => { setGcalShowSetup((v) => !v); setGcalCalendarIdInput(gcalConfig.calendarId ?? ""); if (!gcalListOpen) setGcalListOpen(true); }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Settings2 size={12} />
              {gcalConfig.configured ? "Reconfigurar" : "Configurar"}
            </button>
            <button
              type="button"
              aria-label={gcalListOpen ? "Colapsar" : "Expandir"}
              onClick={() => setGcalListOpen((v) => !v)}
              className="rounded-xl border border-slate-200/80 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              {gcalListOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* Expandable content */}
        {gcalListOpen && (
          <div className="border-t border-slate-100/80 px-5 pb-5 pt-4 space-y-3">
            {/* Setup panel */}
            {gcalShowSetup && (
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-4 space-y-4">
                <p className="text-sm font-semibold text-sky-800">Configuración inicial (una sola vez)</p>
                <ol className="space-y-1 text-xs text-sky-700 list-decimal list-inside">
                  <li>
                    En{" "}
                    <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      Google Cloud Console
                    </a>{" "}
                    habilita la API de Google Calendar para el proyecto Firebase.
                  </li>
                  <li>Copia el email de la cuenta de servicio desde <strong>Firebase Console → Configuración → Cuentas de servicio</strong>.</li>
                  <li>
                    En{" "}
                    <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      Google Calendar → Configuración
                    </a>
                    , comparte el calendario con ese email (permiso: Realizar cambios en eventos).
                  </li>
                  <li>Copia el <strong>ID del calendario</strong> (en "Integrar calendario") y pégalo abajo.</li>
                </ol>
                <form onSubmit={(e) => void handleGcalSaveConfig(e)} className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-sky-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
                    placeholder="kimcestudio@gmail.com  o  abc123...@group.calendar.google.com"
                    value={gcalCalendarIdInput}
                    onChange={(e) => setGcalCalendarIdInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={gcalSaving || !gcalCalendarIdInput.trim()}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {gcalSaving ? "Verificando…" : "Guardar"}
                  </button>
                </form>
                {gcalError && <p className="text-xs font-medium text-rose-600">{gcalError}</p>}
              </div>
            )}

            {gcalError && !gcalShowSetup && (
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
                {gcalError}
              </div>
            )}

            {gcalConfig.configured && (
              <>
                {gcalLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-center text-sm text-slate-400">
                    Cargando eventos…
                  </div>
                ) : gcalEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-center text-sm text-slate-400">
                    No hay eventos próximos en Google Calendar.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...gcalEvents].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20).map((event) => {
                      const cleanDesc = event.description ? stripHtml(event.description) : "";
                      return (
                        <div
                          key={event.id}
                          className="group flex items-start gap-3 rounded-xl bg-white/60 hover:bg-white/90 border border-slate-100/80 px-3 py-2.5 transition-all"
                        >
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0ea5e9]" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">{event.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {fmtDate(event.date)}
                              {event.endDate !== event.date ? ` → ${fmtDate(event.endDate)}` : ""}
                              {!event.isAllDay && event.startTime
                                ? ` · ${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
                                : " · Todo el día"}
                            </p>
                            {event.location && (
                              <p className="flex items-center gap-0.5 truncate text-[11px] text-slate-400">
                                <MapPin size={9} className="shrink-0" />
                                {event.location}
                              </p>
                            )}
                            {cleanDesc && !event.location && (
                              <p className="truncate text-[11px] text-slate-400">{cleanDesc}</p>
                            )}
                            {(event.hangoutLink || event.htmlLink) && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {event.hangoutLink && (
                                  <a
                                    href={event.hangoutLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    <Video size={9} />
                                    Unirse a Meet
                                  </a>
                                )}
                                {event.htmlLink && (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                                  >
                                    <ExternalLink size={9} />
                                    Ver en Calendar
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Hover action icons */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              aria-label="Editar evento"
                              onClick={() => openGcalEdit(event)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label="Eliminar evento"
                              disabled={gcalDeletingId === event.id}
                              onClick={() => setGcalConfirmDeleteId(event.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            >
                              {gcalDeletingId === event.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Feriado / Día libre ───────────────────────────────────────── */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Feriado o día libre global</h3>
              <button
                type="button"
                onClick={() => setHolidayModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateHoliday} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                Tipo
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                  value={holidayKind}
                  onChange={(e) => setHolidayKind(e.target.value as CalendarHolidayKind)}
                >
                  <option value="HOLIDAY">Feriado</option>
                  <option value="DAY_OFF">Día libre global</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Fecha
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Nombre
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                  placeholder="Ej. Fiestas Patrias"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {savingHoliday ? "Guardando…" : "Crear registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Evento interno ────────────────────────────────────────────── */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Evento interno</h3>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                Fecha
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Título
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                  placeholder="Ej. Cierre de plan anual"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Descripción
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                  placeholder="Opcional"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {savingEvent ? "Guardando…" : "Crear evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Crear / Editar evento GCal ───────────────────────────────── */}
      {gcalFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100/80 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {gcalEditingId ? "Editar evento en Google Calendar" : "Nuevo evento en Google Calendar"}
              </h3>
              <button
                type="button"
                onClick={() => setGcalFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(e) => void handleGcalFormSubmit(e)} className="space-y-4 p-5">
              {gcalError && (
                <p className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2 text-xs text-rose-700">
                  {gcalError}
                </p>
              )}
              <label className="block text-xs font-semibold text-slate-500">
                Título *
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                  value={gcalForm.title}
                  onChange={(e) => setGcalForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Descripción
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                  value={gcalForm.description}
                  onChange={(e) => setGcalForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Ubicación
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                  placeholder="Sala de reuniones, Lima…"
                  value={gcalForm.location}
                  onChange={(e) => setGcalForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={gcalForm.isAllDay}
                  onChange={(e) => setGcalForm((f) => ({ ...f, isAllDay: e.target.checked }))}
                />
                Todo el día
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-500">
                  Fecha inicio *
                  <input
                    required
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                    value={gcalForm.startDate}
                    onChange={(e) => setGcalForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Fecha fin
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                    value={gcalForm.endDate}
                    onChange={(e) => setGcalForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </label>
              </div>
              {!gcalForm.isAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-slate-500">
                    Hora inicio
                    <input
                      type="time"
                      className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                      value={gcalForm.startTime}
                      onChange={(e) => setGcalForm((f) => ({ ...f, startTime: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    Hora fin
                    <input
                      type="time"
                      className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                      value={gcalForm.endTime}
                      onChange={(e) => setGcalForm((f) => ({ ...f, endTime: e.target.value }))}
                    />
                  </label>
                </div>
              )}
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <UserPlus size={12} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500">Invitar personas</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                    value={attendeeInput}
                    onChange={(e) => setAttendeeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const email = attendeeInput.trim().toLowerCase();
                        if (email && !gcalForm.attendees.includes(email)) {
                          setGcalForm((f) => ({ ...f, attendees: [...f.attendees, email] }));
                          setAttendeeInput("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const email = attendeeInput.trim().toLowerCase();
                      if (email && !gcalForm.attendees.includes(email)) {
                        setGcalForm((f) => ({ ...f, attendees: [...f.attendees, email] }));
                        setAttendeeInput("");
                      }
                    }}
                    className="rounded-xl border border-slate-200/80 px-3 py-2 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {gcalForm.attendees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {gcalForm.attendees.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-50 pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-sky-700"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setGcalForm((f) => ({ ...f, attendees: f.attendees.filter((a) => a !== email) }))}
                          className="rounded-full p-0.5 hover:bg-sky-200 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={gcalFormSaving}
                className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {gcalFormSaving ? "Guardando…" : gcalEditingId ? "Guardar cambios" : "Crear evento"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm: eliminar evento GCal ────────────────────────────────────── */}
      {gcalConfirmDeleteId && (() => {
        const ev = gcalEvents.find((e) => e.id === gcalConfirmDeleteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-900">Eliminar evento</h3>
              <p className="mt-2 text-sm text-slate-500">
                ¿Eliminar <strong className="text-slate-700">{ev?.title ?? "este evento"}</strong> de Google Calendar? No se puede deshacer.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGcalConfirmDeleteId(null)}
                  className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleGcalDelete(gcalConfirmDeleteId)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Confirm: eliminar registro del portal ────────────────────────────── */}
      {confirmDeletePortalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-900">Eliminar registro</h3>
            <p className="mt-2 text-sm text-slate-500">
              ¿Eliminar <strong className="text-slate-700">{confirmDeletePortalItem.title}</strong>? No se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeletePortalItem(null)}
                className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeletePortalItem.id}
                onClick={() => void handleDeletePortalItem(confirmDeletePortalItem.id, confirmDeletePortalItem.kind)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingId === confirmDeletePortalItem.id ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm: eliminar grabación ─────────────────────────────────────── */}
      {meetingConfirmDeleteId && (() => {
        const m = meetings.find((x) => x.id === meetingConfirmDeleteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-900">Eliminar grabación</h3>
              <p className="mt-2 text-sm text-slate-500">
                ¿Eliminar <strong className="text-slate-700">{m?.title ?? "esta grabación"}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMeetingConfirmDeleteId(null)}
                  className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={meetingDeletingId === meetingConfirmDeleteId}
                  onClick={() => void handleMeetingDelete(meetingConfirmDeleteId)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {meetingDeletingId === meetingConfirmDeleteId ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Day popover ──────────────────────────────────────────────────────── */}
      <DayPopover
        open={Boolean(selectedDate)}
        anchor={popoverAnchor}
        dateLabel={
          selectedDate
            ? selectedDate.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : ""
        }
        holidays={selectedHolidays}
        events={selectedEvents}
        absences={selectedAbsences}
        gcalEvents={selectedGcalEvents.map((ev) => ({ ...ev, source: "kimce" as const }))}
        meetingEvents={selectedMeetings.map((m) => ({
          id: m.id,
          title: m.title,
          time: m.time || undefined,
          platformLabel: { google_meet: "Meet", discord: "Discord", zoom: "Zoom", manual: "Manual" }[m.platform] ?? m.platform,
          participantCount: m.participants?.length,
          linkTo: `/admin/contenidos/reuniones/${m.id}`,
        }))}
        onClose={() => { setSelectedDate(null); setPopoverAnchor(null); }}
        onViewGcalEvent={(ev) => setGcalDetailEvent({ ...ev, source: ev.source ?? "kimce" })}
        onEditGcalEvent={(id) => { const ev = gcalEvents.find((e) => e.id === id); if (ev) openGcalEdit(ev); }}
        onDeleteGcalEvent={(id) => setGcalConfirmDeleteId(id)}
        onDeleteHoliday={(id) => { const h = holidays.find((x) => x.id === id); if (h) setConfirmDeletePortalItem({ id, kind: "holiday", title: h.name }); }}
        onDeleteEvent={(id) => { const ev = events.find((x) => x.id === id); if (ev) setConfirmDeletePortalItem({ id, kind: "event", title: ev.title }); }}
        onDeleteMeeting={(id) => setMeetingConfirmDeleteId(id)}
        onCreateGcalEvent={gcalConfig.configured ? () => { if (selectedISO) openGcalCreate(selectedISO); } : undefined}
      />

      <GCalEventDetailModal
        open={Boolean(gcalDetailEvent)}
        event={gcalDetailEvent}
        onClose={() => setGcalDetailEvent(null)}
        onEdit={(id) => { setGcalDetailEvent(null); const ev = gcalEvents.find((e) => e.id === id); if (ev) openGcalEdit(ev); }}
        onDelete={(id) => { setGcalDetailEvent(null); setGcalConfirmDeleteId(id); }}
      />
    </div>
  );
}
