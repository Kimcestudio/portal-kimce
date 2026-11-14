'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Megaphone, Zap, Users, Radio, BrainCircuit, LogOut, Video, Check, X, CalendarPlus, PhoneCall, Phone, Search, ChevronDown, ChevronRight, Loader, Settings } from 'lucide-react'
import { listPersonalEvents, createPersonalMeeting, type PersonalGCalEvent } from '@/services/googleCalendarOAuth'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import {
  doc, onSnapshot, setDoc, addDoc, collection, updateDoc,
  serverTimestamp, query, orderBy, limit, where,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import {
  useMyPresence, setCurrentSala,
  subscribeSalasConfig, saveSalasConfig,
  PRESENCE_LABELS, PRESENCE_COLORS, CATEGORY_TO_SALA, SALA_LABELS,
  type PresenceStatusLabel, type SalasConfig,
} from '@/services/presence'
import { gcalCreateEvent } from '@/services/googleCalendar'
import type { TeamMember } from '@/cmhub/types'

function playCallSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const freqs = [659, 784, 988]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.14
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.start(t); osc.stop(t + 0.28)
    })
  } catch { /* navegador sin AudioContext */ }
}

// ── Presencia ─────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<PresenceStatusLabel, React.ReactNode> = {
  disponible:  <Radio   size={11} />,
  en_reunion:  <Users   size={11} />,
  concentrado: <BrainCircuit size={11} />,
  fuera:       <LogOut  size={11} />,
}

// kept for Chat sidebar
function MemberDot({ m, size = 8 }: { m: TeamMember; size?: number }) {
  const color = m.isOnline
    ? (PRESENCE_COLORS[m.presenceStatus ?? 'disponible'])
    : '#cbd5e1'
  return (
    <span
      className="rounded-full border-2 border-white shrink-0"
      style={{ width: size, height: size, background: color, display: 'inline-block' }}
    />
  )
}

