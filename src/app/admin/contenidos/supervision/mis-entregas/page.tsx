'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, Zap, AlertTriangle } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { classifyDelivery } from '@/cmhub/points'
import type { DeliveryTiming } from '@/cmhub/points'

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ActRaw {
  assignee?: string
  assignees?: string[]
  status: string
  completedAt?: string | null
  dueDate?: string
  deliveryTiming?: DeliveryTiming
}

interface TareaRaw {
  editor: string
  hecha: boolean
  completedAt?: string | null
  fechaLimite?: string
  deliveryTiming?: DeliveryTiming
  texto?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function periodBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const endDate = new Date(year, month, 1)
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

const DESIGN_DELIVERED = ['revision', 'enviado', 'cambios', 'aprobado', 'programado', 'publicado', 'finalizado', 'reportado']

function scoreLabel(score: number) {
  if (score >= 90) return 'Excelente'
  if (score >= 75) return 'Muy bien'
  if (score >= 60) return 'Regular'
  return 'Mejorar'
}

function scoreColor(score: number) {
  if (score >= 75) return '#16a34a'
  if (score >= 55) return '#d97706'
  return '#ef4444'
}

function scoreBg(score: number) {
  if (score >= 75) return 'rgba(22,163,74,0.10)'
  if (score >= 55) return 'rgba(217,119,6,0.10)'
  return 'rgba(239,68,68,0.10)'
}

// ── Gauge de score ─────────────────────────────────────────────────────────────
function ScoreGauge({ score, T }: { score: number; T: ReturnType<typeof useTokens> }) {
  const color = scoreColor(score)
  const bg    = scoreBg(score)
  const label = scoreLabel(score)
  const circumference = 2 * Math.PI * 52
  const filled = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52"
            fill="none" stroke={T.card2} strokeWidth="10" />
          <circle cx="60" cy="60" r="52"
            fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-extrabold leading-none" style={{ color }}>{score}%</span>
          <span className="text-[11px] font-semibold mt-0.5" style={{ color: T.muted }}>{label}</span>
        </div>
      </div>
      <p className="text-[12px]" style={{ color: T.muted }}>Score ponderado del mes</p>
    </div>
  )
}

