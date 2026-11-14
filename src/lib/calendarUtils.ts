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

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  const endStr = weekEnd.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Detecta si una descripción de evento tiene links de Teams o Zoom embebidos. */
export function hasMeetingLinks(description: string): boolean {
  return /teams\.microsoft\.com|zoom\.us/i.test(description);
}

/** Detecta si un texto contiene marcado HTML (tags, links, etc.). */
export function hasHtmlMarkup(text: string): boolean {
  return /<[a-z][^>]*>/i.test(text);
}

/**
 * Sanitiza el HTML de la descripción de un evento para renderizarlo de forma segura.
 * Fuerza target="_blank" en todos los links y elimina handlers JS.
 */
export function safeDescriptionHtml(html: string): string {
  return html
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .replace(/<a(\s[^>]*)>/gi, (_m, attrs: string) => {
      const stripped = attrs
        .replace(/\btarget\s*=\s*"[^"]*"/gi, "")
        .replace(/\brel\s*=\s*"[^"]*"/gi, "");
      return `<a${stripped} target="_blank" rel="noopener noreferrer">`;
    });
}
