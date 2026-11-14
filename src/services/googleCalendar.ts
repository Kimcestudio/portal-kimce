import { getFunctions, httpsCallable } from "firebase/functions";

const fns = getFunctions(undefined, "us-central1");

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type GCalDateTime = {
  date?: string;       // YYYY-MM-DD  (todo el día)
  dateTime?: string;   // ISO 8601    (con hora)
  timeZone?: string;
};

export type GCalAttendee = {
  email: string;
  displayName?: string;
  responseStatus?: "accepted" | "declined" | "tentative" | "needsAction";
  organizer?: boolean;
  self?: boolean;
};

export type GCalEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: GCalDateTime;
  end: GCalDateTime;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  colorId?: string;
  attendees?: GCalAttendee[];
  organizer?: { email: string; displayName?: string };
};

export type GCalConfig = {
  configured: boolean;
  calendarId: string | null;
  calendarName: string | null;
};

// Forma normalizada para mostrar en el portal
export type PortalGCalEvent = {
  id: string;
  title: string;
  description: string;
  location?: string;
  date: string;        // YYYY-MM-DD del inicio
  endDate: string;     // YYYY-MM-DD del fin
  isAllDay: boolean;
  startTime: string;   // "HH:MM" o "" si es todo el día
  endTime: string;
  htmlLink: string;
  hangoutLink?: string;
  attendees?: GCalAttendee[];
  organizer?: { email: string; displayName?: string };
};

// Forma de entrada para crear/editar
export type GCalEventInput = {
  summary: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD — si es todo el día */
  startDate?: string;
  /** YYYY-MM-DD — si es todo el día */
  endDate?: string;
  /** ISO 8601 — si tiene hora */
  startDateTime?: string;
  /** ISO 8601 — si tiene hora */
  endDateTime?: string;
  timeZone?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
};

// ─── Normalización ────────────────────────────────────────────────────────────

export function normalizeGCalEvent(event: GCalEvent): PortalGCalEvent {
  const isAllDay = Boolean(event.start.date);
  const startDate = event.start.date ?? event.start.dateTime?.slice(0, 10) ?? "";
  const endDateRaw = event.end.date ?? event.end.dateTime?.slice(0, 10) ?? startDate;
  // Google Calendar all-day endDate is exclusive (next day), adjust to inclusive
  const endDate = isAllDay && endDateRaw > startDate
    ? (() => {
        const d = new Date(`${endDateRaw}T00:00:00`);
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      })()
    : endDateRaw;

  const startTime = event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  const endTime = event.end.dateTime
    ? new Date(event.end.dateTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  return {
    id: event.id,
    title: event.summary ?? "(sin título)",
    description: event.description ?? "",
    location: event.location || undefined,
    date: startDate,
    endDate: endDate || startDate,
    isAllDay,
    startTime,
    endTime,
    htmlLink: event.htmlLink ?? "",
    hangoutLink: event.hangoutLink,
    attendees: event.attendees,
    organizer: event.organizer,
  };
}

function eventInputToGCal(input: GCalEventInput): Omit<GCalEvent, "id" | "htmlLink" | "status"> {
  const tz = input.timeZone ?? "America/Lima";
  const isAllDay = Boolean(input.startDate);
  return {
    summary: input.summary,
    description: input.description ?? "",
    location: input.location ?? "",
    start: isAllDay
      ? { date: input.startDate }
      : { dateTime: input.startDateTime!, timeZone: tz },
    end: isAllDay
      ? {
          date: (() => {
            const d = new Date(`${input.endDate ?? input.startDate}T00:00:00`);
            d.setDate(d.getDate() + 1);
            return d.toISOString().slice(0, 10);
          })(),
        }
      : { dateTime: input.endDateTime!, timeZone: tz },
    ...(input.attendees?.length ? { attendees: input.attendees } : {}),
  };
}

// ─── Callable wrappers ────────────────────────────────────────────────────────

export async function gcalGetConfig(): Promise<GCalConfig> {
  const fn = httpsCallable<Record<string, never>, GCalConfig>(fns, "gcalGetConfig");
  const result = await fn({});
  return result.data;
}

export async function gcalSaveConfig(calendarId: string): Promise<{ ok: boolean; calendarName: string }> {
  const fn = httpsCallable<{ calendarId: string }, { ok: boolean; calendarName: string }>(fns, "gcalSaveConfig");
  const result = await fn({ calendarId });
  return result.data;
}

export async function gcalListEvents(opts?: {
  timeMin?: string;
  timeMax?: string;
}): Promise<PortalGCalEvent[]> {
  const fn = httpsCallable<{ timeMin?: string; timeMax?: string }, { events: GCalEvent[] }>(fns, "gcalListEvents");
  const result = await fn(opts ?? {});
  return (result.data.events ?? []).map(normalizeGCalEvent);
}

export async function gcalCreateEvent(input: GCalEventInput): Promise<PortalGCalEvent> {
  const fn = httpsCallable<{ event: ReturnType<typeof eventInputToGCal> }, { event: GCalEvent }>(fns, "gcalCreateEvent");
  const result = await fn({ event: eventInputToGCal(input) });
  return normalizeGCalEvent(result.data.event);
}

export async function gcalUpdateEvent(eventId: string, input: GCalEventInput): Promise<PortalGCalEvent> {
  const fn = httpsCallable<{ eventId: string; event: ReturnType<typeof eventInputToGCal> }, { event: GCalEvent }>(fns, "gcalUpdateEvent");
  const result = await fn({ eventId, event: eventInputToGCal(input) });
  return normalizeGCalEvent(result.data.event);
}

export async function gcalDeleteEvent(eventId: string): Promise<void> {
  const fn = httpsCallable<{ eventId: string }, { ok: boolean }>(fns, "gcalDeleteEvent");
  await fn({ eventId });
}

export async function gcalInviteAssistant(data: {
  meetLink: string
  title?: string
  startTime?: string
}): Promise<void> {
  const fn = httpsCallable<typeof data, { ok: boolean }>(fns, 'gcalInviteAssistant')
  await fn(data)
}
