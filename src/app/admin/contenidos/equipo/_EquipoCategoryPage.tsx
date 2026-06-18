'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft, ChevronRight, ChevronDown, UserPlus, X,
  LayoutDashboard, CalendarDays, Columns3,
  Clock, AlertTriangle, Trash2, GripVertical,
  ExternalLink, Calendar,
  Palette, Film, BarChart2, Users2, Check, CheckCircle2, Zap, CircleDot,
} from 'lucide-react'
import { collection, query, where, onSnapshot, updateDoc, doc as fsDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { getActividadAssignees, actividadHasAssignee } from '@/cmhub/activities'
import { getContentRelevantDate } from '@/cmhub/contentDates'
import type { TeamCategory, TeamMember, Content, ContentStatus, HubActividad } from '@/cmhub/types'
import ContentModal from '@/components/cmhub/ContentModal'
import ActividadModal from '@/components/cmhub/ActividadModal'

// ── Categorías ────────────────────────────────────────────────────────────────
const ALL_CATEGORIES: TeamCategory[] = ['Diseño', 'Audiovisual', 'Estrategia', 'Otro']

const CATEGORY_META: Record<TeamCategory, { color: string; accent: string }> = {
  Diseño:      { color: '#ec4899', accent: 'rgba(236,72,153,0.15)' },
  Audiovisual: { color: '#f97316', accent: 'rgba(249,115,22,0.15)' },
  Estrategia:  { color: '#6366f1', accent: 'rgba(99,102,241,0.15)' },
  Otro:        { color: '#64748b', accent: 'rgba(100,116,139,0.15)' },
}

function CategoryIcon({ cat, size = 14 }: { cat: TeamCategory; size?: number }) {
  const props = { size, strokeWidth: 1.8 }
  if (cat === 'Diseño')      return <Palette {...props} />
  if (cat === 'Audiovisual') return <Film {...props} />
  if (cat === 'Estrategia')  return <BarChart2 {...props} />
  return <Users2 {...props} />
}

// Pipeline de entregas
const PIPELINE_COLS = [
  { key: 'pendiente',   label: 'Pendiente',   statuses: ['idea'],                         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'   },
  { key: 'progreso',    label: 'En Progreso',  statuses: ['produccion'],                   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'   },
  { key: 'revision',    label: 'Revisión',     statuses: ['revision', 'cambios'],          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'  },
  { key: 'listo',       label: 'Listo',        statuses: ['aprobado','programado','publicado','finalizado'], color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
] as const

const FORMAT_TIPO: Record<string, string> = {
  Reel: 'Video', Short: 'Video', Video: 'Video',
  Post: 'RRSS', Carrusel: 'RRSS', Historia: 'RRSS', Story: 'RRSS',
  Email: 'Contenido', Blog: 'Contenido', Mensaje: 'Contenido',
}

// ── Workflow por área ─────────────────────────────────────────────────────────
// Diseño/Audiovisual: su trabajo va de produccion → revision → aprobado (done)
// Estrategia/CM:      su trabajo va de idea → ... → publicado (done)
interface Workflow {
  pendientes: string[]
  enRevision: string[]
  listos:     string[]
  active:     string[]  // todos los estados "en juego" para esta área
}

function getWorkflow(category: TeamCategory): Workflow {
  if (category === 'Diseño' || category === 'Audiovisual') {
    return {
      pendientes: ['produccion'],
      enRevision: ['revision'],
      listos:     ['aprobado', 'programado', 'publicado', 'finalizado'],
      active:     ['produccion', 'revision'],
    }
  }
  // Estrategia / CM / Otro
  return {
    pendientes: ['idea', 'produccion'],
    enRevision: ['revision', 'cambios'],
    listos:     ['publicado', 'finalizado'],
    active:     ['idea', 'produccion', 'revision', 'cambios', 'aprobado', 'programado'],
  }
}

// ── Drive preview helper ──────────────────────────────────────────────────────
function getDrivePreviewUrl(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`
  return null
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function sameName(a: string | null | undefined, b: string) {
  if (!a) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function weekRange(offset = 0) {
  const today  = new Date()
  const day    = today.getDay()
  const diff   = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })
  const fmt    = (d: Date) => d.toISOString().split('T')[0]
  const label  = `${monday.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
  return { start: fmt(monday), end: fmt(days[6]), days, label }
}

function todayISO() { return new Date().toISOString().split('T')[0] }

function dueDiff(d: string | null | undefined) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function fmtDayMonth(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()} ${MESES[dt.getMonth()]}`
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function fmtRelative(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1)  return 'Ahora'
  if (diff < 60) return `Hace ${diff}m`
  const h = Math.floor(diff / 60)
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

function memberAssigned(c: Content, name: string) {
  return sameName(c.responsible, name) ||
    c.responsables?.some(r => sameName(r, name)) ||
    sameName(c.dueAssignee, name)
}

// ── Hook: colaboradores activos hoy ──────────────────────────────────────────
interface ActiveEntry { checkInAt: string; checkOutAt: string | null }

function useActiveToday(members: TeamMember[]) {
  const [active, setActive] = useState<Record<string, ActiveEntry>>({})

  useEffect(() => {
    if (!members.length) return
    const today = todayISO()
    const q = query(collection(db, 'timeEntries'), where('dayKey', '==', today))
    const unsub = onSnapshot(q, snap => {
      const byUid: Record<string, { clockIn?: string; clockOut?: string }> = {}
      snap.docs.forEach(d => {
        const data = d.data() as { uid?: string; type?: string; ts?: string }
        if (!data.uid || !data.ts) return
        if (!byUid[data.uid]) byUid[data.uid] = {}
        if (data.type === 'clock_in')  byUid[data.uid].clockIn  = data.ts
        if (data.type === 'clock_out') byUid[data.uid].clockOut = data.ts
      })
      const result: Record<string, ActiveEntry> = {}
      members.forEach(m => {
        const entry = byUid[m.id]
        if (entry?.clockIn) {
          result[m.id] = { checkInAt: entry.clockIn, checkOutAt: entry.clockOut ?? null }
        }
      })
      setActive(result)
    }, () => {})
    return unsub
  }, [members])

  return active
}

// ── Tokens de color por tema ──────────────────────────────────────────────────
function useTokens(isDark: boolean) {
  return isDark ? {
    bg:      '#0d0f12',
    card:    '#161820',
    card2:   '#1e2028',
    border:  'rgba(255,255,255,0.07)',
    border2: 'rgba(255,255,255,0.12)',
    text:    '#f1f5f9',
    sub:     '#94a3b8',
    muted:   '#475569',
    hover:   'rgba(255,255,255,0.04)',
  } : {
    bg:      '#f8fafc',
    card:    '#ffffff',
    card2:   '#f1f5f9',
    border:  '#e5e7eb',
    border2: '#d1d5db',
    text:    '#111827',
    sub:     '#6b7280',
    muted:   '#9ca3af',
    hover:   '#f9fafb',
  }
}

// ── Badge de tipo ─────────────────────────────────────────────────────────────
const TIPO_META: Record<string, { color: string; bg: string; symbol: string }> = {
  Video:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',   symbol: '▶'  },
  RRSS:        { color: '#f472b6', bg: 'rgba(244,114,182,0.15)',  symbol: '◈'  },
  Contenido:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',  symbol: '≡'  },
  Actividades: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',    symbol: '◎'  },
}

function TipoBadge({ formato }: { formato: string }) {
  const tipo = FORMAT_TIPO[formato] ?? 'Contenido'
  const m = TIPO_META[tipo] ?? TIPO_META.Contenido
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}>
      {m.symbol} {tipo.toUpperCase()}
    </span>
  )
}

function ActividadBadge() {
  const m = TIPO_META.Actividades
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}>
      {m.symbol} ACTIV.
    </span>
  )
}

// ── Badge de estado para actividades ─────────────────────────────────────────
function ActStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    pendiente:  { label: 'Pendiente',  color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
    en_curso:   { label: 'En curso',   color: '#2563eb', bg: 'rgba(37,99,235,0.1)'    },
    completado: { label: 'Completado', color: '#16a34a', bg: 'rgba(22,163,74,0.1)'    },
  }
  const m = meta[status] ?? meta.pendiente
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  )
}

// ── Badge de estado ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    idea:       { label: 'Pendiente',    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    produccion: { label: 'En Progreso',  color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
    revision:   { label: 'Revisión',     color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    cambios:    { label: 'Cambios',      color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
    aprobado:   { label: 'Aprobado',     color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
    programado: { label: 'Programado',   color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
    publicado:  { label: 'Publicado',    color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)' },
  }
  const m = meta[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  )
}

// ── Hook: posición fija para dropdowns (escapa overflow-hidden/overflow-y-auto) ──
function usePortalDropdown() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-dropdown-root]')?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }, [open])

  return { open, setOpen, pos, btnRef, toggle }
}

// ── Dropdown inline de status ─────────────────────────────────────────────────
function StatusSelect({ value, onChange }: { value: string; onChange: (s: ContentStatus) => void }) {
  const { open, setOpen, pos, btnRef, toggle } = usePortalDropdown()
  const statuses: ContentStatus[] = ['idea', 'produccion', 'revision', 'aprobado', 'programado', 'publicado']

  return (
    <div data-dropdown-root className="shrink-0">
      <button ref={btnRef} onClick={toggle} className="flex items-center gap-1 cursor-pointer">
        <StatusBadge status={value} />
        <ChevronDown size={9} className="opacity-40" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-[#1e2028] border border-white/10 rounded-xl shadow-xl py-1 min-w-[140px]">
          {statuses.map(s => (
            <button key={s} onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
              <StatusBadge status={s} />
              {s === value && <Check size={10} className="ml-auto shrink-0 text-indigo-400" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Dropdown estado de actividad ──────────────────────────────────────────────
const ACTIV_STATUS_META: Record<HubActividad['status'], { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  en_curso:   { label: 'En curso',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  completado: { label: 'Completado', color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
}

function ActividadStatusSelect({ value, onChange }: { value: HubActividad['status']; onChange: (s: HubActividad['status']) => void }) {
  const { open, setOpen, pos, btnRef, toggle } = usePortalDropdown()
  const m = ACTIV_STATUS_META[value]

  return (
    <div data-dropdown-root className="shrink-0">
      <button ref={btnRef} onClick={toggle} className="flex items-center gap-1 cursor-pointer">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
          style={{ background: m.bg, color: m.color }}>{m.label}</span>
        <ChevronDown size={9} className="opacity-40" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-[#1e2028] border border-white/10 rounded-xl shadow-xl py-1 min-w-[140px]">
          {(Object.keys(ACTIV_STATUS_META) as HubActividad['status'][]).map(s => (
            <button key={s} onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: ACTIV_STATUS_META[s].bg, color: ACTIV_STATUS_META[s].color }}>
                {ACTIV_STATUS_META[s].label}
              </span>
              {s === value && <Check size={10} className="ml-auto shrink-0 text-indigo-400" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Dropdown asignado de actividad ────────────────────────────────────────────
function AssigneeSelect({ value, members, onChange }: { value: string[]; members: TeamMember[]; onChange: (names: string[]) => void }) {
  const { open, setOpen, pos, btnRef, toggle } = usePortalDropdown()
  const current = value
    .map(name => members.find(m => sameName(name, m.name)))
    .filter(Boolean) as TeamMember[]

  function toggleMember(name: string) {
    onChange(value.some(v => sameName(v, name)) ? value.filter(v => !sameName(v, name)) : [...value, name])
  }

  return (
    <div data-dropdown-root className="shrink-0">
      <button ref={btnRef} onClick={toggle} className="flex items-center gap-1 cursor-pointer">
        {current.length > 0 ? (
          <div className="flex -space-x-1.5">
            {current.slice(0, 3).map(m => <MemberAvatar key={m.id} member={m} size="xs" />)}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
            <Users2 size={9} className="opacity-50" />
          </div>
        )}
        <ChevronDown size={9} className="opacity-40" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-[#1e2028] border border-white/10 rounded-xl shadow-xl py-1 min-w-[160px] max-h-56 overflow-y-auto">
          {members.map(m => (
            <button key={m.id} onClick={e => { e.stopPropagation(); toggleMember(m.name) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
              <MemberAvatar member={m} size="xs" />
              <span className="text-[11px] text-white/80">{m.name}</span>
              {value.some(v => sameName(v, m.name)) && <Check size={10} className="ml-auto shrink-0 text-indigo-400" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Selector de fecha ─────────────────────────────────────────────────────────
function DateSelect({ value, onChange }: { value: string | null | undefined; onChange: (d: string) => void }) {
  const { open, setOpen, pos, btnRef, toggle } = usePortalDropdown()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.showPicker?.(), 50)
  }, [open])

  return (
    <div data-dropdown-root className="shrink-0">
      <button ref={btnRef} onClick={toggle} className="flex items-center gap-0.5 cursor-pointer group">
        <span className="text-[10px] font-medium" style={{ color: value ? '#6b7280' : '#9ca3af' }}>
          {value ? fmtDayMonth(value) : '—'}
        </span>
        <ChevronDown size={9} className="opacity-30 group-hover:opacity-60" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-[#1e2028] border border-white/10 rounded-xl shadow-xl p-3">
          <input ref={inputRef} type="date" value={value ?? ''}
            onChange={e => { if (e.target.value) { onChange(e.target.value); setOpen(false) } }}
            onClick={e => e.stopPropagation()}
            className="text-[12px] bg-[#2a2d38] border border-white/20 rounded-lg px-3 py-1.5 text-white outline-none cursor-pointer" />
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Avatar de miembro ─────────────────────────────────────────────────────────
function MemberAvatar({ member, size = 'sm' }: { member: TeamMember; size?: 'xs' | 'sm' | 'md' }) {
  const s = size === 'xs' ? 'w-5 h-5 text-[8px]' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-[12px]'
  return (
    <div className={`${s} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ background: member.color }} title={member.name}>
      {member.initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA: PANEL PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function PanelView({
  members, contents, actividades, T, accentColor, activeToday, category, onOpenInSemana,
}: {
  members: TeamMember[]
  contents: Content[]
  actividades: HubActividad[]
  T: ReturnType<typeof useTokens>
  accentColor: string
  activeToday: Record<string, ActiveEntry>
  category: TeamCategory
  onOpenInSemana: (item: WeekItem) => void
}) {
  const { updateContent, brands } = useHub()
  const today = todayISO()
  const names = members.map(m => m.name)
  const wf = getWorkflow(category)
  const [alertasOpen, setAlertasOpen] = useState(true)
  const [agendaOpen, setAgendaOpen] = useState(true)
  const [proximasOpen, setProximasOpen] = useState(true)

  const areaContents = contents.filter(c => names.some(n => memberAssigned(c, n)))
  const areaActividades = actividades.filter(a => names.some(n => actividadHasAssignee(a, n)))
  const actividadesActivas = areaActividades.filter(a => a.status !== 'completado')

  const pendientes = areaContents.filter(c => wf.pendientes.includes(c.status))
  const enRevision = areaContents.filter(c => wf.enRevision.includes(c.status))
  const listos     = areaContents.filter(c => wf.listos.includes(c.status))

  const isCreativo = category === 'Diseño' || category === 'Audiovisual'

  // Alertas: vencidos + cambios (content) + vencidos (actividades)
  // Diseño/Audiovisual miran su fecha de entrega; Estrategia mira la fecha de publicación.
  const alertasItems: WeekItem[] = [
    ...areaContents.filter(c => {
      const relevant = getContentRelevantDate(c, isCreativo)
      const overdue = relevant && relevant < today && wf.active.includes(c.status)
      const cambios = c.status === 'cambios' && !isCreativo
      return overdue || cambios
    }).map(c => ({ kind: 'content' as const, data: c })),
    ...areaActividades.filter(a =>
      a.dueDate && a.dueDate < today && a.status !== 'completado'
    ).map(a => ({ kind: 'actividad' as const, data: a })),
  ]

  // Agenda de hoy: content + actividades con fecha relevante === today
  const agendaItems: WeekItem[] = [
    ...areaContents
      .filter(c => getContentRelevantDate(c, isCreativo) === today && wf.active.includes(c.status))
      .map(c => ({ kind: 'content' as const, data: c })),
    ...areaActividades
      .filter(a => a.dueDate === today && a.status !== 'completado')
      .map(a => ({ kind: 'actividad' as const, data: a })),
  ]

  // Próximas: content próximos 14 días + actividades no completadas (futuras o sin fecha)
  const proximasItems: WeekItem[] = [
    ...areaContents.filter(c => {
      const relevant = getContentRelevantDate(c, isCreativo)
      if (!relevant || relevant <= today) return false
      if (!wf.active.includes(c.status)) return false
      const diff = Math.ceil((new Date(relevant).getTime() - Date.now()) / 86_400_000)
      return diff >= 1 && diff <= 14
    }).sort((a, b) => (getContentRelevantDate(a, isCreativo) ?? '').localeCompare(getContentRelevantDate(b, isCreativo) ?? ''))
      .map(c => ({ kind: 'content' as const, data: c })),
    ...areaActividades.filter(a => {
      if (a.status === 'completado') return false
      if (a.dueDate && a.dueDate <= today) return false // already in alertas/agenda
      return true
    }).sort((a, b) => (a.dueDate ?? 'zzzz').localeCompare(b.dueDate ?? 'zzzz'))
      .map(a => ({ kind: 'actividad' as const, data: a })),
  ]
  const kpis = [
    {
      label: isCreativo ? 'En Producción' : 'Pendientes',
      count: pendientes.length,
      tag: 'Acción Requerida',
      tagColor: '#f59e0b',
      desc: isCreativo ? 'Contenidos asignados que están en producción activa.' : 'Ideas y producciones que requieren trabajo activo.',
      chips: isCreativo ? ['#Producción'] : ['#Idea', '#Progreso'],
      icon: <Zap size={18} />, color: '#f59e0b',
    },
    {
      label: 'En Revisión',
      count: enRevision.length,
      tag: 'Atención',
      tagColor: '#a78bfa',
      desc: isCreativo ? 'Entregados al equipo CM, esperando aprobación.' : 'Esperando feedback del cliente o supervisor.',
      chips: isCreativo ? ['#Revisión'] : ['#Feedback', '#Cambios'],
      icon: <CircleDot size={18} />, color: '#a78bfa',
    },
    {
      label: isCreativo ? 'Aprobados' : 'Publicados',
      count: listos.length,
      tag: 'Hecho',
      tagColor: '#34d399',
      desc: isCreativo ? 'Aprobados por CM — tu trabajo está completo.' : 'Publicados y cerrados.',
      chips: isCreativo ? ['#Aprobado'] : ['#Publicado', '#Listo'],
      icon: <Check size={18} />, color: '#34d399',
    },
  ]

  function renderRow(item: WeekItem) {
    const diff = item.kind === 'content' ? dueDiff(getContentRelevantDate(item.data, isCreativo)) : dueDiff(item.data.dueDate ?? null)
    const diffBadge = diff === null
      ? <span className="w-[72px] shrink-0" />
      : diff === 0
        ? <span className="text-[9px] font-bold shrink-0 w-[72px] text-center px-2 py-0.5 rounded-md" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Hoy</span>
        : diff === 1
          ? <span className="text-[9px] font-bold shrink-0 w-[72px] text-center px-2 py-0.5 rounded-md" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Mañana</span>
          : diff > 0
            ? <span className="text-[9px] font-bold shrink-0 w-[72px] text-center px-2 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>En {diff}d</span>
            : <span className="text-[9px] font-bold shrink-0 w-[72px] text-center px-2 py-0.5 rounded-md" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>{Math.abs(diff)}d vencido</span>

    if (item.kind === 'content') {
      const c = item.data
      const brand = brands.find(b => b.id === c.brandId)
      const assignees = members.filter(m =>
        sameName(c.dueAssignee, m.name) ||
        sameName(c.responsible, m.name) ||
        c.responsables?.some(r => sameName(r, m.name))
      )
      const isCambios = c.status === 'cambios'
      return (
        <div key={c.id}
          className="flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => onOpenInSemana(item)}>
          {/* Tipo */}
          <div className="shrink-0"><TipoBadge formato={c.format} /></div>
          {/* Tarea */}
          <p className="flex-1 min-w-0 text-[12px] font-semibold truncate" style={{ color: T.text }}>{c.title}</p>
          {/* Cliente */}
          <span className="w-[110px] shrink-0 text-[11px] truncate" style={{ color: T.muted }}>{brand?.name ?? '—'}</span>
          {/* Responsables */}
          <div className="w-[60px] shrink-0 flex justify-start" onClick={e => e.stopPropagation()}>
            <div className="flex -space-x-1">
              {assignees.slice(0, 3).map(m => <MemberAvatar key={m.id} member={m} size="xs" />)}
            </div>
          </div>
          {/* Estado */}
          <div className="w-[110px] shrink-0 flex justify-start" onClick={e => e.stopPropagation()}>
            <StatusSelect value={c.status} onChange={s => updateContent(c.id, { status: s })} />
          </div>
          {/* Fecha */}
          <div className="w-[52px] shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
            <DateSelect value={c.dueDate}
              onChange={d => updateContent(c.id, { dueDate: d })} />
          </div>
          {/* Días */}
          <div className="w-[72px] shrink-0 flex justify-center">
            {isCambios
              ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>Cambios</span>
              : diffBadge}
          </div>
        </div>
      )
    } else {
      const a = item.data
      return (
        <div key={a.id} className="flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors"
          style={{ background: 'transparent', opacity: a.status === 'completado' ? 0.5 : 1 }}
          onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => onOpenInSemana(item)}>
          {/* Tipo */}
          <div className="shrink-0">
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>◎ Act</span>
          </div>
          {/* Tarea */}
          <p className="flex-1 min-w-0 text-[12px] font-semibold truncate" style={{ color: T.text }}>{a.title}</p>
          {/* Categoría */}
          <span className="w-[110px] shrink-0 text-[11px] truncate" style={{ color: T.muted }}>{a.category ?? '—'}</span>
          {/* Responsable */}
          <div className="w-7 shrink-0 flex justify-center" onClick={e => e.stopPropagation()}>
            <AssigneeSelect value={getActividadAssignees(a)} members={members}
              onChange={names => updateDoc(fsDoc(db, 'hubActividades', a.id), { assignees: names, assignee: names[0] ?? null }).catch(console.error)} />
          </div>
          {/* Estado */}
          <div className="w-[110px] shrink-0 flex justify-start" onClick={e => e.stopPropagation()}>
            <ActividadStatusSelect value={a.status}
              onChange={s => updateDoc(fsDoc(db, 'hubActividades', a.id), { status: s }).catch(console.error)} />
          </div>
          {/* Fecha */}
          <div className="w-[52px] shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
            <DateSelect value={a.dueDate}
              onChange={d => updateDoc(fsDoc(db, 'hubActividades', a.id), { dueDate: d }).catch(console.error)} />
          </div>
          {/* Días */}
          <div className="w-[72px] shrink-0 flex justify-center">
            {diffBadge}
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex gap-0 h-full overflow-hidden">

      {/* ── Columna principal ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="flex flex-col gap-5 p-5 pb-10">

        {/* KPI cards */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: T.sub }}>
            Estado Global del Área
          </p>
          <div className="grid grid-cols-3 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="rounded-2xl p-4 flex flex-col gap-3 border"
                style={{ background: T.card, borderColor: T.border }}>
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${k.color}20` }}>
                    <span style={{ color: k.color }}>{k.icon}</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${k.tagColor}20`, color: k.tagColor }}>{k.tag}</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[32px] font-extrabold leading-none" style={{ color: T.text }}>{k.count}</span>
                    <span className="text-[12px] font-semibold" style={{ color: T.sub }}>{k.label}</span>
                  </div>
                  <p className="text-[11px] mt-1 leading-tight" style={{ color: T.muted }}>{k.desc}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {k.chips.map(c => (
                    <span key={c} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: T.card2, color: T.muted }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alertas ─────────────────────────────────────────── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: T.border }}>
          <button className="w-full px-5 py-3.5 flex items-center gap-2 border-b"
            style={{ borderColor: alertasOpen && alertasItems.length > 0 ? T.border : 'transparent' }}
            onClick={() => setAlertasOpen(o => !o)}>
            <AlertTriangle size={14} className="text-amber-400" />
            <p className="text-[13px] font-bold" style={{ color: T.text }}>Alertas</p>
            {alertasItems.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                {alertasItems.length}
              </span>
            )}
            <ChevronDown size={14} className="ml-auto transition-transform"
              style={{ color: T.muted, transform: alertasOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          </button>
          {alertasOpen && (
            alertasItems.length === 0
              ? <div className="flex items-center justify-center gap-2 py-5 text-[12px]" style={{ color: T.muted }}>
                  <CheckCircle2 size={14} className="text-emerald-400" /> Sin alertas
                </div>
              : <div className="divide-y" style={{ borderColor: T.border }}>
                  {alertasItems.map(renderRow)}
                </div>
          )}
        </div>

        {/* ── Agenda de Hoy ───────────────────────────────────── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: T.border }}>
          <button className="w-full px-5 py-3.5 flex items-center gap-2 border-b"
            style={{ borderColor: agendaOpen && agendaItems.length > 0 ? T.border : 'transparent' }}
            onClick={() => setAgendaOpen(o => !o)}>
            <Zap size={14} style={{ color: T.sub }} />
            <p className="text-[13px] font-bold" style={{ color: T.text }}>Agenda de Hoy</p>
            {agendaItems.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${accentColor.replace('0.15', '0.25')}`, color: '#fff' }}>
                {agendaItems.length}
              </span>
            )}
            <ChevronDown size={14} className="ml-auto transition-transform"
              style={{ color: T.muted, transform: agendaOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          </button>
          {agendaOpen && (
            agendaItems.length === 0
              ? <div className="flex items-center justify-center py-5 text-[12px]" style={{ color: T.muted }}>
                  Sin entregas para hoy
                </div>
              : <div className="divide-y" style={{ borderColor: T.border }}>
                  {agendaItems.map(renderRow)}
                </div>
          )}
        </div>

        {/* ── Próximas tareas (content + actividades) ─────────── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: T.border }}>
          <button className="w-full px-5 py-3.5 flex items-center gap-2 border-b"
            style={{ borderColor: proximasOpen && proximasItems.length > 0 ? T.border : 'transparent' }}
            onClick={() => setProximasOpen(o => !o)}>
            <Clock size={14} style={{ color: T.sub }} />
            <p className="text-[13px] font-bold" style={{ color: T.text }}>Próximas tareas</p>
            {proximasItems.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                {proximasItems.length}
              </span>
            )}
            <ChevronDown size={14} className="ml-auto transition-transform"
              style={{ color: T.muted, transform: proximasOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          </button>
          {proximasOpen && (
            proximasItems.length === 0
              ? <div className="flex items-center justify-center py-5 text-[12px]" style={{ color: T.muted }}>
                  Sin tareas próximas
                </div>
              : <div className="divide-y" style={{ borderColor: T.border }}>
                  {proximasItems.map(renderRow)}
                </div>
          )}
        </div>
      </div>
      </div>

      {/* ── Panel derecho — solo Equipo Activo ────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col gap-0 overflow-y-auto border-l"
        style={{ borderColor: T.border }}>

        {/* Equipo Activo */}
        <div className="px-4 pt-5 pb-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3 flex items-center gap-2"
            style={{ color: T.sub }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Equipo Activo
          </p>
          <div className="flex flex-col gap-2">
            {members.map(m => {
              const entry    = activeToday[m.id]
              const isActive = !!entry && !entry.checkOutAt
              const activeTasks = areaContents.filter(c =>
                memberAssigned(c, m.name) && ['idea','produccion','revision','cambios'].includes(c.status)
              ).length
              const activeActs = areaActividades.filter(a =>
                actividadHasAssignee(a, m.name) && a.status !== 'completado'
              ).length
              return (
                <div key={m.id} className="rounded-2xl p-3 border transition-opacity"
                  style={{ background: T.card, borderColor: T.border, opacity: isActive ? 1 : 0.5 }}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <MemberAvatar member={m} size="md" />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2"
                          style={{ borderColor: T.card }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold truncate leading-tight" style={{ color: T.text }}>
                        {m.name}
                      </p>
                      <p className="text-[10px]" style={{ color: T.muted }}>
                        {isActive && entry.checkInAt ? `Desde ${fmtTime(entry.checkInAt)}` : 'Fuera de horario'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                      style={isActive
                        ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
                        : { background: T.card2, color: T.muted }}>
                      {isActive ? '● Disponible' : '○ Inactivo'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px]" style={{ color: T.muted }}>
                        Cont: {activeTasks}
                      </span>
                      {activeActs > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          +{activeActs} act
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {members.length === 0 && (
              <p className="text-[11px] text-center py-4" style={{ color: T.muted }}>Sin miembros en esta área</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA: SEMANA DE TAREAS
// ─────────────────────────────────────────────────────────────────────────────
type WeekItem =
  | { kind: 'content';   data: Content      }
  | { kind: 'actividad'; data: HubActividad }

type TipoFilter = 'Todo' | 'Video' | 'RRSS' | 'Contenido' | 'Actividades'
const TIPOS: TipoFilter[] = ['Todo', 'Video', 'RRSS', 'Contenido', 'Actividades']

function SemanaView({
  members, contents, T, category, initialItem, defaultResponsable,
}: {
  members: TeamMember[]
  contents: Content[]
  T: ReturnType<typeof useTokens>
  category: TeamCategory
  initialItem?: WeekItem | null
  defaultResponsable?: string | null
}) {
  const { updateContent, brands, actividades } = useHub()
  const isCreativo = category === 'Diseño' || category === 'Audiovisual'
  const [weekOffset,       setWeekOffset]       = useState(0)
  const [tipoFilter,       setTipoFilter]       = useState<TipoFilter>('Todo')
  const [responsableFilter, setResponsableFilter] = useState<string | null>(defaultResponsable ?? null)
  const [selectedItem,     setSelectedItem]     = useState<WeekItem | null>(initialItem ?? null)
  const week  = weekRange(weekOffset)
  const today = todayISO()
  const allNames   = members.map(m => m.name)
  const filterNames = responsableFilter ? [responsableFilter] : allNames

  const byDay = week.days.map(d => {
    const iso = d.toISOString().split('T')[0]

    const contentItems: WeekItem[] = contents
      .filter(c => {
        const relevant = getContentRelevantDate(c, isCreativo)
        if (!relevant || relevant !== iso) return false
        if (!filterNames.some(n => memberAssigned(c, n))) return false
        if (tipoFilter === 'Actividades') return false
        if (tipoFilter !== 'Todo' && (FORMAT_TIPO[c.format] ?? 'Contenido') !== tipoFilter) return false
        return true
      })
      .map(c => ({ kind: 'content', data: c }))

    const actItems: WeekItem[] = actividades
      .filter(a => {
        if (!a.dueDate || a.dueDate !== iso) return false
        if (!filterNames.some(n => actividadHasAssignee(a, n))) return false
        if (tipoFilter !== 'Todo' && tipoFilter !== 'Actividades') return false
        return true
      })
      .map(a => ({ kind: 'actividad', data: a }))

    const items: WeekItem[] = [...contentItems, ...actItems]
    const done = items.filter(item =>
      item.kind === 'content'
        ? ['aprobado','programado','publicado','finalizado'].includes(item.data.status)
        : item.data.status === 'completado'
    ).length

    return { date: d, iso, items, done }
  })

  const totalItems = byDay.reduce((acc, d) => acc + d.items.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="px-5 py-3 flex items-center gap-3 shrink-0 border-b"
        style={{ borderColor: T.border }}>
        <div className="flex gap-1.5">
          {TIPOS.map(t => (
            <button key={t} onClick={() => setTipoFilter(t)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer"
              style={tipoFilter === t
                ? { background: '#6366f1', color: '#fff' }
                : { background: T.card2, color: T.sub }}>
              {t}
            </button>
          ))}
        </div>

        {/* Filtro de responsable */}
        <div className="flex items-center gap-1.5 border-l pl-3" style={{ borderColor: T.border }}>
          <button
            onClick={() => setResponsableFilter(null)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer"
            style={responsableFilter === null
              ? { background: '#6366f1', color: '#fff' }
              : { background: T.card2, color: T.sub }}>
            Todos
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setResponsableFilter(responsableFilter === m.name ? null : m.name)}
              title={m.name}
              className="transition-all cursor-pointer shrink-0"
              style={{ opacity: responsableFilter && responsableFilter !== m.name ? 0.35 : 1 }}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 transition-all ${responsableFilter === m.name ? 'ring-indigo-400 ring-offset-1' : 'ring-transparent'}`}
                style={{ background: m.color }}>
                {m.initials}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:opacity-80 cursor-pointer"
            style={{ borderColor: T.border, background: T.card }}>
            <ChevronLeft size={13} style={{ color: T.sub }} />
          </button>
          <span className="text-[11px] font-semibold px-3 py-1 rounded-lg"
            style={{ background: T.card2, color: T.sub }}>{week.label}</span>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:opacity-80 cursor-pointer"
            style={{ borderColor: T.border, background: T.card }}>
            <ChevronRight size={13} style={{ color: T.sub }} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Días */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {byDay.filter(d => d.items.length > 0 || d.iso === today).map(({ date, iso, items, done }) => {
          const isToday = iso === today
          const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
          const MONTH_NAMES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
          return (
            <div key={iso}>
              {/* Cabecera de día */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold uppercase tracking-widest" style={{ color: T.text }}>
                    {DAY_NAMES[date.getDay()]}
                  </span>
                  <span className="text-[13px] font-medium" style={{ color: T.muted }}>
                    {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">HOY</span>
                  )}
                </div>
                {items.length > 0 && (
                  <span className="ml-auto text-[11px] font-semibold" style={{ color: T.muted }}>
                    Listos: {done}/{items.length}
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed py-4 text-center"
                  style={{ borderColor: T.border }}>
                  <span className="text-[12px]" style={{ color: T.muted }}>Sin entregas</span>
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: T.border }}>
                  <table className="w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 130 }} />
                      <col />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: T.card2, borderBottom: `1px solid ${T.border}` }}>
                        {['Tipo','Tarea','Cliente','Responsable','Estado','Última act.'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[9px]"
                            style={{ color: T.muted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const sep = idx > 0 ? `1px solid ${T.border}` : undefined

                        if (item.kind === 'actividad') {
                          const a = item.data
                          const assigneeNames = getActividadAssignees(a)
                          const assignees = assigneeNames
                            .map(n => members.find(m => sameName(n, m.name)))
                            .filter(Boolean) as TeamMember[]
                          return (
                            <tr key={`a-${a.id}`} style={{ borderTop: sep }}
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={() => setSelectedItem(item)}>
                              <td className="px-4 py-3"><ActividadBadge /></td>
                              <td className="px-4 py-3 font-semibold truncate overflow-hidden" style={{ color: T.text, maxWidth: 0 }}>{a.title}</td>
                              <td className="px-4 py-3"><span style={{ color: T.muted }}>—</span></td>
                              <td className="px-4 py-3">
                                {assignees.length > 0 ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex -space-x-1.5">
                                      {assignees.slice(0, 3).map(m => <MemberAvatar key={m.id} member={m} size="xs" />)}
                                    </div>
                                    {assignees.length === 1 ? (
                                      <span className="font-semibold truncate max-w-[90px]" style={{ color: T.sub }}>{assignees[0].name}</span>
                                    ) : (
                                      <span className="font-semibold" style={{ color: T.sub }}>{assignees.length} personas</span>
                                    )}
                                  </div>
                                ) : <span style={{ color: T.muted }}>—</span>}
                              </td>
                              <td className="px-4 py-3"><ActStatusBadge status={a.status} /></td>
                              <td className="px-4 py-3 font-mono text-[10px]" style={{ color: T.muted }}>—</td>
                            </tr>
                          )
                        }

                        const c = item.data
                        const brand = brands.find(b => b.id === c.brandId)
                        const assignees = members.filter(m =>
                          sameName(c.dueAssignee, m.name) ||
                          sameName(c.responsible, m.name) ||
                          c.responsables?.some(r => sameName(r, m.name))
                        )
                        return (
                          <tr key={`c-${c.id}`} style={{ borderTop: sep }}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                            onClick={() => setSelectedItem(item)}>
                            <td className="px-4 py-3"><TipoBadge formato={c.format} /></td>
                            <td className="px-4 py-3 font-semibold truncate overflow-hidden" style={{ color: T.text, maxWidth: 0 }}>{c.title}</td>
                            <td className="px-4 py-3">
                              {brand ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-md flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                    style={{ background: brand.color }}>{brand.initials}</div>
                                  <span className="truncate max-w-[100px]" style={{ color: T.sub }}>{brand.name}</span>
                                </div>
                              ) : <span style={{ color: T.muted }}>—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {assignees.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex -space-x-1">
                                    {assignees.slice(0, 3).map(m => <MemberAvatar key={m.id} member={m} size="xs" />)}
                                  </div>
                                  {assignees.length === 1 && (
                                    <span className="font-semibold truncate max-w-[70px]" style={{ color: T.sub }}>{assignees[0].name}</span>
                                  )}
                                </div>
                              ) : <span style={{ color: T.muted }}>—</span>}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <StatusSelect value={c.status} onChange={s => updateContent(c.id, { status: s })} />
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px]" style={{ color: T.muted }}>
                              {fmtRelative(c.updatedAt)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        {totalItems === 0 && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <p className="text-[16px] font-bold" style={{ color: T.sub }}>Sin entregas esta semana</p>
              <p className="text-[12px] mt-1" style={{ color: T.muted }}>No hay contenidos ni actividades con fecha de entrega en este rango</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel de detalle: contenido usa ContentModal drawer ──────────── */}
      {selectedItem?.kind === 'content' && (
        <ContentModal
          initial={selectedItem.data}
          onClose={() => setSelectedItem(null)}
          mode="drawer"
        />
      )}

      {selectedItem?.kind === 'actividad' && (
        <ActividadModal
          initial={selectedItem.data}
          onClose={() => setSelectedItem(null)}
          mode="drawer"
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA: PIPELINE DE ENTREGAS
// ─────────────────────────────────────────────────────────────────────────────
function PipelineView({
  members, contents, brands: allBrands, T, category,
}: {
  members: TeamMember[]
  contents: Content[]
  brands: import('@/cmhub/types').Brand[]
  T: ReturnType<typeof useTokens>
  category: TeamCategory
}) {
  const { updateContent } = useHub()
  const names = members.map(m => m.name)
  const wf    = getWorkflow(category)
  const isCreativo = category === 'Diseño' || category === 'Audiovisual'

  // Diseño/Audiovisual solo ven: Producción | Revisión | Aprobado
  // Estrategia/CM ven: Idea | Producción | Revisión | Publicado
  const pipelineCols = isCreativo ? [
    { key: 'produccion', label: 'Producción', statuses: ['produccion'],                         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'   },
    { key: 'revision',   label: 'Revisión',   statuses: ['revision', 'cambios'],                color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'  },
    { key: 'aprobado',   label: 'Aprobado',   statuses: ['aprobado','programado','publicado','finalizado'], color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ] : [
    { key: 'idea',       label: 'Idea',        statuses: ['idea'],                               color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'   },
    { key: 'produccion', label: 'Producción',  statuses: ['produccion'],                         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'   },
    { key: 'revision',   label: 'Revisión',    statuses: ['revision', 'cambios'],                color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'  },
    { key: 'publicado',  label: 'Publicado',   statuses: ['aprobado','programado','publicado','finalizado'], color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ]

  const areaContents = contents.filter(c =>
    names.some(n => memberAssigned(c, n)) && wf.active.concat(wf.listos).includes(c.status)
  )

  const week = weekRange(0)
  const thisWeekCount = areaContents.filter(c => {
    const relevant = getContentRelevantDate(c, isCreativo)
    return relevant && relevant >= week.start && relevant <= week.end
  }).length
  const activeBrands  = new Set(areaContents.map(c => c.brandId)).size

  const cols = pipelineCols.map(col => ({
    ...col,
    items: areaContents.filter(c => (col.statuses as readonly string[]).includes(c.status)),
  }))

  function handleDrop(e: React.DragEvent, targetStatus: ContentStatus) {
    const id = e.dataTransfer.getData('contentId')
    if (id) updateContent(id, { status: targetStatus })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
              style={{ color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }}>
              ● Pipeline de Entregas
            </span>
            <h2 className="text-[28px] font-extrabold mt-3 leading-tight" style={{ color: T.text }}>
              Cada entrega,<br />en su lugar
            </h2>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[32px] font-extrabold leading-none" style={{ color: T.text }}>{activeBrands}</p>
              <p className="text-[11px]" style={{ color: T.muted }}>clientes activos</p>
            </div>
            <div>
              <p className="text-[32px] font-extrabold leading-none" style={{ color: T.text }}>{thisWeekCount}</p>
              <p className="text-[11px]" style={{ color: T.muted }}>entregas esta semana</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-6">
        <div className="flex gap-3 h-full min-w-[900px]">
          {cols.map(col => (
            <div key={col.key} className="flex-1 flex flex-col gap-2 min-w-0"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, col.statuses[0] as ContentStatus)}>
              {/* Header col */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border"
                style={{ background: col.bg, borderColor: `${col.color}30` }}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: col.color }}>
                  {col.label}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${col.color}20`, color: col.color }}>{col.items.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {col.items.map(c => {
                  const brand = allBrands.find(b => b.id === c.brandId)
                  const assignees = members.filter(m =>
                    sameName(c.responsible, m.name) ||
                    c.responsables?.some(r => sameName(r, m.name)) ||
                    sameName(c.dueAssignee, m.name)
                  )
                  const diff = dueDiff(getContentRelevantDate(c, isCreativo))
                  const urgente = diff !== null && diff <= 2 && diff >= 0
                  const vencido = diff !== null && diff < 0

                  return (
                    <div key={c.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('contentId', c.id)}
                      className="rounded-2xl border overflow-hidden cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.01]"
                      style={{ background: T.card, borderColor: T.border }}>
                      {/* Color bar */}
                      <div className="h-1.5 w-full" style={{
                        background: brand
                          ? `linear-gradient(90deg, ${brand.color}, ${brand.color}80)`
                          : `linear-gradient(90deg, ${col.color}, ${col.color}60)`
                      }} />
                      <div className="p-3">
                        <p className="text-[12px] font-bold leading-snug mb-1" style={{ color: T.text }}>{c.title}</p>
                        {brand && (
                          <p className="text-[10px] mb-2 truncate" style={{ color: T.muted }}>{brand.name}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-1">
                            {assignees.slice(0, 3).map(m => (
                              <MemberAvatar key={m.id} member={m} size="xs" />
                            ))}
                          </div>
                          {diff !== null ? (
                            <span className="text-[9px] font-bold"
                              style={{ color: vencido ? '#f87171' : urgente ? '#fbbf24' : T.muted }}>
                              {vencido ? `${Math.abs(diff)}d atrás` : diff === 0 ? 'Hoy' : `${diff}d`}
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: c.priority === 'urgente' ? '#f87171' : c.priority === 'alta' ? '#fbbf24' : T.muted }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {col.items.length === 0 && (
                  <div className="flex-1 border-2 border-dashed rounded-2xl flex items-center justify-center min-h-[80px]"
                    style={{ borderColor: T.border }}>
                    <span className="text-[11px]" style={{ color: T.muted }}>Sin entregas</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
type TabKey = 'panel' | 'semana' | 'pipeline'

const TABS: { key: TabKey; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: 'panel',    label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'semana',   label: 'Semana',    Icon: CalendarDays    },
  { key: 'pipeline', label: 'Pipeline',  Icon: Columns3        },
]

export default function EquipoCategoryPage({ category }: { category: TeamCategory }) {
  const { team, contents, brands, actividades, updateTeamMemberArea } = useHub()
  const { isDark } = useHubTheme()
  const auth = useOptionalAuth()
  const authUser = auth?.authUser ?? null
  const T = useTokens(isDark)
  const meta     = CATEGORY_META[category]
  const members  = team.filter(m => (m.category ?? 'Otro') === category)
  const others   = team.filter(m => (m.category ?? 'Otro') !== category)
  const [tab, setTab] = useState<TabKey>('panel')
  const [showAssign, setShowAssign] = useState(false)
  const [pendingItem, setPendingItem] = useState<WeekItem | null>(null)
  const activeToday = useActiveToday(members)

  // Miembro actual → default del filtro en Semana
  const myMember = members.find(m =>
    (authUser?.uid   && m.id === authUser.uid) ||
    (authUser?.email && m.email.toLowerCase() === authUser.email.toLowerCase())
  )

  function openInSemana(item: WeekItem) {
    setPendingItem(item)
    setTab('semana')
  }

  async function changeArea(uid: string, cat: TeamCategory | null) {
    await updateTeamMemberArea(uid, cat)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl transition-colors"
      style={{ background: T.bg }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 h-14 flex items-center gap-3 border-b"
        style={{ background: T.card, borderColor: T.border }}>

        {/* Título área */}
        <CategoryIcon cat={category} size={20} />
        <span className="text-[14px] font-bold" style={{ color: T.text }}>{category}</span>
        <span className="text-[11px]" style={{ color: T.muted }}>· {members.length} miembros</span>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 ml-4 p-0.5 rounded-xl border"
          style={{ background: T.card2, borderColor: T.border }}>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => { if (key !== tab) setPendingItem(null); setTab(key) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer"
              style={tab === key
                ? { background: meta.color, color: '#fff' }
                : { background: 'transparent', color: T.sub }}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Botón asignar */}
        <button onClick={() => setShowAssign(o => !o)}
          className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white cursor-pointer shrink-0 transition-opacity hover:opacity-80"
          style={{ background: showAssign ? T.muted : meta.color }}>
          <UserPlus size={13} />
          {showAssign ? 'Cerrar' : 'Asignar'}
        </button>
      </div>

      {/* ── Panel asignación ─────────────────────────────────────────── */}
      {showAssign && (
        <div className="shrink-0 mx-5 mt-3 rounded-2xl border-2 border-dashed p-4"
          style={{ background: T.card, borderColor: T.border2 }}>
          <p className="text-[12px] font-bold mb-3" style={{ color: T.text }}>
            Asignar a <span style={{ color: meta.color }}>{category}</span>
          </p>
          {others.length === 0
            ? <p className="text-[12px]" style={{ color: T.muted }}>Todos ya están en {category}</p>
            : <div className="flex flex-col gap-1">
                {others.map(m => {
                  const cc = (m.category ?? 'Otro') as TeamCategory
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-xl"
                      style={{ background: T.hover }}>
                      <MemberAvatar member={m} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: T.text }}>{m.name}</p>
                        <p className="text-[10px]" style={{ color: T.muted }}>{m.position ?? m.role}</p>
                      </div>
                      {m.category && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: CATEGORY_META[cc].accent, color: CATEGORY_META[cc].color }}>
                          {m.category}
                        </span>
                      )}
                      <button onClick={() => updateTeamMemberArea(m.id, category)}
                        className="text-[11px] font-semibold px-3 py-1 rounded-xl text-white cursor-pointer shrink-0"
                        style={{ background: meta.color }}>
                        Asignar
                      </button>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      )}

      {/* ── Sin miembros ─────────────────────────────────────────────── */}
      {members.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center"><CategoryIcon cat={category} size={32} /></div>
            <p className="text-[15px] font-bold" style={{ color: T.text }}>Sin miembros asignados</p>
            <p className="text-[13px] mt-1" style={{ color: T.muted }}>
              Usá <strong>"Asignar"</strong> para agregar colaboradores a {category}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'panel' && (
            <PanelView
              members={members}
              contents={contents}
              actividades={actividades}
              T={T}
              accentColor={meta.accent}
              activeToday={activeToday}
              category={category}
              onOpenInSemana={openInSemana}
            />
          )}
          {tab === 'semana' && (
            <SemanaView
              members={members}
              contents={contents}
              T={T}
              category={category}
              initialItem={pendingItem}
              defaultResponsable={myMember?.name ?? null}
            />
          )}
          {tab === 'pipeline' && (
            <PipelineView
              members={members}
              contents={contents}
              brands={brands}
              T={T}
              category={category}
            />
          )}
        </div>
      )}
    </div>
  )
}
