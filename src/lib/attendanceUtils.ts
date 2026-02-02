import type { WorkSchedule, WorkScheduleDays } from "@/services/firebase/types";

export const WEEKDAY_EXPECTED_MINUTES = {
  0: 0,
  1: 480,
  2: 480,
  3: 480,
  4: 480,
  5: 480,
  6: 240,
} as const;

const DEFAULT_SCHEDULE_DAYS: WorkScheduleDays = {
  mon: 480,
  tue: 480,
  wed: 480,
  thu: 480,
  fri: 480,
  sat: 240,
  sun: 0,
};

const DAY_KEY: Record<number, keyof WorkScheduleDays> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

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

export function expectedMinutesForDate(date: Date, schedule?: WorkSchedule | null) {
  if (schedule?.days) {
    const key = DAY_KEY[date.getDay()];
    const minutes = schedule.days[key];
    if (typeof minutes === "number") return minutes;
  }
  return DEFAULT_SCHEDULE_DAYS[DAY_KEY[date.getDay()]];
}

export function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getWeekKey(dateISO: string) {
  const parsed = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatISODate(getWeekStartMonday(parsed));
}

export function formatTime(dateISO: string | null) {
  if (!dateISO) return "--:--";
  const date = new Date(dateISO);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
