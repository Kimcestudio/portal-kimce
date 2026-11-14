import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { WorkLog, WorkLogTipo } from '@/cmhub/types'

const COL = 'cmhub_worklogs'

function tsMillis(ts: unknown): number {
  if (!ts) return 0
  const t = ts as { toMillis?: () => number; seconds?: number }
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.seconds === 'number') return t.seconds * 1000
  return 0
}

function fromDoc(d: { id: string; data: () => Record<string, unknown> }): WorkLog {
  const data = d.data()
  return {
    id: d.id,
    userId:           (data.userId           as string) ?? '',
    userDisplayName:  (data.userDisplayName  as string) ?? '',
    date:             (data.date             as string) ?? '',
    tipo:             (data.tipo             as WorkLogTipo) ?? 'otro',
    titulo:           (data.titulo           as string) ?? '',
    descripcion:      (data.descripcion      as string | undefined),
    brandId:          (data.brandId          as string | undefined),
    minutosEstimados: (data.minutosEstimados as number | undefined),
    minutosReales:    (data.minutosReales    as number | undefined),
    completado:       (data.completado       as boolean) ?? false,
    completadoAt:     (data.completadoAt     as string | null | undefined),
    startedAt:        (data.startedAt        as string | null | undefined),
    recurrencia:      (data.recurrencia      as WorkLog['recurrencia']),
    diaSemana:        (data.diaSemana        as number | undefined),
    orden:            (data.orden            as number | undefined),
    overdueFrom:      (data.overdueFrom      as string | undefined),
    createdAt:        data.createdAt,
  }
}

function sortByCreatedAt(logs: WorkLog[]): WorkLog[] {
  return [...logs].sort((a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt))
}

/** Suscripción en tiempo real a los worklogs de un colaborador para una fecha YYYY-MM-DD */
export function subscribeWorkLogs(
  userId: string,
  date: string,
  onData: (logs: WorkLog[]) => void,
  onError?: (err: Error) => void,
): () => void {
  // Sin orderBy para evitar requerir índice compuesto — se ordena en cliente
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    where('date', '==', date),
  )
  return onSnapshot(
    q,
    snap => onData(sortByCreatedAt(snap.docs.map(d => fromDoc({ id: d.id, data: () => d.data() as Record<string, unknown> })))),
    err => { console.error('[subscribeWorkLogs]', err); onError?.(err) },
  )
}

/** Suscripción a worklogs de un colaborador para múltiples fechas (Próximo en Mi día) */
export function subscribeWorkLogsByDates(
  userId: string,
  dates: string[],
  onData: (logs: WorkLog[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (dates.length === 0) { onData([]); return () => {} }
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    where('date', 'in', dates),
  )
  return onSnapshot(
    q,
    snap => onData(sortByCreatedAt(snap.docs.map(d => fromDoc({ id: d.id, data: () => d.data() as Record<string, unknown> })))),
    err => { console.error('[subscribeWorkLogsByDates]', err); onError?.(err) },
  )
}

/** Suscripción a worklogs de varios colaboradores para una fecha (vista admin) */
export function subscribeWorkLogsByDate(
  date: string,
  onData: (logs: WorkLog[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where('date', '==', date),
  )
  return onSnapshot(
    q,
    snap => onData(sortByCreatedAt(snap.docs.map(d => fromDoc({ id: d.id, data: () => d.data() as Record<string, unknown> })))),
    err => { console.error('[subscribeWorkLogsByDate]', err); onError?.(err) },
  )
}

/** Crea un nuevo worklog */
export async function addWorkLog(
  payload: Omit<WorkLog, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...payload,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

/** Actualiza campos parciales de un worklog */
export async function updateWorkLog(
  id: string,
  patch: Partial<Omit<WorkLog, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), patch as Record<string, unknown>)
}

/** Marca como completado y registra tiempo real */
export async function completeWorkLog(id: string, minutosReales?: number): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    completado: true,
    completadoAt: new Date().toISOString(),
    ...(minutosReales !== undefined ? { minutosReales } : {}),
    startedAt: null,
  })
}

/** Reinicia a pendiente */
export async function uncompleteWorkLog(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    completado: false,
    completadoAt: null,
  })
}

/** Inicia el timer en vivo */
export async function startTimer(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { startedAt: new Date().toISOString() })
}

/** Detiene el timer y acumula minutos reales */
export async function stopTimer(log: WorkLog): Promise<void> {
  if (!log.startedAt) return
  const elapsed = Math.round((Date.now() - new Date(log.startedAt).getTime()) / 60000)
  const prev = log.minutosReales ?? 0
  await updateDoc(doc(db, COL, log.id), {
    startedAt: null,
    minutosReales: prev + elapsed,
  })
}

/** Elimina un worklog */
export async function deleteWorkLog(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

/**
 * Detecta tareas incompletas de días pasados y las mueve a hoy,
 * marcándolas con overdueFrom = fecha original.
 * Se llama una vez al abrir Mi día.
 */
export async function rescueOverdueTasks(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const snap = await getDocs(
    query(collection(db, COL), where('userId', '==', userId), where('completado', '==', false))
  )
  const updates: Promise<void>[] = []
  snap.docs.forEach(d => {
    const date = d.data().date as string | undefined
    if (!date || date >= today || date === '__backlog__') return
    updates.push(
      updateDoc(doc(db, COL, d.id), {
        date: today,
        overdueFrom: (d.data().overdueFrom as string | undefined) ?? date,
      })
    )
  })
  await Promise.all(updates)
}
