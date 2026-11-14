'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Coffee, LogOut, X } from 'lucide-react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import { formatISODate } from '@/lib/attendanceUtils'

type ReminderType = 'checkin' | 'break' | 'checkout'

interface TodayData {
  checkInAt: string | null
  checkOutAt: string | null
  breaks: { startAt: string; endAt?: string | null }[]
}

const REMINDERS: Record<ReminderType, { icon: typeof Clock; label: string; action: string; bg: string; border: string; text: string }> = {
  checkin: {
    icon: Clock,
    label: 'No has marcado tu entrada hoy.',
    action: 'Marcar entrada',
    bg: '#fef9c3',
    border: '#fbbf24',
    text: '#92400e',
  },
  break: {
    icon: Coffee,
    label: 'Es hora de tu descanso. ¿Ya lo tomaste?',
    action: 'Registrar descanso',
    bg: '#ecfdf5',
    border: '#34d399',
    text: '#065f46',
  },
  checkout: {
    icon: LogOut,
    label: 'No olvides marcar tu salida.',
    action: 'Marcar salida',
    bg: '#fef2f2',
    border: '#f87171',
    text: '#7f1d1d',
  },
}

function dismissKey(type: ReminderType, date: string) {
  return `att_reminder_dismissed_${date}_${type}`
}
function wasDismissed(type: ReminderType, date: string) {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(dismissKey(type, date)) === '1'
}
function setDismissed(type: ReminderType, date: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(dismissKey(type, date), '1')
}

function pickReminder(data: TodayData | null, now: Date, todayISO: string): ReminderType | null {
  const mins = now.getHours() * 60 + now.getMinutes()
  const checkIn = data?.checkInAt ?? null
  const checkOut = data?.checkOutAt ?? null
  const hasBreaks = (data?.breaks?.length ?? 0) > 0

  if (mins >= 8 * 60 && !checkIn && !wasDismissed('checkin', todayISO)) return 'checkin'
  if (mins >= 13 * 60 && mins < 14 * 60 + 30 && checkIn && !checkOut && !hasBreaks && !wasDismissed('break', todayISO)) return 'break'
  if (mins >= 17 * 60 + 30 && checkIn && !checkOut && !wasDismissed('checkout', todayISO)) return 'checkout'
  return null
}

export default function AttendanceReminderBanner() {
  const { authUser, profile } = useAuth()
  const [todayData, setTodayData] = useState<TodayData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissedState] = useState(false)
  const todayISO = formatISODate(new Date())

  const isAdmin = profile?.role?.toLowerCase() === 'admin'

  useEffect(() => {
    if (!authUser?.uid || isAdmin) { setLoaded(true); return }
    const hoursRef = query(
      collection(db, 'users', authUser.uid, 'hours'),
      where('date', '==', todayISO),
    )
    const unsub = onSnapshot(hoursRef, (snap) => {
      const doc = snap.docs[0]
      if (!doc) { setTodayData(null) } else {
        const d = doc.data() as { checkInAt?: string | null; checkOutAt?: string | null; breaks?: { startAt: string; endAt?: string | null }[] }
        setTodayData({
          checkInAt: d.checkInAt ?? null,
          checkOutAt: d.checkOutAt ?? null,
          breaks: Array.isArray(d.breaks) ? d.breaks : [],
        })
      }
      setLoaded(true)
    }, () => setLoaded(true))
    return () => unsub()
  }, [authUser?.uid, isAdmin, todayISO])

  const [activeType, setActiveType] = useState<ReminderType | null>(null)

  const evaluate = useCallback(() => {
    if (!loaded || isAdmin || dismissed) return
    setActiveType(pickReminder(todayData, new Date(), todayISO))
  }, [todayData, loaded, isAdmin, dismissed, todayISO])

  useEffect(() => { evaluate() }, [evaluate])

  useEffect(() => {
    const id = setInterval(evaluate, 60_000)
    return () => clearInterval(id)
  }, [evaluate])

  const handleDismiss = () => {
    if (!activeType) return
    setDismissed(activeType, todayISO)
    setDismissedState(true)
    setTimeout(() => setDismissedState(false), 100)
  }

  if (!authUser || isAdmin || !loaded || !activeType) return null

  const cfg = REMINDERS[activeType]
  const Icon = cfg.icon

  return (
    <div
      role="alert"
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 text-[12px] font-medium"
      style={{ background: cfg.bg, borderBottom: `1.5px solid ${cfg.border}`, color: cfg.text }}
    >
      <span className="flex items-center gap-2">
        <Icon size={14} strokeWidth={2.2} />
        {cfg.label}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <Link
          href="/admin/attendance"
          className="px-3 py-1 rounded-full font-semibold text-[11px] transition-opacity hover:opacity-80"
          style={{ background: cfg.border, color: '#fff' }}
        >
          {cfg.action}
        </Link>
        <button
          aria-label="Cerrar aviso"
          onClick={handleDismiss}
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={13} />
        </button>
      </span>
    </div>
  )
}
