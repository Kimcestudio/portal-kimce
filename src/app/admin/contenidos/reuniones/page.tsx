'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus, Video, CheckCircle2, AlertCircle,
  ChevronRight, Copy, Check, X, Search,
  Calendar, Mic2, Download, Play, Eye, FolderOpen,
  Loader2, ExternalLink, RefreshCw, Link2Off,
  Rows3, Layers, Sparkles, ChevronDown, Bot,
} from 'lucide-react'
import { useHub }      from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useAuth }     from '@/components/auth/AuthProvider'
import { useHubBase }  from '@/cmhub/useHubBase'
import {
  subscribeMeetings, createMeeting, updateMeeting, formatDuration, platformLabel,
  WEBHOOK_URL,
  type HubReunion, type MeetingPlatform, type MeetingParticipant,
} from '@/services/meetings'
import {
  getOAuthStatus, getOAuthUrl, listPersonalEvents,
  type GCalOAuthStatus, type PersonalGCalEvent,
} from '@/services/googleCalendarOAuth'
import { getStoredSession } from '@/services/firebase/auth'

// ── Visual utilities ──────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700', 'from-teal-400 to-emerald-600',
  'from-amber-400 to-orange-500',  'from-rose-400 to-pink-600',
  'from-sky-400 to-blue-600',      'from-indigo-400 to-indigo-600',
  'from-green-400 to-teal-500',    'from-fuchsia-400 to-purple-600',
]

function avatarGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) & 0xffffffff
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MONTHS_LONG  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function parseDateParts(dateStr: string) {
  const [y, m, d] = (dateStr ?? '').split('-').map(Number)
  return { y: y || 0, m: m || 0, d: d || 0 }
}

function isUpcoming(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date(); today.setHours(0,0,0,0)
  const { y, m, d } = parseDateParts(dateStr)
  return new Date(y, m - 1, d) > today
}

function relativeDate(dateStr: string): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const { y, m, d } = parseDateParts(dateStr)
  const target = new Date(y, m - 1, d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff <= 6) return `En ${diff} días`
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

// ── Platform config ───────────────────────────────────────────────────────

const PLATFORM_CFG: Record<MeetingPlatform, { barCls: string; dotCls: string; gradient: string; initial: string }> = {
  google_meet: { barCls: 'bg-emerald-400', dotCls: 'bg-emerald-400', gradient: 'from-emerald-400 to-green-600',  initial: 'M' },
  discord:     { barCls: 'bg-indigo-500',  dotCls: 'bg-indigo-400',  gradient: 'from-indigo-400 to-violet-700',  initial: 'D' },
  zoom:        { barCls: 'bg-sky-400',     dotCls: 'bg-sky-400',     gradient: 'from-sky-400 to-blue-600',       initial: 'Z' },
  manual:      { barCls: 'bg-slate-300',   dotCls: 'bg-slate-300',   gradient: 'from-slate-300 to-slate-500',    initial: '·' },
}

// ── Types ─────────────────────────────────────────────────────────────────

type FilterTab = 'todas' | 'semana' | 'sin_revisar' | 'con_grabacion'
type ViewMode   = 'proyecto' | 'fecha'
type MonthGroup = { label: string; key: string; meetings: HubReunion[] }
interface ProyectoRef { id: string; nombre: string }

interface ProyectoFull extends ProyectoRef {
  brief?: string
  briefUpdatedAt?: string
  autoCreated?: boolean
}

type ProyectoGroup = {
  id: string | null
  nombre: string
  brief: string
  briefUpdatedAt: string
  autoCreated: boolean
  meetings: HubReunion[]
}

function groupByProject(meetings: HubReunion[], proyectos: ProyectoFull[]): ProyectoGroup[] {
  const map = new Map<string | null, HubReunion[]>()
  for (const m of meetings) {
    const pid = m.projectIds?.[0] ?? m.proyectoId ?? null
    if (!map.has(pid)) map.set(pid, [])
    map.get(pid)!.push(m)
  }
  const groups: ProyectoGroup[] = []
  for (const [pid, ms] of map.entries()) {
    const proy = pid ? proyectos.find(p => p.id === pid) : null
    groups.push({
      id:             pid,
      nombre:         proy?.nombre ?? (pid ? pid : 'Sin proyecto'),
      brief:          proy?.brief ?? '',
      briefUpdatedAt: proy?.briefUpdatedAt ?? '',
      autoCreated:    proy?.autoCreated ?? false,
      meetings:       ms,
    })
  }
  // Sort: projects with meetings first (most recent meeting first), "Sin proyecto" last
  return groups.sort((a, b) => {
    if (a.id === null) return 1
    if (b.id === null) return -1
    const latA = a.meetings[0]?.date ?? ''
    const latB = b.meetings[0]?.date ?? ''
    return latB.localeCompare(latA)
  })
}

