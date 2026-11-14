'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Video, Clock, CheckCircle2, ExternalLink, ChevronRight,
  Search, X, Calendar, Play, Eye, Check, AlertCircle,
} from 'lucide-react'
import { useHubTheme } from '@/cmhub/theme'
import { useAuth }     from '@/components/auth/AuthProvider'
import { useHubBase }  from '@/cmhub/useHubBase'
import {
  subscribeMyMeetings, formatDuration, platformLabel,
  type HubReunion, type MeetingPlatform, type MeetingParticipant,
} from '@/services/meetings'

// ── Visual utilities ───────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-teal-400 to-emerald-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600',
  'from-sky-400 to-blue-600',
  'from-indigo-400 to-indigo-600',
  'from-green-400 to-teal-500',
  'from-fuchsia-400 to-purple-600',
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
  return new Date(y, m - 1, d) >= today
}

// ── Platform config ────────────────────────────────────────────────────────

const PLATFORM_CFG: Record<MeetingPlatform, { gradient: string; initial: string }> = {
  google_meet: { gradient: 'from-emerald-400 to-green-600', initial: 'M' },
  discord:     { gradient: 'from-indigo-400 to-violet-700', initial: 'D' },
  zoom:        { gradient: 'from-sky-400 to-blue-600',      initial: 'Z' },
  manual:      { gradient: 'from-slate-300 to-slate-500',   initial: '·' },
}

function PlatformBadge({ platform, size = 28 }: { platform: MeetingPlatform; size?: number }) {
  const { gradient, initial } = PLATFORM_CFG[platform]
  return (
    <div className={`rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </div>
  )
}

// Date tile — Image #3 "Jan 23" colored box
function DateTile({ dateStr, platform, isDark }: { dateStr: string; platform: MeetingPlatform; isDark: boolean }) {
  const { d, m } = parseDateParts(dateStr)
  const { gradient } = PLATFORM_CFG[platform]
  if (!d || !m) return <div className={`w-10 h-12 rounded-xl ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
  return (
    <div className={`flex flex-col items-center justify-center w-10 h-12 rounded-xl bg-gradient-to-br ${gradient} flex-shrink-0`}>
      <span className="text-[9px] font-bold text-white/70 uppercase leading-none">{MONTHS_SHORT[m - 1]}</span>
      <span className="text-[16px] font-extrabold text-white leading-none">{d}</span>
    </div>
  )
}

// Avatar stack
function AvatarStack({ participants, isDark }: { participants: MeetingParticipant[]; isDark: boolean }) {
  if (!participants.length) return null
  const shown = participants.slice(0, 3)
  const extra = participants.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <div key={i} title={p.name}
          className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} border-2 ${isDark ? 'border-[#161820]' : 'border-white'} flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0`}>
          {getInitials(p.name)}
        </div>
      ))}
      {extra > 0 && (
        <div className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-[#161820] bg-white/10 text-slate-300' : 'border-white bg-slate-100 text-slate-500'} flex items-center justify-center text-[8px] font-semibold`}>
          +{extra}
        </div>
      )}
    </div>
  )
}

// ── Filter tab ────────────────────────────────────────────────────────────

type FilterTab = 'todas' | 'semana' | 'mis_pendientes' | 'con_grabacion' | 'proximas'

// ── Month grouping ─────────────────────────────────────────────────────────

type MonthGroup = { label: string; key: string; meetings: HubReunion[] }

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

// ── Skeleton ──────────────────────────────────────────────────────────────

function RowSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? 'bg-white/8' : 'bg-slate-200'
  const card = isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200'
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border animate-pulse ${card}`}>
      <div className={`w-10 h-12 rounded-xl flex-shrink-0 ${base}`} />
      <div className={`w-7 h-7 rounded-xl flex-shrink-0 ${base}`} />
      <div className="flex-1">
        <div className={`h-3.5 rounded w-40 mb-1.5 ${base}`} />
        <div className={`h-3 rounded w-24 ${base}`} style={{ opacity: 0.6 }} />
      </div>
      <div className={`w-16 h-6 rounded-full ${base}`} />
    </div>
  )
}

// ── Meeting row ───────────────────────────────────────────────────────────

function MeetingRow({
  m, base, isDark, myName,
}: { m: HubReunion; base: string; isDark: boolean; myName: string }) {
  const myItems   = m.actionItems.filter(a =>
    a.assignee && myName &&
    a.assignee.toLowerCase().includes(myName.toLowerCase().split(' ')[0])
  )
  const myPending = myItems.filter(a => !a.done)
  const allDone   = myItems.length > 0 && myPending.length === 0

  return (
    <div className={`group relative flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-150 hover:shadow-md hover:-translate-y-px ${
      isDark
        ? 'bg-[#161820] border-white/8 hover:border-white/15'
        : 'bg-white border-slate-200 shadow-sm hover:border-violet-200 hover:shadow-violet-50'
    }`}>
      {/* Date tile */}
      <DateTile dateStr={m.date} platform={m.platform} isDark={isDark} />

      {/* Platform badge */}
      <PlatformBadge platform={m.platform} size={28} />

      {/* Content — clickable */}
      <Link href={`${base}/reuniones/${m.id}`} className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={`text-[13px] font-semibold leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          {m.title}
        </span>
        <div className={`flex items-center gap-1.5 text-[11px] flex-wrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <span>{platformLabel(m.platform)}</span>
          {m.time && <><span>·</span><span>{m.time}</span></>}
          {m.duration && <><span>·</span><span>{formatDuration(m.duration)}</span></>}
          {/* Mis pendientes inline indicator */}
          {myPending.length > 0 && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              · <Clock size={9} /> {myPending.length} tuyo{myPending.length !== 1 ? 's' : ''}
            </span>
          )}
          {allDone && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              · <Check size={9} /> listo
            </span>
          )}
        </div>
      </Link>

      {/* Stats (desktop) */}
      <div className="hidden md:flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-center gap-1 w-14">
          <AvatarStack participants={m.participants} isDark={isDark} />
          <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {m.participants.length} pers.
          </span>
        </div>

        {/* My pending stat */}
        {myItems.length > 0 && (
          <div className="flex flex-col items-center gap-1 w-16">
            <span className={`text-[13px] font-bold tabular-nums ${
              myPending.length > 0 ? isDark ? 'text-amber-400' : 'text-amber-600' : isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {myPending.length} / {myItems.length}
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>mis pend.</span>
          </div>
        )}

        {m.status === 'reviewed' ? (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
            isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
          }`}>
            <CheckCircle2 size={9} /> Revisado
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
            isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
          }`}>
            <AlertCircle size={9} /> Pendiente
          </span>
        )}
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
        {m.recordingUrl && (
          <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer"
            title="Ver grabación"
            onClick={e => e.stopPropagation()}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-violet-400' : 'hover:bg-violet-50 text-violet-600'}`}>
            <Play size={12} fill="currentColor" />
          </a>
        )}
        <Link href={`${base}/reuniones/${m.id}`}
          title="Ver detalle"
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
          <Eye size={12} />
        </Link>
        <ChevronRight size={13} className={`${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
      </div>
    </div>
  )
}

// ── Upcoming card ─────────────────────────────────────────────────────────

function UpcomingCard({ m, base, isDark }: { m: HubReunion; base: string; isDark: boolean }) {
  const { d, m: mo } = parseDateParts(m.date)
  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl border ${
      isDark ? 'bg-[#161820] border-violet-500/20' : 'bg-white border-violet-200 shadow-sm'
    }`}>
      <div className="flex-shrink-0 text-center w-12 pt-0.5">
        <p className={`text-[10px] font-bold uppercase ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{MONTHS_SHORT[mo - 1]}</p>
        <p className={`text-[22px] font-extrabold leading-none mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{d}</p>
        {m.time && <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.time}</p>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${PLATFORM_CFG[m.platform].gradient} mb-1`}>
              {platformLabel(m.platform)}
            </span>
            {m.duration && <span className={`ml-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatDuration(m.duration)}</span>}
            <p className={`text-[14px] font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{m.title}</p>
          </div>
          {m.recordingUrl ? (
            <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-bold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-500/25">
              <ExternalLink size={11} /> Unirse
            </a>
          ) : (
            <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold ${
              isDark ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              <Calendar size={11} /> Programada
            </span>
          )}
        </div>
        {m.participants.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {m.participants.slice(0, 4).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                  {getInitials(p.name)}
                </div>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Link href={`${base}/reuniones/${m.id}`}
        className={`p-1.5 rounded-lg flex-shrink-0 self-start ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        <ChevronRight size={15} />
      </Link>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function MisReunionesPage() {
  const { isDark }            = useHubTheme()
  const { authUser, profile } = useAuth()
  const base                  = useHubBase()

  const [meetings, setMeetings]   = useState<HubReunion[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('todas')

  const uid         = authUser?.uid ?? ''
  const displayName = (profile as { displayName?: string } | null)?.displayName ?? ''

  useEffect(() => {
    if (!uid && !displayName) return
    const unsub = subscribeMyMeetings(uid, displayName, ms => { setMeetings(ms); setLoading(false) })
    return unsub
  }, [uid, displayName])

  const upcoming = useMemo(() => meetings.filter(m => isUpcoming(m.date)), [meetings])
  const past     = useMemo(() => meetings.filter(m => !isUpcoming(m.date)), [meetings])

  const filtered = useMemo(() => {
    let list = filterTab === 'proximas' ? upcoming : past
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q) || m.participants.some(p => p.name.toLowerCase().includes(q)))
    }
    if (filterTab === 'semana') {
      const tod = new Date(); tod.setHours(0,0,0,0)
      const ws  = new Date(tod); ws.setDate(tod.getDate() - tod.getDay())
      list = list.filter(m => { const { y, m: mo, d } = parseDateParts(m.date); return new Date(y, mo - 1, d) >= ws })
    }
    if (filterTab === 'mis_pendientes') {
      list = list.filter(m => m.actionItems.some(a =>
        !a.done && a.assignee && displayName &&
        a.assignee.toLowerCase().includes(displayName.toLowerCase().split(' ')[0])
      ))
    }
    if (filterTab === 'con_grabacion') list = list.filter(m => !!m.recordingUrl)
    return list
  }, [meetings, upcoming, past, search, filterTab, displayName])

  const monthGroups = useMemo(() => groupByMonth(filtered), [filtered])

  const totalMyPending = useMemo(() => meetings.reduce((acc, m) =>
    acc + m.actionItems.filter(a =>
      !a.done && a.assignee && displayName &&
      a.assignee.toLowerCase().includes(displayName.toLowerCase().split(' ')[0])
    ).length, 0), [meetings, displayName])

  const thisWeekCnt = useMemo(() => {
    const tod = new Date(); tod.setHours(0,0,0,0)
    const ws  = new Date(tod); ws.setDate(tod.getDate() - tod.getDay())
    return meetings.filter(m => { const { y, m: mo, d } = parseDateParts(m.date); return new Date(y, mo - 1, d) >= ws }).length
  }, [meetings])

  const misPendientesCnt = past.filter(m => m.actionItems.some(a =>
    !a.done && a.assignee && displayName &&
    a.assignee.toLowerCase().includes(displayName.toLowerCase().split(' ')[0])
  )).length

  const FILTER_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'todas',           label: 'Todas',           count: past.length },
    { id: 'semana',          label: 'Esta semana' },
    { id: 'mis_pendientes',  label: 'Mis pendientes',  count: misPendientesCnt },
    { id: 'con_grabacion',   label: 'Con grabación',   count: past.filter(m => m.recordingUrl).length },
    ...(upcoming.length > 0 ? [{ id: 'proximas' as FilterTab, label: 'Próximas', count: upcoming.length }] : []),
  ]

  return (
    <div className="flex flex-col gap-5 pb-12">

      {/* Header */}
      <div>
        <h1 className={`text-[22px] font-bold tracking-tight leading-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
          Mis reuniones
        </h1>
        <p className={`text-[13px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Sesiones en las que participaste · resúmenes y tus pendientes asignados
        </p>
      </div>

      {/* Stats */}
      {!loading && meetings.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: `${meetings.length} reuniones`,      cls: isDark ? 'bg-white/5 border-white/8 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700' },
            ...(totalMyPending > 0 ? [{ label: `${totalMyPending} pendiente${totalMyPending !== 1 ? 's' : ''} tuyo${totalMyPending !== 1 ? 's' : ''}`, cls: isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700' }] : []),
            ...(thisWeekCnt > 0 ? [{ label: `${thisWeekCnt} esta semana`, cls: isDark ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-700' }] : []),
            ...(upcoming.length > 0 ? [{ label: `${upcoming.length} próxima${upcoming.length !== 1 ? 's' : ''}`, cls: isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-700' }] : []),
          ].map((s, i) => (
            <span key={i} className={`inline-flex items-center px-3 py-1.5 rounded-full border text-[11px] font-semibold ${s.cls}`}>
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {FILTER_TABS.map(ft => (
            <button key={ft.id} onClick={() => setFilterTab(ft.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                filterTab === ft.id
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                  : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {ft.label}
              {ft.count !== undefined && ft.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  filterTab === ft.id ? 'bg-white/20' : isDark ? 'bg-white/8' : 'bg-white shadow-sm'
                }`}>{ft.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] transition ${
          isDark ? 'border-white/10 bg-white/5 focus-within:border-violet-500/50' : 'border-slate-200 bg-white shadow-sm focus-within:border-violet-400'
        }`}>
          <Search size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <input type="search" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
            className={`w-28 bg-transparent outline-none ${isDark ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'}`} />
          {search && <button onClick={() => setSearch('')}><X size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} /></button>}
        </div>
      </div>

      {/* Upcoming section */}
      {filterTab === 'proximas' && (
        <div>
          {upcoming.length === 0 ? (
            <div className={`flex flex-col items-center gap-3 py-16 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Calendar size={28} className="opacity-40" />
              </div>
              <p className={`text-[15px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Sin reuniones programadas</p>
              <p className="text-[13px] max-w-xs">Las reuniones en las que estés invitado aparecerán aquí.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Próximas</span>
                <div className={`flex-1 h-px ${isDark ? 'bg-white/8' : 'bg-slate-100'}`} />
                <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{upcoming.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {upcoming.map(m => <UpcomingCard key={m.id} m={m} base={base} isDark={isDark} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past meetings */}
      {filterTab !== 'proximas' && (
        loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => <RowSkeleton key={i} isDark={isDark} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center gap-3 py-16 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Video size={28} className="opacity-40" />
            </div>
            <div>
              <p className={`text-[15px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {search ? 'Sin resultados'
                  : filterTab === 'mis_pendientes' ? 'Sin pendientes tuyas'
                  : 'Sin reuniones registradas'}
              </p>
              <p className="text-[13px] max-w-xs mx-auto">
                {search ? 'Prueba con otro título o nombre.'
                  : filterTab === 'mis_pendientes' ? '¡Todo al día! No tienes pendientes sin resolver.'
                  : 'Cuando participes en una reunión grabada aparecerá aquí.'}
              </p>
            </div>
            {(search || filterTab !== 'todas') && (
              <button onClick={() => { setSearch(''); setFilterTab('todas') }}
                className={`text-[12px] font-medium ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'}`}>
                Ver todas
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {monthGroups.map(group => (
              <div key={group.key}>
                <div className={`flex items-center gap-3 mb-2.5 pb-2.5 border-b ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                  <span className={`text-[13px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{group.label}</span>
                  <div className="flex-1" />
                  <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{group.meetings.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.meetings.map(m => (
                    <MeetingRow key={m.id} m={m} base={base} isDark={isDark} myName={displayName} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
