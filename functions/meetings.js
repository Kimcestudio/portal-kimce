'use strict'
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule }  = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')

const WEBHOOK_SECRET               = defineSecret('FATHOM_WEBHOOK_SECRET')
const WEBHOOK_SECRET_ASSISTANT     = defineSecret('FATHOM_WEBHOOK_SECRET_ASSISTANT')
const RESEND_API_KEY               = defineSecret('RESEND_API_KEY')
const FATHOM_API_KEY               = defineSecret('FATHOM_API_KEY')
const FATHOM_API_KEY_ASSISTANT     = defineSecret('FATHOM_API_KEY_ASSISTANT')
const ANTHROPIC_API_KEY            = defineSecret('ANTHROPIC_API_KEY')
const FIREFLIES_API_KEY            = defineSecret('FIREFLIES_API_KEY')

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1'

const db = admin.firestore()

const PORTAL_URL   = 'https://kimce-app.web.app'
const FROM_EMAIL   = 'KIMCE Reuniones <reuniones@kimcestudio.com>'
const REPLY_TO     = 'kimcestudio@gmail.com'

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString() }
function uid()    { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

/** Date → { date: 'YYYY-MM-DD', time: 'HH:mm' } en hora de Lima (los proveedores entregan UTC) */
function limaDateTime(d) {
  const s = d.toLocaleString('sv-SE', { timeZone: 'America/Lima' })
  return { date: s.slice(0, 10), time: s.slice(11, 16) }
}

/** Normalize Fathom / Zapier payload → internal meeting object */
function normalizeFathomPayload(body) {
  const raw = body || {}

  const title        = raw.title        || raw.call_title       || raw.meeting_title || 'Reunión sin título'
  const summary      = raw.summary      || raw.ai_summary       || raw.notes         || ''
  const transcript   = raw.transcript   || raw.full_transcript  || ''
  const recordingUrl = raw.recording_url || raw.video_url       || raw.url           || ''
  const fathomId     = raw.id           || raw.call_id          || raw.fathom_id     || ''

  const startRaw = raw.start_time || raw.started_at || raw.created_at || raw.date || null
  const endRaw   = raw.end_time   || raw.ended_at   || null
  const startDate = startRaw ? new Date(startRaw) : new Date()
  const endDate   = endRaw   ? new Date(endRaw)   : null
  const { date, time } = limaDateTime(startDate)
  const duration  = endDate ? Math.round((endDate - startDate) / 60000) : null

  let participants = []
  const rawAttendees = raw.attendees || raw.attendee_names || raw.participants || ''
  if (Array.isArray(rawAttendees)) {
    participants = rawAttendees.map(a =>
      typeof a === 'string'
        ? { name: a.trim(), email: '' }
        : { name: a.name || a.displayName || '', email: a.email || '' }
    ).filter(p => p.name)
  } else if (typeof rawAttendees === 'string' && rawAttendees.trim()) {
    participants = rawAttendees.split(',').map(n => ({ name: n.trim(), email: '' })).filter(p => p.name)
  }

  const rawItems = raw.action_items || raw.tasks || raw.todos || []
  let actionItems = []
  if (Array.isArray(rawItems)) {
    actionItems = rawItems
      .map(item => typeof item === 'string' ? item.trim() : (item.text || item.title || '').trim())
      .filter(Boolean)
  } else if (typeof rawItems === 'string' && rawItems.trim()) {
    actionItems = rawItems.split(/\n|•|–|-/).map(s => s.trim()).filter(Boolean)
  }

  return { title, summary, transcript, recordingUrl, fathomId, date, time, duration, participants, actionItems }
}

/** Parse "Name: task description" or just "task description"
 *  Falls back to scanning the text for exactly one team member name.
 */
function parseActionItem(text, teamNames = []) {
  // 1. Try "Name: task" / "Name - task" format
  const match = text.match(/^([^:–-]{2,30})[:–-]\s+(.+)$/)
  if (match) {
    const possibleName = match[1].trim()
    const task = match[2].trim()
    const isName = possibleName.split(' ').length <= 3 &&
      (teamNames.length === 0 || teamNames.some(n => n.toLowerCase().includes(possibleName.toLowerCase()) || possibleName.toLowerCase().includes(n.split(' ')[0].toLowerCase())))
    if (isName) return { text: task, assignee: possibleName }
  }

  // 2. Scan text for team first names — assign only if exactly one found
  if (teamNames.length) {
    const lowerText = text.toLowerCase()
    const found = teamNames.filter(fullName => {
      const first = fullName.split(' ')[0].toLowerCase()
      return first.length >= 3 && new RegExp(`\\b${first}\\b`).test(lowerText)
    })
    if (found.length === 1) {
      return { text: text.trim(), assignee: found[0].split(' ')[0] }
    }
  }

  return { text: text.trim(), assignee: '' }
}

/** Call Claude Haiku for meeting processing.
 *  Returns { summary, actionItems, resolvedItemIds } or null on failure.
 */
async function extractActionItemsWithAI(summary, rawItems, teamNames, transcript, openPendingItems, projects = []) {
  const apiKey = ANTHROPIC_API_KEY.value()
  if (!apiKey) return null

  const context = transcript
    ? `Transcripción (fragmento):\n${transcript.slice(0, 3000)}`
    : `Resumen de Fathom:\n${summary}`

  const pendingSection = openPendingItems?.length
    ? `\nPendientes abiertos de reuniones anteriores (IDs para cerrar si se resolvieron):\n${openPendingItems.map(p => `[${p.id}] ${p.text}${p.assignee ? ` — ${p.assignee}` : ''}`).join('\n')}`
    : ''

  const projectsSection = projects?.length
    ? `\nProyectos activos del equipo (usa el ID exacto si la reunión pertenece a alguno):\n${projects.map(p => `[${p.id}] ${p.nombre}`).join('\n')}`
    : ''

  const prompt = `Eres el asistente de reuniones de KIMCE Studio, agencia creativa en Perú.
Equipo: ${teamNames.join(', ')}.

${context}

Action items detectados (en inglés, pueden estar incompletos):
${rawItems.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${pendingSection}
${projectsSection}

Responde SOLO con este JSON (sin texto extra):
{
  "summary": "resumen ejecutivo en español, 2-3 oraciones, directo al punto",
  "proyectoId": "ID exacto del proyecto más relacionado de la lista, o cadena vacía si no aplica",
  "suggestedNewProject": null,
  "actionItems": [
    {"text": "tarea clara en español", "assignee": "nombre exacto del equipo o cadena vacía", "dueDate": "YYYY-MM-DD o cadena vacía", "priority": "alta|normal|baja"}
  ],
  "resolvedItemIds": ["IDs de pendientes anteriores que se cerraron en esta reunión"]
}

Regla para suggestedNewProject: si proyectoId quedó vacío Y la reunión trata claramente de un proyecto nuevo (no es una reunión interna genérica), rellena este campo con:
{"nombre": "nombre del proyecto en español", "descripcion": "descripción breve 1-2 líneas", "objetivoGeneral": "objetivo principal", "tipo": "campaña|lanzamiento|estrategia|web|contenido_especial|interno|propuesta"}
Si no aplica, déjalo en null.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data  = await res.json()
    const text  = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]+\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/** Update the living project brief after a meeting is linked */
async function updateProjectBrief(proyectoId, currentBrief, meeting, actionItems) {
  const apiKey = ANTHROPIC_API_KEY.value()
  if (!apiKey || !proyectoId) return
  const items = actionItems.map(i =>
    `• [${i.done ? 'cerrado' : 'abierto'}] ${i.text}${i.assignee ? ' — ' + i.assignee : ''}`
  ).join('\n')
  const prompt = `Eres el asistente de proyectos de KIMCE Studio, agencia creativa en Perú.
${currentBrief ? `Brief actual del proyecto:\n${currentBrief}\n` : ''}
Nueva reunión (${meeting.date}): ${meeting.title}
Resumen: ${meeting.summary || ''}
${items ? `Pendientes:\n${items}` : ''}

Actualiza el brief incorporando lo de esta reunión. Usa exactamente estas secciones:
OBJETIVO: qué es el proyecto y qué se quiere lograr (máx 2 líneas)
AVANCE: qué se ha hecho (máx 3 líneas, acumulativo)
PENDIENTE: qué falta por hacer (lista corta, solo los abiertos relevantes)
POR VALIDAR: decisiones o cosas pendientes de aprobación (omitir sección si no hay nada)

Sin markdown, sin asteriscos. Texto directo. Máx 280 palabras. Conserva contexto previo.`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return
    const data  = await res.json()
    const brief = data.content?.[0]?.text?.trim()
    if (!brief) return
    await db.collection('hubProyectos').doc(proyectoId).update({ brief, briefUpdatedAt: nowISO() })
  } catch (e) {
    console.warn('[updateProjectBrief] error:', e.message)
  }
}

/** Auto-create a draft project in hubProyectos from AI suggestion */
async function autoCreateProject(suggested, meetingDate, meetingTitle) {
  const docRef = db.collection('hubProyectos').doc()
  const now = nowISO()
  await docRef.set({
    id:                       docRef.id,
    nombre:                   suggested.nombre,
    brandId:                  '',
    estado:                   'prospecto',
    avance:                   0,
    descripcion:              suggested.descripcion || '',
    fechaInicio:              meetingDate,
    responsable:              '',
    responsables:             [],
    objetivoGeneral:          suggested.objetivoGeneral || '',
    tipo:                     suggested.tipo || 'interno',
    autoCreated:              true,
    autoCreatedFromMeeting:   meetingTitle,
    createdAt:                admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:                now,
  })
  console.log('[autoCreateProject] created:', docRef.id, suggested.nombre)
  return docRef.id
}

/** Call Claude Haiku to generate a personalized follow-up message */
async function generatePersonalizedDigest(name, pendingGroups, totalMeetings) {
  const apiKey = ANTHROPIC_API_KEY.value()
  if (!apiKey) return null

  const items = pendingGroups.flatMap(g =>
    g.items.map(i => `• ${i.text} (de "${g.meeting.title}", ${g.meeting.date}, ${Math.floor((Date.now() - new Date(g.meeting.date).getTime()) / 86400000)} días)`)
  ).join('\n')

  const prompt = `Eres KIMCE AI, el asistente de equipo de KIMCE Studio. Escríbele directamente a ${name}.
Esta semana hubo ${totalMeetings} reunión(es). Tiene ${pendingGroups.reduce((s, g) => s + g.items.length, 0)} pendiente(s) sin cerrar:
${items}

Escribe 2-3 oraciones en primera persona plural (como si hablaras en nombre del equipo), tono cercano y de confianza — como un compañero que sabe todo lo que pasó y te da un empujón. En español, sin saludos, sin emojis, sin formalidades. Ve directo al grano con calidez.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || null
  } catch {
    return null
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

/** Send a single email via Resend REST API (no extra npm package needed) */
async function sendEmail({ to, subject, html }) {
  const apiKey = RESEND_API_KEY.value()
  if (!apiKey || !to) return

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: [to], subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn('[meetings] sendEmail failed:', res.status, err)
    }
  } catch (e) {
    console.warn('[meetings] sendEmail error:', e.message)
  }
}

