"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import DayDetailsModal from "@/components/calendar/DayDetailsModal";
import MonthGrid from "@/components/calendar/MonthGrid";
import PersonalCalendarConnect from "@/components/calendar/PersonalCalendarConnect";
import { formatMonthLabel, getMonthMatrix, isInRange } from "@/lib/calendarUtils";
import {
  subscribeApprovedAbsences,
  subscribeCalendarEvents,
  subscribeCalendarHolidays,
  type CalendarAbsenceRecord,
  type CalendarEventRecord,
  type CalendarHolidayRecord,
} from "@/services/calendar";
import { listPersonalEvents, type PersonalGCalEvent } from "@/services/googleCalendarOAuth";

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [absences, setAbsences] = useState<CalendarAbsenceRecord[]>([]);
  const [personalEvents, setPersonalEvents] = useState<PersonalGCalEvent[]>([]);
  const [personalConnected, setPersonalConnected] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const personalMonthRef = useRef<string | null>(null);

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

  // Reload personal calendar when month changes (only if connected)
  useEffect(() => {
    if (!personalConnected) return;
    const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (personalMonthRef.current === key) return;
    personalMonthRef.current = key;
    const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0, 23, 59, 59).toISOString();
    listPersonalEvents({ timeMin, timeMax }).then(setPersonalEvents).catch(() => {});
  }, [currentDate, personalConnected]);

  function refreshPersonalEvents() {
    personalMonthRef.current = null;
    const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0, 23, 59, 59).toISOString();
    listPersonalEvents({ timeMin, timeMax })
      .then((evs) => { setPersonalEvents(evs); setPersonalConnected(true); })
      .catch(() => {});
  }

  const monthLabel = formatMonthLabel(currentDate);
  const monthMatrix = useMemo(
    () => getMonthMatrix(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );

  const myAbsences = useMemo(
    () => absences.filter((absence) => absence.uid === user?.uid),
    [absences, user?.uid],
  );

  const selectedISO = selectedDate ? selectedDate.toISOString().slice(0, 10) : null;
  const selectedHolidays = selectedISO ? holidays.filter((holiday) => holiday.date === selectedISO) : [];
  const selectedEvents = selectedISO ? events.filter((event) => event.date === selectedISO) : [];
  const selectedAbsences = selectedDate
    ? myAbsences.filter((absence) => isInRange(selectedDate, absence.dateStart, absence.dateEnd))
    : [];
  const selectedPersonalEvents = selectedDate
    ? personalEvents.filter((ev) => isInRange(selectedDate, ev.date, ev.endDate))
    : [];

  const allUpcomingItems = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    return [
      ...holidays
        .filter((item) => item.date >= todayISO)
        .map((item) => ({
          key: `holiday-${item.id}`,
          date: item.date,
          title: item.name,
          tone: item.kind === "DAY_OFF" ? "bg-pink-100 text-pink-700" : "bg-violet-100 text-violet-700",
          label: item.kind === "DAY_OFF" ? "Día libre global" : "Feriado",
        })),
      ...events
        .filter((item) => item.date >= todayISO)
        .map((item) => ({
          key: `event-${item.id}`,
          date: item.date,
          title: item.title,
          tone: "bg-sky-100 text-sky-700",
          label: "Evento interno",
        })),
      ...myAbsences
        .filter((item) => item.dateEnd >= todayISO)
        .map((item) => ({
          key: `absence-${item.id}`,
          date: item.dateStart,
          title: item.type === "VACATION" ? "Tus vacaciones aprobadas" : "Tu permiso aprobado",
          tone: item.type === "VACATION" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
          label: item.type === "VACATION" ? "Vacaciones" : "Permiso",
        })),
      ...personalEvents
        .filter((item) => item.endDate >= todayISO && item.status !== "cancelled")
        .map((item) => ({
          key: `personal-${item.id}`,
          date: item.date,
          title: item.title,
          tone: "bg-indigo-100 text-indigo-700",
          label: `Mi calendario${!item.isAllDay && item.startTime ? ` · ${item.startTime}` : ""}`,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, [events, holidays, myAbsences, personalEvents]);

  const upcomingItems = showAllUpcoming ? allUpcomingItems : allUpcomingItems.slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <CalendarHeader
        label={monthLabel}
        subtitle="Feriados, eventos del equipo y tu agenda personal."
        onPrev={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
        onNext={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
        onToday={() => {
          const now = new Date();
          setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
        }}
        actions={
          <PersonalCalendarConnect
            onConnected={refreshPersonalEvents}
            onDisconnected={() => {
              setPersonalEvents([]);
              setPersonalConnected(false);
              personalMonthRef.current = null;
            }}
            compact
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <CalendarFilters
            activeFilters={activeFilters}
            onChange={setActiveFilters}
            showPersonal={personalConnected}
            showGcal={false}
          />
          <MonthGrid
            weeks={monthMatrix}
            month={currentDate.getMonth()}
            holidays={holidays}
            events={events}
            absences={myAbsences}
            personalEvents={personalEvents}
            activeFilters={activeFilters}
            onSelectDate={(date) => setSelectedDate(date)}
          />
        </div>

        <div className="space-y-4">
          <CalendarLegend showPersonal={personalConnected} />

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Tu agenda visible</h2>
              <p className="text-sm text-slate-500">
                Feriados, días libres, eventos internos y tus permisos aprobados.
              </p>
            </div>

            <div className="space-y-3">
              {upcomingItems.length ? (
                <>
                  {upcomingItems.map((item) => (
                    <div key={item.key} className="rounded-xl border border-slate-200/70 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(item.date)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${item.tone}`}>
                          {item.label}
                        </span>
                      </div>
                    </div>
                  ))}
                  {allUpcomingItems.length > 12 && (
                    <button
                      type="button"
                      onClick={() => setShowAllUpcoming((v) => !v)}
                      className="w-full rounded-xl border border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      {showAllUpcoming
                        ? "Mostrar menos"
                        : `Ver todos (${allUpcomingItems.length})`}
                    </button>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/70 px-4 py-6 text-sm text-slate-500">
                  Aún no hay próximos registros visibles para ti.
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
        gcalEvents={selectedPersonalEvents.map((ev) => ({
          id: ev.id,
          title: ev.title,
          description: ev.description,
          startTime: ev.startTime,
          endTime: ev.endTime,
          isAllDay: ev.isAllDay,
          htmlLink: ev.htmlLink,
          source: "personal" as const,
        }))}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
