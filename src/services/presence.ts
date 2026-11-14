'use client'
import { useEffect, useRef } from 'react'
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db, app } from '@/services/firebase/client'

export type PresenceStatusLabel = 'disponible' | 'en_reunion' | 'concentrado' | 'fuera'

export const PRESENCE_LABELS: Record<PresenceStatusLabel, string> = {
  disponible:   'Disponible',
  en_reunion:   'En reunión',
  concentrado:  'Concentrado',
  fuera:        'Fuera',
}

export const PRESENCE_COLORS: Record<PresenceStatusLabel, string> = {
  disponible:  '#22c55e',
  en_reunion:  '#f59e0b',
  concentrado: '#6366f1',
  fuera:       '#94a3b8',
}

function now() { return new Date().toISOString() }

/** Writes presence heartbeat to userDirectory/{uid} every 60s. */
export function useMyPresence(uid: string | null | undefined, initialStatus: PresenceStatusLabel = 'disponible') {
  const statusRef = useRef<PresenceStatusLabel>(initialStatus)

  useEffect(() => {
    if (!uid) return
    const ref = doc(db, 'userDirectory', uid)

    // Mark online immediately
    try { updateDoc(ref, { onlineStatus: 'online', lastSeenAt: now(), presenceStatus: statusRef.current }).catch(() => {}) } catch { /* Firestore SDK state race */ }

    // Heartbeat every 60s
    const timer = setInterval(() => {
      try { updateDoc(ref, { onlineStatus: 'online', lastSeenAt: now() }).catch(() => {}) } catch { /* Firestore SDK state race */ }
    }, 60_000)

    // Mark offline on unmount / tab close
    function markOffline() {
      try { updateDoc(ref, { onlineStatus: 'offline', lastSeenAt: now(), currentSala: null }).catch(() => {}) } catch { /* Firestore SDK state race */ }
    }

    window.addEventListener('beforeunload', markOffline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', markOffline)
      markOffline()
    }
  }, [uid])

  function setStatus(uid: string, status: PresenceStatusLabel) {
    statusRef.current = status
    updateDoc(doc(db, 'userDirectory', uid), { presenceStatus: status, lastSeenAt: now() }).catch(() => {})
  }

  return { setStatus }
}

export type SalasConfig = {
  general:    string
  diseno:     string
  cm:         string
  estrategia: string
  audiovisual:string
}

export const SALAS_DEFAULT: SalasConfig = {
  general:     '',
  diseno:      '',
  cm:          '',
  estrategia:  '',
  audiovisual: '',
}

export const SALA_LABELS: Record<keyof SalasConfig, string> = {
  general:     'Sala General',
  diseno:      'Sala Diseño',
  cm:          'Sala CM',
  estrategia:  'Sala Estrategia',
  audiovisual: 'Sala Audiovisual',
}

/** Maps TeamCategory → SalasConfig key */
export const CATEGORY_TO_SALA: Record<string, keyof SalasConfig> = {
  'Diseño':      'diseno',
  'CM':          'cm',
  'Estrategia':  'estrategia',
  'Audiovisual': 'audiovisual',
}

export function subscribeSalasConfig(cb: (cfg: SalasConfig) => void) {
  let unsub: (() => void) | null = null
  const auth = getAuth(app)

  const unsubAuth = auth.onAuthStateChanged(user => {
    if (unsub) { unsub(); unsub = null }
    if (!user) return
    unsub = onSnapshot(
      doc(db, 'config', 'salas'),
      snap => {
        if (snap.exists()) cb({ ...SALAS_DEFAULT, ...(snap.data() as Partial<SalasConfig>) })
        else cb(SALAS_DEFAULT)
      },
      () => cb(SALAS_DEFAULT),
    )
  })

  return () => {
    unsubAuth()
    if (unsub) unsub()
  }
}

export async function saveSalasConfig(cfg: SalasConfig) {
  const { setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'config', 'salas'), cfg)
}

export function setCurrentSala(uid: string, salaKey: keyof SalasConfig | null) {
  updateDoc(doc(db, 'userDirectory', uid), {
    currentSala: salaKey ?? null,
    currentSalaJoinedAt: salaKey ? new Date().toISOString() : null,
  }).catch(() => {})
}
