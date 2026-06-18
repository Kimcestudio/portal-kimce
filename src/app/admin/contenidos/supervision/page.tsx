'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, ChevronRight, Users, Activity } from 'lucide-react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { actividadHasAssignee } from '@/cmhub/activities'
import type { TeamMember, Content, HubActividad } from '@/cmhub/types'

// ── Utils ─────────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().split('T')[0] }

function weekBounds() {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const mon   = new Date(today); mon.setDate(today.getDate() + diff)
  const sun   = new Date(mon);   sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end:   sun.toISOString().split('T')[0],
  }
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function sameName(a: string | null | undefined, b: string) {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

function memberAssigned(c: Content, name: string) {
  return sameName(c.responsible, name) ||
    c.responsables?.some(r => sameName(r, name)) ||
    sameName(c.dueAssignee, name)
}

const ACTIVE_STATUSES   = ['idea', 'produccion', 'revision', 'cambios', 'redaccion', 'diseno', 'audiovisual', 'enviado']
const DONE_STATUSES     = ['aprobado', 'programado', 'publicado', 'finalizado', 'reportado']

const CATEGORY_COLOR: Record<string, string> = {
  Diseño:      '#ec4899',
  Audiovisual: '#f97316',
  Estrategia:  '#6366f1',
  Otro:        '#64748b',
}

// ── Hook: clock-in de hoy ─────────────────────────────────────────────────────
interface ActiveEntry { checkInAt: string; checkOutAt: string | null }

function useActiveToday(members: TeamMember[]) {
  const [active, setActive] = useState<Record<string, ActiveEntry>>({})

  useEffect(() => {
    if (!members.length) return
    const today = todayISO()
    const q = query(collection(db, 'timeEntries'), where('dayKey', '==', today))
    return onSnapshot(q, snap => {
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
        const e = byUid[m.id]
        if (e?.clockIn) result[m.id] = { checkInAt: e.clockIn, checkOutAt: e.clockOut ?? null }
      })
      setActive(result)
    }, () => {})
  }, [members])

  return active
}

// ── Tokens de tema ────────────────────────────────────────────────────────────
function useTokens(isDark: boolean) {
  return isDark ? {
    bg: '#0d0f12', card: '#161820', card2: '#1e2028',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    text: '#f1f5f9', sub: '#94a3b8', muted: '#475569', hover: 'rgba(255,255,255,0.04)',
  } : {
    bg: '#f8fafc', card: '#ffffff', card2: '#f1f5f9',
    border: '#e5e7eb', border2: '#d1d5db',
    text: '#111827', sub: '#6b7280', muted: '#9ca3af', hover: '#f9fafb',
  }
}

// ── Semáforo de carga ─────────────────────────────────────────────────────────
function workloadLevel(active: number, overdue: number): 'ok' | 'medio' | 'alto' | 'vacio' {
  if (active === 0) return 'vacio'
  if (overdue >= 2 || active >= 8) return 'alto'
  if (overdue >= 1 || active >= 5) return 'medio'
  return 'ok'
}