function platformLabel(p) {
  return { google_meet: 'Google Meet', discord: 'Discord', zoom: 'Zoom', manual: 'Manual' }[p] || p
}

function formatMinutes(mins) {
  if (!mins) return ''
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m ? m + 'min' : ''}` : `${m}min`
}

/** Build a clean HTML email for one participant */
function buildMeetingEmail({ meeting, participantName, myItems, allItems, meetingUrl, autoCreatedProjectName = '' }) {
  const durationStr = formatMinutes(meeting.duration)
  const header = `
    <div style="background:#7c3aed;padding:20px 24px;border-radius:12px 12px 0 0">
      <p style="color:#e9d5ff;font-size:12px;margin:0 0 4px">KIMCE AI · Resumen de reunión</p>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">${escHtml(meeting.title)}</h1>
      <p style="color:#ddd6fe;font-size:13px;margin:6px 0 0">
        ${meeting.date}${meeting.time ? ' · ' + meeting.time : ''}${durationStr ? ' · ' + durationStr : ''} · ${platformLabel(meeting.platform)}
      </p>
    </div>`

  const participantsHtml = meeting.participants?.length
    ? `<div style="margin-bottom:20px">
        <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Participantes</p>
        <p style="font-size:14px;color:#374151;margin:0">${meeting.participants.map(p => escHtml(p.name || '')).filter(Boolean).join(' · ')}</p>
      </div>`
    : ''

  const summaryHtml = meeting.summary
    ? `<div style="margin-bottom:20px">
        <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Resumen</p>
        <p style="font-size:14px;color:#374151;margin:0;line-height:1.6">${escHtml(meeting.summary).replace(/\n/g, '<br>')}</p>
      </div>`
    : ''

  const myItemsHtml = myItems.length
    ? `<div style="margin-bottom:20px;background:#faf5ff;border-left:4px solid #7c3aed;padding:16px;border-radius:0 8px 8px 0">
        <p style="font-size:12px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Tus pendientes</p>
        ${myItems.map(item => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
            <span style="color:#7c3aed;font-size:16px;line-height:1.4">●</span>
            <div>
              <p style="font-size:14px;color:#1f2937;margin:0;font-weight:500">${escHtml(item.text)}</p>
              ${item.dueDate ? `<p style="font-size:12px;color:#9ca3af;margin:2px 0 0">Fecha límite: ${item.dueDate}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>`
    : ''

  const otherItems = allItems.filter(i => !myItems.some(m => m.id === i.id))
  const otherItemsHtml = otherItems.length
    ? `<div style="margin-bottom:20px">
        <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Otros pendientes del equipo</p>
        ${otherItems.map(item => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
            <span style="color:#d1d5db;font-size:16px;line-height:1.4">○</span>
            <div>
              <p style="font-size:14px;color:#6b7280;margin:0">${escHtml(item.text)}${item.assignee ? ` <span style="color:#9ca3af">— ${escHtml(item.assignee)}</span>` : ''}</p>
              ${item.dueDate ? `<p style="font-size:12px;color:#9ca3af;margin:2px 0 0">Fecha límite: ${item.dueDate}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>`
    : ''

  const newProjectBanner = autoCreatedProjectName
    ? `<div style="margin-bottom:20px;background:#ecfdf5;border-left:4px solid #16a34a;padding:14px 16px;border-radius:0 8px 8px 0">
        <p style="font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">Nuevo proyecto creado</p>
        <p style="font-size:14px;color:#1f2937;margin:0"><strong>KIMCE AI</strong> creó automáticamente el proyecto <strong>${escHtml(autoCreatedProjectName)}</strong> como prospecto. Revisalo para completar sus detalles.</p>
      </div>`
    : ''

  const actionsHtml = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      <a href="${meetingUrl}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Ver reunión en el portal</a>
      ${meeting.recordingUrl ? `<a href="${escHtml(meeting.recordingUrl)}" style="background:#f3f4f6;color:#374151;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Ver grabación</a>` : ''}
    </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    ${header}
    <div style="padding:24px">
      <p style="font-size:14px;color:#374151;margin:0 0 20px">Todo listo, <strong>${escHtml(participantName || '')}</strong>. Aquí va lo que salió de la reunión de hoy.</p>
      ${newProjectBanner}
      ${participantsHtml}
      ${summaryHtml}
      ${myItemsHtml}
      ${otherItemsHtml}
      ${actionsHtml}
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px">
      <p style="font-size:12px;color:#9ca3af;margin:0">Procesado por <strong>KIMCE AI</strong> · Para cualquier consulta escríbenos a kimcestudio@gmail.com</p>
    </div>
  </div>
</body>
</html>`
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Dispatch per-participant emails after a meeting is saved.
 * Matches participants by name against userDirectory to get emails.
 * Also emails all admins if they're not already listed as participants.
 * Fire-and-forget: errors are logged but don't fail the main flow.
 */
async function dispatchMeetingEmails({ meeting, meetingId, actionItems, teamMap, autoCreatedProjectName = '' }) {
  // teamMap: Map<lowerName, { email, displayName, uid }>
  const meetingUrl = `${PORTAL_URL}/admin/contenidos/reuniones/${meetingId}`

  const pendingItems = actionItems.filter(i => !i.done)

  // Build recipient list: all participants who have an email in the directory
  const recipients = []

  // From participants list in the meeting
  for (const p of (meeting.participants || [])) {
    const key = (p.name || '').toLowerCase().split(' ')[0]
    const match = [...teamMap.entries()].find(([k]) => k.startsWith(key) || key.startsWith(k.split(' ')[0]))
    const email = match ? match[1].email : (p.email || '')
    const name  = match ? match[1].displayName : (p.name || '')
    if (email) recipients.push({ email, name })
  }

  // Add admins not already in the list
  const adminSnap = await db.collection('users').where('role', 'in', ['admin', 'ADMIN']).get()
  for (const doc of adminSnap.docs) {
    const data = doc.data()
    if (data.email && !recipients.some(r => r.email === data.email)) {
      recipients.push({ email: data.email, name: data.displayName || '' })
    }
  }

  for (const r of recipients) {
    const firstName = r.name.split(' ')[0]
    const myItems = pendingItems.filter(i => i.assignee && i.assignee.toLowerCase().includes(firstName.toLowerCase()))

    const html = buildMeetingEmail({
      meeting,
      participantName: r.name,
      myItems,
      allItems: pendingItems,
      meetingUrl,
      autoCreatedProjectName,
    })

    await sendEmail({
      to: r.email,
      subject: `Reunión lista: ${meeting.title} · ${meeting.date}`,
      html,
    })
  }
}

// ── Fireflies helpers ─────────────────────────────────────────────────────────

async function fetchFirefliesTranscript(apiKey, transcriptId) {
  const query = `
    query Transcript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
        summary {
          action_items
          overview
          bullet_gist
        }
        organizer_email
        participants
        meeting_link
      }
    }
  `
  const res = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: transcriptId } }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[fetchFirefliesTranscript] HTTP', res.status, 'id:', transcriptId, 'body:', errBody)
    throw new Error(`Fireflies API error: ${res.status}`)
  }
  const data = await res.json()
  if (data.errors?.length) {
    console.error('[fetchFirefliesTranscript] GraphQL errors:', JSON.stringify(data.errors))
    throw new Error(`Fireflies GraphQL error: ${data.errors[0].message}`)
  }
  return data.data?.transcript || null
}

function normalizeFirefliesMeeting(item) {
  const title = item.title || 'Reunión sin título'

  // date: unix timestamp in seconds or milliseconds
  let startDate
  if (typeof item.date === 'number') {
    startDate = item.date > 1e12 ? new Date(item.date) : new Date(item.date * 1000)
  } else {
    startDate = new Date(item.date || Date.now())
  }
  const { date, time } = limaDateTime(startDate)

  // duration: Fireflies returns seconds
  const duration = item.duration ? Math.round(item.duration / 60) : null

  // Transcript from sentences array
  let transcript = ''
  if (Array.isArray(item.sentences) && item.sentences.length) {
    transcript = item.sentences
      .map(s => `${s.speaker_name || ''}: ${s.text || ''}`.trim())
      .filter(Boolean)
      .join('\n')
  }

  const summary = item.summary?.overview || item.summary?.bullet_gist || ''

  // Action items (can be string[] or string)
  let actionItems = []
  const rawItems = item.summary?.action_items
  if (Array.isArray(rawItems)) {
    actionItems = rawItems.map(i => (typeof i === 'string' ? i : (i.text || '')).trim()).filter(Boolean)
  } else if (typeof rawItems === 'string' && rawItems.trim()) {
    actionItems = rawItems.split(/\n|•/).map(s => s.trim()).filter(Boolean)
  }

  const recordingUrl = item.video_url || item.audio_url || ''

  let participants = []
  // Fireflies API: participants es [String!] — array de emails o nombres
  const INTERNAL_EMAILS = ['fireflies', 'kimcecuentas']
  const rawParticipants = item.participants || item.attendees || []
  if (Array.isArray(rawParticipants)) {
    participants = rawParticipants
      .filter(p => typeof p === 'string' && p && !INTERNAL_EMAILS.some(x => p.toLowerCase().includes(x)))
      .map(p => ({ name: p.includes('@') ? p.split('@')[0] : p, email: p.includes('@') ? p : '' }))
  }

  // Detect platform from meeting_link
  let platform = 'google_meet'
  const link = (item.meeting_link || '').toLowerCase()
  if (link.includes('zoom.us')) platform = 'zoom'
  else if (link.includes('teams.microsoft') || link.includes('teams.live')) platform = 'google_meet' // map Teams→google_meet to reuse icon

  const firefliesId = String(item.id || '')

  return { title, summary, transcript, recordingUrl, firefliesId, date, time, duration, participants, actionItems, platform }
}

// ── HTTP: Fireflies webhook ───────────────────────────────────────────────────

exports.firefliesWebhook = onRequest(
  { region: 'us-central1', secrets: [FIREFLIES_API_KEY, RESEND_API_KEY, ANTHROPIC_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

    try {
      const body = req.body || {}
      console.log('[firefliesWebhook] received body:', JSON.stringify(body))
      // Fireflies sends action + meeting_id on transcript completion
      const transcriptId = body.meeting_id || body.meetingId || body.transcript_id || body.transcriptId
      if (!transcriptId) { res.status(400).json({ error: 'missing meeting_id' }); return }

      // Ignore non-transcription events
      const action = (body.action || '').toLowerCase()
      if (action && !action.includes('transcript')) {
        res.status(200).json({ ok: true, skipped: true }); return
      }

      // Dedup check
      const existing = await db.collection('hubReuniones').where('firefliesId', '==', transcriptId).limit(1).get()
      if (!existing.empty) { res.status(200).json({ ok: true, duplicate: true }); return }

      const apiKey = FIREFLIES_API_KEY.value()
      if (!apiKey) { res.status(500).json({ error: 'FIREFLIES_API_KEY not configured' }); return }

      const item = await fetchFirefliesTranscript(apiKey, transcriptId)
      if (!item) { res.status(404).json({ error: 'transcript not found' }); return }

      const meeting = normalizeFirefliesMeeting(item)

      const teamSnap  = await db.collection('userDirectory').get()
      const teamNames = teamSnap.docs.map(d => d.data().displayName || '').filter(Boolean)
      const teamMap   = new Map(teamSnap.docs.map(d => [
        (d.data().displayName || '').toLowerCase(),
        { email: d.data().email || '', displayName: d.data().displayName || '', uid: d.id },
      ]))

      const proySnap = await db.collection('hubProyectos').where('estado', '==', 'activo').limit(20).get()
      const activeProjects = proySnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre || '' })).filter(p => p.nombre)

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const openSnap = await db.collection('hubReuniones').where('date', '>=', thirtyDaysAgo).get()
      const openPendingItems = openSnap.docs.flatMap(d =>
        (d.data().actionItems || []).filter(i => !i.done).map(i => ({ id: i.id, text: i.text, assignee: i.assignee }))
      )

      const aiResult = await extractActionItemsWithAI(
        meeting.summary, meeting.actionItems, teamNames,
        meeting.transcript, openPendingItems, activeProjects
      )

      let parsedItems, finalSummary
      if (aiResult?.actionItems?.length) {
        parsedItems  = aiResult.actionItems
        finalSummary = aiResult.summary || meeting.summary

        if (aiResult.resolvedItemIds?.length) {
          for (const doc of openSnap.docs) {
            const data = doc.data()
            const updated = (data.actionItems || []).map(i =>
              aiResult.resolvedItemIds.includes(i.id) ? { ...i, done: true } : i
            )
            if (updated.some((i, idx) => i.done !== (data.actionItems[idx]?.done))) {
              await db.collection('hubReuniones').doc(doc.id).update({ actionItems: updated })
            }
          }
        }
      } else {
        parsedItems  = meeting.actionItems.map(raw => parseActionItem(raw, teamNames))
        parsedItems  = await translateActionItems(parsedItems)
        finalSummary = meeting.summary
      }

      let resolvedProyectoId = aiResult?.proyectoId || ''
      let autoCreatedProjectName = ''

      if (!resolvedProyectoId && aiResult?.suggestedNewProject?.nombre) {
        try {
          resolvedProyectoId = await autoCreateProject(aiResult.suggestedNewProject, meeting.date, meeting.title)
          autoCreatedProjectName = aiResult.suggestedNewProject.nombre
        } catch (e) {
          console.warn('[firefliesWebhook] auto-create project error:', e.message)
        }
      }

      const docRef     = db.collection('hubReuniones').doc()
      const actionItems = parsedItems.map((item, i) => ({
        id:         uid(),
        text:       item.text,
        assignee:   item.assignee || '',
        dueDate:    item.dueDate  || '',
        proyectoId: resolvedProyectoId,
        taskId:     '',
        done:       false,
        order:      i,
      }))

      const meetingDoc = {
        id:           docRef.id,
        title:        meeting.title,
        date:         meeting.date,
        time:         meeting.time,
        duration:     meeting.duration,
        platform:     meeting.platform,
        participants: meeting.participants,
        summary:      finalSummary,
        transcript:   meeting.transcript,
        recordingUrl: meeting.recordingUrl,
        fathomId:     '',
        firefliesId:  meeting.firefliesId,
        proyectoId:   resolvedProyectoId,
        projectIds:   resolvedProyectoId ? [resolvedProyectoId] : [],
        actionItems,
        tasksCreated: [],
        source:       'fireflies',
        status:       'pending_review',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:    nowISO(),
      }

      await docRef.set(meetingDoc)

      const adminsSnap = await db.collection('users').where('role', 'in', ['admin', 'ADMIN']).get()
      const notifBatch = db.batch()
      const notifMessage = autoCreatedProjectName
        ? `${meeting.date} · Proyecto "${autoCreatedProjectName}" creado automaticamente`
        : `${meeting.date} · ${parsedItems.length} pendiente${parsedItems.length !== 1 ? 's' : ''} detectado${parsedItems.length !== 1 ? 's' : ''}`
      adminsSnap.docs.forEach(adminDoc => {
        const notifRef = db.collection('notifications').doc()
        notifBatch.set(notifRef, {
          userId:    adminDoc.id,
          type:      'meeting_received',
          title:     `Nueva reunión: ${meeting.title}`,
          message:   notifMessage,
          link:      `/admin/contenidos/reuniones/${docRef.id}`,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
      await notifBatch.commit()

      await dispatchMeetingEmails({ meeting: meetingDoc, meetingId: docRef.id, actionItems, teamMap, autoCreatedProjectName })
        .catch(e => console.error('[firefliesWebhook] email error:', e.message))

      if (resolvedProyectoId) {
        const proyDoc = await db.collection('hubProyectos').doc(resolvedProyectoId).get()
        const currentBrief = proyDoc.data()?.brief || ''
        await updateProjectBrief(resolvedProyectoId, currentBrief,
          { date: meeting.date, title: meeting.title, summary: finalSummary }, actionItems
        ).catch(e => console.warn('[firefliesWebhook] brief update error:', e.message))
      }

      console.log('[firefliesWebhook] saved:', docRef.id, meeting.title)
      res.status(200).json({ ok: true, id: docRef.id })
    } catch (err) {
      console.error('[firefliesWebhook]', err)
      res.status(500).json({ error: 'Internal error' })
    }
  }
)

// ── HTTP: Fathom / Zapier webhook ─────────────────────────────────────────────

exports.fathomWebhook = onRequest(
  { region: 'us-central1', secrets: [WEBHOOK_SECRET, WEBHOOK_SECRET_ASSISTANT, RESEND_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

    // Acepta webhooks de la cuenta principal (kimcestudio) o del asistente (asistentekimce)
    const secretMain      = WEBHOOK_SECRET.value()
    const secretAssistant = WEBHOOK_SECRET_ASSISTANT.value()
    if (secretMain || secretAssistant) {
      const received = req.headers['x-webhook-secret'] || req.headers['x-fathom-secret'] || req.headers['authorization']?.replace('Bearer ', '')
      const valid = (secretMain && received === secretMain) || (secretAssistant && received === secretAssistant)
      if (!valid) { res.status(401).send('Unauthorized'); return }
    }

    try {
      const meeting = normalizeFathomPayload(req.body)

      if (meeting.fathomId) {
        const existing = await db.collection('hubReuniones').where('fathomId', '==', meeting.fathomId).limit(1).get()
        if (!existing.empty) { res.status(200).json({ ok: true, duplicate: true }); return }
      }

      const teamSnap = await db.collection('userDirectory').get()
      const teamNames = teamSnap.docs.map(d => d.data().displayName || '').filter(Boolean)
      const teamMap   = new Map(teamSnap.docs.map(d => [
        (d.data().displayName || '').toLowerCase(),
        { email: d.data().email || '', displayName: d.data().displayName || '', uid: d.id }
      ]))

      let parsedItems = await extractActionItemsWithAI(meeting.summary, meeting.actionItems, teamNames)
      if (!parsedItems) {
        parsedItems = meeting.actionItems.map(raw => parseActionItem(raw, teamNames))
      }

      // Translate action items to Spanish
      parsedItems = await translateActionItems(parsedItems)

      const docRef = db.collection('hubReuniones').doc()
      const now = nowISO()
      const actionItems = parsedItems.map((item, i) => ({
        id: uid(),
        text: item.text,
        assignee: item.assignee || '',
        dueDate: item.dueDate || '',
        taskId: '',
        done: false,
        order: i,
      }))

      const meetingDoc = {
        id: docRef.id,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        duration: meeting.duration,
        platform: 'google_meet',
        participants: meeting.participants,
        summary: meeting.summary,
        transcript: meeting.transcript,
        recordingUrl: meeting.recordingUrl,
        fathomId: meeting.fathomId,
        actionItems,
        tasksCreated: [],
        source: 'fathom',
        status: 'pending_review',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: now,
      }

      await docRef.set(meetingDoc)

      // Notify admins in portal
      const adminsSnap = await db.collection('users').where('role', 'in', ['admin', 'ADMIN']).get()
      const batch = db.batch()
      adminsSnap.docs.forEach(adminDoc => {
        const notifRef = db.collection('notifications').doc()
        batch.set(notifRef, {
          userId: adminDoc.id,
          type: 'meeting_received',
          title: `Nueva reunión: ${meeting.title}`,
          message: `${meeting.date} · ${parsedItems.length} pendiente${parsedItems.length !== 1 ? 's' : ''} detectado${parsedItems.length !== 1 ? 's' : ''}`,
          link: `/admin/contenidos/reuniones/${docRef.id}`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
      await batch.commit()

      // Send per-participant emails (fire-and-forget)
      dispatchMeetingEmails({ meeting: meetingDoc, meetingId: docRef.id, actionItems, teamMap }).catch(e =>
        console.error('[fathomWebhook] email dispatch error:', e.message)
      )

      res.status(200).json({ ok: true, id: docRef.id })
    } catch (err) {
      console.error('[fathomWebhook]', err)
      res.status(500).json({ error: 'Internal error' })
    }
  }
)

// ── Callable: Create tasks from meeting action items ──────────────────────────

exports.meetingCreateTasks = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesión requerida.')

  const callerSnap = await db.collection('users').doc(request.auth.uid).get()
  const callerRole = callerSnap.data()?.role ?? ''
  const isAdmin    = ['admin', 'ADMIN'].includes(callerRole)
  const isTeam     = isAdmin || callerRole === 'collab'

  if (!isTeam) throw new HttpsError('permission-denied', 'Acceso denegado.')

  const { meetingId, items } = request.data ?? {}
  if (!meetingId || !Array.isArray(items) || !items.length) {
    throw new HttpsError('invalid-argument', 'meetingId e items son requeridos.')
  }

  // Collabs can only create tasks assigned to themselves
  const allowedItems = isAdmin
    ? items
    : items.filter(item => item.assigneeUid === request.auth.uid)

  if (!allowedItems.length) {
    throw new HttpsError('permission-denied', 'Solo puedes crear tareas asignadas a ti.')
  }

  const meetingRef = db.collection('hubReuniones').doc(meetingId)
  const meetingSnap = await meetingRef.get()
  if (!meetingSnap.exists) throw new HttpsError('not-found', 'Reunión no encontrada.')

  const meeting = meetingSnap.data()
  const now = nowISO()
  const batch = db.batch()
  const tasksCreated = [...(meeting.tasksCreated || [])]
  const updatedItems = [...(meeting.actionItems || [])]

  for (const item of allowedItems) {
    if (!item.text?.trim()) continue
    const taskRef = db.collection('hubActividades').doc()
    batch.set(taskRef, {
      title: item.text.trim(),
      status: 'pendiente',
      proyectoId: item.proyectoId || null,
      assignee: item.assignee || '',
      assignees: item.assignee ? [item.assignee] : [],
      assigneeIds: item.assigneeIds || [],
      dueDate: item.dueDate || null,
      description: `De la reunión: ${meeting.title} (${meeting.date})`,
      priority: 'normal',
      progress: 0,
      archived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: now,
      updatedBy: request.auth.uid,
      completionSource: 'meeting',
      meetingId,
    })

    tasksCreated.push(taskRef.id)
    const idx = updatedItems.findIndex(ai => ai.id === item.id)
    if (idx !== -1) updatedItems[idx] = { ...updatedItems[idx], taskId: taskRef.id, done: true }

    if (item.assigneeUid) {
      const notifRef = db.collection('notifications').doc()
      batch.set(notifRef, {
        userId: item.assigneeUid,
        type: 'task_from_meeting',
        title: `Nueva tarea de reunión: ${item.text.trim().slice(0, 60)}`,
        message: `Asignada desde la reunión "${meeting.title}" del ${meeting.date}`,
        link: `/app/contenidos/actividades`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  }

  batch.update(meetingRef, {
    tasksCreated,
    actionItems: updatedItems,
    status: 'reviewed',
    updatedAt: now,
  })

  await batch.commit()
  return { ok: true, created: tasksCreated.length }
})

// ── Callable: Create manual meeting ──────────────────────────────────────────

exports.meetingCreate = onCall(
  { region: 'us-central1', secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sesión requerida.')

    const callerSnap = await db.collection('users').doc(request.auth.uid).get()
    if (!['admin', 'ADMIN'].includes(callerSnap.data()?.role)) {
      throw new HttpsError('permission-denied', 'Solo administradores.')
    }

    const { title, date, time, platform, participants, summary, actionItems, recordingUrl } = request.data ?? {}
    if (!title?.trim() || !date) throw new HttpsError('invalid-argument', 'title y date son requeridos.')

    const docRef = db.collection('hubReuniones').doc()
    const now = nowISO()
    const parsedItems = (actionItems || []).map((item, i) => ({
      id: uid(),
      text: typeof item === 'string' ? item : item.text,
      assignee: typeof item === 'object' ? (item.assignee || '') : '',
      dueDate: typeof item === 'object' ? (item.dueDate || '') : '',
      taskId: '',
      done: false,
      order: i,
    }))

    const meetingDoc = {
      id: docRef.id,
      title: title.trim(),
      date,
      time: time || '',
      duration: null,
      platform: platform || 'manual',
      participants: Array.isArray(participants) ? participants : [],
      summary: summary || '',
      transcript: '',
      recordingUrl: recordingUrl || '',
      fathomId: '',
      actionItems: parsedItems,
      tasksCreated: [],
      source: 'manual',
      status: 'pending_review',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: now,
    }

    await docRef.set(meetingDoc)

    // Send per-participant emails (fire-and-forget)
    const teamSnap = await db.collection('userDirectory').get()
    const teamMap  = new Map(teamSnap.docs.map(d => [
      (d.data().displayName || '').toLowerCase(),
      { email: d.data().email || '', displayName: d.data().displayName || '', uid: d.id }
    ]))

    dispatchMeetingEmails({ meeting: meetingDoc, meetingId: docRef.id, actionItems: parsedItems, teamMap }).catch(e =>
      console.error('[meetingCreate] email dispatch error:', e.message)
    )

    return { ok: true, id: docRef.id }
  }
)

// ── Callable: Update meeting ──────────────────────────────────────────────────

exports.meetingUpdate = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesión requerida.')

  const callerSnap = await db.collection('users').doc(request.auth.uid).get()
  if (!['admin', 'ADMIN'].includes(callerSnap.data()?.role)) {
    throw new HttpsError('permission-denied', 'Solo administradores.')
  }

  const { meetingId, ...fields } = request.data ?? {}
  if (!meetingId) throw new HttpsError('invalid-argument', 'meetingId requerido.')

  const allowed = ['title', 'date', 'time', 'platform', 'participants', 'summary', 'transcript', 'recordingUrl', 'actionItems', 'status']
  const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)))
  patch.updatedAt = nowISO()

  await db.collection('hubReuniones').doc(meetingId).update(patch)
  return { ok: true }
})

// ── Scheduled: Weekly digest (lunes 8am Lima = UTC-5 → 13:00 UTC) ────────────

exports.weeklyMeetingDigest = onSchedule(
  { schedule: '0 18 * * 5', region: 'us-central1', secrets: [RESEND_API_KEY, ANTHROPIC_API_KEY], timeZone: 'America/Lima' },
  async () => {
    const apiKey = RESEND_API_KEY.value()
    if (!apiKey) { console.log('[weeklyDigest] RESEND_API_KEY not set, skipping'); return }

    // Get meetings from the last 7 days
    const since = new Date()
    since.setDate(since.getDate() - 7)
    const sinceStr = since.toISOString().slice(0, 10)

    const meetingsSnap = await db.collection('hubReuniones')
      .where('date', '>=', sinceStr)
      .orderBy('date', 'desc')
      .get()

    if (meetingsSnap.empty) return

    const meetings = meetingsSnap.docs.map(d => d.data())

    // Get all team members with emails
    const teamSnap = await db.collection('userDirectory').get()

    for (const teamDoc of teamSnap.docs) {
      const data = teamDoc.data()
      if (!data.email) continue

      const firstName = (data.displayName || '').split(' ')[0].toLowerCase()
      if (!firstName) continue

      // Collect all pending items assigned to this person across meetings
      const myPendingItems = []
      for (const m of meetings) {
        const mine = (m.actionItems || []).filter(i =>
          !i.done && i.assignee && i.assignee.toLowerCase().includes(firstName)
        )
        if (mine.length) {
          myPendingItems.push({ meeting: m, items: mine })
        }
      }

      const aiIntro = myPendingItems.length
        ? await generatePersonalizedDigest(data.displayName || '', myPendingItems, meetings.length)
        : null

      const html = buildWeeklyDigestEmail({
        name: data.displayName || '',
        meetings,
        myPendingItems,
        since: sinceStr,
        aiIntro,
      })

      await sendEmail({
        to: data.email,
        subject: `Tu informe semanal · ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`,
        html,
      })
    }
  }
)

function buildWeeklyDigestEmail({ name, meetings, myPendingItems, since, aiIntro }) {
  const totalPending = myPendingItems.reduce((s, g) => s + g.items.length, 0)

  const mySection = myPendingItems.length
    ? `<div style="margin-bottom:24px;background:#faf5ff;border-left:4px solid #7c3aed;padding:16px;border-radius:0 8px 8px 0">
        <p style="font-size:12px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">
          Tus ${totalPending} pendiente${totalPending !== 1 ? 's' : ''} esta semana
        </p>
        ${myPendingItems.map(g => `
          <p style="font-size:13px;color:#374151;font-weight:600;margin:0 0 6px">${escHtml(g.meeting.title)} · ${g.meeting.date}</p>
          ${g.items.map(i => `
            <div style="display:flex;gap:8px;margin-bottom:6px;padding-left:12px">
              <span style="color:#7c3aed">●</span>
              <p style="font-size:13px;color:#1f2937;margin:0">${escHtml(i.text)}${i.dueDate ? ` <span style="color:#9ca3af">· ${i.dueDate}</span>` : ''}</p>
            </div>`).join('')}
        `).join('<hr style="border:none;border-top:1px dashed #e9d5ff;margin:12px 0">')}
      </div>`
    : `<div style="margin-bottom:24px;background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:0 8px 8px 0">
        <p style="font-size:14px;color:#16a34a;margin:0;font-weight:600">¡Sin pendientes! Semana limpia.</p>
      </div>`

  const meetingsSection = `
    <div style="margin-bottom:24px">
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">
        ${meetings.length} reunión${meetings.length !== 1 ? 'es' : ''} esta semana
      </p>
      ${meetings.map(m => `
        <div style="margin-bottom:10px;padding:12px;background:#f9fafb;border-radius:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <p style="font-size:14px;color:#1f2937;font-weight:600;margin:0">${escHtml(m.title)}</p>
            <p style="font-size:12px;color:#9ca3af;margin:0;white-space:nowrap;margin-left:8px">${m.date}</p>
          </div>
          ${m.summary ? `<p style="font-size:12px;color:#6b7280;margin:4px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(m.summary)}</p>` : ''}
        </div>`).join('')}
    </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#7c3aed;padding:20px 24px">
      <p style="color:#e9d5ff;font-size:12px;margin:0 0 4px">KIMCE AI · Informe semanal</p>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">Tu semana en resumen</h1>
      <p style="color:#ddd6fe;font-size:13px;margin:6px 0 0">Semana del ${since}</p>
    </div>
    <div style="padding:24px">
      ${aiIntro
        ? `<p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">Hola <strong>${escHtml(name)}</strong>, ${escHtml(aiIntro)}</p>`
        : `<p style="font-size:14px;color:#374151;margin:0 0 20px">Hola <strong>${escHtml(name)}</strong>, así cerró tu semana. Te dejo todo en orden.</p>`
      }
      ${mySection}
      ${meetingsSection}
      <a href="${PORTAL_URL}/admin/contenidos/reuniones" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Ver todas las reuniones</a>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px">
      <p style="font-size:12px;color:#9ca3af;margin:0">Este correo fue procesado por <strong>KIMCE AI</strong>.</p>
    </div>
  </div>
</body>
</html>`
}

// ── Fathom API helpers ────────────────────────────────────────────────────────

/** Translate a short text en→es via MyMemory (free, no key) */
async function translateToSpanish(text) {
  if (!text || text.length < 4) return text
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return text
    const data = await res.json()
    if (data.responseStatus !== 200) return text
    return data.responseData?.translatedText || text
  } catch {
    return text
  }
}

/** Translate an array of action item texts in one batched request */
async function translateActionItems(items) {
  if (!items.length) return items
  // Join with a separator unlikely to appear in meeting notes
  const SEP = ' @@@ '
  const joined = items.map(i => i.text).join(SEP)
  if (joined.length > 900) {
    // Too long for one request — translate individually
    return Promise.all(items.map(async item => ({
      ...item, text: await translateToSpanish(item.text),
    })))
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(joined)}&langpair=en|es`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return items
    const data = await res.json()
    if (data.responseStatus !== 200) return items
    const translated = (data.responseData?.translatedText || '').split(SEP)
    if (translated.length !== items.length) return items
    return items.map((item, i) => ({ ...item, text: translated[i].trim() }))
  } catch {
    return items
  }
}

