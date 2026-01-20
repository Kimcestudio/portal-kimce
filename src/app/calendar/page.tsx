"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import SidebarNav from "@/components/SidebarNav";
import PageHeader from "@/components/PageHeader";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthGrid from "@/components/calendar/MonthGrid";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import DayDetailsModal from "@/components/calendar/DayDetailsModal";
import { absences, events, holidays } from "@/data/calendar";
import { formatMonthLabel, getMonthMatrix, isInRange } from "@/lib/calendarUtils";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthLabel = formatMonthLabel(currentDate);
  const monthMatrix = useMemo(
    () => getMonthMatrix(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const handlePrev = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const selectedISO = selectedDate ? selectedDate.toISOString().slice(0, 10) : null;
  const selectedHolidays = selectedISO
    ? holidays.filter((holiday) => holiday.date === selectedISO)
    : [];
  const selectedEvents = selectedISO
    ? events.filter((event) => event.date === selectedISO)
    : [];
  const selectedAbsences = selectedDate
    ? absences.filter(
        (absence) =>
          absence.status === "APPROVED" &&
          isInRange(selectedDate, absence.dateStart, absence.dateEnd)
      )
    : [];

  return (
    <AppShell sidebar={<SidebarNav />}>
      <div className="flex flex-col gap-4">
        <PageHeader />
        <CalendarHeader
          label={monthLabel}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <MonthGrid
              weeks={monthMatrix}
              month={currentDate.getMonth()}
              holidays={holidays}
              events={events}
              absences={absences}
              onSelectDate={(date) => setSelectedDate(date)}
            />
          </div>
          <CalendarLegend />
        </div>
      </div>

      <DayDetailsModal
        open={Boolean(selectedDate)}
        dateLabel={selectedDate ? selectedDate.toLocaleDateString("es-ES") : ""}
        holidays={selectedHolidays}
        events={selectedEvents}
        absences={selectedAbsences}
        onClose={() => setSelectedDate(null)}
      />
    </AppShell>
  );
}
