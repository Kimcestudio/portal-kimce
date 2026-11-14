'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { useHub } from '@/cmhub/context'
import {
  subscribeWorkLogs,
  subscribeWorkLogsByDates,
  rescueOverdueTasks,
  addWorkLog,
  updateWorkLog,
  completeWorkLog,
  uncompleteWorkLog,
  startTimer,
  stopTimer,
  deleteWorkLog,
} from '@/services/worklogs'
import type { WorkLog, WorkLogTipo } from '@/cmhub/types'
import {
  Plus, Check, Trash2, Play, Square, ChevronDown, ChevronUp,
  Clock, Zap, Users, Phone, BarChart2, FileText, Video,
  Palette, HelpCircle, X, Pencil, Inbox, ArrowRight, CalendarDays, AlertTriangle,
} from 'lucide-react'

// ── Constantes ──────────────────────────────────────────────────────────────
const BACKLOG_DATE = '__backlog__'

const TIPOS: { value: WorkLogTipo; label: string; color: string; Icon: React.ElementType }[] = [
  { value: 'redaccion',      label: 'Redacción',      color: '#7c3aed', Icon: FileText   },
  { value: 'diseno',         label: 'Diseño',          color: '#ec4899', Icon: Palette    },
  { value: 'video',          label: 'Video/Edición',  color: '#f97316', Icon: Video      },
  { value: 'reunion',        label: 'Reunión',         color: '#14b8a6', Icon: Users      },
  { value: 'llamada',        label: 'Llamada',         color: '#22c55e', Icon: Phone      },
  { value: 'estrategia',     label: 'Estrategia',     color: '#a855f7', Icon: BarChart2  },
  { value: 'administrativo', label: 'Administración', color: '#f59e0b', Icon: Zap        },
  { value: 'investigacion',  label: 'Investigación',  color: '#0ea5e9', Icon: HelpCircle },
  { value: 'otro',           label: 'Otro',            color: '#94a3b8', Icon: Clock      },
]