function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Normalize a Fathom /meetings item → internal meeting format
 *  Field names verified against api.fathom.ai/external/v1 response schema.
 */
function normalizeFathomMeeting(item) {
  // Title: prefer meeting_title (calendar title), fall back to title
  const title = item.meeting_title || item.title || 'Reunión sin título'

  // Dates: recording_start/end_time are the actual call times; fall back to scheduled
  const startRaw  = item.recording_start_time || item.scheduled_start_time || item.created_at || null
  const endRaw    = item.recording_end_time   || item.scheduled_end_time   || null
  const startDate = startRaw ? new Date(startRaw) : new Date()
  const endDate   = endRaw   ? new Date(endRaw)   : null
  const { date, time } = limaDateTime(startDate)
  const duration  = endDate ? Math.round((endDate - startDate) / 60000) : (item.duration ?? null)

  // Summary (fetched via include_summary=true or nested object)
  const summaryObj = item.summary || {}
  const rawSummary = typeof summaryObj === 'string'
    ? summaryObj
    : (summaryObj.markdown_formatted || summaryObj.short_summary || summaryObj.overview || summaryObj.text || summaryObj.content || '')
  const summary = stripMarkdown(rawSummary)

  // Transcript (fetched via include_transcript=true)
  let transcript = ''
  if (item.transcript) {
    if (typeof item.transcript === 'string') {
      transcript = item.transcript
    } else if (Array.isArray(item.transcript)) {
      transcript = item.transcript
        .map(seg => `${seg.speaker || seg.name || ''}: ${seg.text || seg.content || ''}`.trim())
        .join('\n')
    }
  }

  // Recording URL: share_url is the public shareable link
  const recordingUrl = item.share_url || item.url || ''

  // Fathom ID: recording_id is the numeric identifier
  const fathomId = String(item.recording_id || item.id || '')

  // Participants: calendar_invitees array with { name, email }
  let participants = []
  const rawAttendees = item.calendar_invitees || item.attendees || item.participants || []
  if (Array.isArray(rawAttendees)) {
    participants = rawAttendees
      .map(a => typeof a === 'string'
        ? { name: a.trim(), email: '' }
        : { name: a.name || a.display_name || a.email?.split('@')[0] || '', email: a.email || '' }
      )
      .filter(p => p.name)
  }

  // Action items (fetched via include_action_items=true)
  let actionItems = []
  const rawItems = item.action_items || []
  if (Array.isArray(rawItems)) {
    actionItems = rawItems
      .map(i => typeof i === 'string' ? i.trim() : (i.text || i.description || i.title || '').trim())
      .filter(Boolean)
  }

  return { title, summary, transcript, recordingUrl, fathomId, date, time, duration, participants, actionItems }
}

