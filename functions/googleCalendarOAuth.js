const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { google } = require('googleapis');
const admin = require('firebase-admin');

const REDIRECT_URI = 'https://kimce-app.web.app/auth/gcal/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

const SECRETS = ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET'];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    (process.env.OAUTH_CLIENT_ID || '').trim(),
    (process.env.OAUTH_CLIENT_SECRET || '').trim(),
    REDIRECT_URI,
  );
}

function requireAuth(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  return auth.uid;
}

async function requireAdmin(auth) {
  const uid = requireAuth(auth);
  const doc = await admin.firestore().collection('users').doc(uid).get();
  const role = doc.data()?.role;
  if (role !== 'admin' && role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Solo administradores pueden realizar esta acción.');
  }
  return uid;
}

// Returns the OAuth2 URL the user must visit to grant permission
exports.gcalOAuthGetUrl = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { loginHint } = request.data ?? {};
  const oauth2Client = getOAuth2Client();

  // Random state to prevent CSRF
  const state = Buffer.from(`${uid}:${Date.now()}:${Math.random()}`).toString('base64url');
  await admin.firestore().collection('oauthStates').doc(state).set({
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const authOptions = {
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'select_account consent',
  };
  if (loginHint) authOptions.login_hint = loginHint;

  const url = oauth2Client.generateAuthUrl(authOptions);
  return { url };
});

// Called from the callback page after Google redirects back
exports.gcalOAuthExchangeCode = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { code, state } = request.data ?? {};

  if (!code) throw new HttpsError('invalid-argument', 'Código de autorización inválido.');

  // Verify state
  if (state) {
    const stateDoc = await admin.firestore().collection('oauthStates').doc(state).get();
    if (!stateDoc.exists || stateDoc.data().uid !== uid) {
      throw new HttpsError('permission-denied', 'Estado OAuth inválido o expirado.');
    }
    await stateDoc.ref.delete();
  }

  const oauth2Client = getOAuth2Client();
  let tokens;
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch (err) {
    throw new HttpsError('internal', 'No se pudo obtener el token de Google. Intenta de nuevo.');
  }

  if (!tokens.refresh_token) {
    throw new HttpsError(
      'failed-precondition',
      'Google no devolvió un refresh token. Ve a myaccount.google.com/permissions, revoca el acceso a "Kimce App" y vuelve a conectar.',
    );
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  await admin.firestore()
    .collection('users').doc(uid)
    .collection('private').doc('googleCalendar')
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      email: userInfo.email,
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { success: true, email: userInfo.email };
});

// Returns whether the current user has their calendar connected
exports.gcalOAuthStatus = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const doc = await admin.firestore()
    .collection('users').doc(uid)
    .collection('private').doc('googleCalendar')
    .get();

  if (!doc.exists) return { connected: false };
  const { email, connectedAt } = doc.data();
  return { connected: true, email, connectedAt };
});

// Revokes and removes the connection
exports.gcalOAuthDisconnect = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const doc = await admin.firestore()
    .collection('users').doc(uid)
    .collection('private').doc('googleCalendar')
    .get();

  if (doc.exists) {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({ access_token: doc.data().accessToken });
      await oauth2Client.revokeCredentials();
    } catch (_) { /* ignore revocation errors */ }
    await doc.ref.delete();
  }

  return { success: true };
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function getUserOAuth2Client(uid) {
  const doc = await admin.firestore()
    .collection('users').doc(uid)
    .collection('private').doc('googleCalendar')
    .get();

  if (!doc.exists) {
    throw new HttpsError('failed-precondition', 'Google Calendar no conectado. Conéctalo desde tu perfil.');
  }

  const { accessToken, refreshToken, expiryDate } = doc.data();
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate });

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (newTokens) => {
    const update = {};
    if (newTokens.access_token) update.accessToken = newTokens.access_token;
    if (newTokens.expiry_date) update.expiryDate = newTokens.expiry_date;
    if (Object.keys(update).length > 0) {
      await admin.firestore()
        .collection('users').doc(uid)
        .collection('private').doc('googleCalendar')
        .update(update);
    }
  });

  return oauth2Client;
}

function normalizeEvent(ev) {
  const isAllDay = Boolean(ev.start?.date);
  const startRaw = isAllDay ? ev.start?.date : ev.start?.dateTime;
  const endRaw   = isAllDay ? ev.end?.date   : ev.end?.dateTime;
  const startDate = startRaw ? startRaw.slice(0, 10) : '';
  let endDate = endRaw ? endRaw.slice(0, 10) : startDate;
  if (isAllDay && endDate > startDate) {
    // Google uses exclusive end date for all-day events
    const d = new Date(endDate);
    d.setDate(d.getDate() - 1);
    endDate = d.toISOString().slice(0, 10);
  }
  return {
    id: ev.id,
    title: ev.summary ?? '(Sin título)',
    description: ev.description ?? '',
    date: startDate,
    endDate,
    isAllDay,
    startTime: isAllDay ? '' : (startRaw ? startRaw.slice(11, 16) : ''),
    endTime:   isAllDay ? '' : (endRaw   ? endRaw.slice(11, 16)   : ''),
    htmlLink: ev.htmlLink ?? '',
    status: ev.status ?? 'confirmed',
    attendees: (ev.attendees ?? []).map((a) => ({ email: a.email, name: a.displayName ?? '', status: a.responseStatus ?? 'needsAction' })),
    location: ev.location ?? '',
    colorId: ev.colorId ?? '',
    isRecurring: Boolean(ev.recurringEventId),
  };
}

