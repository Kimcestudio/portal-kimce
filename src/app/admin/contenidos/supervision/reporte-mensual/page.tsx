'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, Clock, CheckCircle2, Star, Zap, Award } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TareaRaw {
  editor: string
  hecha: boolean
  completedAt?: string | null
  fechaLimite?: string
  fecha: string
}
interface ActRaw {
  assignee?: string
  assignees?: string[]
  status: string
  completedAt?: string | null
  dueDate?: string
}
interface LogRaw {
  userId: string
  amount: number
}

interface MemberStats {
  name: string
  initials: string
  color: string
  tareasComp: number
  tareasATiempo: number
  tareasTotal: number
  actsComp: number
  actsATiempo: number
  puntosDelMes: number
  score: number
  label: string
  labelColor: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function monthBounds(year: number, month: number) {
  const pad  = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  const end   = `${nextY}-${pad(nextM)}-01`
  return { start, end }
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

function calcScore(tareasATiempo: number, tareasTotal: number, actsATiempo: number, actsTotal: number, puntos: number): number {
  const vol   = Math.min(1, (tareasTotal + actsTotal * 3) / 20) * 30
  const puntualidad = (tareasTotal + actsTotal) === 0
    ? 50
    : ((tareasATiempo + actsATiempo) / (tareasTotal + actsTotal)) * 40
  const pts   = Math.min(1, puntos / 300) * 30
  return Math.round(vol + puntualidad + pts)
}

function scoreLabel(s: number): { label: string; color: string; bg: string } {
  if (s >= 80) return { label: '🔥 Excelente',   color: '#16a34a', bg: '#dcfce7' }
  if (s >= 60) return { label: '✅ Productivo',   color: '#0d9488', bg: '#ccfbf1' }
  if (s >= 40) return { label: '⚡ Regular',      color: '#d97706', bg: '#fef3c7' }
  return        { label: '⏳ Lento',             color: '#dc2626', bg: '#fee2e2' }
}

// ── Barra de progreso simple ───────────────────────────────────────────────────
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100)
  return (
    <div className="w-full h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReporteMensualPage() {
  const { team } = useHub()
  const { isDark } = useHubTheme()
  const BASE = useHubBase()

  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)

  const [tareas, setTareas] = useState<TareaRaw[]>([])
  const [acts,   setActs]   = useState<ActRaw[]>([])
  const [logs,   setLogs]   = useState<LogRaw[]>([])