function groupByMonth(meetings: HubReunion[]): MonthGroup[] {
  const map = new Map<string, HubReunion[]>()
  for (const m of meetings) {
    const { y, m: mo } = parseDateParts(m.date)
    const key = `${y}-${String(mo).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return Array.from(map.entries()).map(([key, ms]) => {
    const { y, m: mo } = parseDateParts(`${key}-01`)
    return { key, label: `${MONTHS_LONG[mo - 1]} ${y}`, meetings: ms }
  })
}

// ── Date tile ─────────────────────────────────────────────────────────────

function DateTile({ dateStr, isDark }: { dateStr: string; isDark: boolean }) {
  const { d, m } = parseDateParts(dateStr)
  if (!d || !m) return null
  return (
    <div className={`flex flex-col items-center justify-center w-9 h-11 rounded-xl flex-shrink-0 select-none ${
      isDark ? 'bg-violet-500/10' : 'bg-violet-50'
    }`}>
      <span className={`text-[9px] font-bold uppercase leading-none tracking-wider ${isDark ? 'text-violet-400' : 'text-violet-500'}`}>
        {MONTHS_SHORT[m - 1]}
      </span>
      <span className={`text-[16px] font-extrabold leading-none mt-0.5 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
        {d}
      </span>
    </div>
  )
}

// ── Avatar stack ──────────────────────────────────────────────────────────

function AvatarStack({ participants, isDark, max = 3 }: { participants: MeetingParticipant[]; isDark: boolean; max?: number }) {
  if (!participants.length) return <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</span>
  const shown = participants.slice(0, max)
  const extra = participants.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <div key={i} title={p.name}
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} border-2 ${isDark ? 'border-[#161820]' : 'border-white'} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
          {getInitials(p.name)}
        </div>
      ))}
      {extra > 0 && (
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${
          isDark ? 'border-[#161820] bg-white/10 text-slate-400' : 'border-white bg-slate-100 text-slate-500'
        }`}>+{extra}</div>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function RowSkeleton({ isDark }: { isDark: boolean }) {
  const s = isDark ? 'bg-white/8' : 'bg-slate-100'
  return (
    <div className={`flex items-center gap-3 pl-4 pr-4 py-3.5 animate-pulse border-b last:border-0 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
      <div className={`w-1 self-stretch rounded-full ${s}`} />
      <div className={`w-9 h-11 rounded-xl ${s}`} />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`h-3.5 rounded w-48 ${s}`} />
        <div className={`h-3 rounded w-28 ${s}`} style={{ opacity: .6 }} />
      </div>
      <div className="hidden md:flex items-center gap-5">
        <div className={`flex -space-x-1.5`}>{[1,2].map(i => <div key={i} className={`w-6 h-6 rounded-full ${s}`} />)}</div>
        <div className={`h-3 rounded w-10 ${s}`} />
        <div className={`h-6 rounded-full w-20 ${s}`} />
      </div>
      <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className={`w-6 h-6 rounded-lg ${s}`} />)}</div>
    </div>
  )
}

// ── Meeting row ───────────────────────────────────────────────────────────

