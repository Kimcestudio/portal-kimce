'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download, TrendingUp, Clock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { DELIVERY_META, classifyDelivery } from '@/cmhub/points'
import type { DeliveryTiming } from '@/cmhub/points'

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ActRaw {
  assignee?: string
  assignees?: string[]
  status: string
  completedAt?: string | null
  dueDate?: string
  deliveryTiming?: DeliveryTiming
  title?: string
}

interface TareaRaw {
  editor: string
  hecha: boolean
  completedAt?: string | null
  fechaLimite?: string
  deliveryTiming?: DeliveryTiming
  texto?: string
}

interface MemberStats {
  name: string
  initials: string
  color: string
  // actividades
  actsEarly: number
  actsOnTime: number
  actsLate: number
  actsTotal: number
  // tareas
  tareasEarly: number
  tareasOnTime: number
  tareasLate: number
  tareasTotal: number
  // contenido rrss
  contEarly: number
  contOnTime: number
  contLate: number
  contTotal: number
  // score ponderado combinado
  combinedScore: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function periodBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const endDate = new Date(year, month, 1) // first day of next month
  const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01`
  return { start, end }
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

function calcScore(early: number, onTime: number, late: number, total: number): number {
  if (total === 0) return 0
  return Math.round(((early * 1.0 + onTime * 0.75 + late * 0.1) / total) * 100)
}

const RANK_MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

function resolveDelivery(completedAt: string | null | undefined, dueDate: string | undefined, stored?: DeliveryTiming): DeliveryTiming {
  if (stored) return stored
  if (!completedAt) return 'late'
  return classifyDelivery(completedAt, dueDate)
}

function resolveContentDelivery(updatedAt: string, dueDate: string | null | undefined): DeliveryTiming {
  if (!dueDate) return 'late'
  const completedDay = updatedAt.slice(0, 10)
  if (completedDay < dueDate) return 'early'
  if (completedDay === dueDate) return 'on_time'
  return 'late'
}

// Statuses que indican que el diseñador ya entregó su parte
const DESIGN_DELIVERED = ['revision', 'enviado', 'cambios', 'aprobado', 'programado', 'publicado', 'finalizado', 'reportado']

// ── Componente barra ───────────────────────────────────────────────────────────
function TriBar({ early, onTime, late, total }: { early: number; onTime: number; late: number; total: number }) {
  if (total === 0) return <span className="text-[11px] text-slate-400">—</span>
  const pEarly  = pct(early,  total)
  const pOnTime = pct(onTime, total)
  const pLate   = pct(late,   total)
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        {pEarly  > 0 && <div style={{ width: `${pEarly}%`,  background: '#16a34a' }} />}
        {pOnTime > 0 && <div style={{ width: `${pOnTime}%`, background: '#d97706' }} />}
        {pLate   > 0 && <div style={{ width: `${pLate}%`,   background: '#ef4444' }} />}
      </div>
      <span className="text-[10px] text-slate-400">{pEarly + pOnTime}% OK</span>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function ReporteEntregasPage() {
  const { team, contents } = useHub()
  const { isDark } = useHubTheme()
  const BASE = useHubBase()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [acts,   setActs]   = useState<ActRaw[]>([])
  const [tareas, setTareas] = useState<TareaRaw[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'actividades' | 'tareas' | 'contenido' | 'combinado'>('combinado')

  const { start, end } = periodBounds(year, month)

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  useEffect(() => {
    setLoading(true)
    let done = 0
    const check = () => { done++; if (done === 2) setLoading(false) }

    getDocs(query(
      collection(db, 'hubActividades'),
      where('status', '==', 'completado'),
      where('completedAt', '>=', start),
      where('completedAt', '<', end),
    )).then(snap => {
      setActs(snap.docs.map(d => d.data() as ActRaw))
      check()
    }).catch(() => check())

    getDocs(query(
      collection(db, 'cmhub_tareas_diarias'),
      where('hecha', '==', true),
      where('completedAt', '>=', start),
      where('completedAt', '<', end),
    )).then(snap => {
      setTareas(snap.docs.map(d => d.data() as TareaRaw))
      check()
    }).catch(() => check())
  }, [start, end])

  const stats = useMemo<MemberStats[]>(() => {
    return team.map(m => {
      const name = m.name.trim().toLowerCase()
      const isCreativo = m.category === 'Diseño' || m.category === 'Audiovisual'

      const myActs = acts.filter(a => {
        const all = a.assignees?.length ? a.assignees : (a.assignee ? [a.assignee] : [])
        return all.some(n => n.trim().toLowerCase() === name)
      })
      const myTareas = tareas.filter(t => t.editor.trim().toLowerCase() === name)

      // Contenido RRSS — lógica por rol
      const myContents = isCreativo
        // Diseñador: piezas donde son el responsable de diseño y ya entregaron (dueDate en el mes)
        ? contents.filter(c =>
            c.dueDate && c.dueDate >= start && c.dueDate < end &&
            DESIGN_DELIVERED.includes(c.status) &&
            (c.dueAssignee?.trim().toLowerCase() === name ||
             c.responsables?.some(r => r.trim().toLowerCase() === name))
          )
        // CM: piezas publicadas donde son el responsable principal (date en el mes)
        : contents.filter(c =>
            c.date && c.date >= start && c.date < end &&
            c.status === 'publicado' &&
            c.responsible?.trim().toLowerCase() === name
          )

      // Deadline por rol: diseñador usa dueDate, CM usa date (publishDate)
      const getDeadline = (c: typeof contents[0]) =>
        isCreativo ? c.dueDate : c.date

      const actsEarly  = myActs.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'early').length
      const actsOnTime = myActs.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'on_time').length
      const actsLate   = myActs.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'late').length

      const tareasEarly  = myTareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'early').length
      const tareasOnTime = myTareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'on_time').length
      const tareasLate   = myTareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'late').length

      const contEarly  = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'early').length
      const contOnTime = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'on_time').length
      const contLate   = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'late').length

      const combinedScore = calcScore(
        actsEarly  + tareasEarly  + contEarly,
        actsOnTime + tareasOnTime + contOnTime,
        actsLate   + tareasLate   + contLate,
        myActs.length + myTareas.length + myContents.length,
      )
      return {
        name: m.name, initials: m.initials, color: m.color,
        actsEarly, actsOnTime, actsLate, actsTotal: myActs.length,
        tareasEarly, tareasOnTime, tareasLate, tareasTotal: myTareas.length,
        contEarly, contOnTime, contLate, contTotal: myContents.length,
        combinedScore,
      }
    }).filter(s => s.actsTotal + s.tareasTotal + s.contTotal > 0)
      .sort((a, b) => b.combinedScore - a.combinedScore)
  }, [team, acts, tareas, contents, start, end])

  // KPIs globales
  const totalActs   = acts.length
  const totalTareas = tareas.length
  // KPIs de contenido: suma de todos los miembros (ya filtrado por rol en stats)
  const earlyActs   = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'early').length
  const onTimeActs  = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'on_time').length
  const lateActs    = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'late').length
  const earlyTareas = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'early').length
  const onTimeTareas = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'on_time').length
  const lateTareas  = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'late').length
  const totalConts  = stats.reduce((s, r) => s + r.contTotal,  0)
  const earlyConts  = stats.reduce((s, r) => s + r.contEarly,  0)
  const onTimeConts = stats.reduce((s, r) => s + r.contOnTime, 0)
  const lateConts   = stats.reduce((s, r) => s + r.contLate,   0)

  const T = isDark ? {
    bg: '#0d0f12', card: '#161820', card2: '#1e2028',
    border: 'rgba(255,255,255,0.07)', text: '#f1f5f9', sub: '#94a3b8', muted: '#475569',
  } : {
    bg: '#f8fafc', card: '#ffffff', card2: '#f1f5f9',
    border: '#e5e7eb', text: '#111827', sub: '#6b7280', muted: '#9ca3af',
  }

  const currentTab =
    tab === 'actividades' ? { early: earlyActs,  onTime: onTimeActs,  late: lateActs,  total: totalActs  }
    : tab === 'tareas'    ? { early: earlyTareas, onTime: onTimeTareas, late: lateTareas, total: totalTareas }
    : tab === 'contenido' ? { early: earlyConts,  onTime: onTimeConts,  late: lateConts,  total: totalConts  }
    : { early: earlyActs + earlyTareas + earlyConts, onTime: onTimeActs + onTimeTareas + onTimeConts, late: lateActs + lateTareas + lateConts, total: totalActs + totalTareas + totalConts }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl" style={{ background: T.bg }}>

      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-3 mb-1">
          <Link href={`${BASE}/supervision`}
            className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
            style={{ color: T.muted }}>
            <ChevronLeft size={13} /> Supervisión
          </Link>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-extrabold" style={{ color: T.text }}>Reporte de entregas</h1>
            <p className="text-[12px] mt-0.5" style={{ color: T.muted }}>
              Puntualidad por colaborador — actividades y tareas diarias
            </p>
          </div>
          {/* Navegador de mes */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={prevMonth} type="button"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70"
              style={{ background: T.card2 }}>
              <ChevronLeft size={14} style={{ color: T.sub }} />
            </button>
            <span className="text-[13px] font-bold capitalize min-w-[130px] text-center" style={{ color: T.text }}>
              {monthLabel}
            </span>
            <button onClick={nextMonth} type="button"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70"
              style={{ background: T.card2 }}>
              <ChevronRight size={14} style={{ color: T.sub }} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs globales */}
      <div className="px-6 pt-4 pb-3 grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total entregadas', value: currentTab.total, color: '#7c3aed', icon: CheckCircle2 },
          { label: '🚀 Antes de fecha', value: currentTab.early, color: '#16a34a', icon: TrendingUp },
          { label: '⚡ En el límite',  value: currentTab.onTime, color: '#d97706', icon: Zap },
          { label: '⏰ Con retraso',   value: currentTab.late,  color: '#ef4444', icon: AlertTriangle },
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

      {/* Tabs */}
      <div className="px-6 pb-3 flex gap-2 shrink-0">
        {(['combinado', 'actividades', 'tareas', 'contenido'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
            style={{
              background: tab === t ? '#7c3aed' : T.card2,
              color: tab === t ? '#fff' : T.sub,
              border: `1px solid ${tab === t ? '#7c3aed' : T.border}`,
            }}>
            {t === 'combinado' ? 'Combinado' : t === 'actividades' ? 'Actividades' : t === 'tareas' ? 'Tareas diarias' : '📱 Contenido RRSS'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: T.muted }}>Cargando datos…</div>
        ) : stats.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: T.muted }}>
            Sin entregas registradas en {monthLabel}
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border }}>
            {/* Cabecera */}
            <div className="grid text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 border-b"
              style={{
                gridTemplateColumns: '36px 1.5fr 60px 60px 60px 60px 80px 110px',
                background: T.card2, borderColor: T.border, color: T.muted,
              }}>
              <span className="text-center">#</span>
              <span>Colaborador</span>
              <span className="text-center">Total</span>
              <span className="text-center">🚀 Antes</span>
              <span className="text-center">⚡ Límite</span>
              <span className="text-center">⏰ Tarde</span>
              <span className="text-center">Score</span>
              <span className="text-center">Distribución</span>
            </div>

            <div className="divide-y" style={{ borderColor: T.border }}>
              {stats.map((s, idx) => {
                const early  = tab === 'actividades' ? s.actsEarly  : tab === 'tareas' ? s.tareasEarly  : tab === 'contenido' ? s.contEarly  : s.actsEarly  + s.tareasEarly  + s.contEarly
                const onTime = tab === 'actividades' ? s.actsOnTime : tab === 'tareas' ? s.tareasOnTime : tab === 'contenido' ? s.contOnTime : s.actsOnTime + s.tareasOnTime + s.contOnTime
                const late   = tab === 'actividades' ? s.actsLate   : tab === 'tareas' ? s.tareasLate   : tab === 'contenido' ? s.contLate   : s.actsLate   + s.tareasLate   + s.contLate
                const total  = tab === 'actividades' ? s.actsTotal  : tab === 'tareas' ? s.tareasTotal  : tab === 'contenido' ? s.contTotal  : s.actsTotal  + s.tareasTotal  + s.contTotal
                const score  = calcScore(early, onTime, late, total)

                if (total === 0) return null
                const medal = RANK_MEDAL[idx]
                const scoreColor = score >= 80 ? '#16a34a' : score >= 55 ? '#d97706' : '#ef4444'
                const scoreBg    = score >= 80 ? 'rgba(22,163,74,0.12)' : score >= 55 ? 'rgba(217,119,6,0.12)' : 'rgba(239,68,68,0.12)'

                return (
                  <div key={s.name} className="grid items-center px-4 py-3"
                    style={{ gridTemplateColumns: '36px 1.5fr 60px 60px 60px 60px 80px 110px', background: T.card }}>

                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      {medal
                        ? <span className="text-[16px]">{medal}</span>
                        : <span className="text-[11px] font-bold" style={{ color: T.muted }}>#{idx + 1}</span>
                      }
                    </div>

                    {/* Colaborador */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: s.color }}>
                        {s.initials}
                      </div>
                      <p className="text-[13px] font-semibold" style={{ color: T.text }}>{s.name}</p>
                    </div>

                    <p className="text-center text-[15px] font-bold" style={{ color: T.text }}>{total}</p>

                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-[15px] font-bold" style={{ color: early > 0 ? '#16a34a' : T.muted }}>{early}</p>
                      {early > 0 && <p className="text-[9px]" style={{ color: T.muted }}>{pct(early, total)}%</p>}
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-[15px] font-bold" style={{ color: onTime > 0 ? '#d97706' : T.muted }}>{onTime}</p>
                      {onTime > 0 && <p className="text-[9px]" style={{ color: T.muted }}>{pct(onTime, total)}%</p>}
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-[15px] font-bold" style={{ color: late > 0 ? '#ef4444' : T.muted }}>{late}</p>
                      {late > 0 && <p className="text-[9px]" style={{ color: T.muted }}>{pct(late, total)}%</p>}
                    </div>

                    {/* Score */}
                    <div className="flex justify-center">
                      <span className="text-[12px] font-extrabold px-2 py-0.5 rounded-lg"
                        style={{ background: scoreBg, color: scoreColor }}>
                        {score}%
                      </span>
                    </div>

                    <TriBar early={early} onTime={onTime} late={late} total={total} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
