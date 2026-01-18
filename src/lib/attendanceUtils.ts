export const WEEKDAY_EXPECTED_MINUTES = {
  0: 0,
  1: 480,
  2: 480,
  3: 480,
  4: 480,
  5: 480,
  6: 240,
} as const;

export function minutesToHHMM(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function getWeekStartMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getWeekDates(weekStart: Date) {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + i);
    dates.push(next);
  }
  return dates;
}

export function expectedMinutesForDate(date: Date) {
  return WEEKDAY_EXPECTED_MINUTES[date.getDay() as keyof typeof WEEKDAY_EXPECTED_MINUTES];
}

export function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatTime(dateISO: string | null) {
  if (!dateISO) return "--:--";
  const date = new Date(dateISO);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
