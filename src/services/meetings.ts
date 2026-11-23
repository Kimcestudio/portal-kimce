import { collection, doc, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/services/firebase/client'

const fns = getFunctions(undefined, 'us-central1')

// ── Types ─────────────────────────────────────────────────────────────────────

export type MeetingPlatform = 'google_meet' | 'discord' | 'zoom' | 'manual'
export type MeetingStatus   = 'pending_review' | 'reviewed'
export type MeetingSource   = 'fathom' | 'fireflies' | 'manual'

export interface MeetingParticipant {
  name: string
  email?: string
  uid?: string
}

export interface MeetingActionItem {
  id: string
  text: string
  assignee: string
  assigneeUid?: string
  assigneeIds?: string[]
  dueDate: string
  proyectoId?: string
  taskId: string
  done: boolean
  order: number
}

export interface HubReunion {
  id: string
  title: string
  date: string
  time: string
  duration: number | null
  platform: MeetingPlatform
  participants: MeetingParticipant[]
  summary: string
  fathomSummary?: string
  transcript: string
  recordingUrl: string
  fathomId: string
  firefliesId?: string
  gcalEventId?: string  // links this recording to a Google Calendar event (deduplicates calendar chips)
  actionItems: MeetingActionItem[]
  tasksCreated: string[]
  source: MeetingSource
  status: MeetingStatus
  proyectoId?: string
  projectIds?: string[]
  createdAt: unknown
  updatedAt: string
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function subscribeMeetings(
  cb: (meetings: HubReunion[]) => void,
  options?: { uid?: string; limit?: number }
): Unsubscribe {
  const q = query(collection(db, 'hubReuniones'), orderBy('date', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as HubReunion)))
}

export function subscribeMeeting(id: string, cb: (m: HubReunion | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'hubReuniones', id), snap =>
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as HubReunion) : null)
  )
}

export function subscribeMyMeetings(uid: string, displayName: string, cb: (meetings: HubReunion[]) => void): Unsubscribe {
  const q = query(collection(db, 'hubReuniones'), orderBy('date', 'desc'))
  return onSnapshot(q, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as HubReunion)
    const mine = all.filter(m =>
      m.participants.some(p =>
        (p.uid && p.uid === uid) ||
        (p.name && displayName && p.name.toLowerCase().includes(displayName.toLowerCase().split(' ')[0]))
      )
    )
    cb(mine)
  })
}

// ── Callables ─────────────────────────────────────────────────────────────────

export async function createMeeting(data: {
  title: string
  date: string
  time?: string
  platform: MeetingPlatform
  participants: MeetingParticipant[]
  summary?: string
  actionItems?: Array<{ text: string; assignee?: string; dueDate?: string }>
  recordingUrl?: string
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof data, { ok: boolean; id: string }>(fns, 'meetingCreate')
  const res = await fn(data)
  return { id: res.data.id }
}

export async function updateMeeting(meetingId: string, fields: Partial<HubReunion>): Promise<void> {
  const fn = httpsCallable(fns, 'meetingUpdate')
  await fn({ meetingId, ...fields })
}

export async function createTasksFromMeeting(
  meetingId: string,
  items: Array<{
    id: string
    text: string
    assignee: string
    assigneeUid?: string
    assigneeIds?: string[]
    dueDate?: string
    proyectoId?: string
  }>
): Promise<{ created: number }> {
  const fn = httpsCallable<{ meetingId: string; items: typeof items }, { ok: boolean; created: number }>(fns, 'meetingCreateTasks')
  const res = await fn({ meetingId, items })
  return { created: res.data.created }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDuration(minutes: number | null): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export function platformLabel(p: MeetingPlatform): string {
  return { google_meet: 'Google Meet', discord: 'Discord', zoom: 'Zoom', manual: 'Manual' }[p] ?? p
}

export function platformColor(p: MeetingPlatform): string {
  return {
    google_meet: 'bg-blue-100 text-blue-700',
    discord:     'bg-indigo-100 text-indigo-700',
    zoom:        'bg-sky-100 text-sky-700',
    manual:      'bg-slate-100 text-slate-600',
  }[p] ?? 'bg-slate-100 text-slate-600'
}

export async function regenerateSummary(meetingId: string): Promise<{ ok: boolean; summary: string }> {
  const fn = httpsCallable<{ meetingId: string }, { ok: boolean; summary: string }>(fns, 'meetingRegenerateSummary')
  const res = await fn({ meetingId })
  return res.data
}

export async function refetchNativeSummary(meetingId: string): Promise<{ ok: boolean; summary: string; source: string; message?: string }> {
  const fn = httpsCallable<{ meetingId: string }, { ok: boolean; summary: string; source: string; message?: string }>(fns, 'meetingRefetchNativeSummary')
  const res = await fn({ meetingId })
  return res.data
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'hubReuniones', meetingId))
}

export async function inviteFirefliesBot(data: {
  meetingLink: string
  title?: string
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const fn = httpsCallable<typeof data, { ok: boolean; message?: string; error?: string }>(fns, 'inviteFirefliesBot')
  const res = await fn(data)
  return res.data
}

export const WEBHOOK_URL = 'https://us-central1-kimce-app.cloudfunctions.net/fathomWebhook'