const WORKLOAD_META = {
  vacio: { label: 'Sin carga',    color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  ok:    { label: 'Normal',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  medio: { label: 'Carga media',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  alto:  { label: 'Sobrecargado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function MemberAvatar({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-6 h-6 text-[9px]' : size === 'md' ? 'w-9 h-9 text-[12px]' : 'w-12 h-12 text-[15px]'
  return (
    <div className={`${s} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ background: member.color }}>
      {member.initials}
    </div>
  )
}

// ── Badge de estado ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    idea:       { label: 'Idea',       color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
    produccion: { label: 'Producción', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
    revision:   { label: 'Revisión',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cambios:    { label: 'Cambios',    color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    aprobado:   { label: 'Aprobado',   color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
    programado: { label: 'Programado', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
    publicado:  { label: 'Publicado',  color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
  }
  const m = meta[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA GENERAL — tabla de todos los miembros
// ─────────────────────────────────────────────────────────────────────────────
function VistaGeneral({
  members, contents, actividades, activeToday, T,
  onSelect,
}: {
  members: TeamMember[]
  contents: Content[]
  actividades: HubActividad[]
  activeToday: Record<string, ActiveEntry>
  T: ReturnType<typeof useTokens>
  onSelect: (m: TeamMember) => void
}) {
  const today = todayISO()
  const week  = weekBounds()

  const rows = useMemo(() => members.map(m => {
    const mine       = contents.filter(c => memberAssigned(c, m.name))
    const activas    = mine.filter(c => ACTIVE_STATUSES.includes(c.status))
    const vencidas   = activas.filter(c => c.dueDate && c.dueDate < today)
    const hoy        = activas.filter(c => c.dueDate === today)
    const urgentes   = activas.filter(c => c.priority === 'urgente' || c.priority === 'alta')
    const completadas = mine.filter(c =>
      DONE_STATUSES.includes(c.status) && c.updatedAt >= week.start
    )
    const misActivs  = actividades.filter(a => actividadHasAssignee(a, m.name))
    const actsActivas = misActivs.filter(a => a.status !== 'completado')
    const level      = workloadLevel(activas.length, vencidas.length)
    const entry      = activeToday[m.id]
    const conectado  = !!entry && !entry.checkOutAt

    return { member: m, activas, vencidas, hoy, urgentes, completadas, actsActivas, level, conectado, entry }
  }), [members, contents, actividades, activeToday, today, week])

  const totalActivas   = rows.reduce((s, r) => s + r.activas.length, 0)
  const totalVencidas  = rows.reduce((s, r) => s + r.vencidas.length, 0)
  const totalCompletadas = rows.reduce((s, r) => s + r.completadas.length, 0)
  const conectados     = rows.filter(r => r.conectado).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0 border-b" style={{ borderColor: T.border }}>
        <h1 className="text-[20px] font-extrabold" style={{ color: T.text }}>Supervisión del equipo</h1>
        <p className="text-[12px] mt-0.5" style={{ color: T.muted }}>
          Carga de trabajo, pendientes y actividad de todos los colaboradores
        </p>
      </div>

      {/* KPIs globales */}
      <div className="px-6 pt-4 pb-3 grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Tareas activas',    value: totalActivas,    color: '#3b82f6', icon: Activity     },
          { label: 'Vencidas',          value: totalVencidas,   color: '#ef4444', icon: AlertTriangle },
          { label: 'Completadas / sem', value: totalCompletadas,color: '#22c55e', icon: CheckCircle2  },
          { label: 'Conectados hoy',    value: conectados,      color: '#a78bfa', icon: Users         },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ background: T.card, borderColor: T.border }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${k.color}18` }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-[24px] font-extrabold leading-none" style={{ color: T.text }}>{k.value}</p>
                <p className="text-[10px] mt-0.5 font-medium" style={{ color: T.muted }}>{k.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border }}>
          {/* Cabecera tabla */}
          <div className="grid text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: '2fr 90px 60px 60px 60px 60px 80px 80px 32px',
              background: T.card2, borderColor: T.border, color: T.muted,
            }}>
            <span>Colaborador</span>
            <span className="text-center">Estado</span>
            <span className="text-center">Activas</span>
            <span className="text-center">Vencidas</span>
            <span className="text-center">Hoy</span>
            <span className="text-center">Urge</span>
            <span className="text-center">✓ Semana</span>
            <span className="text-center">Actividades</span>
            <span />
          </div>

          {rows.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: T.muted }}>
              No hay colaboradores en el equipo
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: T.border }}>
              {rows.map(r => {
                const wm = WORKLOAD_META[r.level]
                const catColor = CATEGORY_COLOR[r.member.category ?? 'Otro'] ?? '#64748b'
                return (
                  <button
                    key={r.member.id}
                    type="button"
                    onClick={() => onSelect(r.member)}
                    className="w-full grid items-center px-4 py-3 transition-colors text-left"
                    style={{
                      gridTemplateColumns: '2fr 90px 60px 60px 60px 60px 80px 80px 32px',
                      background: 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Colaborador */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <MemberAvatar member={r.member} size="md" />
                        {r.conectado && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
                            style={{ borderColor: T.card }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: T.text }}>
                          {r.member.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${catColor}20`, color: catColor }}>
                            {r.member.category ?? 'Sin área'}
                          </span>
                          {r.conectado && r.entry && (
                            <span className="text-[9px]" style={{ color: T.muted }}>
                              desde {fmtTime(r.entry.checkInAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Semáforo */}
                    <div className="flex justify-center">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: wm.bg, color: wm.color }}>
                        {wm.label}
                      </span>
                    </div>

                    {/* Activas */}
                    <p className="text-center text-[14px] font-bold" style={{ color: r.activas.length > 0 ? T.text : T.muted }}>
                      {r.activas.length}
                    </p>

                    {/* Vencidas */}
                    <p className="text-center text-[14px] font-bold"
                      style={{ color: r.vencidas.length > 0 ? '#ef4444' : T.muted }}>
                      {r.vencidas.length || '—'}
                    </p>

                    {/* Hoy */}
                    <p className="text-center text-[14px] font-bold"
                      style={{ color: r.hoy.length > 0 ? '#f59e0b' : T.muted }}>
                      {r.hoy.length || '—'}
                    </p>

                    {/* Urgentes */}
                    <p className="text-center text-[14px] font-bold"
                      style={{ color: r.urgentes.length > 0 ? '#f87171' : T.muted }}>
                      {r.urgentes.length || '—'}
                    </p>

                    {/* Completadas semana */}
                    <p className="text-center text-[14px] font-bold"
                      style={{ color: r.completadas.length > 0 ? '#22c55e' : T.muted }}>
                      {r.completadas.length || '—'}
                    </p>

                    {/* Actividades activas */}
                    <p className="text-center text-[14px] font-bold"
                      style={{ color: r.actsActivas.length > 0 ? '#a78bfa' : T.muted }}>
                      {r.actsActivas.length || '—'}
                    </p>

                    {/* Flecha */}
                    <ChevronRight size={14} style={{ color: T.muted }} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SupervisionPage() {
  const { team, contents, actividades } = useHub()
  const { isDark } = useHubTheme()
  const T = useTokens(isDark)
  const BASE = useHubBase()
  const router = useRouter()
  const pathname = usePathname()
  const auth = useOptionalAuth()
  const isAdmin = (auth?.profile as { role?: string })?.role === 'admin' || pathname.startsWith('/admin')
  const activeToday = useActiveToday(team)

  function handleSelect(m: TeamMember) {
    if (!isAdmin) return
    router.push(`${BASE}/vista-colaborador?member=${encodeURIComponent(m.id)}&from=supervision`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl transition-colors"
      style={{ background: T.bg }}>
      <VistaGeneral
        members={team}
        contents={contents}
        actividades={actividades}
        activeToday={activeToday}
        T={T}
        onSelect={handleSelect}
      />
    </div>
  )
}
