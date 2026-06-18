"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import DayDetailsModal from "@/components/calendar/DayDetailsModal";
import MonthGrid from "@/components/calendar/MonthGrid";
import { formatMonthLabel, getMonthMatrix, isInRange } from "@/lib/calendarUtils";
import {
  createCalendarEvent,
  createCalendarHoliday,
  deleteCalendarEvent,
  deleteCalendarHoliday,
  subscribeApprovedAbsences,
  subscribeCalendarEvents,
  subscribeCalendarHolidays,
  type CalendarAbsenceRecord,
  type CalendarEventRecord,
  type CalendarHolidayKind,
  type CalendarHolidayRecord,
} from "@/services/calendar";

type StatusState = {
  type: "success" | "error";
  message: string;
} | null;

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [absences, setAbsences] = useState<CalendarAbsenceRecord[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayKind, setHolidayKind] = useState<CalendarHolidayKind>("HOLIDAY");
  const [eventDate, setEventDate] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [status, setStatus] = useState<StatusState>(null);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeHolidays = subscribeCalendarHolidays(setHolidays);
    const unsubscribeEvents = subscribeCalendarEvents(setEvents);
    const unsubscribeAbsences = subscribeApprovedAbsences(setAbsences);

    return () => {
      unsubscribeHolidays();
      unsubscribeEvents();
      unsubscribeAbsences();
    };
  }, []);

  const monthLabel = formatMonthLabel(currentDate);
  const monthMatrix = useMemo(
    () => getMonthMatrix(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );

  const selectedISO = selectedDate ? selectedDate.toISOString().slice(0, 10) : null;
  const selectedHolidays = selectedISO ? holidays.filter((holiday) => holiday.date === selectedISO) : [];
  const selectedEvents = selectedISO ? events.filter((event) => event.date === selectedISO) : [];
  const selectedAbsences = selectedDate
    ? absences.filter((absence) => isInRange(selectedDate, absence.dateStart, absence.dateEnd))
    : [];

  const upcomingGlobalItems = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);

    return [
      ...holidays
        .filter((item) => item.date >= todayISO)
        .map((item) => ({
          id: item.id,
          date: item.date,
          title: item.name,
          subtitle: item.kind === "DAY_OFF" ? "Día libre global" : "Feriado",
          kind: "holiday" as const,
          tone: item.kind === "DAY_OFF" ? "bg-pink-100 text-pink-700" : "bg-violet-100 text-violet-700",
        })),
      ...events
        .filter((item) => item.date >= todayISO)
        .map((item) => ({
          id: item.id,
          date: item.date,
          title: item.title,
          subtitle: item.description || "Evento interno",
          kind: "event" as const,
          tone: "bg-sky-100 text-sky-700",
        })),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, [events, holidays]);

  const upcomingTeamAbsences = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return absences
      .filter((absence) => absence.dateEnd >= todayISO)
      .sort((a, b) => a.dateStart.localeCompare(b.dateStart))
      .slice(0, 10);
  }, [absences]);

  async function handleCreateHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      setStatus({ type: "error", message: "Completa la fecha y el nombre del feriado o día libre." });
      return;
    }

    setSavingHoliday(true);
    setStatus(null);
    try {
      await createCalendarHoliday({
        date: holidayDate,
        name: holidayName.trim(),
        kind: holidayKind,
      });
      setHolidayDate("");
      setHolidayName("");
      setHolidayKind("HOLIDAY");
      setStatus({ type: "success", message: "Registro global creado correctamente." });
    } catch (error) {
      setStatus({ type: "error", message: "No se pudo guardar el registro global." });
      console.error("[calendar-admin] create holiday failed", error);
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventDate || !eventTitle.trim()) {
      setStatus({ type: "error", message: "Completa la fecha y el título del evento interno." });
      return;
    }

    setSavingEvent(true);
    setStatus(null);
    try {
      await createCalendarEvent({
        date: eventDate,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
      });
      setEventDate("");
      setEventTitle("");
      setEventDescription("");
      setStatus({ type: "success", message: "Evento interno creado correctamente." });
    } catch (error) {
      setStatus({ type: "error", message: "No se pudo guardar el evento interno." });
      console.error("[calendar-admin] create event failed", error);
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteItem(id: string, kind: "holiday" | "event") {
    setDeletingId(id);
    setStatus(null);
    try {
      if (kind === "holiday") {
        await deleteCalendarHoliday(id);
      } else {
        await deleteCalendarEvent(id);
      }
      setStatus({ type: "success", message: "Registro eliminado correctamente." });
    } catch (error) {
      setStatus({ type: "error", message: "No se pudo eliminar el registro seleccionado." });
      console.error("[calendar-admin] delete item failed", error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <CalendarHeader
        label={monthLabel}
        onPrev={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
        onNext={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
        onToday={() => {
          const now = new Date();
          setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
        }}
      />

      {status ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            status.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <MonthGrid
              weeks={monthMatrix}
              month={currentDate.getMonth()}
              holidays={holidays}
              events={events}
              absences={absences}
              onSelectDate={setSelectedDate}
            />
          </div>

          <CalendarLegend />
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <form
              className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]"
              onSubmit={handleCreateHoliday}
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-900">Feriados y días libres</h2>
                <p className="text-sm text-slate-500">Crea cierres globales visibles para todo el equipo.</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Tipo
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                    value={holidayKind}
                    onChange={(e) => setHolidayKind(e.target.value as CalendarHolidayKind)}
                  >
                    <option value="HOLIDAY">Feriado</option>
                    <option value="DAY_OFF">Día libre global</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Fecha
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Nombre
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                    placeholder="Ej. Fiestas Patrias"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                  />
                </label>
              </div>

              <button
                className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingHoliday}
                type="submit"
              >
                {savingHoliday ? "Guardando..." : "Crear registro global"}
              </button>
            </form>

            <form
              className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]"
              onSubmit={handleCreateEvent}
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-900">Evento interno</h2>
                <p className="text-sm text-slate-500">Publica hitos del portal que deban reflejarse en calendario.</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Fecha
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Título
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                    placeholder="Ej. Cierre de plan anual"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Descripción
                  <textarea
                    className="mt-1 min-h-[88px] w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
                    placeholder="Opcional"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                  />
                </label>
              </div>

              <button
                className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingEvent}
                type="submit"
              >
                {savingEvent ? "Guardando..." : "Crear evento"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Próximos registros globales</h2>
                <p className="text-sm text-slate-500">Gestiona lo que se mostrará a todos los colaboradores.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {upcomingGlobalItems.length} visibles
              </span>
            </div>

            <div className="space-y-3">
              {upcomingGlobalItems.length ? (
                upcomingGlobalItems.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.date}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.tone}`}>
                          {item.kind === "holiday" ? "Global" : "Evento"}
                        </span>
                        <button
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingId === item.id}
                          onClick={() => handleDeleteItem(item.id, item.kind)}
                          type="button"
                        >
                          {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/70 px-4 py-6 text-sm text-slate-500">
                  Aún no hay feriados, días libres o eventos futuros creados.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Ausencias aprobadas del equipo</h2>
              <p className="text-sm text-slate-500">
                Estas se reflejan automáticamente según las solicitudes aprobadas del portal.
              </p>
            </div>

            <div className="space-y-3">
              {upcomingTeamAbsences.length ? (
                upcomingTeamAbsences.map((absence) => (
                  <div key={absence.id} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{absence.personName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {absence.dateStart === absence.dateEnd
                            ? absence.dateStart
                            : `${absence.dateStart} al ${absence.dateEnd}`}
                        </p>
                        {absence.reason ? <p className="mt-1 text-xs text-slate-500">{absence.reason}</p> : null}
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          absence.type === "VACATION"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {absence.type === "VACATION" ? "Vacaciones" : "Permiso"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/70 px-4 py-6 text-sm text-slate-500">
                  No hay ausencias aprobadas próximas por mostrar.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DayDetailsModal
        open={Boolean(selectedDate)}
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
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