/** Fetch all pages from GET /meetings since lastPolledAt */
async function fetchFathomMeetingsSince(apiKey, since) {
  const meetings = []
  let cursor = null

  do {
    const params = new URLSearchParams({
      include_summary:      'true',
      include_action_items: 'true',
      include_transcript:   'true',
    })
    if (since)  params.set('created_after', since)
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${FATHOM_API_BASE}/meetings?${params}`, {
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    })

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 10_000))
      continue
    }
    if (!res.ok) {
      console.error('[fathomPoller] API error:', res.status, await res.text())
      break
    }

    const data = await res.json()
    const items = data.items || data.data || data.meetings || []
    meetings.push(...items)
    cursor = data.next_cursor || null
  } while (cursor)

  return meetings
}

// ── Scheduled: Fathom API poller (every 30 min) ───────────────────────────────

exports.fathomPoller = onSchedule(
  {
    schedule:       'every 5 minutes',
    region:         'us-central1',
    secrets:        [FATHOM_API_KEY, FATHOM_API_KEY_ASSISTANT, RESEND_API_KEY, ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory:         '512MiB',
  },
  async () => {
    const apiKeys = [
      { key: FATHOM_API_KEY.value(),           label: 'kimcestudio',    pollerDoc: 'fathomPoller' },
      { key: FATHOM_API_KEY_ASSISTANT.value(),  label: 'asistentekimce', pollerDoc: 'fathomPollerAssistant' },
    ].filter(a => a.key)

    if (!apiKeys.length) { console.log('[fathomPoller] no API keys set, skipping'); return }

    for (const account of apiKeys) {
      await runFathomPoll(account.key, account.label, account.pollerDoc)
    }
  }
)

async function runFathomPoll(apiKey, label, pollerDoc) {
    const pollerRef  = db.collection('config').doc(pollerDoc)
    const pollerSnap = await pollerRef.get()
    const lastPolledAt = pollerSnap.exists ? pollerSnap.data().lastPolledAt : null

    const since    = lastPolledAt || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const runStart = nowISO()

    console.log(`[fathomPoller:${label}] fetching since`, since)

    let rawMeetings
    try {
      rawMeetings = await fetchFathomMeetingsSince(apiKey, since)
    } catch (e) {
      console.error(`[fathomPoller:${label}] fetch failed:`, e.message)
      return
    }

    if (!rawMeetings.length) {
      await pollerRef.set({ lastPolledAt: runStart, updatedAt: runStart }, { merge: true })
      console.log(`[fathomPoller:${label}] no new meetings`)
      return
    }

    console.log(`[fathomPoller:${label}] found`, rawMeetings.length, 'meetings')

    const teamSnap  = await db.collection('userDirectory').get()
    const teamNames = teamSnap.docs.map(d => d.data().displayName || '').filter(Boolean)
    const teamMap   = new Map(teamSnap.docs.map(d => [
      (d.data().displayName || '').toLowerCase(),
      { email: d.data().email || '', displayName: d.data().displayName || '', uid: d.id },
    ]))

    const proySnap = await db.collection('hubProyectos').where('estado', '==', 'activo').limit(20).get()
    const activeProjects = proySnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre || '' })).filter(p => p.nombre)

    let processed = 0

    for (const rawItem of rawMeetings) {
      const meeting = normalizeFathomMeeting(rawItem)

      if (meeting.fathomId) {
        const existing = await db.collection('hubReuniones')
          .where('fathomId', '==', meeting.fathomId).limit(1).get()
        if (!existing.empty) continue
      }

      // Fetch open pending items for AI context (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const openSnap = await db.collection('hubReuniones')
        .where('date', '>=', thirtyDaysAgo).get()
      const openPendingItems = openSnap.docs.flatMap(d =>
        (d.data().actionItems || []).filter(i => !i.done).map(i => ({ id: i.id, text: i.text, assignee: i.assignee }))
      )

      const aiResult = await extractActionItemsWithAI(
        meeting.summary, meeting.actionItems, teamNames,
        meeting.transcript, openPendingItems, activeProjects
      )

      let parsedItems, finalSummary
      if (aiResult?.actionItems?.length) {
        parsedItems  = aiResult.actionItems
        finalSummary = aiResult.summary || meeting.summary

        // Close resolved items from previous meetings
        if (aiResult.resolvedItemIds?.length) {
          for (const doc of openSnap.docs) {
            const data = doc.data()
            const updated = (data.actionItems || []).map(i =>
              aiResult.resolvedItemIds.includes(i.id) ? { ...i, done: true } : i
            )
            if (updated.some((i, idx) => i.done !== (data.actionItems[idx]?.done))) {
              await db.collection('hubReuniones').doc(doc.id).update({ actionItems: updated })
            }
          }
        }
      } else {
        parsedItems  = meeting.actionItems.map(raw => parseActionItem(raw, teamNames))
        parsedItems  = await translateActionItems(parsedItems)
        finalSummary = meeting.summary
      }

      // Resolve project ID: existing match or auto-create from suggestion
      let resolvedProyectoId = aiResult?.proyectoId || ''
      let autoCreatedProjectName = ''

      if (!resolvedProyectoId && aiResult?.suggestedNewProject?.nombre) {
        try {
          resolvedProyectoId = await autoCreateProject(
            aiResult.suggestedNewProject,
            meeting.date,
            meeting.title
          )
          autoCreatedProjectName = aiResult.suggestedNewProject.nombre
        } catch (e) {
          console.warn('[fathomPoller] auto-create project error:', e.message)
        }
      }

      const docRef     = db.collection('hubReuniones').doc()
      const actionItems = parsedItems.map((item, i) => ({
        id:         uid(),
        text:       item.text,
        assignee:   item.assignee || '',
        dueDate:    item.dueDate  || '',
        proyectoId: resolvedProyectoId,
        taskId:     '',
        done:       false,
        order:      i,
      }))

      const meetingDoc = {
        id:           docRef.id,
        title:        meeting.title,
        date:         meeting.date,
        time:         meeting.time,
        duration:     meeting.duration,
        platform:     'google_meet',
        participants: meeting.participants,
        summary:      finalSummary,
        transcript:   meeting.transcript,
        recordingUrl: meeting.recordingUrl,
        fathomId:     meeting.fathomId,
        proyectoId:   resolvedProyectoId,
        projectIds:   resolvedProyectoId ? [resolvedProyectoId] : [],
        actionItems,
        tasksCreated:  [],
        source:        'fathom',
        status:        'pending_review',
        createdAt:     admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:     nowISO(),
      }

      await docRef.set(meetingDoc)

      // Notificaciones en portal a admins
      const adminsSnap = await db.collection('users').where('role', 'in', ['admin', 'ADMIN']).get()
      const notifBatch = db.batch()
      const notifMessage = autoCreatedProjectName
        ? `${meeting.date} · Proyecto "${autoCreatedProjectName}" creado automaticamente`
        : `${meeting.date} · ${parsedItems.length} pendiente${parsedItems.length !== 1 ? 's' : ''} detectado${parsedItems.length !== 1 ? 's' : ''}`
      adminsSnap.docs.forEach(adminDoc => {
        const notifRef = db.collection('notifications').doc()
        notifBatch.set(notifRef, {
          userId:    adminDoc.id,
          type:      'meeting_received',
          title:     `Nueva reunión: ${meeting.title}`,
          message:   notifMessage,
          link:      `/admin/contenidos/reuniones/${docRef.id}`,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
      await notifBatch.commit()

      // Emails a participantes
      await dispatchMeetingEmails({ meeting: meetingDoc, meetingId: docRef.id, actionItems, teamMap, autoCreatedProjectName })
        .catch(e => console.error('[fathomPoller] email error:', e.message))

      // Update project brief (existing or newly created)
      if (resolvedProyectoId) {
        const proyDoc = await db.collection('hubProyectos').doc(resolvedProyectoId).get()
        const currentBrief = proyDoc.data()?.brief || ''
        await updateProjectBrief(
          resolvedProyectoId, currentBrief,
          { date: meeting.date, title: meeting.title, summary: finalSummary },
          actionItems
        ).catch(e => console.warn('[fathomPoller] brief update error:', e.message))
      }

      processed++
    }

    await pollerRef.set({ lastPolledAt: runStart, updatedAt: runStart, lastProcessed: processed }, { merge: true })
    console.log(`[fathomPoller:${label}] done, processed`, processed, 'new meetings')
}

// ── Callable: Regenerate summary for a meeting with transcript ───────────────

exports.meetingRegenerateSummary = onCall(
  { region: 'us-central1', secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sesión requerida.')
    const { meetingId } = request.data ?? {}
    if (!meetingId) throw new HttpsError('invalid-argument', 'meetingId requerido.')

    const snap = await db.collection('hubReuniones').doc(meetingId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Reunión no encontrada.')
    const meeting = snap.data()

    const transcript = meeting.transcript || ''
    if (!transcript) throw new HttpsError('failed-precondition', 'Esta reunión no tiene transcripción disponible.')

    const apiKey = ANTHROPIC_API_KEY.value()
    if (!apiKey) throw new HttpsError('internal', 'ANTHROPIC_API_KEY no configurado.')

    const prompt = `Eres el asistente de reuniones de KIMCE Studio, agencia creativa en Perú.

Transcripción de la reunión "${meeting.title}" (${meeting.date}):
${transcript.slice(0, 6000)}

Genera SOLO el resumen ejecutivo: 2-3 oraciones en español, directo al punto, sin formato markdown. Solo el texto del resumen.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) throw new HttpsError('internal', 'Error al llamar la IA.')
      const data = await res.json()
      const summary = data.content?.[0]?.text?.trim() || ''
      if (!summary) throw new HttpsError('internal', 'La IA no generó un resumen.')

      await db.collection('hubReuniones').doc(meetingId).update({ summary, updatedAt: nowISO() })
      return { ok: true, summary }
    } catch (e) {
      if (e.code) throw e
      throw new HttpsError('internal', e.message)
    }
  }
)

