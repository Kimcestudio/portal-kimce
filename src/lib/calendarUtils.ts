export function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getMonthMatrix(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const diff = startDay === 0 ? -6 : 1 - startDay;
  const startDate = new Date(year, month, 1 + diff);
  const weeks: Date[][] = [];
  let current = new Date(startDate);

  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

export function isInRange(date: Date, startISO: string, endISO: string) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return target >= startDay && target <= endDay;
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}
