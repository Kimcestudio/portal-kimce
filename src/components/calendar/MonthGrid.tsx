import { isSameDate } from "@/lib/calendarUtils";
import type { Absence, CalendarEvent, Holiday } from "@/data/calendar";
import DayCell from "./DayCell";

interface MonthGridProps {
  weeks: Date[][];
  month: number;
  holidays: Holiday[];
  events: CalendarEvent[];
  absences: Absence[];
  onSelectDate: (date: Date) => void;
}

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function MonthGrid({
  weeks,
  month,
  holidays,
  events,
  absences,
  onSelectDate,
}: MonthGridProps) {
  const today = new Date();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-muted">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-2 py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weeks.flat().map((date) => {
          const dateISO = date.toISOString().slice(0, 10);
          const isOutside = date.getMonth() !== month;
          const isToday = isSameDate(date, today);
          const holidayItems = holidays.filter((item) => item.date === dateISO);
          const eventItems = events.filter((item) => item.date === dateISO);
          const absenceItems = absences.filter(
            (item) =>
              item.status === "APPROVED" &&
              date >= new Date(item.dateStart) &&
              date <= new Date(item.dateEnd)
          );
          const hasHoliday = holidayItems.length > 0;

          return (
            <DayCell
              key={dateISO}
              isToday={isToday}
              isOutside={isOutside}
              isHoliday={hasHoliday}
              dayNumber={date.getDate()}
              onClick={() => onSelectDate(date)}
            >
              {holidayItems.length ? (
                <span className="h-2 w-2 rounded-full bg-[#6c63ff]" />
              ) : null}
              {absenceItems.some((item) => item.type === "VACATION") ? (
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              ) : null}
              {absenceItems.some((item) => item.type === "PERMIT") ? (
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              ) : null}
              {eventItems.length ? (
                <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
              ) : null}
            </DayCell>
          );
        })}
      </div>
    </div>
  );
}