function PersonCard({ m, isDark, isMe, onCall, onInvite }: {
  m: TeamMember; isDark: boolean; isMe: boolean
  onCall: () => void; onInvite: () => void
}) {
  const [hover, setHover] = useState(false)
  const statusColor = m.isOnline ? PRESENCE_COLORS[m.presenceStatus ?? 'disponible'] : (isDark ? '#475569' : '#c4c4c6')
  const statusLabel = m.isOnline ? PRESENCE_LABELS[m.presenceStatus ?? 'disponible'] : 'Sin conexión'
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const textC = isDark ? '#f1f5f9' : '#111827'
  const bg = isDark ? '#161820' : '#fff'

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 12, background: hover ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent', transition: 'background 0.12s' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(145deg, ${m.color}, ${m.color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
          {m.initials}
        </div>
        <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', border: `2px solid ${bg}`, background: statusColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: textC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
          {isMe && <span style={{ fontSize: 9, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '1px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>tú</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          {m.isOnline && <span style={{ flexShrink: 0, fontSize: 11, color: statusColor }}>{STATUS_ICONS[m.presenceStatus ?? 'disponible']}</span>}
          <span style={{ fontSize: 11.5, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>
      {!isMe && (
        <div style={{ display: 'flex', gap: 6, opacity: hover ? 1 : 0.25, transition: 'opacity 0.15s' }}>
          <button onClick={onCall} title="Llamar"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f5', color: sub }}>
            <Phone size={14} />
          </button>
          <button onClick={onInvite} title="Reunión"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7c3aed', color: '#fff', boxShadow: hover ? '0 2px 8px rgba(124,58,237,0.3)' : 'none' }}>
            <Video size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function PersonRow({ m, isDark, isMe, onCall, onInvite, creatingMeet }: {
  m: TeamMember; isDark: boolean; isMe: boolean
  onCall: () => void; onInvite: () => void; creatingMeet?: boolean
}) {
  const [hover, setHover] = useState(false)
  const statusColor = m.isOnline ? PRESENCE_COLORS[m.presenceStatus ?? 'disponible'] : (isDark ? '#475569' : '#c4c4c6')
  const statusLabel = m.isOnline ? PRESENCE_LABELS[m.presenceStatus ?? 'disponible'] : 'Sin conexión'
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const textC = isDark ? '#f1f5f9' : '#111827'

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '18px 10px 14px', gap: 8,
        borderRadius: 18,
        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#ebebeb'}`,
        background: isDark ? '#161820' : '#fff',
        boxShadow: hover
          ? (isDark ? '0 8px 28px rgba(0,0,0,0.3)' : '0 8px 28px rgba(0,0,0,0.1)')
          : (isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)'),
        transition: 'all 0.2s', textAlign: 'center', cursor: 'default',
      }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 62, height: 62, borderRadius: '50%',
          background: `linear-gradient(145deg, ${m.color}, ${m.color}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#fff',
          boxShadow: `0 4px 14px ${m.color}44`,
        }}>
          {m.initials}
        </div>
        <span style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 13, height: 13, borderRadius: '50%',
          border: `2.5px solid ${isDark ? '#161820' : '#fff'}`,
          background: statusColor,
        }} />
      </div>
      <div style={{ width: '100%', minHeight: 52 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: textC, lineHeight: 1.35,
            display: '-webkit-box' as React.CSSProperties['display'],
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as 'vertical',
            overflow: 'hidden', wordBreak: 'break-word', textAlign: 'center' }}>{m.name}</span>
          {isMe && <span style={{ fontSize: 9, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '1px 5px', borderRadius: 5, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>tú</span>}
        </div>
        <span style={{ fontSize: 11, color: statusColor, display: 'block', marginTop: 2, textAlign: 'center' }}>{statusLabel}</span>
      </div>
      {!isMe && (
        <div style={{ display: 'flex', gap: 7, opacity: hover ? 1 : 0.35, transition: 'opacity 0.15s' }}>
          <button onClick={onCall} title="Llamar"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.08)' : '#f4f6fb', color: sub }}>
            <Phone size={13} />
          </button>
          <button onClick={onInvite} title="Reunión con Fireflies" disabled={creatingMeet}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: creatingMeet ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7c3aed', color: '#fff', opacity: creatingMeet ? 0.7 : 1 }}>
            {creatingMeet ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={13} />}
          </button>
        </div>
      )}
    </div>
  )
}

function AreaSection({
  salaKey, areaLabel, areaColor, members, meetLink, myUid, myArea, isDark,
  meetNowTarget, onGroupCall, onCallPerson, onMeetNow,
}: {
  salaKey: keyof SalasConfig; areaLabel: string; areaColor: string
  members: TeamMember[]; meetLink: string; myUid: string | null; myArea: string | undefined; isDark: boolean
  meetNowTarget: string | null
  onGroupCall: (salaKey: keyof SalasConfig) => void
  onCallPerson: (m: TeamMember) => void
  onMeetNow: (m: TeamMember) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const online = members.filter(m => m.isOnline).length
  const isMyArea = myArea && CATEGORY_TO_SALA[myArea] === salaKey
  const showGroupCall = members.length > 1 && meetLink
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const iconSm = { width: 24, height: 24, borderRadius: '50%' as const, border: 'none', cursor: 'pointer' as const, display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', cursor: 'pointer', borderRadius: 10, userSelect: 'none' as const }}>
        <ChevronRight size={13} color={sub} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: areaColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{areaLabel}</span>
        <span style={{ fontSize: 11, color: sub }}>{members.length}</span>
        {online > 0 && <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>{online} online</span>}
        {isMyArea && <span style={{ fontSize: 10, color: areaColor, fontWeight: 700 }}>tu área</span>}
        <div style={{ flex: 1 }} />
        {showGroupCall && (
          <button onClick={e => { e.stopPropagation(); onGroupCall(salaKey) }} title="Llamada grupal"
            style={{ ...iconSm, background: `${areaColor}18`, color: areaColor }}>
            <Phone size={11} />
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${members.length}, 1fr)`, gap: 10, padding: '6px 10px 16px' }}>
          {members.map(m => (
            <PersonRow key={m.id} m={m} isDark={isDark} isMe={m.id === myUid}
              onCall={() => onCallPerson(m)} onInvite={() => onMeetNow(m)}
              creatingMeet={meetNowTarget === m.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProximasReuniones({ isDark, onSchedule }: { isDark: boolean; onSchedule: () => void }) {
  const [events, setEvents] = useState<PersonalGCalEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const textC = isDark ? '#f1f5f9' : '#111827'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'

  useEffect(() => {
    const now = new Date().toISOString()
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    listPersonalEvents({ timeMin: now, timeMax: end })
      .then(evs => setEvents(evs.filter(e => !e.isAllDay).slice(0, 5)))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  function formatDate(ev: PersonalGCalEvent) {
    try {
      const start = new Date(`${ev.date}T${ev.startTime || '00:00'}`)
      const today = new Date()
      const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
      const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
      const prefix = same(start, today) ? 'Hoy'
        : same(start, tomorrow) ? 'Mañana'
        : start.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })
      return ev.startTime ? `${prefix} · ${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''}` : prefix
    } catch { return ev.date }
  }

  return (
    <div style={{ background: isDark ? '#1c1e2a' : '#fff', borderRadius: 20, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarPlus size={14} color="#fff" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: textC, flex: 1 }}>Próximas reuniones</span>
        <button onClick={onSchedule}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none', background: isDark ? 'rgba(5,150,105,0.2)' : '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Programar
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '20px 16px' }}>
          <Loader size={14} color={sub} className="animate-spin" />
          <span style={{ fontSize: 13, color: sub }}>Cargando...</span>
        </div>
      ) : !events?.length ? (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: sub }}>Sin reuniones próximas esta semana</p>
        </div>
      ) : (
        <div>
          {events.map((ev, i) => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < events.length - 1 ? `1px solid ${border}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(5,150,105,0.15)' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarPlus size={16} color="#059669" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: sub }}>{formatDate(ev)}</p>
              </div>
              {ev.htmlLink && (
                <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#059669', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Unirse
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabPresencia() {
  const { team } = useHub()
  const { isDark } = useHubTheme()
  const auth  = useOptionalAuth()
  const uid   = auth?.authUser?.uid ?? null
  const profile = auth?.profile ?? auth?.user
  const myArea  = (profile as { area?: string })?.area

  const [salasConfig, setSalasConfig] = useState<SalasConfig>({ general: '', diseno: '', cm: '', estrategia: '', audiovisual: '' })
  const [myStatus, setMyStatusState] = useState<PresenceStatusLabel>('disponible')
  const [callNotif, setCallNotif] = useState<{ name: string; salaKey: keyof SalasConfig; personal: boolean; meetLink?: string } | null>(null)
  const [callingMsg, setCallingMsg] = useState('')

  // Settings panel
  const [configOpen, setConfigOpen] = useState(false)
  const configRef = useRef<HTMLDivElement>(null)
  const [configLinks, setConfigLinks] = useState<SalasConfig>({ general: '', diseno: '', cm: '', estrategia: '', audiovisual: '' })

  // Reunión ahora (video button)
  const [meetNowTarget, setMeetNowTarget] = useState<string | null>(null)

  // Invitaciones de reunión perdidas (call_incoming no leídas)
  const [pendingCalls, setPendingCalls] = useState<Array<{ id: string; title: string; message?: string; link?: string; createdAt: unknown }>>([])

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      where('type', '==', 'call_incoming'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
    return onSnapshot(q, snap => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as { id: string; title: string; message?: string; link?: string; createdAt: unknown }))
      setPendingCalls(items)
    })
  }, [uid])

  function formatNotifTime(createdAt: unknown): string {
    const ms = (createdAt as { toMillis?: () => number })?.toMillis?.()
    if (!ms) return 'Ahora'
    const d = new Date(ms)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
    if (isToday) return `Hoy · ${time}`
    if (isYesterday) return `Ayer · ${time}`
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`
  }

  function dismissCall(id: string) {
    setPendingCalls(prev => prev.filter(n => n.id !== id))
    updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {})
  }

  function dismissAllCalls() {
    const ids = pendingCalls.map(n => n.id)
    setPendingCalls([])
    ids.forEach(id => updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {}))
  }

  // Invite modal (Programar)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteParticipants, setInviteParticipants] = useState<string[]>([])
  const [inviteForm, setInviteForm] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00' })
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'saving' | 'done'>('idle')

  const { setStatus } = useMyPresence(uid)

  useEffect(() => {
    return subscribeSalasConfig(cfg => { setSalasConfig(cfg); setConfigLinks(cfg) })
  }, [])

  useEffect(() => {
    if (!configOpen) return
    function handleOutside(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) setConfigOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [configOpen])

  // Suscripción a notificaciones de llamada
  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'salaCallEvents'), orderBy('createdAt', 'desc'), limit(1))
    return onSnapshot(q, snap => {
      if (snap.empty) return
      const ev = snap.docs[0].data()
      if (ev.uid === uid) return
      const age = Date.now() - (ev.createdAt?.toMillis?.() ?? 0)
      if (age > 6000) return
      // Personal call: only show to target; broadcast (no targetUid): show to all
      if (ev.targetUid && ev.targetUid !== uid) return
      setCallNotif({ name: ev.name, salaKey: ev.salaKey, personal: Boolean(ev.targetUid), meetLink: ev.meetLink })
      playCallSound()
      setTimeout(() => setCallNotif(null), 10000)
    })
  }, [uid])

  const T = isDark
    ? { text: '#f1f5f9', sub: '#94a3b8', bg: '#0f1117', card: '#161820', border: 'rgba(255,255,255,0.08)' }
    : { text: '#111827', sub: '#6b7280', bg: '#f8fafc', card: '#fff', border: '#e5e7eb' }

  function handleCallPerson(target: TeamMember) {
    const mySalaKey: keyof SalasConfig = (myArea && CATEGORY_TO_SALA[myArea]) ? CATEGORY_TO_SALA[myArea] : 'general'
    const me = team.find(m => m.id === uid)
    const myName = me?.name ?? (auth?.authUser?.email ?? 'Alguien')
    const link = me?.personalMeetLink || salasConfig[mySalaKey]
    if (link) window.open(link, '_blank', 'noopener')
    if (uid) {
      setStatus(uid, 'en_reunion')
      setMyStatusState('en_reunion')
      setCurrentSala(uid, mySalaKey)
      addDoc(collection(db, 'salaCallEvents'), {
        uid, name: myName, salaKey: mySalaKey, targetUid: target.id, targetName: target.name, meetLink: link, createdAt: serverTimestamp(),
      }).catch(() => {})
      addDoc(collection(db, 'notifications'), {
        userId: target.id,
        type: 'call_incoming',
        category: 'Sala',
        title: `${myName} te llama`,
        message: link ? `Unirse: ${link}` : `Llamada desde ${SALA_LABELS[mySalaKey]}`,
        link: link || '/admin/contenidos/sala',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }
    setCallingMsg(`Llamando a ${target.name}…`)
    setTimeout(() => setCallingMsg(''), 5000)
  }

  async function handleGroupCall(salaKey: keyof SalasConfig) {
    const me = team.find(m => m.id === uid)
    const myName = me?.name ?? (auth?.authUser?.email ?? 'Alguien')
    if (uid) {
      setStatus(uid, 'en_reunion')
      setMyStatusState('en_reunion')
      setCurrentSala(uid, salaKey)
      addDoc(collection(db, 'salaCallEvents'), {
        uid, name: myName, salaKey, createdAt: serverTimestamp(),
      }).catch(() => {})
    }
    // Crear evento desde la cuenta personal del usuario (él es el host) con asistentekimce
    // como invitado del evento → bot entra cuando el usuario lo admite desde el lobby.
    // Fallback: cuenta de servicio KIMCE si el usuario no tiene GCal conectado.
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 60 * 60 * 1000)
      let hangoutLink = ''
      try {
        const meeting = await createPersonalMeeting({
          title: `Sala ${SALA_LABELS[salaKey]} — ${myName}`,
          startDateTime: now.toISOString(),
          endDateTime: end.toISOString(),
        })
        hangoutLink = meeting.hangoutLink
      } catch {
        const ev = await gcalCreateEvent({
          summary: `Sala ${SALA_LABELS[salaKey]} — ${myName}`,
          startDateTime: now.toISOString(),
          endDateTime: end.toISOString(),
          timeZone: 'America/Lima',
        })
        hangoutLink = ev.hangoutLink || ''
      }
      if (hangoutLink) window.open(hangoutLink, '_blank', 'noopener')
    } catch {
      const fallback = salasConfig[salaKey]
      if (fallback) window.open(fallback, '_blank', 'noopener')
    }
  }

  async function handleMeetNow(target: TeamMember) {
    setMeetNowTarget(target.id)
    const mySalaKey: keyof SalasConfig = (myArea && CATEGORY_TO_SALA[myArea]) ? CATEGORY_TO_SALA[myArea] : 'general'
    const me = team.find(m => m.id === uid)
    const myName = me?.name ?? (auth?.authUser?.email ?? 'Alguien')

    if (uid) {
      setStatus(uid, 'en_reunion')
      setMyStatusState('en_reunion')
      setCurrentSala(uid, mySalaKey)
    }

    // Crear evento desde la cuenta personal del usuario (él es el host) con asistentekimce
    // y el target como invitados → Fathom bot entra cuando el usuario (host presente) lo admite.
    // Fallback: cuenta de servicio KIMCE si el usuario no tiene GCal conectado.
    let meetLink = ''
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 60 * 60 * 1000)
      const extraAttendees = target.email ? [{ email: target.email, displayName: target.name }] : []
      try {
        const meeting = await createPersonalMeeting({
          title: `Reunión — ${myName} con ${target.name}`,
          startDateTime: now.toISOString(),
          endDateTime: end.toISOString(),
          attendees: extraAttendees,
        })
        meetLink = meeting.hangoutLink
      } catch {
        const ev = await gcalCreateEvent({
          summary: `Reunión — ${myName} con ${target.name}`,
          startDateTime: now.toISOString(),
          endDateTime: end.toISOString(),
          timeZone: 'America/Lima',
          attendees: extraAttendees,
        })
        meetLink = ev.hangoutLink || ''
      }
    } catch {
      meetLink = me?.personalMeetLink || salasConfig[mySalaKey] || salasConfig['general'] || ''
    }

    if (meetLink) window.open(meetLink, '_blank', 'noopener')

    if (uid) {
      addDoc(collection(db, 'salaCallEvents'), {
        uid, name: myName, salaKey: mySalaKey, targetUid: target.id, targetName: target.name, meetLink, createdAt: serverTimestamp(),
      }).catch(() => {})
      addDoc(collection(db, 'notifications'), {
        userId: target.id,
        type: 'call_incoming',
        category: 'Sala',
        title: `${myName} te invita a reunión`,
        message: meetLink ? `Unirse: ${meetLink}` : 'Reunión en curso — entra a la sala',
        link: meetLink || '/admin/contenidos/sala',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }

    setCallingMsg(`Reunión iniciada con ${target.name}…`)
    setTimeout(() => setCallingMsg(''), 5000)
    setMeetNowTarget(null)
  }

  function handleOpenSchedule(salaKey: keyof SalasConfig) {
    const today = new Date().toISOString().slice(0, 10)
    setInviteParticipants([])
    setInviteForm({ title: `Reunión ${SALA_LABELS[salaKey]}`, date: today, startTime: '09:00', endTime: '10:00' })
    setInviteStatus('idle')
    setInviteOpen(true)
  }

  function toggleParticipant(memberId: string) {
    setInviteParticipants(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    )
  }

  async function handleCreateMeeting() {
    setInviteStatus('saving')
    const selectedMembers = team.filter(m => inviteParticipants.includes(m.id) && m.email)
    const attendees = [
      ...selectedMembers.map(m => ({ email: m.email!, displayName: m.name })),
      { email: 'fred@fireflies.ai', displayName: 'Fireflies Notetaker' },
    ]
    // De-duplicate by email
    const seen = new Set<string>()
    const uniqueAttendees = attendees.filter(a => { if (seen.has(a.email)) return false; seen.add(a.email); return true })
    try {
      const ev = await gcalCreateEvent({
        summary: inviteForm.title || 'Reunión KIMCE',
        description: 'Reunión programada desde Portal KIMCE',
        startDateTime: `${inviteForm.date}T${inviteForm.startTime}:00`,
        endDateTime: `${inviteForm.date}T${inviteForm.endTime}:00`,
        timeZone: 'America/Lima',
        attendees: uniqueAttendees,
      })
      setInviteStatus('done')
      if (ev.htmlLink) window.open(ev.htmlLink, '_blank', 'noopener')
      setTimeout(() => { setInviteOpen(false); setInviteStatus('idle') }, 1800)
    } catch {
      setInviteStatus('idle')
    }
  }

  function handleSetStatus(s: PresenceStatusLabel) {
    setMyStatusState(s)
    if (uid) {
      setStatus(uid, s)
      if (s !== 'en_reunion') setCurrentSala(uid, null)
    }
  }

  async function handleSaveLink(salaKey: keyof SalasConfig, link: string) {
    const updated = { ...salasConfig, [salaKey]: link }
    setSalasConfig(updated)
    await saveSalasConfig(updated)
  }

  const AREA_ORDER: Array<{ key: keyof SalasConfig; label: string; category: string; color: string }> = [
    { key: 'estrategia', label: 'Estrategia',  category: 'Estrategia',  color: '#3b82f6' },
    { key: 'cm',         label: 'CM',           category: 'CM',          color: '#f59e0b' },
    { key: 'diseno',     label: 'Diseño',       category: 'Diseño',      color: '#8b5cf6' },
    { key: 'audiovisual',label: 'Audiovisual',  category: 'Audiovisual', color: '#ec4899' },
  ]

  // Search + filter state
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusOpen])

  const totalOnline = team.filter(m => m.isOnline).length

  const filteredTeam = useMemo(() => {
    let members = team
    if (search.trim()) {
      const q = search.toLowerCase()
      members = members.filter(m => m.name.toLowerCase().includes(q) || (m.category ?? '').toLowerCase().includes(q))
    }
    if (filter === 'Disponibles') {
      members = members.filter(m => m.isOnline)
    }
    return members
  }, [team, search, filter])

  const filteredAreas = AREA_ORDER.filter(({ category }) => filteredTeam.some(m => m.category === category))
  const pageBg = isDark ? '#0f1117' : '#f4f6fb'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16, background: pageBg }}>

      {/* Top bar: Mi estado · Sala general · Programar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Mi estado — pill compacto con dropdown */}
        <div ref={statusRef} style={{ position: 'relative' }}>
          <button onClick={() => setStatusOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 10px', borderRadius: 24, border: `1.5px solid ${T.border}`, background: isDark ? '#1c1e2a' : '#fff', cursor: 'pointer', boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRESENCE_COLORS[myStatus ?? 'disponible'], flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{PRESENCE_LABELS[myStatus ?? 'disponible']}</span>
            <ChevronDown size={13} color={T.sub} style={{ transform: statusOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
          </button>
          {statusOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: isDark ? '#1e2130' : '#fff', borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', border: `1px solid ${T.border}`, padding: 6, minWidth: 170 }}>
              {(Object.keys(PRESENCE_LABELS) as PresenceStatusLabel[]).map(s => (
                <button key={s} onClick={() => { handleSetStatus(s); setStatusOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 9, border: 'none', background: myStatus === s ? (isDark ? 'rgba(255,255,255,0.08)' : '#f4f6fb') : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRESENCE_COLORS[s], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: myStatus === s ? 700 : 500, color: T.text }}>{PRESENCE_LABELS[s]}</span>
                  {myStatus === s && <Check size={12} color="#7c3aed" style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sala general */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px 7px 10px', borderRadius: 24, border: `1.5px solid ${T.border}`, background: isDark ? '#1c1e2a' : '#fff', boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={14} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Sala general</p>
            <p style={{ margin: 0, fontSize: 11, color: T.sub, lineHeight: 1.2 }}>{totalOnline > 0 ? `${totalOnline} online` : 'Todo el equipo'}</p>
          </div>
          {salasConfig['general'] && (
            <button onClick={() => handleGroupCall('general')} style={{ marginLeft: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: '#7c3aed', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Phone size={12} /> Entrar
            </button>
          )}
        </div>

        {/* Programar */}
        <button onClick={() => handleOpenSchedule('general' as keyof SalasConfig)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px 7px 10px', borderRadius: 24, border: `1.5px solid ${T.border}`, background: isDark ? '#1c1e2a' : '#fff', boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarPlus size={14} color="#fff" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Programar</span>
        </button>

        {/* Ajustes de salas */}
        <div ref={configRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button onClick={() => setConfigOpen(o => !o)} title="Configurar links de salas"
            style={{ width: 36, height: 36, borderRadius: 12, border: `1.5px solid ${configOpen ? '#7c3aed' : T.border}`, background: configOpen ? (isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe') : (isDark ? '#1c1e2a' : '#fff'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: configOpen ? '#7c3aed' : T.sub, transition: 'all 0.15s' }}>
            <Settings size={16} />
          </button>
          {configOpen && (
            <div style={{ position: 'absolute', top: 44, right: 0, zIndex: 200, width: 300, background: isDark ? '#1c1e2a' : '#fff', border: `1.5px solid ${T.border}`, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Salas informales</p>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.sub, lineHeight: 1.4 }}>Links de Google Meet dedicados para llamadas rápidas del equipo. No usar links de reuniones programadas.</p>
              {([
                { key: 'general' as keyof SalasConfig, label: 'Sala General' },
                { key: 'estrategia' as keyof SalasConfig, label: 'Sala Estrategia' },
                { key: 'diseno' as keyof SalasConfig, label: 'Sala Diseño' },
                { key: 'cm' as keyof SalasConfig, label: 'Sala CM' },
                { key: 'audiovisual' as keyof SalasConfig, label: 'Sala Audiovisual' },
              ]).map(({ key, label }) => (
                <div key={key}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.sub }}>{label}</p>
                  <input
                    value={configLinks[key]}
                    onChange={e => setConfigLinks(prev => ({ ...prev, [key]: e.target.value }))}
                    onBlur={() => { handleSaveLink(key, configLinks[key].trim()) }}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 9, border: `1.5px solid ${T.border}`, outline: 'none', color: T.text, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', boxSizing: 'border-box' as const }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Toast "Llamando a X…" */}
      {callingMsg && (
        <div style={{ padding: '10px 16px', borderRadius: 12, background: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff', border: '1px solid #c4b5fd', color: '#7c3aed', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={14} /> {callingMsg}
        </div>
      )}

      {/* Invitaciones pendientes (perdidas o no atendidas) */}
      {pendingCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingCalls.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={dismissAllCalls}
                style={{ fontSize: 11, fontWeight: 600, color: T.sub, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}>
                Descartar todas
              </button>
            </div>
          )}
          {pendingCalls.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: isDark ? 'rgba(124,58,237,0.12)' : '#f5f3ff', border: `1.5px solid ${isDark ? 'rgba(124,58,237,0.35)' : '#c4b5fd'}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneCall size={15} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: T.sub }}>{formatNotifTime(n.createdAt)}</p>
              </div>
              {n.link?.startsWith('https://meet.google.com') && (
                <button
                  onClick={() => { window.open(n.link!, '_blank', 'noopener'); dismissCall(n.id) }}
                  style={{ padding: '5px 14px', borderRadius: 20, background: '#7c3aed', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  Unirse
                </button>
              )}
              <button
                onClick={() => dismissCall(n.id)}
                title="Descartar"
                style={{ width: 26, height: 26, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sub, flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Directorio del equipo */}
      <div style={{ background: isDark ? '#1c1e2a' : '#fff', borderRadius: 20, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color={T.sub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar persona o área..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 12, border: `1.5px solid ${T.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['Todos', 'Disponibles'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: filter === f ? 700 : 500, cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: filter === f ? (isDark ? 'rgba(124,58,237,0.25)' : '#ede9fe') : (isDark ? 'rgba(255,255,255,0.06)' : '#f4f6fb'),
                  color: filter === f ? '#7c3aed' : T.sub }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {filteredAreas.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: T.sub }}>Sin resultados para "{search}"</p>
            <button onClick={() => { setSearch(''); setFilter('Todos') }}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : '#f4f6fb', fontSize: 13, fontWeight: 600, color: T.sub, cursor: 'pointer' }}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {filteredAreas.map(({ key, label, category, color }, i) => {
              const areaMembers = filteredTeam.filter(m => m.category === category)
              return (
                <div key={key} style={{ flex: areaMembers.length, minWidth: 0, borderRight: i < filteredAreas.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <AreaSection
                    salaKey={key}
                    areaLabel={label}
                    areaColor={color}
                    members={areaMembers}
                    meetLink={salasConfig[key]}
                    myUid={uid}
                    myArea={myArea}
                    isDark={isDark}
                    meetNowTarget={meetNowTarget}
                    onGroupCall={handleGroupCall}
                    onCallPerson={handleCallPerson}
                    onMeetNow={handleMeetNow}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Próximas reuniones */}
      <ProximasReuniones isDark={isDark} onSchedule={() => handleOpenSchedule('general' as keyof SalasConfig)} />

      {/* Notificación de llamada entrante */}
      {callNotif && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: isDark ? '#1e2130' : '#fff', border: '1px solid #c4b5fd', borderRadius: 14, padding: '14px 16px', boxShadow: '0 8px 32px rgba(124,58,237,0.18)', display: 'flex', alignItems: 'center', gap: 12, minWidth: 280 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneCall size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>{callNotif.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#7c3aed' }}>
              {callNotif.personal ? 'te está llamando' : `entró a ${SALA_LABELS[callNotif.salaKey] ?? callNotif.salaKey}`}
            </p>
          </div>
          {(callNotif.meetLink || salasConfig[callNotif.salaKey]) && (
            <button onClick={() => {
              const link = callNotif!.meetLink || salasConfig[callNotif!.salaKey]
              if (uid) { setStatus(uid, 'en_reunion'); setMyStatusState('en_reunion'); setCurrentSala(uid, callNotif!.salaKey) }
              window.open(link, '_blank', 'noopener')
              setCallNotif(null)
            }}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Unirse
            </button>
          )}
          <button onClick={() => setCallNotif(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#6b7280', padding: 4 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modal invitar a reunión */}
      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setInviteOpen(false) }}>
          <div style={{ background: isDark ? '#1e2130' : '#fff', borderRadius: 16, padding: 24, width: 400, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>Programar reunión</p>
                <p style={{ margin: 0, fontSize: 12, color: '#7c3aed' }}>Fireflies grabará automáticamente</p>
              </div>
              <button onClick={() => setInviteOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#6b7280' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 4 }}>TÍTULO</label>
                <input value={inviteForm.title} onChange={e => setInviteForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#161820' : '#f9fafb', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 4 }}>FECHA</label>
                <input type="date" value={inviteForm.date} onChange={e => setInviteForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#161820' : '#f9fafb', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 4 }}>INICIO</label>
                  <input type="time" value={inviteForm.startTime} onChange={e => setInviteForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#161820' : '#f9fafb', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 4 }}>FIN</label>
                  <input type="time" value={inviteForm.endTime} onChange={e => setInviteForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#161820' : '#f9fafb', boxSizing: 'border-box', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 6 }}>PARTICIPANTES</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {team.filter(m => m.id !== uid).map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: inviteParticipants.includes(m.id) ? (isDark ? 'rgba(124,58,237,0.12)' : '#f5f3ff') : 'transparent', border: `1px solid ${inviteParticipants.includes(m.id) ? '#c4b5fd' : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9')}` }}>
                      <input type="checkbox" checked={inviteParticipants.includes(m.id)} onChange={() => toggleParticipant(m.id)} style={{ accentColor: '#7c3aed', width: 14, height: 14, flexShrink: 0 }} />
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.initials}</div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#f1f5f9' : '#111827' }}>{m.name}</span>
                      {!m.email && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>sin email</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(124,58,237,0.06)', border: '1px solid #ede9fe' }}>
                <Video size={12} color="#7c3aed" />
                <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>Fireflies grabará automáticamente</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setInviteOpen(false)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', fontSize: 13, fontWeight: 600, color: isDark ? '#94a3b8' : '#6b7280', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreateMeeting} disabled={!inviteForm.date || inviteStatus !== 'idle'}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: inviteStatus === 'done' ? '#22c55e' : '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !inviteForm.date ? 0.5 : 1 }}>
                {inviteStatus === 'saving' ? 'Creando…' : inviteStatus === 'done' ? 'Creada' : 'Crear reunión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Chat ──────────────────────────────────────────────────────────────────────
function Chat() {
  const { mensajesSala, sendMensajeSala, team } = useHub()
  const { isDark } = useHubTheme()
  const auth = useOptionalAuth()
  const authUser = auth?.authUser
  const profile  = auth?.profile ?? auth?.user
  const myName   = (profile as { displayName?: string } | null)?.displayName ?? authUser?.email ?? 'Yo'

  const yo = team.find(m => m.email === authUser?.email)
    ?? { name: myName, initials: myName.slice(0, 2).toUpperCase(), color: '#7c3aed', email: '', isOnline: true, presenceStatus: 'disponible' as PresenceStatusLabel }

  const [texto, setTexto] = useState('')
  const [tipo, setTipo]   = useState<'mensaje' | 'anuncio'>('mensaje')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [mensajesSala])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    await sendMensajeSala({ autor: yo.name, autorInitials: yo.initials, autorColor: yo.color, texto: texto.trim(), tipo })
    setTexto(''); setTipo('mensaje')
  }

  const formatHora = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  const T = isDark
    ? { bg: '#0f1117', chatBg: '#161820', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8', inputBg: '#1e2130' }
    : { bg: '#f8fafc', chatBg: '#ffffff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', inputBg: '#ffffff' }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={listRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {mensajesSala.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="text-3xl mb-3">💬</div>
              <p className="text-[15px] font-bold" style={{ color: T.text }}>La Sala está vacía</p>
              <p className="text-[13px] mt-1" style={{ color: T.sub }}>Enviá el primer mensaje al equipo</p>
            </div>
          )}
          {mensajesSala.map(m => {
            if (m.tipo === 'bot') {
              return (
                <div key={m.id} className="flex justify-center py-0.5">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl max-w-[88%]"
                    style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(79,70,229,0.07))', border: '1px solid rgba(124,58,237,0.18)' }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      <Zap size={11} color="#fff" />
                    </div>
                    <span className="text-[12.5px] leading-relaxed" style={{ color: '#4c1d95' }}>{m.texto}</span>
                    <span className="text-[10px] shrink-0" style={{ color: '#a78bfa' }}>{formatHora(m.createdAt)}</span>
                  </div>
                </div>
              )
            }
            return (
              <div key={m.id} className={`flex gap-3 ${m.tipo === 'anuncio' ? 'rounded-2xl p-4 border border-[#fde68a]' : ''}`}
                style={m.tipo === 'anuncio' ? { background: '#fef9c3' } : {}}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                  style={{ background: m.autorColor }}>{m.autorInitials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: T.text }}>{m.autor}</span>
                    <span className="text-[11px]" style={{ color: T.sub }}>{formatHora(m.createdAt)}</span>
                    {m.tipo === 'anuncio' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#d97706] bg-[#fef3c7] px-2 py-0.5 rounded-full">
                        <Megaphone size={9} /> ANUNCIO
                      </span>
                    )}
                  </div>
                  <div className={`text-[13px] rounded-2xl px-3.5 py-2.5 inline-block max-w-full break-words`}
                    style={m.tipo === 'anuncio'
                      ? { background: '#fef3c7', color: '#92400e' }
                      : { background: T.chatBg, border: `1px solid ${T.border}`, color: T.text }}>
                    {m.texto}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ background: T.chatBg, borderTop: `1px solid ${T.border}`, padding: 16, flexShrink: 0 }}>
          <form onSubmit={enviar} className="flex gap-2 items-center">
            {tipo === 'anuncio' && <span className="text-[11px] text-[#d97706] font-semibold shrink-0 flex items-center gap-1"><Megaphone size={11} /> Anuncio</span>}
            <input value={texto} onChange={e => setTexto(e.target.value)}
              placeholder={tipo === 'anuncio' ? 'Escribí el anuncio...' : 'Escribí un mensaje...'}
              style={{ background: T.inputBg, border: `1px solid ${T.border}`, color: T.text }}
              className="flex-1 px-3.5 py-2.5 text-[13px] rounded-xl focus:outline-none focus:border-[#7c3aed] transition-colors" />
            <button type="button" onClick={() => setTipo(t => t === 'mensaje' ? 'anuncio' : 'mensaje')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${tipo === 'anuncio' ? 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a]' : 'text-[#9ca3af] hover:bg-[#f9fafb]'}`}
              style={tipo !== 'anuncio' ? { border: `1px solid ${T.border}` } : {}}
              title="Cambiar a anuncio">
              <Megaphone size={15} />
            </button>
            <button type="submit"
              className="w-10 h-10 rounded-xl bg-[#7c3aed] hover:bg-[#5b21b6] flex items-center justify-center text-white transition-colors shadow-sm cursor-pointer">
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Panel lateral — miembros con presencia real */}
      <div style={{ width: 200, background: isDark ? '#0f1117' : '#fff', borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            EQUIPO — {team.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {(() => {
            const ORDER = ['Estrategia', 'CM', 'Diseño', 'Audiovisual', 'Agencia', 'Otro']
            const grouped: Record<string, typeof team> = {}
            team.forEach(m => { const key = m.category ?? 'Otro'; if (!grouped[key]) grouped[key] = []; grouped[key].push(m) })
            return ORDER.filter(k => grouped[k]?.length).map(cat => (
              <div key={cat}>
                <p style={{ padding: '10px 16px 4px', fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{cat}</p>
                {grouped[cat].map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 10, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{m.initials}</div>
                      <span style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 9, height: 9, borderRadius: '50%', border: '2px solid white',
                        background: m.isOnline ? PRESENCE_COLORS[m.presenceStatus ?? 'disponible'] : '#cbd5e1',
                      }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#f1f5f9' : '#111827', margin: 0, lineHeight: 1.3 }}>{m.name}</p>
                      <p style={{ fontSize: 10, color: m.isOnline ? PRESENCE_COLORS[m.presenceStatus ?? 'disponible'] : '#94a3b8', margin: 0 }}>
                        {m.isOnline ? PRESENCE_LABELS[m.presenceStatus ?? 'disponible'] : 'offline'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const SALA_TABS = [
  { key: 'presencia', label: 'Presencia' },
  { key: 'chat',      label: 'Mensajes'  },
] as const

type SalaTab = typeof SALA_TABS[number]['key']

export default function SalaPage() {
  const { mensajesSala, team } = useHub()
  const { isDark } = useHubTheme()
  const [tab, setTab] = useState<SalaTab>('presencia')

  const totalOnline = team.filter(m => m.isOnline).length

  const T = isDark
    ? { bg: '#0f1117', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#f8fafc', border: '#e5e7eb', text: '#111827', sub: '#6b7280' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: T.bg, borderRadius: 16 }}>
      {/* Header */}
      <div style={{ background: isDark ? '#161820' : '#fff', borderBottom: `1px solid ${T.border}`, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, borderRadius: '16px 16px 0 0' }}>
        {SALA_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: tab === t.key ? '#f5f3ff' : 'transparent',
              color: tab === t.key ? '#7c3aed' : T.sub,
            }}>
            {t.label}
            {t.key === 'presencia' && totalOnline > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 20 }}>
                {totalOnline}
              </span>
            )}
            {t.key === 'chat' && mensajesSala.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.sub, background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', padding: '1px 6px', borderRadius: 20 }}>
                {mensajesSala.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'presencia' && <TabPresencia />}
      {tab === 'chat'      && <Chat />}
    </div>
  )
}