// ── Callable: Refetch native summary from Fathom / Fireflies ────────────────

exports.meetingRefetchNativeSummary = onCall(
  { region: 'us-central1', secrets: [FATHOM_API_KEY, FATHOM_API_KEY_ASSISTANT, FIREFLIES_API_KEY] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sesión requerida.')
    const { meetingId } = request.data ?? {}
    if (!meetingId) throw new HttpsError('invalid-argument', 'meetingId requerido.')

    const snap = await db.collection('hubReuniones').doc(meetingId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Reunión no encontrada.')
    const meeting = snap.data()

    let nativeSummary = ''
    let fetchSource = 'none'

    if (meeting.source === 'fathom' && meeting.fathomId) {
      // Intentar con la cuenta principal, luego con el asistente
      const apiKey = FATHOM_API_KEY.value() || FATHOM_API_KEY_ASSISTANT.value()
      if (!apiKey) throw new HttpsError('internal', 'FATHOM_API_KEY no configurado.')

      const params = new URLSearchParams({ include_summary: 'true', include_transcript: 'true' })
      try {
        const res = await fetch(`${FATHOM_API_BASE}/meetings/${meeting.fathomId}?${params}`, {
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
        })
        if (res.ok) {
          const raw = await res.json()
          const rawItem = raw.data || raw.meeting || raw
          // Log to debug which field name Fathom uses for the summary
          console.log('[meetingRefetchNativeSummary] Fathom item keys:', Object.keys(rawItem || {}).join(', '))
          console.log('[meetingRefetchNativeSummary] Fathom summary field:', JSON.stringify(rawItem.summary || null).slice(0, 400))
          const normalized = normalizeFathomMeeting(rawItem)
          nativeSummary = normalized.summary
          fetchSource = 'fathom'
        } else {
          const body = await res.text().catch(() => '')
          console.warn('[meetingRefetchNativeSummary] Fathom single-meeting endpoint error', res.status, body.slice(0, 200))
        }
      } catch (e) {
        console.error('[meetingRefetchNativeSummary] Fathom fetch error:', e.message)
      }
    } else if (meeting.source === 'fireflies' && meeting.firefliesId) {
      const apiKey = FIREFLIES_API_KEY.value()
      if (!apiKey) throw new HttpsError('internal', 'FIREFLIES_API_KEY no configurado.')

      try {
        const item = await fetchFirefliesTranscript(apiKey, meeting.firefliesId)
        if (item) {
          const normalized = normalizeFirefliesMeeting(item)
          nativeSummary = normalized.summary
          fetchSource = 'fireflies'
        }
      } catch (e) {
        console.error('[meetingRefetchNativeSummary] Fireflies fetch error:', e.message)
      }
    }

    if (nativeSummary) {
      await db.collection('hubReuniones').doc(meetingId).update({ summary: nativeSummary, updatedAt: nowISO() })
      return { ok: true, summary: nativeSummary, source: fetchSource }
    }

    return { ok: false, summary: '', source: fetchSource, message: 'No hay resumen nativo disponible en la fuente original.' }
  }
)

// ── Callable: Invite Fireflies bot to a live meeting ─────────────────────────

exports.inviteFirefliesBot = onCall(
  { region: 'us-central1', secrets: [FIREFLIES_API_KEY] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sesión requerida.')
    const { meetingLink, title } = request.data ?? {}
    if (!meetingLink) throw new HttpsError('invalid-argument', 'meetingLink requerido.')
    const apiKey = FIREFLIES_API_KEY.value()
    if (!apiKey) throw new HttpsError('internal', 'FIREFLIES_API_KEY no configurado.')

    // Fireflies API: argumentos planos (snake_case), sin wrapper "input"
    const mutation = `
      mutation AddToLiveMeeting($meeting_link: String!, $title: String) {
        addToLiveMeeting(meeting_link: $meeting_link, title: $title) {
          success
          message
        }
      }
    `
    try {
      const res = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { meeting_link: meetingLink, title: title || 'Reunión KIMCE' },
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        const body = await res.text()
        console.warn('[inviteFirefliesBot] HTTP error:', res.status, body)
        return { ok: false, error: `HTTP ${res.status}` }
      }
      const data = await res.json()
      console.log('[inviteFirefliesBot] response:', JSON.stringify(data))
      if (data.errors?.length) {
        console.warn('[inviteFirefliesBot] GraphQL error:', data.errors[0].message)
        return { ok: false, error: data.errors[0].message }
      }
      const result = data.data?.addToLiveMeeting
      return { ok: result?.success ?? false, message: result?.message, code: result?.code }
    } catch (e) {
      console.warn('[inviteFirefliesBot] error:', e.message)
      return { ok: false, error: e.message }
    }
  }
)

