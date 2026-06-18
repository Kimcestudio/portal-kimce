'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import {
  collection, query, where, orderBy, limit, onSnapshot,
  updateDoc, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { AppNotification } from '@/cmhub/types'

interface Props {
  uid: string
  isDark: boolean
}

const CATEGORY_COLOR: Record<string, string> = {
  'Diseño': '#ec4899',
  'Audiovisual': '#f97316',
  'Estrategia': '#6366f1',
  'Actividad': '#16a34a',
}

function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function toDate(createdAt: unknown): Date {
  if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
    return (createdAt as { toDate: () => Date }).toDate()
  }
  return new Date()
}

export default function NotificationBell({ uid, isDark }: Props) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)))
    }, (err) => console.error('[NotificationBell]', err))
    return () => unsub()
  }, [uid])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const unread = items.filter((n) => !n.read)

  async function markRead(n: AppNotification) {
    if (n.read) return
    try { await updateDoc(doc(db, 'notifications', n.id), { read: true }) } catch (e) { console.error(e) }
  }

  async function markAllRead() {
    if (unread.length === 0) return
    try {
      const batch = writeBatch(db)
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }))
      await batch.commit()
    } catch (e) { console.error(e) }
  }

  const cardBg = isDark ? '#161820' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb'
  const text = isDark ? '#e2e8f0' : '#111827'
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const hover = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notificaciones"
        className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
        style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
      >
        <Bell size={13} />
        {unread.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
            style={{ background: '#ef4444' }}
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-80 rounded-2xl shadow-2xl border overflow-hidden z-[300]"
          style={{ background: cardBg, borderColor: border }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-[13px] font-bold" style={{ color: text }}>Notificaciones</span>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                style={{ color: '#7c3aed' }}
              >
                <CheckCheck size={11} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px]" style={{ color: sub }}>
                Sin notificaciones por ahora.
              </div>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? '#'}
                onClick={() => { markRead(n); setOpen(false) }}
                className="flex gap-2.5 px-4 py-3 transition-colors cursor-pointer"
                style={{
                  background: n.read ? 'transparent' : (isDark ? 'rgba(124,58,237,0.08)' : '#f5f3ff'),
                  borderBottom: `1px solid ${border}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hover }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : (isDark ? 'rgba(124,58,237,0.08)' : '#f5f3ff') }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: CATEGORY_COLOR[n.category] ?? '#9ca3af' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold truncate" style={{ color: text }}>{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />}
                  </div>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: sub }}>{n.message}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: `${CATEGORY_COLOR[n.category] ?? '#9ca3af'}22`, color: CATEGORY_COLOR[n.category] ?? '#9ca3af' }}
                    >
                      {n.category}
                    </span>
                    <span className="text-[10px]" style={{ color: sub }}>{timeAgo(toDate(n.createdAt))}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
