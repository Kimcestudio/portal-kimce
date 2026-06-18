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
  subscribeApprovedAbsences,
  subscribeCalendarEvents,
  subscribeCalendarHolidays,
  type CalendarAbsenceRecord,
  type CalendarEventRecord,
  type CalendarHolidayRecord,
} from "@/services/calendar";

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holidays, setHolidays] = useState<CalendarHolidayRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [absences, setAbsences] = useState<CalendarAbsenceRecord[]>([]);

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

  const upcomingItems = useMemo(() => {
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
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [events, holidays, myAbsences]);

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

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <MonthGrid
            weeks={monthMatrix}
            month={currentDate.getMonth()}
            holidays={holidays}
            events={events}
            absences={myAbsences}
            onSelectDate={setSelectedDate}
          />
        </div>

        <div className="space-y-4">
          <CalendarLegend />

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Tu agenda visible</h2>
              <p className="text-sm text-slate-500">
                Aquí verás feriados, días libres globales, eventos internos y tus permisos aprobados.
              </p>
            </div>

            <div className="space-y-3">
              {upcomingItems.length ? (
                upcomingItems.map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.date}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.tone}`}>
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))
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
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