function tipoMeta(tipo: WorkLogTipo) {
  return TIPOS.find(t => t.value === tipo) ?? TIPOS[TIPOS.length - 1]
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function fmtOverdueLabel(overdueFrom: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const from  = new Date(overdueFrom + 'T00:00:00')
  const days  = Math.round((today.getTime() - from.getTime()) / 86400000)
  if (days === 1) return 'De ayer'
  if (days === 2) return 'De hace 2 días'
  return `De hace ${days} días`
}

function fmtMins(mins?: number) {
  if (!mins) return null
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

// ── Timer en vivo ────────────────────────────────────────────────────────────
function useLiveTimer(startedAt?: string | null) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!startedAt) { setSecs(0); return }
    const tick = () => setSecs(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  if (!startedAt) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Formulario rápido ────────────────────────────────────────────────────────
interface QuickAddProps {
  userId: string
  userDisplayName: string
  date: string
  brands: { id: string; name: string }[]
  onAdded: () => void
  addLabel?: string
  inputPlaceholder?: string
}
function QuickAdd({ userId, userDisplayName, date, brands, onAdded, addLabel = 'Añadir actividad', inputPlaceholder = '¿Qué vas a hacer?' }: QuickAddProps) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<WorkLogTipo>('otro')
  const [titulo, setTitulo] = useState('')
  const [brandId, setBrandId] = useState('')
  const [mins, setMins] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setLoading(true)
    try {
      await addWorkLog({
        userId,
        userDisplayName,
        date,
        tipo,
        titulo: titulo.trim(),
        brandId: brandId || undefined,
        minutosEstimados: mins ? parseInt(mins) : undefined,
        completado: false,
        completadoAt: null,
        startedAt: null,
        recurrencia: null,
      })
      setTitulo(''); setBrandId(''); setMins(''); setOpen(false)
      onAdded()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-[#e5e7eb] text-[#9ca3af] hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors text-[13px] font-medium"
      >
        <Plus size={15} /> {addLabel}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm p-4 flex flex-col gap-3">
      {/* Tipo */}
      <div className="flex gap-1.5 flex-wrap">
        {TIPOS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTipo(t.value)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
            style={tipo === t.value
              ? { background: t.color, color: '#fff', borderColor: t.color }
              : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }}
          >
            <t.Icon size={10} /> {t.label}
          </button>
        ))}
      </div>
      {/* Título */}
      <input
        ref={inputRef}
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        placeholder={inputPlaceholder}
        className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] text-[13px] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed]"
        required
      />
      <div className="flex gap-2">
        {/* Cliente */}
        <select
          value={brandId}
          onChange={e => setBrandId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-[#e5e7eb] text-[12px] text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] bg-white"
        >
          <option value="">Sin cliente</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {/* Tiempo estimado */}
        <div className="flex items-center gap-1.5 border border-[#e5e7eb] rounded-lg px-3 py-2 bg-white">
          <Clock size={12} className="text-[#9ca3af] shrink-0" />
          <input
            type="number"
            min={1}
            max={480}
            value={mins}
            onChange={e => setMins(e.target.value)}
            placeholder="min"
            className="w-14 text-[12px] text-[#374151] focus:outline-none placeholder:text-[#9ca3af]"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-[12px] text-[#6b7280] hover:text-[#111827] transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !titulo.trim()}
          className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-[#5254cc] transition-colors"
        >
          {loading ? 'Añadiendo…' : 'Añadir'}
        </button>
      </div>
    </form>
  )
}

// ── Tarjeta de WorkLog ────────────────────────────────────────────────────────
function WorkLogCard({ log, brands }: { log: WorkLog; brands: { id: string; name: string }[] }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitulo, setEditTitulo] = useState(log.titulo)
  const [editBrand, setEditBrand] = useState(log.brandId ?? '')
  const [editMins, setEditMins] = useState(String(log.minutosEstimados ?? ''))
  const liveTimer = useLiveTimer(log.startedAt)
  const meta = tipoMeta(log.tipo)
  const brandName = brands.find(b => b.id === log.brandId)?.name

  async function toggleComplete() {
    if (log.completado) await uncompleteWorkLog(log.id)
    else {
      const mins = log.startedAt
        ? Math.round((Date.now() - new Date(log.startedAt).getTime()) / 60000)
        : undefined
      await completeWorkLog(log.id, mins)
    }
  }

  async function toggleTimer() {
    if (log.startedAt) await stopTimer(log)
    else await startTimer(log.id)
  }

  async function saveEdit() {
    await updateWorkLog(log.id, {
      titulo: editTitulo.trim(),
      brandId: editBrand || undefined,
      minutosEstimados: editMins ? parseInt(editMins) : undefined,
    })
    setEditing(false)
  }

  return (
    <div className={`bg-white rounded-xl border transition-all ${log.completado ? 'border-[#d1fae5] opacity-70' : 'border-[#e5e7eb] hover:border-[#c7d2fe]'}`}>
      <div className="flex items-start gap-3 p-3.5">
        {/* Check */}
        <button
          onClick={toggleComplete}
          className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${log.completado ? 'bg-[#10b981] border-[#10b981]' : 'border-[#d1d5db] hover:border-[#7c3aed]'}`}
        >
          {log.completado && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={editTitulo}
                onChange={e => setEditTitulo(e.target.value)}
                className="w-full px-2 py-1 rounded border border-[#e5e7eb] text-[13px] focus:outline-none focus:border-[#7c3aed]"
              />
              <div className="flex gap-2">
                <select value={editBrand} onChange={e => setEditBrand(e.target.value)}
                  className="flex-1 px-2 py-1 rounded border border-[#e5e7eb] text-[12px] bg-white">
                  <option value="">Sin cliente</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="number" min={1} max={480} value={editMins} onChange={e => setEditMins(e.target.value)}
                  placeholder="min"
                  className="w-16 px-2 py-1 rounded border border-[#e5e7eb] text-[12px] focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="px-3 py-1 text-[11px] bg-[#7c3aed] text-white rounded-lg font-semibold">Guardar</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-[11px] text-[#6b7280]">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                  style={{ background: meta.color + '18', color: meta.color }}
                >
                  <meta.Icon size={9} /> {meta.label}
                </span>
                {log.overdueFrom && !log.completado && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                    <AlertTriangle size={9} /> {fmtOverdueLabel(log.overdueFrom)}
                  </span>
                )}
                {brandName && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#f3f4f6] text-[#6b7280]">
                    {brandName}
                  </span>
                )}
              </div>
              <p className={`text-[13px] font-medium mt-1 ${log.completado ? 'line-through text-[#9ca3af]' : 'text-[#111827]'}`}>
                {log.titulo}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {log.minutosEstimados && (
                  <span className="text-[11px] text-[#9ca3af]">Est. {fmtMins(log.minutosEstimados)}</span>
                )}
                {log.minutosReales && (
                  <span className="text-[11px] text-[#10b981] font-medium">Real {fmtMins(log.minutosReales)}</span>
                )}
                {liveTimer && (
                  <span className="text-[11px] text-[#f97316] font-mono font-semibold animate-pulse">{liveTimer}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          {!log.completado && (
            <button
              onClick={toggleTimer}
              className={`p-1.5 rounded-lg transition-all ${log.startedAt ? 'bg-[#fef3c7] text-[#f59e0b] hover:bg-[#fde68a]' : 'text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#7c3aed]'}`}
              title={log.startedAt ? 'Detener timer' : 'Iniciar timer'}
            >
              {log.startedAt ? <Square size={13} /> : <Play size={13} />}
            </button>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-all">
              <Pencil size={13} />
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6] transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => deleteWorkLog(log.id)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0 border-t border-[#f3f4f6] mt-0">
          {log.descripcion ? (
            <p className="text-[12px] text-[#6b7280] leading-relaxed mt-2">{log.descripcion}</p>
          ) : (
            <p className="text-[11px] text-[#d1d5db] italic mt-2">Sin descripción</p>
          )}
          {log.completadoAt && (
            <p className="text-[10px] text-[#9ca3af] mt-1">
              Completado a las {new Date(log.completadoAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de Backlog ────────────────────────────────────────────────────────
function BacklogCard({ log, brands }: { log: WorkLog; brands: { id: string; name: string }[] }) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const meta = tipoMeta(log.tipo)
  const brandName = brands.find(b => b.id === log.brandId)?.name
  const dateInputRef = useRef<HTMLInputElement>(null)

  async function moveTo(targetDate: string) {
    try {
      await updateWorkLog(log.id, { date: targetDate })
    } catch (err) {
      console.error('[BacklogCard] moveTo error:', err)
    }
  }

  async function applyCustomDate() {
    if (!customDate) return
    await moveTo(customDate)
    setShowDatePicker(false)
  }

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] hover:border-[#c7d2fe] transition-all">
      <div className="flex items-start gap-3 p-3.5">
        {/* Tipo dot */}
        <div className="shrink-0 mt-1.5 w-2 h-2 rounded-full" style={{ background: meta.color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: meta.color + '18', color: meta.color }}
            >
              <meta.Icon size={9} /> {meta.label}
            </span>
            {brandName && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#f3f4f6] text-[#6b7280]">
                {brandName}
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium text-[#111827] mt-1">{log.titulo}</p>
          {log.minutosEstimados && (
            <span className="text-[11px] text-[#9ca3af]">Est. {fmtMins(log.minutosEstimados)}</span>
          )}
        </div>

        {/* Acciones: mover a fecha */}
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            onClick={() => moveTo(todayISO())}
            title="Mover a hoy"
            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ddd6fe] transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => moveTo(tomorrowISO())}
            title="Mover a mañana"
            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#f0fdf4] text-[#16a34a] hover:bg-[#dcfce7] transition-colors"
          >
            Mañana
          </button>
          <button
            onClick={() => { setShowDatePicker(d => !d); setTimeout(() => dateInputRef.current?.showPicker?.(), 50) }}
            title="Elegir fecha"
            className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#7c3aed] transition-all"
          >
            <CalendarDays size={13} />
          </button>
          <button
            onClick={() => deleteWorkLog(log.id)}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all"
          >
            <Trash2 size={13} />
          </button>

          {showDatePicker && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-[#e5e7eb] rounded-xl shadow-lg p-3 flex flex-col gap-2 min-w-[180px]">
              <input
                ref={dateInputRef}
                type="date"
                value={customDate}
                min={todayISO()}
                onChange={e => setCustomDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-[#e5e7eb] text-[12px] focus:outline-none focus:border-[#7c3aed]"
              />
              <div className="flex gap-2">
                <button
                  onClick={applyCustomDate}
                  disabled={!customDate}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#7c3aed] text-white text-[11px] font-semibold disabled:opacity-40 hover:bg-[#5254cc] transition-colors"
                >
                  Mover
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-[#6b7280] hover:bg-[#f3f4f6]"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formulario simplificado independiente ────────────────────────────────────
interface TopQuickAddProps {
  userId: string
  userDisplayName: string
  today: string
  tomorrow: string
  brandList: { id: string; name: string }[]
}
function TopQuickAdd({ userId, userDisplayName, today, tomorrow, brandList }: TopQuickAddProps) {
  const [titulo, setTitulo] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(date: string) {
    const t = titulo.trim()
    if (!t || loading) return
    setLoading(true)
    try {
      await addWorkLog({ userId, userDisplayName, date, tipo: 'otro', titulo: t, completado: false, completadoAt: null, startedAt: null, recurrencia: null })
      setTitulo('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit(today)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] px-3 py-2.5 flex items-center gap-2 shadow-sm">
      <Plus size={14} className="text-[#9ca3af] shrink-0" />
      <input
        ref={inputRef}
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        onKeyDown={onKey}
        placeholder="Nueva actividad… (Enter = hoy)"
        className="flex-1 text-[13px] placeholder:text-[#c4c9d4] focus:outline-none bg-transparent min-w-0"
      />
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => submit(today)}
          disabled={!titulo.trim() || loading}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ddd6fe] disabled:opacity-40 transition-colors"
        >
          Hoy
        </button>
        <button
          onClick={() => submit(tomorrow)}
          disabled={!titulo.trim() || loading}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#e0f2fe] text-[#0ea5e9] hover:bg-[#bae6fd] disabled:opacity-40 transition-colors"
        >
          Mañana
        </button>
      </div>
    </div>
  )
}

// ── Sección de un día (Hoy / Mañana) ─────────────────────────────────────────
interface DaySectionProps {
  title: string
  accent: string
  date: string
  logs: WorkLog[]
  brandList: { id: string; name: string }[]
  userId: string
  userDisplayName: string
  open: boolean
  onToggle: () => void
  showStats?: boolean
}
function DaySection({ title, accent, date, logs, brandList, userId, userDisplayName, open, onToggle, showStats }: DaySectionProps) {
  const pending = logs.filter(l => !l.completado)
  const done    = logs.filter(l => l.completado)
  const minsEst  = logs.reduce((s, l) => s + (l.minutosEstimados ?? 0), 0)
  const minsReal = logs.reduce((s, l) => s + (l.minutosReales    ?? 0), 0)

  return (
    <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-[13px] font-bold text-[#111827]">{title}</span>
        <span className="text-[11px] text-[#9ca3af] capitalize hidden sm:inline">{fmtDate(date)}</span>
        <div className="ml-auto flex items-center gap-2">
          {pending.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: accent + '18', color: accent }}>
              {pending.length}
            </span>
          )}
          {done.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#059669]">
              {done.length} ✓
            </span>
          )}
          <ChevronDown size={14} className={`text-[#9ca3af] transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-[#e5e7eb] bg-[#fafafa] p-4 flex flex-col gap-3">
          {showStats && logs.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-1">
              {[
                { label: 'Pendientes', value: String(pending.length), color: accent },
                { label: 'Hechas',     value: String(done.length),    color: '#10b981' },
                { label: 'Est.',       value: fmtMins(minsEst) ?? '—', color: '#f59e0b' },
                { label: 'Real',       value: fmtMins(minsReal) ?? '—', color: '#14b8a6' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-[#e5e7eb] px-2 py-2 text-center">
                  <div className="text-[15px] font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] text-[#9ca3af] mt-0.5 font-medium uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">Por hacer — {pending.length}</p>
              {pending.map(log => <WorkLogCard key={log.id} log={log} brands={brandList} />)}
            </div>
          )}

          {done.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mt-1">Completadas — {done.length}</p>
              {done.map(log => <WorkLogCard key={log.id} log={log} brands={brandList} />)}
            </div>
          )}

          {logs.length === 0 && (
            <p className="text-[12px] text-[#9ca3af] text-center py-3">Sin actividades para {title.toLowerCase()}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sección Próximo ───────────────────────────────────────────────────────────
interface ProximoSectionProps {
  daysWithLogs: [string, WorkLog[]][]
  brandList: { id: string; name: string }[]
  userId: string
  userDisplayName: string
  open: boolean
  onToggle: () => void
}
function ProximoSection({ daysWithLogs, brandList, userId, userDisplayName, open, onToggle }: ProximoSectionProps) {
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const totalPending = daysWithLogs.reduce((s, [, logs]) => s + logs.filter(l => !l.completado).length, 0)

  function fmtDayLabel(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  return (
    <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
      >
        <div className="w-2 h-2 rounded-full shrink-0 bg-[#f59e0b]" />
        <span className="text-[13px] font-bold text-[#111827]">Próximo</span>
        <div className="ml-auto flex items-center gap-2">
          {totalPending > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#d97706]">
              {totalPending}
            </span>
          )}
          <ChevronDown size={14} className={`text-[#9ca3af] transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-[#e5e7eb] bg-[#fafafa] p-4 flex flex-col gap-4">
          {daysWithLogs.length === 0 && !addingDate && (
            <p className="text-[12px] text-[#9ca3af] text-center py-2">Sin actividades programadas próximamente</p>
          )}

          {daysWithLogs.map(([date, logs]) => {
            const pending = logs.filter(l => !l.completado)
            const done = logs.filter(l => l.completado)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-widest capitalize">
                    {fmtDayLabel(date)}
                  </p>
                  <button
                    onClick={() => setAddingDate(addingDate === date ? null : date)}
                    className="text-[11px] text-[#7c3aed] hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Añadir
                  </button>
                </div>
                {addingDate === date && (
                  <div className="mb-2">
                    <QuickAdd
                      userId={userId} userDisplayName={userDisplayName}
                      date={date} brands={brandList} onAdded={() => setAddingDate(null)}
                      addLabel="Añadir para este día"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {pending.map(log => <WorkLogCard key={log.id} log={log} brands={brandList} />)}
                  {done.map(log => <WorkLogCard key={log.id} log={log} brands={brandList} />)}
                </div>
              </div>
            )
          })}

          {/* Añadir a una fecha sin tareas todavía */}
          {addingDate && !daysWithLogs.find(([d]) => d === addingDate) && (
            <QuickAdd
              userId={userId} userDisplayName={userDisplayName}
              date={addingDate} brands={brandList} onAdded={() => setAddingDate(null)}
              addLabel="Añadir actividad"
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-[#9ca3af]">Programar para:</span>
            <input
              type="date"
              min={tomorrowISO()}
              onChange={e => { if (e.target.value) setAddingDate(e.target.value) }}
              className="px-2 py-1 rounded-lg border border-[#e5e7eb] text-[11px] focus:outline-none focus:border-[#7c3aed] bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function MiDiaPage() {
  const auth = useOptionalAuth()
  const { brands } = useHub()
  const [, setRefresh] = useState(0)

  const userId = auth?.profile?.uid ?? auth?.authUser?.uid ?? ''
  const userDisplayName = auth?.profile?.displayName ?? auth?.authUser?.email ?? ''
  const brandList = brands.map(b => ({ id: b.id, name: b.name }))

  const today    = todayISO()
  const tomorrow = tomorrowISO()

  const [todayLogs,    setTodayLogs]    = useState<WorkLog[]>([])
  const [tomorrowLogs, setTomorrowLogs] = useState<WorkLog[]>([])
  const [nextLogsMap,  setNextLogsMap]  = useState<Record<string, WorkLog[]>>({})
  const [backlog,      setBacklog]      = useState<WorkLog[]>([])

  // Secciones colapsables
  const [todayOpen,    setTodayOpen]    = useState(true)
  const [tomorrowOpen, setTomorrowOpen] = useState(true)
  const [proximoOpen,  setProximoOpen]  = useState(true)
  const [backlogOpen,  setBacklogOpen]  = useState(true)

  // Rescatar tareas vencidas al abrir la página
  useEffect(() => { if (userId) rescueOverdueTasks(userId) }, [userId])

  // Suscripciones
  useEffect(() => { if (!userId) return; return subscribeWorkLogs(userId, today, setTodayLogs) }, [userId, today])
  useEffect(() => { if (!userId) return; return subscribeWorkLogs(userId, tomorrow, setTomorrowLogs) }, [userId, tomorrow])
  useEffect(() => {
    if (!userId) return
    const nextDates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i + 2)
      return d.toISOString().split('T')[0]
    })
    return subscribeWorkLogsByDates(userId, nextDates, logs => {
      const map: Record<string, WorkLog[]> = {}
      for (const log of logs) {
        if (!map[log.date]) map[log.date] = []
        map[log.date].push(log)
      }
      setNextLogsMap(map)
    })
  }, [userId])
  useEffect(() => { if (!userId) return; return subscribeWorkLogs(userId, BACKLOG_DATE, setBacklog) }, [userId])

  // Timer en vivo — refresca cada segundo si hay alguno activo
  useEffect(() => {
    const hasTimer = [...todayLogs, ...tomorrowLogs].some(l => l.startedAt)
    if (!hasTimer) return
    const id = setInterval(() => setRefresh(r => r + 1), 1000)
    return () => clearInterval(id)
  }, [todayLogs, tomorrowLogs])

  // Próximo: solo días que tengan al menos una tarea, ordenados
  const nextDaysWithLogs = Object.entries(nextLogsMap)
    .filter(([, logs]) => logs.length > 0)
    .sort(([a], [b]) => a.localeCompare(b)) as [string, WorkLog[]][]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <h1 className="text-[14px] font-bold text-[#111827]">Mi día</h1>
        <span className="text-[12px] text-[#9ca3af] capitalize">{fmtDate(today)}</span>
      </div>

      <div className="flex-1 overflow-hidden flex gap-0">

        {/* ── Columna izquierda: Hoy + Mañana ── */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 min-w-0">
          <TopQuickAdd
            userId={userId} userDisplayName={userDisplayName}
            today={today} tomorrow={tomorrow} brandList={brandList}
          />
          <DaySection
            title="Hoy" accent="#7c3aed" date={today}
            logs={todayLogs} brandList={brandList}
            userId={userId} userDisplayName={userDisplayName}
            open={todayOpen} onToggle={() => setTodayOpen(o => !o)}
            showStats
          />
          <DaySection
            title="Mañana" accent="#0ea5e9" date={tomorrow}
            logs={tomorrowLogs} brandList={brandList}
            userId={userId} userDisplayName={userDisplayName}
            open={tomorrowOpen} onToggle={() => setTomorrowOpen(o => !o)}
          />
        </div>

        {/* ── Columna derecha: Próximo + Backlog ── */}
        <div className="w-[340px] shrink-0 border-l border-[#e5e7eb] overflow-y-auto p-4 flex flex-col gap-3 bg-[#f8fafc]">

          {/* Próximo — tareas con fecha asignada */}
          <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden bg-white">
            <button
              onClick={() => setProximoOpen(o => !o)}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
            >
              <CalendarDays size={14} className="text-[#f59e0b] shrink-0" />
              <span className="text-[13px] font-bold text-[#111827]">Próximo</span>
              <div className="ml-auto flex items-center gap-2">
                {nextDaysWithLogs.reduce((s, [, l]) => s + l.filter(x => !x.completado).length, 0) > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#d97706]">
                    {nextDaysWithLogs.reduce((s, [, l]) => s + l.filter(x => !x.completado).length, 0)}
                  </span>
                )}
                <ChevronDown size={14} className={`text-[#9ca3af] transition-transform duration-200 ${proximoOpen ? '' : '-rotate-90'}`} />
              </div>
            </button>

            {proximoOpen && (
              <div className="border-t border-[#e5e7eb] bg-[#fafafa] p-3 flex flex-col gap-3">
                {nextDaysWithLogs.length === 0 && !proximoOpen && null}
                {nextDaysWithLogs.length === 0 && (
                  <p className="text-[11px] text-[#9ca3af] text-center py-2">Sin actividades programadas</p>
                )}
                {nextDaysWithLogs.map(([date, logs]) => {
                  const label = new Date(date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
                  const pending = logs.filter(l => !l.completado)
                  const done    = logs.filter(l => l.completado)
                  return (
                    <div key={date}>
                      <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1.5 capitalize">{label}</p>
                      <div className="flex flex-col gap-1.5">
                        {[...pending, ...done].map(log => <WorkLogCard key={log.id} log={log} brands={brandList} />)}
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 pt-1 border-t border-[#e5e7eb]">
                  <span className="text-[10px] text-[#9ca3af] shrink-0">Programar para:</span>
                  <input
                    type="date"
                    min={tomorrowISO()}
                    className="flex-1 px-2 py-1 rounded-lg border border-[#e5e7eb] text-[11px] focus:outline-none focus:border-[#f59e0b] bg-white"
                    onChange={e => {
                      const d = e.target.value
                      if (!d) return
                      setNextLogsMap(prev => ({ ...prev, [d]: prev[d] ?? [] }))
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Backlog — ideas sin fecha, para capturar y mover */}
          <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden bg-white">
            <button
              onClick={() => setBacklogOpen(o => !o)}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
            >
              <Inbox size={14} className="text-[#8b5cf6] shrink-0" />
              <span className="text-[13px] font-bold text-[#111827]">Backlog</span>
              <span className="ml-1 text-[10px] text-[#9ca3af] font-normal">Ideas sin fecha</span>
              <div className="ml-auto flex items-center gap-2">
                {backlog.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ede9fe] text-[#7c3aed]">
                    {backlog.length}
                  </span>
                )}
                <ChevronDown size={14} className={`text-[#9ca3af] transition-transform duration-200 ${backlogOpen ? '' : '-rotate-90'}`} />
              </div>
            </button>

            {backlogOpen && (
              <div className="border-t border-[#e5e7eb] bg-[#fafafa] p-3 flex flex-col gap-2">
                <QuickAdd
                  userId={userId} userDisplayName={userDisplayName}
                  date={BACKLOG_DATE} brands={brandList} onAdded={() => {}}
                  addLabel="Capturar idea"
                  inputPlaceholder="¿Qué tienes en mente?"
                />
                {backlog.length === 0 && (
                  <p className="text-[11px] text-[#9ca3af] text-center py-2">Captura y mueve cuando tengas fecha</p>
                )}
                {backlog.map(log => (
                  <BacklogCard key={log.id} log={log} brands={brandList} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