function MeetingRow({
  m, base, isDark, isAdmin, isLast, proyectos, onToggleReviewed,
}: {
  m: HubReunion; base: string; isDark: boolean; isAdmin: boolean; isLast: boolean;
  proyectos: ProyectoRef[]; onToggleReviewed: (m: HubReunion) => void;
}) {
  const pendingCnt = m.actionItems.filter(a => !a.done).length
  const projectName = useMemo(() => {
    const id = m.projectIds?.[0] ?? m.proyectoId
    return id ? proyectos.find(p => p.id === id)?.nombre : null
  }, [m.projectIds, m.proyectoId, proyectos])

  const { barCls, dotCls } = PLATFORM_CFG[m.platform]

  return (
    <div className={`group flex items-center gap-3 pl-3 pr-4 py-3.5 transition-colors ${
      !isLast ? `border-b ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''
    } ${isDark ? 'hover:bg-white/4' : 'hover:bg-violet-50/50'}`}>

      {/* Platform accent bar */}
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${barCls} opacity-50 group-hover:opacity-80 transition-opacity`} />

      {/* Date tile */}
      <DateTile dateStr={m.date} isDark={isDark} />

      {/* Content */}
      <Link href={`${base}/reuniones/${m.id}`} className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2 mb-0.5 min-w-0">
          <span className={`text-[13px] font-semibold leading-snug truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {m.title}
          </span>
          {projectName && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
              isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-700'
            }`}>
              <FolderOpen size={8} />{projectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
          <span className={`text-[11px] leading-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {platformLabel(m.platform)}
            {m.time    ? ` · ${m.time}` : ''}
            {m.duration ? ` · ${formatDuration(m.duration)}` : ''}
          </span>
        </div>
      </Link>

      {/* Stats columns */}
      <div className="hidden md:flex items-center gap-5 flex-shrink-0">
        {/* Team avatars */}
        <div className="w-[72px] flex justify-end">
          <AvatarStack participants={m.participants} isDark={isDark} />
        </div>

        {/* Pending */}
        <div className="w-14 text-center">
          <span className={`text-[13px] font-bold tabular-nums leading-none ${
            pendingCnt > 0 ? isDark ? 'text-amber-400' : 'text-amber-500' : isDark ? 'text-slate-700' : 'text-slate-300'
          }`}>{pendingCnt}/{m.actionItems.length}</span>
        </div>

        {/* Status */}
        {m.status === 'reviewed' ? (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold w-[82px] justify-center ${
            isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
          }`}>
            <CheckCircle2 size={9} /> Revisado
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold w-[82px] justify-center ${
            isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
          }`}>
            <AlertCircle size={9} /> Pendiente
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {m.recordingUrl && (
          <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-violet-400' : 'hover:bg-violet-50 text-violet-600'}`}>
            <Play size={12} fill="currentColor" />
          </a>
        )}
        {isAdmin && (
          <button onClick={e => { e.preventDefault(); onToggleReviewed(m) }}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500'}`}>
            <Check size={12} />
          </button>
        )}
        <Link href={`${base}/reuniones/${m.id}`}
          className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500'}`}>
          <Eye size={12} />
        </Link>
      </div>
    </div>
  )
}

// ── Month group card (Apple list-in-container) ────────────────────────────

