import { getFunctions, httpsCallable } from "firebase/functions";

const fns = getFunctions(undefined, "us-central1");

export type PersonalGCalEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  htmlLink: string;
  status: string;
  attendees: { email: string; name: string; status: string }[];
  location: string;
  colorId: string;
  isRecurring: boolean;
};

export type GCalOAuthStatus = {
  connected: boolean;
  email?: string;
  connectedAt?: unknown;
};

export type FreeBusyResult = {
  [uid: string]: {
    connected: boolean;
    email?: string;
    error?: boolean;
    busy?: { start: string; end: string }[];
  };
};

type EventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
  attendees?: { email: string; displayName?: string }[];
  colorId?: string;
};

// ── Connection management ─────────────────────────────────────────────────────

export async function getOAuthUrl(opts?: { loginHint?: string }): Promise<string> {
  const fn = httpsCallable<{ loginHint?: string }, { url: string }>(fns, "gcalOAuthGetUrl");
  const result = await fn({ loginHint: opts?.loginHint });
  return result.data.url;
}

export async function exchangeCode(code: string, state: string | null): Promise<{ email: string }> {
  const fn = httpsCallable<{ code: string; state: string | null }, { success: boolean; email: string }>(
    fns,
    "gcalOAuthExchangeCode",
  );
  const result = await fn({ code, state });
  return { email: result.data.email };
}

export async function getOAuthStatus(): Promise<GCalOAuthStatus> {
  const fn = httpsCallable<Record<string, never>, GCalOAuthStatus>(fns, "gcalOAuthStatus");
  const result = await fn({});
  return result.data;
}

export async function disconnectOAuth(): Promise<void> {
  const fn = httpsCallable(fns, "gcalOAuthDisconnect");
  await fn({});
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function listPersonalEvents(params?: {
  timeMin?: string;
  timeMax?: string;
}): Promise<PersonalGCalEvent[]> {
  const fn = httpsCallable<typeof params, { events: PersonalGCalEvent[] }>(
    fns,
    "gcalUserListEvents",
  );
  const result = await fn(params ?? {});
  return result.data.events;
}

export async function createPersonalEvent(event: EventInput): Promise<PersonalGCalEvent> {
  const fn = httpsCallable<{ event: EventInput }, { event: PersonalGCalEvent }>(
    fns,
    "gcalUserCreateEvent",
  );
  const result = await fn({ event });
  return result.data.event;
}

export async function updatePersonalEvent(eventId: string, event: Partial<EventInput>): Promise<PersonalGCalEvent> {
  const fn = httpsCallable<{ eventId: string; event: Partial<EventInput> }, { event: PersonalGCalEvent }>(
    fns,
    "gcalUserUpdateEvent",
  );
  const result = await fn({ eventId, event });
  return result.data.event;
}

export async function deletePersonalEvent(eventId: string): Promise<void> {
  const fn = httpsCallable<{ eventId: string }, { success: boolean }>(
    fns,
    "gcalUserDeleteEvent",
  );
  await fn({ eventId });
}

export async function movePersonalEvent(
  eventId: string,
  params: { newStartDate: string; newEndDate?: string; newStartTime?: string; newEndTime?: string },
): Promise<PersonalGCalEvent> {
  const fn = httpsCallable<{ eventId: string } & typeof params, { event: PersonalGCalEvent }>(
    fns,
    "gcalUserMoveEvent",
  );
  const result = await fn({ eventId, ...params });
  return result.data.event;
}

export async function cancelPersonalEvent(eventId: string): Promise<PersonalGCalEvent> {
  const fn = httpsCallable<{ eventId: string }, { event: PersonalGCalEvent }>(
    fns,
    "gcalUserCancelEvent",
  );
  const result = await fn({ eventId });
  return result.data.event;
}

// Crea reunión espontánea desde la cuenta personal del usuario — el usuario es el
// organizador/anfitrión y asistentekimce queda como invitado del evento (bot entra sin admisión)
export async function createPersonalMeeting(params: {
  title: string
  startDateTime?: string
  endDateTime?: string
  attendees?: { email: string; displayName?: string }[]
}): Promise<{ hangoutLink: string; eventId: string }> {
  const fn = httpsCallable<typeof params, { hangoutLink: string; eventId: string }>(
    fns,
    'gcalUserCreateMeeting',
  )
  const result = await fn(params)
  return result.data
}

// ── Free/Busy (admin only) ────────────────────────────────────────────────────

export async function getTeamFreeBusy(params: {
  timeMin: string;
  timeMax: string;
  uids: string[];
}): Promise<FreeBusyResult> {
  const fn = httpsCallable<typeof params, { results: FreeBusyResult }>(fns, "gcalFreeBusy");
  const result = await fn(params);
  return result.data.results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildAllDayEvent(
  summary: string,
  startDate: string,
  endDate?: string,
  opts?: { description?: string; attendees?: { email: string }[]; location?: string },
): EventInput {
  const end = endDate ?? startDate;
  // Google requires exclusive end date for all-day events
  const d = new Date(end);
  d.setDate(d.getDate() + 1);
  const exclusiveEnd = d.toISOString().slice(0, 10);
  return {
    summary,
    description: opts?.description,
    location: opts?.location,
    start: { date: startDate },
    end: { date: exclusiveEnd },
    attendees: opts?.attendees,
  };
}

export function buildTimedEvent(
  summary: string,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  opts?: { description?: string; attendees?: { email: string }[]; location?: string; timeZone?: string },
): EventInput {
  const tz = opts?.timeZone ?? "America/Lima";
  return {
    summary,
    description: opts?.description,
    location: opts?.location,
    start: { dateTime: `${startDate}T${startTime}:00`, timeZone: tz },
    end:   { dateTime: `${endDate}T${endTime}:00`,   timeZone: tz },
    attendees: opts?.attendees,
  };
}