  // ── Navegación de mes ──────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else             { setMonth(m => m - 1) }
  }
  function nextMonth() {
    const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)
    if (isCurrentOrFuture) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else              { setMonth(m => m + 1) }
  }

  // ── Carga de datos Firestore ───────────────────────────────────────────────
  useEffect(() => {
    if (!team.length) return
    const { start, end } = monthBounds(year, month)
    setLoading(true)

    Promise.all([
      // Tareas completadas en el mes
      getDocs(query(
        collection(db, 'cmhub_tareas_diarias'),
        where('completedAt', '>=', start),
        where('completedAt', '<', end),
      )),
      // Actividades completadas en el mes
      getDocs(query(
        collection(db, 'hubActividades'),
        where('completedAt', '>=', start),
        where('completedAt', '<', end),
      )),
      // Log de puntos del mes (createdAt es serverTimestamp → Timestamp obj)
      getDocs(query(
        collection(db, 'cmhub_puntos_log'),
        where('createdAt', '>=', new Date(`${start}T00:00:00Z`)),
        where('createdAt', '<',  new Date(`${end}T00:00:00Z`)),
      )),
    ])
      .then(([tSnap, aSnap, lSnap]) => {
        setTareas(tSnap.docs.map(d => d.data() as TareaRaw))
        setActs(aSnap.docs.map(d => d.data() as ActRaw))
        setLogs(lSnap.docs.map(d => d.data() as LogRaw))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month, team.length])

  // ── Cómputo de estadísticas por miembro ───────────────────────────────────
  const stats = useMemo<MemberStats[]>(() => {
    return team.map(member => {
      const name = member.name

      // Tareas asignadas a este miembro completadas en el mes
      const myTareas = tareas.filter(t => t.editor?.trim().toLowerCase() === name.trim().toLowerCase())
      const tareasComp = myTareas.length
      const tareasATiempo = myTareas.filter(t => {
        if (!t.completedAt || !t.fechaLimite) return true // sin límite = a tiempo
        return t.completedAt.split('T')[0] <= t.fechaLimite
      }).length

      // Actividades asignadas a este miembro
      const myActs = acts.filter(a => {
        const assignees = [
          a.assignee?.trim().toLowerCase(),
          ...(a.assignees ?? []).map(s => s.trim().toLowerCase()),
        ].filter(Boolean)
        return assignees.includes(name.trim().toLowerCase())
      })
      const actsComp = myActs.length
      const actsATiempo = myActs.filter(a => {
        if (!a.completedAt || !a.dueDate) return true
        return a.completedAt.split('T')[0] <= a.dueDate
      }).length

      // Puntos del mes desde log
      const puntosDelMes = logs
        .filter(l => l.userId === member.id)
        .reduce((s, l) => s + (l.amount ?? 0), 0)

      const total = tareasComp + actsComp
      const score = calcScore(tareasATiempo, tareasComp, actsATiempo, actsComp, puntosDelMes)
      const { label, color } = scoreLabel(score)

      return {
        name, initials: member.initials, color: member.color,
        tareasComp, tareasATiempo, tareasTotal: tareasComp,
        actsComp, actsATiempo, puntosDelMes,
        score, label, labelColor: color,
      }
    }).sort((a, b) => b.score - a.score)
  }, [team, tareas, acts, logs])

  const maxScore   = Math.max(...stats.map(s => s.score), 1)
  const totalTareas = tareas.length
  const totalActs   = acts.length

  const T = isDark ? {
    bg:      '#161820',
    card:    '#1e2028',
    border:  'rgba(255,255,255,0.07)',
    text:    '#f1f5f9',
    sub:     '#94a3b8',
    muted:   '#475569',
    cardHov: '#252830',
  } : {
    bg:      '#f8fafc',
    card:    '#ffffff',
    border:  '#e5e7eb',
    text:    '#111827',
    sub:     '#6b7280',
    muted:   '#9ca3af',
    cardHov: '#f9fafb',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl" style={{ background: T.bg }}>
      {/* Header */}
      <div className="bg-white border-b px-6 h-14 flex items-center gap-3 shrink-0 rounded-t-2xl"
        style={{ borderColor: T.border, background: T.card }}>
        <Link href={`${BASE}/supervision`}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:text-[#7c3aed]"
          style={{ color: T.sub }}>
          <ChevronLeft size={14} /> Supervisión
        </Link>
        <span style={{ color: T.border }}>›</span>
        <span className="text-[13px] font-semibold" style={{ color: T.text }}>Reporte de productividad</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={prevMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f3f4f6] transition-colors cursor-pointer"
            style={{ color: T.sub }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-semibold min-w-[130px] text-center capitalize" style={{ color: T.text }}>
            {monthLabel(year, month)}
          </span>
          <button onClick={nextMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f3f4f6] transition-colors cursor-pointer disabled:opacity-30"
            style={{ color: T.sub }}
            disabled={year === now.getFullYear() && month >= now.getMonth() + 1}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
        {/* KPIs rápidos del mes */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: CheckCircle2, label: 'Tareas completadas', value: loading ? '…' : totalTareas, color: '#0d9488' },
            { icon: Zap,          label: 'Actividades cerradas', value: loading ? '…' : totalActs,   color: '#6366f1' },
            { icon: TrendingUp,   label: 'Productividad promedio', value: loading ? '…' : (stats.length ? `${Math.round(stats.reduce((s,m)=>s+m.score,0)/stats.length)}%` : '—'), color: '#7c3aed' },
            { icon: Star,         label: 'Puntos del equipo', value: loading ? '…' : logs.reduce((s,l)=>s+l.amount,0), color: '#d97706' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-2xl border p-4 flex flex-col gap-2"
              style={{ background: T.card, borderColor: T.border }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${color}18` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div className="text-[22px] font-bold leading-none" style={{ color: T.text }}>{value}</div>
              <div className="text-[11px]" style={{ color: T.sub }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Cards por colaborador */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="w-8 h-8 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" />
              <span className="text-[13px]" style={{ color: T.sub }}>Cargando datos del mes…</span>
            </div>
          </div>
        ) : stats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-[13px]" style={{ color: T.sub }}>Sin equipo registrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {stats.map((m, i) => {
              const { bg: scoreBg, color: scoreColor } = scoreLabel(m.score)
              const puntualidadTotal = m.tareasTotal + m.actsComp
              const puntualidadOk   = m.tareasATiempo + m.actsATiempo
              const pct = puntualidadTotal === 0 ? 100 : Math.round((puntualidadOk / puntualidadTotal) * 100)

              return (
                <div key={m.name} className="rounded-2xl border p-5 flex flex-col gap-4"
                  style={{ background: T.card, borderColor: i === 0 ? 'rgba(124,58,237,0.3)' : T.border }}>
                  {/* Top: avatar + nombre + score */}
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold"
                        style={{ background: m.color }}>
                        {m.initials}
                      </div>
                      {i === 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#fef3c7] flex items-center justify-center text-[10px]">
                          🥇
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold truncate" style={{ color: T.text }}>{m.name}</p>
                      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                        style={{ background: scoreBg, color: scoreColor }}>
                        {m.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[24px] font-bold leading-none" style={{ color: scoreColor }}>{m.score}</div>
                      <div className="text-[10px]" style={{ color: T.muted }}>/ 100</div>
                    </div>
                  </div>

                  {/* Barra score */}
                  <div>
                    <Bar value={m.score} max={100} color={scoreColor} />
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-2">
                    <MetricPill
                      icon={<CheckCircle2 size={11} />}
                      label="Tareas"
                      value={m.tareasComp}
                      sub={m.tareasComp > 0 ? `${Math.round((m.tareasATiempo/m.tareasComp)*100)}% a tiempo` : '—'}
                      color="#0d9488"
                      isDark={isDark}
                    />
                    <MetricPill
                      icon={<Clock size={11} />}
                      label="Actividades"
                      value={m.actsComp}
                      sub={m.actsComp > 0 ? `${Math.round((m.actsATiempo/m.actsComp)*100)}% a tiempo` : '—'}
                      color="#6366f1"
                      isDark={isDark}
                    />
                    <MetricPill
                      icon={<Star size={11} />}
                      label="Puntos"
                      value={m.puntosDelMes}
                      sub="del mes"
                      color="#d97706"
                      isDark={isDark}
                    />
                  </div>

                  {/* Puntualidad global */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] font-medium" style={{ color: T.sub }}>Puntualidad global</span>
                      <span className="text-[11px] font-bold" style={{ color: pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }}>
                        {pct}%
                      </span>
                    </div>
                    <Bar value={pct} max={100} color={pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444'} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Leyenda de score */}
        <div className="rounded-2xl border p-4" style={{ background: T.card, borderColor: T.border }}>
          <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.muted }}>
            Cómo se calcula el score
          </p>
          <div className="grid grid-cols-3 gap-4 text-[12px]" style={{ color: T.sub }}>
            <div>
              <span className="font-semibold" style={{ color: T.text }}>Volumen (30%)</span>
              <p className="mt-0.5 leading-relaxed">Tareas + actividades completadas en el mes.</p>
            </div>
            <div>
              <span className="font-semibold" style={{ color: T.text }}>Puntualidad (40%)</span>
              <p className="mt-0.5 leading-relaxed">% de items entregados antes o en la fecha límite.</p>
            </div>
            <div>
              <span className="font-semibold" style={{ color: T.text }}>Puntos (30%)</span>
              <p className="mt-0.5 leading-relaxed">Puntos acumulados en el mes (máx. referencial: 300 pts).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pequeña píldora de métrica ─────────────────────────────────────────────────
function MetricPill({
  icon, label, value, sub, color, isDark,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  color: string
  isDark: boolean
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-[20px] font-bold leading-none" style={{ color: isDark ? '#f1f5f9' : '#111827' }}>
        {value}
      </div>
      <div className="text-[10px]" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>{sub}</div>
    </div>
  )
}