function MonthGroupCard({
  group, base, isDark, isAdmin, proyectos, onToggleReviewed,
}: {
  group: MonthGroup; base: string; isDark: boolean; isAdmin: boolean;
  proyectos: ProyectoRef[]; onToggleReviewed: (m: HubReunion) => void;
}) {
  return (
    <div>
      {/* Month header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`text-[13px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {group.label}
        </span>
        <span className={`text-[11px] font-semibold tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {group.meetings.length}
        </span>
        <div className="flex-1" />
        {isAdmin && (
          <button onClick={() => exportGroupCSV(group.label, group.meetings)}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
            }`}>
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {/* Container card */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Column headers */}
        <div className={`flex items-center gap-3 pl-5 pr-4 py-2 border-b ${
          isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="w-9 flex-shrink-0" />
          <div className={`flex-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Reunión
          </div>
          <div className="hidden md:flex items-center gap-5 flex-shrink-0">
            <div className={`w-[72px] text-right text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Equipo
            </div>
            <div className={`w-14 text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Pend.
            </div>
            <div className={`w-[82px] text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Estado
            </div>
          </div>
          <div className="w-[60px] flex-shrink-0" />
        </div>

        {/* Rows */}
        {group.meetings.map((m, i) => (
          <MeetingRow
            key={m.id} m={m} base={base} isDark={isDark} isAdmin={isAdmin}
            isLast={i === group.meetings.length - 1}
            proyectos={proyectos} onToggleReviewed={onToggleReviewed}
          />
        ))}
      </div>
    </div>
  )
}

// ── Proyecto group card ───────────────────────────────────────────────────

function ProyectoGroupCard({
  group, base, isDark, isAdmin, proyectos, onToggleReviewed,
}: {
  group: ProyectoGroup; base: string; isDark: boolean; isAdmin: boolean;
  proyectos: ProyectoRef[]; onToggleReviewed: (m: HubReunion) => void;
}) {
  const [briefOpen, setBriefOpen] = useState(!!group.brief)
  const totalItems    = group.meetings.reduce((s, m) => s + m.actionItems.length, 0)
  const pendingItems  = group.meetings.reduce((s, m) => s + m.actionItems.filter(a => !a.done).length, 0)
  const sinRevisar    = group.meetings.filter(m => m.status === 'pending_review').length

  return (
    <div>
      {/* Group header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {group.id === null ? (
            <Link2Off size={13} className={isDark ? 'text-slate-600' : 'text-slate-400'} />
          ) : (
            <FolderOpen size={13} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
          )}
          <span className={`text-[13px] font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {group.nombre}
          </span>
          {group.autoCreated && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
              isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <Bot size={8} /> Auto-creado · pendiente de confirmar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <span className={`text-[11px] font-semibold tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {group.meetings.length} {group.meetings.length === 1 ? 'reunión' : 'reuniones'}
          </span>
          {pendingItems > 0 && (
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              <AlertCircle size={10} /> {pendingItems} pend.
            </span>
          )}
          {sinRevisar > 0 && (
            <span className={`text-[11px] font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
              {sinRevisar} sin revisar
            </span>
          )}
          {isAdmin && group.id && (
            <button onClick={() => exportGroupCSV(group.nombre, group.meetings)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <Download size={10} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* Container card */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'
      }`}>

        {/* Brief section (collapsible) */}
        {group.brief && (
          <div className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <button
              onClick={() => setBriefOpen(o => !o)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                isDark ? 'hover:bg-white/4' : 'hover:bg-slate-50'
              }`}
            >
              <Sparkles size={11} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
              <span className={`text-[11px] font-semibold flex-1 ${isDark ? 'text-violet-400' : 'text-violet-700'}`}>
                Brief del proyecto
              </span>
              {group.briefUpdatedAt && (
                <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Actualizado {group.briefUpdatedAt.slice(0, 10)}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${briefOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
            {briefOpen && (
              <div className={`px-4 pb-4 text-[12.5px] leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {group.brief}
              </div>
            )}
          </div>
        )}

        {/* Column headers */}
        <div className={`flex items-center gap-3 pl-5 pr-4 py-2 border-b ${
          isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="w-9 flex-shrink-0" />
          <div className={`flex-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Reunión
          </div>
          <div className="hidden md:flex items-center gap-5 flex-shrink-0">
            <div className={`w-[72px] text-right text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Equipo</div>
            <div className={`w-14 text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Pend.</div>
            <div className={`w-[82px] text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Estado</div>
          </div>
          <div className="w-[60px] flex-shrink-0" />
        </div>

        {/* Rows */}
        {group.meetings.map((m, i) => (
          <MeetingRow
            key={m.id} m={m} base={base} isDark={isDark} isAdmin={isAdmin}
            isLast={i === group.meetings.length - 1}
            proyectos={proyectos} onToggleReviewed={onToggleReviewed}
          />
        ))}
      </div>
    </div>
  )
}

// ── Google Calendar sidebar ───────────────────────────────────────────────

function CalendarSidebar({
  isDark, isAdmin, onNewMeeting,
}: {
  isDark: boolean; isAdmin: boolean; onNewMeeting: () => void;
}) {
  const [oauthStatus, setOauthStatus] = useState<GCalOAuthStatus | null>(null)
  const [events, setEvents]           = useState<PersonalGCalEvent[]>([])
  const [loading, setLoading]         = useState(true)
  const [connecting, setConnecting]   = useState(false)
  const [refreshKey, setRefreshKey]   = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const status = await getOAuthStatus()
        if (cancelled) return
        setOauthStatus(status)
        if (status.connected) {
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0)
          const twoWeeks = new Date(tomorrow); twoWeeks.setDate(twoWeeks.getDate() + 14)
          const evs = await listPersonalEvents({ timeMin: tomorrow.toISOString(), timeMax: twoWeeks.toISOString() })
          if (!cancelled) setEvents(evs.filter(e => e.status !== 'cancelled'))
        }
      } catch {
        if (!cancelled) setOauthStatus({ connected: false })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  async function handleConnect() {
    setConnecting(true)
    try {
      const session = getStoredSession()
      const url = await getOAuthUrl({ loginHint: session?.email ?? undefined })
      window.location.href = url
    } catch {
      setConnecting(false)
    }
  }

  return (
    <aside className={`w-64 flex-shrink-0 rounded-2xl border flex flex-col overflow-hidden ${
      isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-violet-500/15' : 'bg-violet-50'}`}>
            <Calendar size={12} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
          </div>
          <div className="min-w-0">
            <p className={`text-[13px] font-bold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Próximas</p>
            <p className={`text-[10px] leading-tight truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {loading ? 'Cargando…'
                : oauthStatus?.connected ? (oauthStatus.email ?? 'Google Calendar')
                : 'Sin conectar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {oauthStatus?.connected && !loading && (
            <button onClick={() => setRefreshKey(k => k + 1)} title="Actualizar"
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/8 hover:text-slate-300' : 'text-slate-400 hover:bg-slate-100'}`}>
              <RefreshCw size={12} />
            </button>
          )}
          {isAdmin && (
            <button onClick={onNewMeeting} title="Nueva reunión manual"
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
              <Plus size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col py-2">
            {[1,2,3].map(i => (
              <div key={i} className={`flex items-start gap-2.5 px-4 py-3 animate-pulse`}>
                <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className={`h-2.5 rounded w-16 ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
                  <div className={`h-3 rounded w-32 ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
                  <div className={`h-2.5 rounded w-24 ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : !oauthStatus?.connected ? (
          /* Connect state */
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Calendar size={18} className={`opacity-40 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className={`text-[12px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Conecta tu calendario
              </p>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Ve tus próximas reuniones programadas directamente aquí.
              </p>
            </div>
            <button onClick={handleConnect} disabled={connecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60 w-full justify-center">
              {connecting ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
              {connecting ? 'Redirigiendo…' : 'Conectar Google Calendar'}
            </button>
          </div>
        ) : events.length === 0 ? (
          /* Empty connected state */
          <div className="flex flex-col items-center gap-2.5 py-10 px-4 text-center">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Calendar size={16} className="opacity-40" />
            </div>
            <p className={`text-[12px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Sin eventos próximos
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Los próximos 14 días están libres.
            </p>
          </div>
        ) : (
          /* Events list */
          <div className="py-1.5">
            {events.map(ev => (
              <GCalEventItem key={ev.id} event={ev} isDark={isDark} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function GCalEventItem({ event, isDark }: { event: PersonalGCalEvent; isDark: boolean }) {
  return (
    <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
      className={`flex items-start gap-2.5 px-4 py-2.5 group transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
      {/* Left bar */}
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isDark ? 'bg-violet-500/60' : 'bg-violet-400/60'} group-hover:opacity-100 transition-opacity`} />
      <div className="flex-1 min-w-0">
        {/* Date + time */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-[10px] font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
            {relativeDate(event.date)}
          </span>
          {event.startTime && (
            <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {event.startTime}
            </span>
          )}
        </div>
        {/* Title */}
        <p className={`text-[12px] font-semibold leading-tight truncate mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {event.title}
        </p>
        {/* Attendees or duration */}
        {event.attendees?.length > 0 ? (
          <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {event.attendees.slice(0, 2).map(a => a.name || a.email.split('@')[0]).join(', ')}
            {event.attendees.length > 2 ? ` +${event.attendees.length - 2}` : ''}
          </p>
        ) : event.location ? (
          <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{event.location}</p>
        ) : null}
      </div>
    </a>
  )
}

// ── Export CSV ────────────────────────────────────────────────────────────

function exportGroupCSV(label: string, meetings: HubReunion[]) {
  const header = 'Título,Fecha,Hora,Plataforma,Participantes,Duración,Pendientes,Estado'
  const rows = meetings.map(m => [
    `"${m.title.replace(/"/g, '""')}"`, m.date, m.time || '', platformLabel(m.platform),
    m.participants.map(p => p.name).join(' · '),
    m.duration ? formatDuration(m.duration) : '',
    m.actionItems.filter(a => !a.done).length,
    m.status === 'reviewed' ? 'Revisado' : 'Pendiente',
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `reuniones-${label.replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
}

const PLATFORMS: { value: MeetingPlatform; label: string }[] = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'discord',     label: 'Discord' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'manual',      label: 'Otra / Manual' },
]

// ── Main component ────────────────────────────────────────────────────────

export default function ReunionesPage() {
  const { isDark }              = useHubTheme()
  const { team, proyectos }     = useHub()
  const { profile }             = useAuth()
  const base                    = useHubBase()
  const isAdmin                 = profile?.role?.toLowerCase() === 'admin'

  const [meetings, setMeetings]   = useState<HubReunion[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('todas')
  const [view, setView]           = useState<ViewMode>('proyecto')
  const [copied, setCopied]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [busy, setBusy]           = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    title: '', date: new Date().toISOString().slice(0, 10), time: '',
    platform: 'google_meet' as MeetingPlatform,
    participants: [] as string[],
    summary: '', recordingUrl: '', actionItemsRaw: '',
  })

  const proyectosRef: ProyectoRef[] = useMemo(
    () => (proyectos as Array<{ id: string; nombre: string }>).map(p => ({ id: p.id, nombre: p.nombre })),
    [proyectos]
  )

  useEffect(() => {
    const unsub = subscribeMeetings(ms => { setMeetings(ms); setLoading(false) })
    return unsub
  }, [])

  const past = useMemo(() => meetings.filter(m => !isUpcoming(m.date)), [meetings])

  const filtered = useMemo(() => {
    let list = past
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q) || m.participants.some(p => p.name.toLowerCase().includes(q)))
    }
    if (filterTab === 'semana') {
      const tod = new Date(); tod.setHours(0,0,0,0)
      const ws  = new Date(tod); ws.setDate(tod.getDate() - tod.getDay())
      list = list.filter(m => { const { y, m: mo, d } = parseDateParts(m.date); return new Date(y, mo - 1, d) >= ws })
    }
    if (filterTab === 'sin_revisar')   list = list.filter(m => m.status === 'pending_review')
    if (filterTab === 'con_grabacion') list = list.filter(m => !!m.recordingUrl)
    return list
  }, [past, search, filterTab])

  const monthGroups    = useMemo(() => groupByMonth(filtered), [filtered])
  const proyectoGroups = useMemo(
    () => groupByProject(past, proyectos as unknown as ProyectoFull[]),
    [past, proyectos]
  )

  const totalPending = useMemo(() => meetings.reduce((a, m) => a + m.actionItems.filter(i => !i.done).length, 0), [meetings])
  const thisWeekCnt  = useMemo(() => {
    const tod = new Date(); tod.setHours(0,0,0,0)
    const ws  = new Date(tod); ws.setDate(tod.getDate() - tod.getDay())
    return meetings.filter(m => { const { y, m: mo, d } = parseDateParts(m.date); return new Date(y, mo - 1, d) >= ws }).length
  }, [meetings])

  async function handleToggleReviewed(m: HubReunion) {
    const next = m.status === 'reviewed' ? 'pending_review' : 'reviewed'
    try { await updateMeeting(m.id, { status: next }) } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date) { setFormError('Nombre y fecha son obligatorios.'); return }
    setBusy(true); setFormError('')
    try {
      const participants = form.participants
        .map(id => { const mb = team.find(t => t.id === id); return mb ? { name: mb.name, email: mb.email, uid: mb.id } : null })
        .filter(Boolean) as { name: string; email: string; uid: string }[]
      const actionItems = form.actionItemsRaw.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text }))
      const { id } = await createMeeting({ title: form.title.trim(), date: form.date, time: form.time, platform: form.platform, participants, summary: form.summary, actionItems, recordingUrl: form.recordingUrl })
      setShowForm(false)
      window.location.href = `${base}/reuniones/${id}`
    } catch (err) {
      setFormError((err as { message?: string })?.message ?? 'No se pudo crear.')
    } finally { setBusy(false) }
  }

  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none transition focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 ${
    isDark ? 'bg-[#1e2027] border-white/10 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
  }`

  const sinRevisarCnt  = past.filter(m => m.status === 'pending_review').length
  const conGrabCnt     = past.filter(m => !!m.recordingUrl).length

  const FILTER_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'todas',         label: 'Todas',         count: past.length },
    { id: 'semana',        label: 'Esta semana' },
    { id: 'sin_revisar',   label: 'Sin revisar',   count: sinRevisarCnt },
    { id: 'con_grabacion', label: 'Con grabación', count: conGrabCnt },
  ]

  return (
    <div className="flex flex-col gap-5 pb-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-[22px] font-bold tracking-tight leading-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
            Reuniones
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {past.length} registradas
            </span>
            {totalPending > 0 && (
              <span className={`flex items-center gap-1 text-[12px] font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                <AlertCircle size={11} /> {totalPending} pendientes
              </span>
            )}
            {thisWeekCnt > 0 && (
              <span className={`text-[12px] ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                {thisWeekCnt} esta semana
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-colors ${
                isDark ? 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Webhook'}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-500/25">
              <Plus size={13} /> Nueva reunión
            </button>
          )}
        </div>
      </div>

      {/* ── Webhook collapsible ── */}
      {isAdmin && (
        <details className={`group rounded-xl border px-4 py-2.5 text-[12px] ${isDark ? 'border-white/8 bg-white/3' : 'border-slate-200 bg-slate-50'}`}>
          <summary className={`cursor-pointer select-none flex items-center gap-2 font-medium list-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Mic2 size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            Conectar Fathom / Fireflies para grabaciones automáticas
            <ChevronRight size={11} className={`ml-auto transition-transform group-open:rotate-90 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          </summary>
          <p className={`mt-2 leading-relaxed text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Fathom → Settings → Webhooks, pega la URL. Header: <code className={`px-1 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-white/8 text-violet-300' : 'bg-slate-200 text-violet-700'}`}>x-webhook-secret</code>
          </p>
        </details>
      )}

      {/* ── View toggle + filter toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* View segmented control */}
        <div className={`flex items-center gap-0.5 p-1 rounded-xl border flex-shrink-0 ${
          isDark ? 'border-white/8 bg-white/3' : 'border-slate-200 bg-slate-50'
        }`}>
          {([
            { id: 'proyecto' as ViewMode, label: 'Por proyecto', icon: <Layers size={12} /> },
            { id: 'fecha'    as ViewMode, label: 'Por fecha',    icon: <Rows3  size={12} /> },
          ]).map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                view === v.id
                  ? isDark ? 'bg-violet-600 text-white' : 'bg-white shadow-sm text-violet-700 shadow-slate-200/80'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>

        {/* Filter tabs (only in fecha view) */}
        {view === 'fecha' && (
          <div className={`flex items-center gap-1 p-1 rounded-xl border flex-1 min-w-0 ${
            isDark ? 'border-white/8 bg-white/3' : 'border-slate-200 bg-slate-50 shadow-sm'
          }`}>
            {FILTER_TABS.map(ft => (
              <button key={ft.id} onClick={() => setFilterTab(ft.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                  filterTab === ft.id
                    ? isDark ? 'bg-violet-600 text-white' : 'bg-white shadow-sm text-violet-700 shadow-slate-200/80'
                    : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {ft.label}
                {ft.count !== undefined && ft.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                    filterTab === ft.id
                      ? isDark ? 'bg-white/20' : 'bg-violet-100 text-violet-600'
                      : isDark ? 'bg-white/8 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>{ft.count}</span>
                )}
              </button>
            ))}
            <div className="flex-1" />
          </div>
        )}

        {/* Search */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors flex-shrink-0 ${
          isDark ? 'border-white/8 bg-white/3 hover:bg-white/8' : 'border-slate-200 bg-slate-50 hover:bg-white'
        } ${search ? isDark ? '!bg-white/8' : '!bg-white shadow-sm' : ''}`}>
          <Search size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <input type="search" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
            className={`w-28 bg-transparent outline-none text-[12px] ${isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`} />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={11} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* Left: main list */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'}`}>
              {[1, 2, 3, 4].map(i => <RowSkeleton key={i} isDark={isDark} />)}
            </div>
          ) : view === 'proyecto' ? (
            /* ── Vista por proyecto ── */
            past.length === 0 ? (
              <div className={`flex flex-col items-center gap-3 py-16 text-center rounded-2xl border ${isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'}`}>
                <Video size={24} className="opacity-30" />
                <p className={`text-[15px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Sin reuniones</p>
                <p className={`text-[12px] max-w-xs mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Las grabaciones desde Fathom aparecerán aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {proyectoGroups
                  .filter(g => !search || g.meetings.some(m =>
                    m.title.toLowerCase().includes(search.toLowerCase()) ||
                    m.participants.some(p => p.name.toLowerCase().includes(search.toLowerCase()))
                  ))
                  .map(g => (
                    <ProyectoGroupCard
                      key={g.id ?? '__sin_proyecto__'} group={g} base={base} isDark={isDark} isAdmin={isAdmin}
                      proyectos={proyectosRef} onToggleReviewed={handleToggleReviewed}
                    />
                  ))}
              </div>
            )
          ) : (
            /* ── Vista por fecha ── */
            filtered.length === 0 ? (
              <div className={`flex flex-col items-center gap-3 py-16 text-center rounded-2xl border ${
                isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <Video size={24} className="opacity-30" />
                </div>
                <div>
                  <p className={`text-[15px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {search ? 'Sin resultados' : filterTab === 'sin_revisar' ? 'Todo al día' : filterTab === 'con_grabacion' ? 'Sin grabaciones' : 'Sin reuniones'}
                  </p>
                  <p className={`text-[12px] max-w-xs mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {search ? 'Prueba con otro título o nombre.'
                      : filterTab === 'sin_revisar' ? 'Todas las reuniones están revisadas.'
                      : 'Las grabaciones desde Fathom aparecerán aquí.'}
                  </p>
                </div>
                {(search || filterTab !== 'todas') && (
                  <button onClick={() => { setSearch(''); setFilterTab('todas') }}
                    className={`text-[12px] font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                    Ver todas
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {monthGroups.map(group => (
                  <MonthGroupCard
                    key={group.key} group={group} base={base} isDark={isDark} isAdmin={isAdmin}
                    proyectos={proyectosRef} onToggleReviewed={handleToggleReviewed}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Right: Google Calendar sidebar */}
        <div className="hidden lg:block sticky top-6">
          <CalendarSidebar
            isDark={isDark}
            isAdmin={isAdmin}
            onNewMeeting={() => setShowForm(true)}
          />
        </div>
      </div>

      {/* ── Create modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className={`w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-[#161820]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <div>
                <h2 className={`text-[16px] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Nueva reunión</h2>
                <p className={`text-[12px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Registro manual de sesión</p>
              </div>
              <button onClick={() => setShowForm(false)} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-5">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>¿Cuándo?</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Título *</label>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Revisión semanal de contenidos" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Fecha *</label>
                      <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Hora</label>
                      <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PLATFORMS.map(p => {
                      const cfg = PLATFORM_CFG[p.value]; const sel = form.platform === p.value
                      return (
                        <button key={p.value} type="button" onClick={() => setForm({ ...form, platform: p.value })}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                            sel ? isDark ? 'border-violet-500 bg-violet-500/15 text-violet-400' : 'border-violet-500 bg-violet-50 text-violet-700'
                               : isDark ? 'border-white/8 bg-white/5 text-slate-400 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.gradient} flex items-center justify-center font-bold text-white text-[11px]`}>{cfg.initial}</div>
                          {p.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>¿Quiénes?</p>
                <div className="flex flex-wrap gap-2">
                  {team.map(mb => {
                    const sel = form.participants.includes(mb.id)
                    return (
                      <label key={mb.id} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-[12px] font-semibold cursor-pointer select-none transition-colors ${
                        sel ? 'bg-violet-600 border-violet-600 text-white' : isDark ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}>
                        <input type="checkbox" className="sr-only" checked={sel} onChange={ev => setForm({ ...form, participants: ev.target.checked ? [...form.participants, mb.id] : form.participants.filter(id => id !== mb.id) })} />
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(mb.name)} flex items-center justify-center text-[9px] font-bold text-white`}>{getInitials(mb.name)}</div>
                        {mb.name.split(' ')[0]}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Contenido</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Resumen</label>
                    <textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="¿De qué trató la reunión?" className={`${inputCls} resize-y`} />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Pendientes (una por línea)</label>
                    <textarea rows={3} value={form.actionItemsRaw} onChange={e => setForm({ ...form, actionItemsRaw: e.target.value })} placeholder={'Luis: Enviar propuesta\nMaria: Preparar reporte'} className={`${inputCls} resize-y`} />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Link de grabación</label>
                    <input type="url" value={form.recordingUrl} onChange={e => setForm({ ...form, recordingUrl: e.target.value })} placeholder="https://…" className={inputCls} />
                  </div>
                </div>
              </div>
              {formError && <p className="text-[12px] text-red-500 font-medium">{formError}</p>}
              <div className={`flex gap-2.5 pt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <button type="button" onClick={() => setShowForm(false)} disabled={busy}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Cancelar
                </button>
                <button type="submit" disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60">
                  {busy ? 'Guardando…' : 'Crear reunión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
