'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { google } = require('googleapis');
const admin = require('firebase-admin');

const OPTS = { region: 'us-central1', timeoutSeconds: 30 };
const CONFIG_DOC = 'config/googleCalendar';

// Cuenta asistente — siempre se agrega a todas las reuniones para que Fathom grabe independientemente
const ASSISTANT_EMAIL = 'asistentekimce@gmail.com';

function db() {
  return admin.firestore();
}

async function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const authClient = await auth.getClient();
  return google.calendar({ version: 'v3', auth: authClient });
}

async function resolveCalendarId(override) {
  if (override?.trim()) return override.trim();
  const snap = await db().doc(CONFIG_DOC).get();
  const id = snap.data()?.calendarId;
  if (!id) throw new HttpsError('not-found', 'No hay un Google Calendar configurado. Ve a Ajustes de Calendario en la sección de administración.');
  return id;
}

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para usar esta función.');
}

async function requireAdmin(auth) {
  requireAuth(auth);
  const snap = await db().collection('users').doc(auth.uid).get();
  const role = snap.data()?.role;
  if (role !== 'admin') throw new HttpsError('permission-denied', 'Solo administradores pueden realizar esta acción.');
}

// ─── Obtener configuración actual ────────────────────────────────────────────
const gcalGetConfig = onCall(OPTS, async (request) => {
  requireAuth(request.auth);
  const snap = await db().doc(CONFIG_DOC).get();
  const data = snap.data();
  if (!data?.calendarId) return { configured: false, calendarId: null, calendarName: null };
  return {
    configured: true,
    calendarId: data.calendarId,
    calendarName: data.calendarName ?? data.calendarId,
  };
});

// ─── Guardar Calendar ID y verificar acceso ───────────────────────────────────
const gcalSaveConfig = onCall(OPTS, async (request) => {
  await requireAdmin(request.auth);
  const calendarId = (request.data?.calendarId ?? '').trim();
  if (!calendarId) throw new HttpsError('invalid-argument', 'El ID del calendario no puede estar vacío.');

  const calendar = await getCalendarClient();
  try {
    const meta = await calendar.calendars.get({ calendarId });
    await db().doc(CONFIG_DOC).set(
      {
        calendarId,
        calendarName: meta.data.summary ?? calendarId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      },
      { merge: true },
    );
    return { ok: true, calendarName: meta.data.summary ?? calendarId };
  } catch (err) {
    const msg = err?.errors?.[0]?.message ?? err?.message ?? String(err);
    throw new HttpsError(
      'permission-denied',
      `No se pudo acceder al calendario "${calendarId}". Verifica que esté compartido con la cuenta de servicio de Firebase. Detalle: ${msg}`,
    );
  }
});

// ─── Listar eventos ──────────────────────────────────────────────────────────
const gcalListEvents = onCall(OPTS, async (request) => {
  requireAuth(request.auth);
  const { timeMin, timeMax, calendarId: overrideId } = request.data ?? {};
  const calendarId = await resolveCalendarId(overrideId);
  const calendar = await getCalendarClient();

  const now = new Date();
  const defaultMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const defaultMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin ?? defaultMin,
    timeMax: timeMax ?? defaultMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  return { events: response.data.items ?? [] };
});

// ─── Crear evento ────────────────────────────────────────────────────────────
const gcalCreateEvent = onCall(OPTS, async (request) => {
  requireAuth(request.auth);
  const { event, calendarId: overrideId } = request.data ?? {};
  if (!event?.summary?.trim()) throw new HttpsError('invalid-argument', 'El evento necesita un título.');
  if (!event?.start) throw new HttpsError('invalid-argument', 'El evento necesita fecha de inicio.');

  const calendarId = await resolveCalendarId(overrideId);
  const calendar = await getCalendarClient();

  // Siempre incluir al asistente para que Fathom grabe independientemente
  const existingAttendees = event.attendees || []
  const hasAssistant = existingAttendees.some(a => a.email === ASSISTANT_EMAIL)
  const attendees = hasAssistant ? existingAttendees : [...existingAttendees, { email: ASSISTANT_EMAIL }]

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      ...event,
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `kimce-meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });
  const eventData = response.data;
  // hangoutLink puede estar en conferenceData.entryPoints si no viene al nivel raíz
  if (!eventData.hangoutLink && eventData.conferenceData?.entryPoints) {
    const videoEntry = eventData.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
    if (videoEntry?.uri) eventData.hangoutLink = videoEntry.uri;
  }
  return { event: eventData };
});

// ─── Invitar asistente a reunión espontánea (sin crear nuevo Meet link) ───────
const gcalInviteAssistant = onCall(OPTS, async (request) => {
  requireAuth(request.auth);
  const { meetLink, title, startTime } = request.data ?? {};
  if (!meetLink) throw new HttpsError('invalid-argument', 'meetLink requerido.');

  const calendarId = await resolveCalendarId(null);
  const calendar = await getCalendarClient();

  const start = startTime ? new Date(startTime) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hora

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: title || 'Reunión KIMCE',
      location: meetLink,
      description: `Reunión en curso: ${meetLink}`,
      start: { dateTime: start.toISOString(), timeZone: 'America/Lima' },
      end:   { dateTime: end.toISOString(),   timeZone: 'America/Lima' },
      attendees: [{ email: ASSISTANT_EMAIL }],
    },
  });

  return { ok: true };
});

// ─── Actualizar evento ────────────────────────────────────────────────────────
const gcalUpdateEvent = onCall(OPTS, async (request) => {
  await requireAdmin(request.auth);
  const { eventId, event, calendarId: overrideId } = request.data ?? {};
  if (!eventId) throw new HttpsError('invalid-argument', 'Se requiere el ID del evento.');
  if (!event?.summary?.trim()) throw new HttpsError('invalid-argument', 'El evento necesita un título.');

  const calendarId = await resolveCalendarId(overrideId);
  const calendar = await getCalendarClient();

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
  return { event: response.data };
});

// ─── Eliminar evento ─────────────────────────────────────────────────────────
const gcalDeleteEvent = onCall(OPTS, async (request) => {
  await requireAdmin(request.auth);
  const { eventId, calendarId: overrideId } = request.data ?? {};
  if (!eventId) throw new HttpsError('invalid-argument', 'Se requiere el ID del evento.');

  const calendarId = await resolveCalendarId(overrideId);
  const calendar = await getCalendarClient();

  await calendar.events.delete({ calendarId, eventId });
  return { ok: true };
});

module.exports = {
  gcalGetConfig,
  gcalSaveConfig,
  gcalListEvents,
  gcalCreateEvent,
  gcalInviteAssistant,
  gcalUpdateEvent,
  gcalDeleteEvent,
};
