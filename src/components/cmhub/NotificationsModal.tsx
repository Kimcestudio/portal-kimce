'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, CheckCheck, Bell, ClipboardList, FileText, MessageSquare, Trash2, AlertOctagon, Inbox } from 'lucide-react'
import { doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { AppNotification } from '@/cmhub/types'
import { GROUP_COLOR, notifGroup, timeAgo, toDate, type NotifGroup } from '@/cmhub/notifications'

interface Props {
  items: AppNotification[]
  isDark: boolean
  onClose: () => void
}

const GROUP_ICON: Record<NotifGroup, typeof Bell> = {
  Actividad:   ClipboardList,
  Contenidos:  FileText,
  Comentarios: MessageSquare,
  Vencidos:    AlertOctagon,
  Solicitudes: Inbox,
}
const GROUPS: NotifGroup[] = ['Vencidos', 'Solicitudes', 'Actividad', 'Contenidos', 'Comentarios']
const DAY_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Anteriores']

function fmtFull(d: Date) {
  return `${d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
}

function dayGroup(d: Date): string {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  if (diffDays <= 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays <= 7) return 'Esta semana'
  return 'Anteriores'
}

export default function NotificationsModal({ items, isDark, onClose }: Props) {
  const [groupFilter, setGroupFilter] = useState<NotifGroup | 'all'>('all')
  const [onlyUnread, setOnlyUnread]   = useState(false)

  const cardBg = isDark ? '#161820' : '#ffffff'
  const groupBg = isDark ? '#161820' : '#fafafa'
  const border = isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb'
  const text = isDark ? '#e2e8f0' : '#111827'
  const sub = isDark ? '#94a3b8' : '#6b7280'
  const hover = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'
  const unreadBg = isDark ? 'rgba(124,58,237,0.07)' : '#f5f3ff'

  const unreadCount = items.filter((n) => !n.read).length

  const filtered = items.filter((n) => {
    if (onlyUnread && n.read) return false
    if (groupFilter !== 'all' && notifGroup(n) !== groupFilter) return false
    return true
  })

  const grouped = DAY_ORDER
    .map((label) => ({ label, items: filtered.filter((n) => dayGroup(toDate(n.createdAt)) === label) }))
    .filter((g) => g.items.length > 0)

  async function markRead(n: AppNotification) {
    if (n.read) return
    try { await updateDoc(doc(db, 'notifications', n.id), { read: true }) } catch (e) { console.error(e) }
  }

  async function markAllRead() {
    const unread = items.filter((n) => !n.read)
    if (unread.length === 0) return
    try {
      const batch = writeBatch(db)
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }))
      await batch.commit()
    } catch (e) { console.error(e) }
  }

  async function clearFiltered() {
    if (filtered.length === 0) return
    const scoped = onlyUnread || groupFilter !== 'all'
    const ok = confirm(
      scoped
        ? `¿Eliminar ${filtered.length} notificación${filtered.length > 1 ? 'es' : ''} de esta vista filtrada? No se puede deshacer.`
        : `¿Eliminar las ${filtered.length} notificaciones? No se puede deshacer.`
    )
    if (!ok) return
    try {
      const batch = writeBatch(db)
      filtered.forEach((n) => batch.delete(doc(db, 'notifications', n.id)))
      await batch.commit()
    } catch (e) { console.error(e) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${border}` }}
        onClick={(e) => e.stopPropagation()}>

        {/* Cabecera */}
        <div className="flex items-center gap-2 px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <Bell size={16} style={{ color: '#7c3aed' }} />
          <h2 className="text-[16px] font-bold flex-1" style={{ color: text }}>Notificaciones</h2>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors cursor-pointer"
              style={{ color: '#7c3aed' }}>
              <CheckCheck size={13} /> Marcar todas como leídas
            </button>
          )}
          <button onClick={clearFiltered} disabled={filtered.length === 0}
            title="Eliminar las notificaciones de esta vista"
            className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            style={{ color: '#ef4444' }}>
            <Trash2 size={13} /> Limpiar
          </button>
          <button onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: sub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hover }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <X size={15} />
          </button>
        </div>

        {/* Filtros: tipo + no leídas */}
        <div className="flex items-center gap-2 px-6 py-3 flex-wrap shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <button onClick={() => setGroupFilter('all')}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer"
            style={groupFilter === 'all'
              ? { background: '#7c3aed', color: '#fff' }
              : { background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: sub }}>
            Todas · {items.length}
          </button>
          {GROUPS.map((g) => {
            const count = items.filter((n) => notifGroup(n) === g).length
            if (count === 0) return null
            const color = GROUP_COLOR[g]
            const active = groupFilter === g
            const Icon = GROUP_ICON[g]
            return (
              <button key={g} onClick={() => setGroupFilter(active ? 'all' : g)}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer"
                style={active ? { background: color, color: '#fff' } : { background: `${color}16`, color }}>
                <Icon size={11} /> {g} · {count}
              </button>
            )
          })}
          <button onClick={() => setOnlyUnread((v) => !v)}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all cursor-pointer"
            style={onlyUnread
              ? { background: unreadBg, color: '#7c3aed', borderColor: '#c4b5fd' }
              : { background: 'transparent', color: sub, borderColor: border }}>
            Solo no leídas{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        </div>

        {/* Lista agrupada por fecha */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Bell size={28} style={{ color: sub, opacity: 0.4 }} />
              <p className="text-[13px] font-semibold" style={{ color: sub }}>Sin notificaciones</p>
            </div>
          )}
          {grouped.map((dayGroupEntry) => (
            <div key={dayGroupEntry.label}>
              <div className="px-6 py-2 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10"
                style={{ color: sub, background: groupBg }}>
                {dayGroupEntry.label}
              </div>
              {dayGroupEntry.items.map((n) => {
                const group = notifGroup(n)
                const color = GROUP_COLOR[group]
                const Icon  = GROUP_ICON[group]
                const d     = toDate(n.createdAt)
                return (
                  <Link key={n.id} href={n.link ?? '#'}
                    onClick={() => { markRead(n); onClose() }}
                    className="flex gap-3 px-6 py-3.5 transition-colors cursor-pointer"
                    style={{ background: n.read ? 'transparent' : unreadBg, borderBottom: `1px solid ${border}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hover }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : unreadBg }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${color}1c`, color }}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold" style={{ color: text }}>{n.title}</span>
                        {!n.read && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#7c3aed' }} />}
                      </div>
                      <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: sub }}>{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color}18`, color }}>{group}</span>
                        <span className="text-[10px]" style={{ color: sub }}>{fmtFull(d)} · {timeAgo(d)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