// ── Scheduled: Monthly close (every Friday, checks if last of month) ──────────

exports.monthlyMeetingClose = onSchedule(
  { schedule: '0 18 * * 5', region: 'us-central1', secrets: [RESEND_API_KEY, ANTHROPIC_API_KEY], timeZone: 'America/Lima' },
  async () => {
    // Only run on the last Friday of the month
    const today    = new Date()
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)
    if (nextWeek.getMonth() === today.getMonth()) return

    const apiKey = RESEND_API_KEY.value()
    if (!apiKey) return

    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    const snap = await db.collection('hubReuniones')
      .where('date', '>=', firstOfMonth)
      .orderBy('date', 'desc').get()

    if (snap.empty) return

    const meetings     = snap.docs.map(d => d.data())
    const totalItems   = meetings.flatMap(m => m.actionItems || [])
    const closedItems  = totalItems.filter(i => i.done)
    const openItems    = totalItems.filter(i => !i.done)

    // Per-person breakdown
    const teamSnap = await db.collection('userDirectory').get()
    const perPerson = teamSnap.docs.map(d => {
      const name  = d.data().displayName || ''
      const first = name.split(' ')[0].toLowerCase()
      return {
        name,
        open:   openItems.filter(i => i.assignee?.toLowerCase().includes(first)).length,
        closed: closedItems.filter(i => i.assignee?.toLowerCase().includes(first)).length,
      }
    }).filter(p => p.name && (p.open + p.closed) > 0)

    const monthName = today.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

    // AI executive summary
    const anthropicKey = ANTHROPIC_API_KEY.value()
    let aiSummary = ''
    if (anthropicKey) {
      try {
        const prompt = `Eres KIMCE AI. Escribe el cierre de ${monthName} para el equipo de KIMCE Studio.
Datos: ${meetings.length} reuniones, ${totalItems.length} compromisos generados, ${closedItems.length} cerrados, ${openItems.length} aún abiertos.
Equipo: ${perPerson.map(p => `${p.name} (${p.closed} cerrados, ${p.open} abiertos)`).join('; ')}.
2-3 oraciones. Tono cercano y directo — como alguien que estuvo en todas las reuniones y hace un balance honesto. Sin emojis, en español.`
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
        })
        if (res.ok) {
          const data = await res.json()
          aiSummary = data.content?.[0]?.text?.trim() || ''
        }
      } catch { /* fallback gracefully */ }
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#111827;padding:20px 24px">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">KIMCE AI · Cierre mensual</p>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">Resumen de ${monthName}</h1>
    </div>
    <div style="padding:24px">
      <p style="font-size:14px;color:#374151;margin:0 0 20px">Cerramos <strong>${monthName}</strong>. Aquí va el resumen del equipo.</p>
      ${aiSummary ? `<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;padding:16px;background:#f9fafb;border-radius:10px;border-left:4px solid #7c3aed">${escHtml(aiSummary)}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
        <div style="text-align:center;padding:16px;background:#f5f3ff;border-radius:10px">
          <p style="font-size:28px;font-weight:700;color:#7c3aed;margin:0">${meetings.length}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Reuniones</p>
        </div>
        <div style="text-align:center;padding:16px;background:#dcfce7;border-radius:10px">
          <p style="font-size:28px;font-weight:700;color:#16a34a;margin:0">${closedItems.length}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Cerrados</p>
        </div>
        <div style="text-align:center;padding:16px;background:#fef3c7;border-radius:10px">
          <p style="font-size:28px;font-weight:700;color:#d97706;margin:0">${openItems.length}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Pendientes</p>
        </div>
      </div>
      ${perPerson.length ? `
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Por persona</p>
      ${perPerson.sort((a, b) => b.open - a.open).map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-size:14px;color:#1f2937;font-weight:600">${escHtml(p.name)}</span>
          <span style="font-size:12px;color:#6b7280">${p.closed} cerrados · <strong style="color:${p.open > 3 ? '#dc2626' : '#d97706'}">${p.open} abiertos</strong></span>
        </div>`).join('')}` : ''}
      <div style="margin-top:24px">
        <a href="${PORTAL_URL}/admin/contenidos/reuniones" style="display:inline-block;background:#111827;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Ver reuniones del mes</a>
      </div>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px">
      <p style="font-size:12px;color:#9ca3af;margin:0">Este correo fue procesado por <strong>KIMCE AI</strong>.</p>
    </div>
  </div>
</body>
</html>`

    // Send to all admins
    const adminsSnap = await db.collection('users').where('role', 'in', ['admin', 'ADMIN']).get()
    for (const adminDoc of adminsSnap.docs) {
      const email = adminDoc.data().email
      if (email) {
        await sendEmail({
          to: email,
          subject: `Cierre mensual KIMCE · ${monthName}`,
          html,
        })
      }
    }
    console.log('[monthlyClose] sent to', adminsSnap.size, 'admins')
  }
)
