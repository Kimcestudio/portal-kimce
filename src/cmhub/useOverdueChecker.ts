'use client'
import { useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { TareaD, HubActividad } from './types'

function todayISO() { return new Date().toISOString().split('T')[0] }

function daysOverdue(dateISO: string): number {
  const diff = new Date(todayISO()).getTime() - new Date(dateISO).getTime()
  return Math.floor(diff / 86_400_000)
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function sameName(a: string | undefined | null, b: string) {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

interface Params {
  uid: string | null | undefined
  userName: string | null | undefined
  tareasD: TareaD[]
  actividades: HubActividad[]
  hubBase: string
}

export function useOverdueChecker({ uid, userName, tareasD, actividades, hubBase }: Params) {
  // Track the last date we ran the check so we don't re-run on every render.
  const lastRunRef = useRef<string | null>(null)

  useEffect(() => {
    if (!uid || !userName) return

    const today = todayISO()
    // One pass per day per session
    if (lastRunRef.current === today) return
    lastRunRef.current = today

    async function check() {
      const name = userName!

      // ── Tareas diarias vencidas ────────────────────────────────────────────
      const tareasVencidas = tareasD.filter(t =>
        !t.hecha &&
        t.fechaLimite &&
        t.fechaLimite < today &&
        sameName(t.editor, name)
      )

      // ── Actividades vencidas ───────────────────────────────────────────────
      const actsVencidas = actividades.filter(a =>
        a.status !== 'completado' &&
        a.dueDate &&
        a.dueDate < today &&
        (sameName(a.assignee, name) || a.assignees?.some(x => sameName(x, name)))
      )

      const writes: Promise<void>[] = []

      for (const t of tareasVencidas) {
        const notifId = `overdue_task_${t.id}_${today}`
        const ref = doc(db, 'notifications', notifId)
        writes.push(
          getDoc(ref).then(snap => {
            if (snap.exists()) return
            const dias = daysOverdue(t.fechaLimite!)
            return setDoc(ref, {
              userId: uid,
              type: 'task_overdue',
              category: 'Vencidos',
              title: '⚠️ Tarea vencida',
              message: `"${t.texto}" venció el ${fmtDate(t.fechaLimite!)} — hace ${dias} día${dias !== 1 ? 's' : ''}`,
              link: `${hubBase}/tareas-diarias`,
              contentId: t.contentId ?? null,
              brandId: t.brandId ?? null,
              actividadId: null,
              read: false,
              createdAt: serverTimestamp(),
            })
          }).then(() => {})
        )
      }

      for (const a of actsVencidas) {
        const notifId = `overdue_act_${a.id}_${today}`
        const ref = doc(db, 'notifications', notifId)
        writes.push(
          getDoc(ref).then(snap => {
            if (snap.exists()) return
            const dias = daysOverdue(a.dueDate!)
            return setDoc(ref, {
              userId: uid,
              type: 'activity_overdue',
              category: 'Vencidos',
              title: '⚠️ Actividad vencida',
              message: `"${a.title}" venció el ${fmtDate(a.dueDate!)} — hace ${dias} día${dias !== 1 ? 's' : ''}`,
              link: `${hubBase}/actividades`,
              contentId: null,
              brandId: null,
              actividadId: a.id,
              read: false,
              createdAt: serverTimestamp(),
            })
          }).then(() => {})
        )
      }

      await Promise.all(writes)
    }

    check().catch(err => console.error('[useOverdueChecker]', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, userName, tareasD.length, actividades.length])
}
