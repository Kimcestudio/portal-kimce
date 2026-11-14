'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Bell, CheckCheck, Maximize2 } from 'lucide-react'
import {
  collection, query, where, orderBy, limit, onSnapshot,
  updateDoc, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { AppNotification } from '@/cmhub/types'
import { GROUP_COLOR, notifGroup, timeAgo, toDate } from '@/cmhub/notifications'
import NotificationsModal from './NotificationsModal'

interface Props {
  uid: string
  isDark: boolean
}

// Un solo AudioContext reutilizado — crear uno por notificación es innecesario y
// algunos navegadores limitan cuántos se pueden instanciar.
let sharedAudioCtx: AudioContext | null = null
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedAudioCtx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      sharedAudioCtx = new Ctx()
    }
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume()
    return sharedAudioCtx
  } catch {
    return null
  }
}

// Campanita sintetizada (dos tonos ascendentes) — sin depender de un archivo de audio externo.
function playChime() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  ;[880, 1318.5].forEach((freq, i) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t0 = now + i * 0.11
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.32)
  })
}

export default function NotificationBell({ uid, isDark }: Props) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [ringing, setRinging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // null = todavía no llegó el primer snapshot; evita sonar/animar con las notificaciones
  // que ya existían al cargar la página, solo con las que llegan después, en vivo.
  const knownIdsRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!uid) return
    knownIdsRef.current = null
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
      const prevIds = knownIdsRef.current
      if (prevIds && next.some((n) => !n.read && !prevIds.has(n.id))) {
        playChime()
        setRinging(true)
        setTimeout(() => setRinging(false), 700)
      }
      knownIdsRef.current = new Set(next.map((n) => n.id))
      setItems(next)
    }, (err) => console.error('[NotificationBell]', err))
    return () => { try { unsub() } catch { /* Firestore SDK state race on unmount */ } }
  }, [uid])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const PANEL_WIDTH = 320

  const toggle = useCallback(() => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const left = Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8)
      setPos({ top: r.bottom + 6, left: Math.max(8, left) })
    }
    setOpen((o) => !o)
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
    <div className="relative shrink-0">
      <style>{`
        @keyframes notifBellRing {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-16deg); }
          30% { transform: rotate(14deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(7deg); }
          75% { transform: rotate(-3deg); }
        }
        @keyframes notifBadgePop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Notificaciones"
        className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
        style={{
          color: isDark ? '#94a3b8' : '#6b7280',
          animation: ringing ? 'notifBellRing 0.6s ease' : undefined,
          transformOrigin: 'top center',
        }}
      >
        <Bell size={13} />
        {unread.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
            style={{ background: '#ef4444', animation: ringing ? 'notifBadgePop 0.4s ease' : undefined }}
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, background: cardBg, borderColor: border }}
          className="w-80 max-w-[92vw] rounded-2xl shadow-2xl border overflow-hidden z-[300]"
        >
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-[13px] font-bold flex-1" style={{ color: text }}>Notificaciones</span>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                style={{ color: '#7c3aed' }}
              >
                <CheckCheck size={11} /> Marcar todas
              </button>
            )}
            <button
              onClick={() => { setShowAll(true); setOpen(false) }}
              title="Ver todas — vista ampliada"
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
              style={{ color: sub }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hover }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Maximize2 size={12} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px]" style={{ color: sub }}>
                Sin notificaciones por ahora.
              </div>
            )}
            {items.map((n) => {
              const group = notifGroup(n)
              const color = GROUP_COLOR[group]
              return (
              <Link
                key={n.id}
                href={n.link ?? '#'}
                target={n.link?.startsWith('https://meet.google.com') ? '_blank' : undefined}
                rel={n.link?.startsWith('https://meet.google.com') ? 'noopener' : undefined}
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
                  style={{ background: color }}
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
                      style={{ background: `${color}22`, color }}
                    >
                      {group}
                    </span>
                    <span className="text-[10px]" style={{ color: sub }}>{timeAgo(toDate(n.createdAt))}</span>
                  </div>
                </div>
              </Link>
              )
            })}
          </div>
        </div>,
        document.body,
      )}

      {showAll && (
        <NotificationsModal items={items} isDark={isDark} onClose={() => setShowAll(false)} />
      )}
    </div>
  )
}