// ── Personal calendar CRUD ────────────────────────────────────────────────────

exports.gcalUserListEvents = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { timeMin, timeMax } = request.data ?? {};

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin ?? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
    timeMax: timeMax ?? new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 200,
    showDeleted: false,
  });

  return { events: (response.data.items ?? []).map(normalizeEvent) };
});

exports.gcalUserCreateEvent = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { event } = request.data ?? {};
  if (!event) throw new HttpsError('invalid-argument', 'Datos del evento requeridos.');

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all',
  });

  return { event: normalizeEvent(response.data) };
});

exports.gcalUserUpdateEvent = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { eventId, event } = request.data ?? {};
  if (!eventId || !event) throw new HttpsError('invalid-argument', 'ID y datos del evento requeridos.');

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: event,
    sendUpdates: 'all',
  });

  return { event: normalizeEvent(response.data) };
});

exports.gcalUserDeleteEvent = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { eventId, sendUpdates } = request.data ?? {};
  if (!eventId) throw new HttpsError('invalid-argument', 'ID del evento requerido.');

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: sendUpdates ?? 'all',
  });

  return { success: true };
});

// Duplicate / move event (copy to new date, delete original)
exports.gcalUserMoveEvent = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { eventId, newStartDate, newEndDate, newStartTime, newEndTime } = request.data ?? {};
  if (!eventId || !newStartDate) throw new HttpsError('invalid-argument', 'eventId y newStartDate son requeridos.');

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get existing event
  const existing = await calendar.events.get({ calendarId: 'primary', eventId });
  const ev = existing.data;
  const isAllDay = Boolean(ev.start?.date);

  const patchBody = isAllDay
    ? { start: { date: newStartDate }, end: { date: newEndDate ?? newStartDate } }
    : {
        start: { dateTime: `${newStartDate}T${newStartTime ?? ev.start.dateTime.slice(11, 16)}:00`, timeZone: ev.start.timeZone ?? 'America/Lima' },
        end:   { dateTime: `${newEndDate ?? newStartDate}T${newEndTime ?? ev.end.dateTime.slice(11, 16)}:00`,   timeZone: ev.end.timeZone   ?? 'America/Lima' },
      };

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: patchBody,
    sendUpdates: 'all',
  });

  return { event: normalizeEvent(response.data) };
});

// Cancel an event (sets status to 'cancelled' without deleting)
exports.gcalUserCancelEvent = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { eventId } = request.data ?? {};
  if (!eventId) throw new HttpsError('invalid-argument', 'ID del evento requerido.');

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: { status: 'cancelled' },
    sendUpdates: 'all',
  });

  return { event: normalizeEvent(response.data) };
});

// ── Crear reunión espontánea desde cuenta personal con Meet + asistentekimce ──
const ASSISTANT_EMAIL = 'asistentekimce@gmail.com';

exports.gcalUserCreateMeeting = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireAuth(request.auth);
  const { title, startDateTime, endDateTime, attendees: extra } = request.data ?? {};

  const oauth2Client = await getUserOAuth2Client(uid);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = startDateTime ? new Date(startDateTime) : new Date();
  const end   = endDateTime   ? new Date(endDateTime)   : new Date(start.getTime() + 60 * 60 * 1000);

  const attendees = [...(extra || [])];
  if (!attendees.some(a => a.email === ASSISTANT_EMAIL)) {
    attendees.push({ email: ASSISTANT_EMAIL });
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: title || 'Reunión KIMCE',
      start: { dateTime: start.toISOString(), timeZone: 'America/Lima' },
      end:   { dateTime: end.toISOString(),   timeZone: 'America/Lima' },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `kimce-sala-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const ev = response.data;
  let hangoutLink = ev.hangoutLink;
  if (!hangoutLink && ev.conferenceData?.entryPoints) {
    const video = ev.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
    if (video?.uri) hangoutLink = video.uri;
  }

  return { hangoutLink: hangoutLink || '', eventId: ev.id || '' };
});

// ── Free/busy (admin only) ────────────────────────────────────────────────────

exports.gcalFreeBusy = onCall({ secrets: SECRETS }, async (request) => {
  await requireAdmin(request.auth);
  const { timeMin, timeMax, uids } = request.data ?? {};
  if (!timeMin || !timeMax || !Array.isArray(uids) || !uids.length) {
    throw new HttpsError('invalid-argument', 'timeMin, timeMax y uids son requeridos.');
  }

  const results = {};

  await Promise.all(uids.map(async (targetUid) => {
    const tokenDoc = await admin.firestore()
      .collection('users').doc(targetUid)
      .collection('private').doc('googleCalendar')
      .get();

    if (!tokenDoc.exists) {
      results[targetUid] = { connected: false };
      return;
    }

    try {
      const oauth2Client = await getUserOAuth2Client(targetUid);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const fb = await calendar.freebusy.query({
        requestBody: { timeMin, timeMax, items: [{ id: 'primary' }] },
      });
      results[targetUid] = {
        connected: true,
        email: tokenDoc.data().email,
        busy: fb.data.calendars?.primary?.busy ?? [],
      };
    } catch (_) {
      results[targetUid] = { connected: true, error: true, email: tokenDoc.data().email };
    }
  }));

  return { results };
});