// ── Tokens de tema ─────────────────────────────────────────────────────────────
function useTokens(isDark: boolean) {
  return isDark ? {
    bg: '#0d0f12', card: '#161820', card2: '#1e2028',
    border: 'rgba(255,255,255,0.07)', text: '#f1f5f9', sub: '#94a3b8', muted: '#475569',
  } : {
    bg: '#f8fafc', card: '#ffffff', card2: '#f1f5f9',
    border: '#e5e7eb', text: '#111827', sub: '#6b7280', muted: '#9ca3af',
  }
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function MisEntregasPage() {
  const auth   = useOptionalAuth()
  const { team, contents } = useHub()
  const { isDark } = useHubTheme()
  const T   = useTokens(isDark)
  const BASE = useHubBase()

  const myMember = team.find(m => m.id === auth?.authUser?.uid)
  const myName   = myMember?.name ?? ''

  const now = new Date()
  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth() + 1)
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
    if (!myName) return
    setLoading(true)
    const name = myName.trim().toLowerCase()
    let done = 0
    const check = () => { done++; if (done === 2) setLoading(false) }

    getDocs(query(
      collection(db, 'hubActividades'),
      where('status', '==', 'completado'),
      where('completedAt', '>=', start),
      where('completedAt', '<', end),
    )).then(snap => {
      setActs(snap.docs
        .map(d => d.data() as ActRaw)
        .filter(a => {
          const all = a.assignees?.length ? a.assignees : (a.assignee ? [a.assignee] : [])
          return all.some(n => n.trim().toLowerCase() === name)
        })
      )
      check()
    }).catch(() => check())

    getDocs(query(
      collection(db, 'cmhub_tareas_diarias'),
      where('hecha', '==', true),
      where('completedAt', '>=', start),
      where('completedAt', '<', end),
    )).then(snap => {
      setTareas(snap.docs
        .map(d => d.data() as TareaRaw)
        .filter(t => t.editor.trim().toLowerCase() === name)
      )
      check()
    }).catch(() => check())
  }, [start, end, myName])

  // Stats por tipo
  const actsEarly  = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'early').length
  const actsOnTime = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'on_time').length
  const actsLate   = acts.filter(a => resolveDelivery(a.completedAt, a.dueDate, a.deliveryTiming) === 'late').length

  const tareasEarly  = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'early').length
  const tareasOnTime = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'on_time').length
  const tareasLate   = tareas.filter(t => resolveDelivery(t.completedAt, t.fechaLimite, t.deliveryTiming) === 'late').length

  const isCreativo = myMember?.category === 'Diseño' || myMember?.category === 'Audiovisual'
  const myName_lower = myName.trim().toLowerCase()

  const myContents = isCreativo
    ? contents.filter(c =>
        c.dueDate && c.dueDate >= start && c.dueDate < end &&
        DESIGN_DELIVERED.includes(c.status) &&
        (c.dueAssignee?.trim().toLowerCase() === myName_lower ||
         c.responsables?.some(r => r.trim().toLowerCase() === myName_lower))
      )
    : contents.filter(c =>
        c.date && c.date >= start && c.date < end &&
        c.status === 'publicado' &&
        c.responsible?.trim().toLowerCase() === myName_lower
      )

  const getDeadline = (c: typeof contents[0]) => isCreativo ? c.dueDate : c.date

  const contEarly  = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'early').length
  const contOnTime = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'on_time').length
  const contLate   = myContents.filter(c => resolveContentDelivery(c.updatedAt, getDeadline(c)) === 'late').length

  const early  = tab === 'actividades' ? actsEarly  : tab === 'tareas' ? tareasEarly  : tab === 'contenido' ? contEarly  : actsEarly  + tareasEarly  + contEarly
  const onTime = tab === 'actividades' ? actsOnTime : tab === 'tareas' ? tareasOnTime : tab === 'contenido' ? contOnTime : actsOnTime + tareasOnTime + contOnTime
  const late   = tab === 'actividades' ? actsLate   : tab === 'tareas' ? tareasLate   : tab === 'contenido' ? contLate   : actsLate   + tareasLate   + contLate
  const total  = tab === 'actividades' ? acts.length : tab === 'tareas' ? tareas.length : tab === 'contenido' ? myContents.length : acts.length + tareas.length + myContents.length

  const score = calcScore(early, onTime, late, total)

  if (!myName) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 rounded-2xl" style={{ background: T.bg }}>
        <p className="text-[14px]" style={{ color: T.muted }}>No se pudo identificar tu perfil en el equipo.</p>
      </div>
    )
  }

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
          <div className="flex items-center gap-3">
            {myMember && (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                style={{ background: myMember.color }}>
                {myMember.initials}
              </div>
            )}
            <div>
              <h1 className="text-[20px] font-extrabold" style={{ color: T.text }}>Mis Entregas</h1>
              <p className="text-[12px] mt-0.5" style={{ color: T.muted }}>
                {myName} · Puntualidad y score personal
              </p>
            </div>
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center text-[13px]" style={{ color: T.muted }}>Cargando…</div>
        ) : (
          <div className="px-6 py-4 flex flex-col gap-4">

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
              {(['combinado', 'actividades', 'tareas', 'contenido'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
                  style={{
                    background: tab === t ? '#7c3aed' : T.card2,
                    color: tab === t ? '#fff' : T.sub,
                    border: `1px solid ${tab === t ? '#7c3aed' : T.border}`,
                  }}>
                  {t === 'combinado' ? 'Combinado' : t === 'actividades' ? 'Actividades' : t === 'tareas' ? 'Tareas diarias' : '📱 RRSS'}
                </button>
              ))}
            </div>

            {total === 0 ? (
              <div className="py-16 text-center rounded-2xl border" style={{ borderColor: T.border, background: T.card }}>
                <p className="text-[14px] font-semibold" style={{ color: T.muted }}>
                  Sin entregas registradas en {monthLabel}
                </p>
              </div>
            ) : (
              <>
                {/* Gauge de score */}
                <div className="rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
                  <ScoreGauge score={score} T={T} />
                </div>

                {/* 3 stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { emoji: '🚀', label: 'Antes de fecha', value: early,  color: '#16a34a', bg: 'rgba(22,163,74,0.10)'   },
                    { emoji: '⚡', label: 'En el límite',   value: onTime, color: '#d97706', bg: 'rgba(217,119,6,0.10)'   },
                    { emoji: '⏰', label: 'Con retraso',    value: late,   color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
                  ].map(k => (
                    <div key={k.label} className="rounded-2xl border p-4 flex flex-col gap-2"
                      style={{ background: T.card, borderColor: T.border }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]"
                        style={{ background: k.bg }}>
                        {k.emoji}
                      </div>
                      <div>
                        <p className="text-[28px] font-extrabold leading-none" style={{ color: k.value > 0 ? k.color : T.muted }}>
                          {k.value}
                        </p>
                        <p className="text-[11px] mt-1 font-medium" style={{ color: T.muted }}>{k.label}</p>
                      </div>
                      {total > 0 && (
                        <div className="mt-1">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.card2 }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct(k.value, total)}%`, background: k.color }} />
                          </div>
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: k.color }}>
                            {pct(k.value, total)}% del total
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Resumen total */}
                <div className="rounded-2xl border px-5 py-3 flex items-center justify-between"
                  style={{ background: T.card, borderColor: T.border }}>
                  <span className="text-[13px] font-semibold" style={{ color: T.sub }}>Total de entregas</span>
                  <span className="text-[20px] font-extrabold" style={{ color: T.text }}>{total}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
