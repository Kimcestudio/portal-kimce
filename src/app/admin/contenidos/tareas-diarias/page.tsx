'use client'
import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight, Link2, GripVertical } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import type { TareaTipo, TareaD } from '@/cmhub/types'

// ── Utils ────────────────────────────────────────────────────────────────────
function weekRange(offset = 0) {
  const today  = new Date()
  const day    = today.getDay()
  const diff   = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  const label = `${monday.toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${sunday.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
  return { start: fmt(monday), end: fmt(sunday), label }
}

function todayISO() { return new Date().toISOString().split('T')[0] }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'Ahora'
  if (h < 24) return `Hace ${h} h`
  const d = Math.floor(h / 24)
  return `Hace ${d} día${d > 1 ? 's' : ''}`
}

const TIPO_META: Record<TareaTipo, { label: string; short: string; color: string; bg: string; darkBg: string }> = {
  produccion: { label: 'Producción', short: 'PROD',     color: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124,58,237,0.2)'  },
  cliente:    { label: 'Cliente',    short: 'CLIENTE',  color: '#0891b2', bg: '#ecfeff', darkBg: 'rgba(8,145,178,0.2)'   },
  interno:    { label: 'Interno',    short: 'INTERNO',  color: '#6b7280', bg: '#f3f4f6', darkBg: 'rgba(107,114,128,0.2)' },
}

const PRIO_META = {
  alta:  { label: 'Alta',  color: '#dc2626', bg: '#fee2e2', darkBg: 'rgba(220,38,38,0.2)'  },
  media: { label: 'Media', color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(217,119,6,0.2)'  },
  baja:  { label: 'Baja',  color: '#6b7280', bg: '#f3f4f6', darkBg: 'rgba(107,114,128,0.2)'},
}

// ── Celda editable inline ────────────────────────────────────────────────────
function InlineSelect<T extends string>({
  value, options, onChange, renderValue, renderOption, T: tokens,
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
  renderValue: (v: T) => React.ReactNode
  renderOption?: (v: T) => React.ReactNode
  T: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} className="cursor-pointer">{renderValue(value)}</button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-lg overflow-hidden min-w-[120px]"
          style={{ background: tokens.card, borderColor: tokens.border }}>
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center gap-2"
              style={{ background: o === value ? (tokens.page) : 'transparent', color: tokens.text }}
              onMouseEnter={e => (e.currentTarget.style.background = tokens.page)}
              onMouseLeave={e => (e.currentTarget.style.background = o === value ? tokens.page : 'transparent')}>
              {renderOption ? renderOption(o) : o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Celda de observaciones editable ─────────────────────────────────────────
function ObsCell({ value, onSave, T }: { value?: string; onSave: (v: string) => void; T: Record<string, string> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() { setEditing(false); if (draft !== value) onSave(draft) }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
        className="w-full px-2 py-1 text-[12px] rounded-lg border outline-none"
        style={{ background: T.input, color: T.text, borderColor: '#7c3aed' }}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-[12px] text-left w-full px-1 py-0.5 rounded hover:bg-opacity-60 transition-colors"
      style={{ color: value ? T.sub : T.muted }}>
      {value || <span className="opacity-40">—</span>}
    </button>
  )
}

// ── Celda de persona editable ────────────────────────────────────────────────
function PersonCell({
  value, team, onSave, T,
}: { value: string; team: { id: string; name: string; initials: string; color: string }[]; onSave: (v: string) => void; T: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const member = team.find(m => m.name === value)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 cursor-pointer group/person">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: member?.color ?? '#7c3aed' }}>
          {member?.initials ?? value.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[12px] group-hover/person:underline" style={{ color: T.text }}>{value}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-lg overflow-hidden w-44"
          style={{ background: T.card, borderColor: T.border }}>
          {team.map(m => (
            <button key={m.id} onClick={() => { onSave(m.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = T.page)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ background: m.color }}>
                {m.initials}
              </div>
              <span className="text-[12px]" style={{ color: T.text }}>{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fila de tarea ─────────────────────────────────────────────────────────────
function TaskRow({ t, onToggle, onDelete, onUpdate }: {
  t: TareaD
  onToggle: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<TareaD>) => void
}) {
  const { isDark }           = useHubTheme()
  const { brands, contents, team } = useHub()
  const tipoM = TIPO_META[t.tipo ?? 'interno']
  const prioM = PRIO_META[t.prioridad ?? 'media']
  const brand   = t.brandId   ? brands.find(b => b.id === t.brandId)     : null
  const content = t.contentId ? contents.find(c => c.id === t.contentId) : null

  const today    = todayISO()
  const overdue  = t.fechaLimite && !t.hecha && t.fechaLimite < today
  const daysLeft = t.fechaLimite ? Math.ceil((new Date(t.fechaLimite).getTime() - Date.now()) / 86_400_000) : null

  const T: Record<string, string> = isDark ? {
    card: '#161820', border: 'rgba(255,255,255,0.06)', text: '#f1f5f9',
    sub: '#94a3b8', muted: '#4b5563', input: '#1e2028', page: '#0d0f12',
  } : {
    card: '#ffffff', border: '#e5e7eb', text: '#111827',
    sub: '#6b7280', muted: '#d1d5db', input: '#f9fafb', page: '#f8fafc',
  }

  return (
    <tr className="group border-b transition-colors"
      style={{ borderColor: T.border, background: t.hecha ? (isDark ? 'rgba(255,255,255,0.01)' : '#fafafa') : 'transparent' }}
      onMouseEnter={e => { if (!t.hecha) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.02)' : '#fafafe' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.hecha ? (isDark ? 'rgba(255,255,255,0.01)' : '#fafafa') : 'transparent' }}>

      {/* Drag handle */}
      <td className="px-2 w-6">
        <GripVertical size={12} className="opacity-0 group-hover:opacity-30 transition-opacity cursor-grab" style={{ color: T.sub }} />
      </td>

      {/* Checkbox */}
      <td className="px-2 w-8">
        <button onClick={onToggle}
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
          style={{
            borderColor: t.hecha ? '#7c3aed' : T.muted,
            background:  t.hecha ? '#7c3aed' : 'transparent',
          }}>
          {t.hecha && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
        </button>
      </td>

      {/* TIPO */}
      <td className="px-2 w-24">
        <InlineSelect
          value={t.tipo ?? 'interno'}
          options={['produccion', 'cliente', 'interno'] as TareaTipo[]}
          onChange={v => onUpdate({ tipo: v })}
          T={T}
          renderValue={v => {
            const m = TIPO_META[v]
            return (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: isDark ? m.darkBg : m.bg, color: m.color }}>
                {m.short}
              </span>
            )
          }}
          renderOption={v => {
            const m = TIPO_META[v]
            return <span className="text-[11px] font-semibold" style={{ color: m.color }}>{m.label}</span>
          }}
        />
      </td>

      {/* TAREA */}
      <td className="px-2 py-2.5 min-w-[180px]">
        <span className="text-[13px] font-medium"
          style={{ color: t.hecha ? T.sub : T.text, textDecoration: t.hecha ? 'line-through' : 'none' }}>
          {t.texto}
        </span>
        {(content || brand) && (
          <div className="flex items-center gap-1 mt-0.5">
            <Link2 size={9} style={{ color: T.sub }} />
            <span className="text-[10px]" style={{ color: T.sub }}>{content ? content.title : brand?.name}</span>
          </div>
        )}
      </td>

      {/* CLIENTE */}
      <td className="px-2 w-36 text-[12px]" style={{ color: T.sub }}>
        {brand?.name ?? content ? <span className="text-[12px]" style={{ color: T.sub }}>{brand?.name ?? '—'}</span> : <span style={{ color: T.muted }}>—</span>}
      </td>

      {/* RESPONSABLE */}
      <td className="px-2 w-40">
        <PersonCell value={t.editor} team={team} onSave={v => onUpdate({ editor: v })} T={T} />
      </td>

      {/* PRIORIDAD */}
      <td className="px-2 w-24">
        <InlineSelect
          value={t.prioridad ?? 'media'}
          options={['alta', 'media', 'baja'] as const as ('alta' | 'media' | 'baja')[]}
          onChange={v => onUpdate({ prioridad: v })}
          T={T}
          renderValue={v => {
            const m = PRIO_META[v]
            return (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: isDark ? m.darkBg : m.bg, color: m.color }}>
                {m.label}
              </span>
            )
          }}
          renderOption={v => {
            const m = PRIO_META[v]
            return <span className="text-[11px] font-semibold" style={{ color: m.color }}>{m.label}</span>
          }}
        />
      </td>

      {/* OBSERVACIONES */}
      <td className="px-2 min-w-[140px]">
        <ObsCell value={t.observaciones} onSave={v => onUpdate({ observaciones: v || undefined })} T={T} />
      </td>

      {/* FECHA LÍMITE */}
      <td className="px-2 w-20 text-[11px] font-mono text-right">
        {t.fechaLimite && !t.hecha ? (
          <span className="font-semibold"
            style={{ color: overdue ? '#dc2626' : daysLeft! <= 2 ? '#d97706' : T.sub }}>
            {overdue ? `${Math.abs(daysLeft!)}d atrás` : daysLeft === 0 ? 'hoy' : `${daysLeft}d`}
          </span>
        ) : t.createdAt ? (
          <span style={{ color: T.muted }}>{timeAgo(t.createdAt)}</span>
        ) : null}
      </td>

      {/* Eliminar */}
      <td className="px-2 w-8 text-right">
        <button onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#ef4444' }}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── Form inline de nueva tarea ────────────────────────────────────────────────
function AddTaskForm({ defaultEditor, defaultFecha, isDark, T, onAdd }: {
  defaultEditor: string
  defaultFecha: string
  isDark: boolean
  T: Record<string, string>
  onAdd: (data: {
    texto: string; editor: string; prioridad: 'alta'|'media'|'baja'
    tipo: TareaTipo; fecha: string; fechaLimite?: string
    contentId?: string; brandId?: string
  }) => Promise<void>
}) {
  const { team, brands, contents } = useHub()
  const [texto,       setTexto]       = useState('')
  const [editor,      setEditor]      = useState(defaultEditor)
  const [prio,        setPrio]        = useState<'alta'|'media'|'baja'>('media')
  const [tipo,        setTipo]        = useState<TareaTipo>('produccion')
  const [fechaLimite, setFechaLimite] = useState('')
  const [contentId,   setContentId]   = useState('')
  const [brandId,     setBrandId]     = useState('')
  const [expanded,    setExpanded]    = useState(false)
  const [saving,      setSaving]      = useState(false)

  const inputCls = 'px-3 py-2 text-[12px] rounded-xl border outline-none transition-colors'
  const inputStyle = { background: T.input, color: T.text, borderColor: T.border }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setSaving(true)
    await onAdd({
      texto: texto.trim(), editor, prioridad: prio, tipo,
      fecha: defaultFecha,
      fechaLimite: fechaLimite || undefined,
      contentId: contentId || undefined,
      brandId: brandId || undefined,
    })
    setTexto(''); setFechaLimite(''); setContentId(''); setBrandId('')
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ background: T.card, borderColor: T.border }}>
      <div className="flex gap-2 flex-wrap">
        <input value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="¿Qué hay que hacer?"
          className={inputCls + ' flex-1 min-w-[200px]'}
          style={{ ...inputStyle, borderColor: texto ? '#7c3aed' : T.border }} />

        <select value={tipo} onChange={e => setTipo(e.target.value as TareaTipo)}
          className={inputCls}
          style={{ ...inputStyle, color: TIPO_META[tipo].color }}>
          <option value="produccion">📹 Producción</option>
          <option value="cliente">🤝 Cliente</option>
          <option value="interno">⚙️ Interno</option>
        </select>

        <select value={prio} onChange={e => setPrio(e.target.value as 'alta'|'media'|'baja')}
          className={inputCls}
          style={inputStyle}>
          <option value="alta">🔴 Alta</option>
          <option value="media">🟡 Media</option>
          <option value="baja">⚪ Baja</option>
        </select>

        <select value={editor} onChange={e => setEditor(e.target.value)}
          className={inputCls}
          style={inputStyle}>
          {['Estrategia', 'Diseño', 'Audiovisual', 'Otro'].map(cat => {
            const members = team.filter(m => (m.category ?? 'Otro') === cat)
            if (!members.length) return null
            return (
              <optgroup key={cat} label={cat}>
                {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </optgroup>
            )
          })}
        </select>

        <button type="button" onClick={() => setExpanded(o => !o)}
          className={inputCls + ' flex items-center gap-1'}
          style={{ ...inputStyle, color: expanded ? '#7c3aed' : T.sub, borderColor: expanded ? '#7c3aed' : T.border }}>
          <Link2 size={12} /> Vincular
        </button>

        <button type="submit" disabled={saving || !texto.trim()}
          className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={14} /> {saving ? '…' : 'Agregar'}
        </button>
      </div>

      {expanded && (
        <div className="flex gap-2 flex-wrap pt-3 border-t" style={{ borderColor: T.border }}>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.sub }}>Fecha límite</label>
            <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          {tipo === 'produccion' && (
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.sub }}>Vincular contenido</label>
              <select value={contentId} onChange={e => setContentId(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="">Sin vincular</option>
                {contents.filter(c => !['publicado'].includes(c.status)).map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}
          {(tipo === 'cliente' || tipo === 'interno') && (
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.sub }}>Vincular cliente</label>
              <select value={brandId} onChange={e => setBrandId(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="">Sin vincular</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </form>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TareasDiariasPage() {
  const { isDark } = useHubTheme()
  const { tareasD, addTareaD, toggleTareaD, deleteTareaD, updateTareaD, team } = useHub()

  const [weekOffset,   setWeekOffset]   = useState(0)
  const [filterEditor, setFilterEditor] = useState('all')
  const [filterTipo,   setFilterTipo]   = useState<TareaTipo | 'all'>('all')

  const week  = weekRange(weekOffset)
  const today = todayISO()

  const T: Record<string, string> = isDark ? {
    page: '#0d0f12', card: '#161820', border: 'rgba(255,255,255,0.07)',
    text: '#f1f5f9', sub: '#94a3b8', muted: '#4b5563',
    input: '#1e2028', th: 'rgba(255,255,255,0.03)',
  } : {
    page: '#f8fafc', card: '#ffffff', border: '#e5e7eb',
    text: '#111827', sub: '#6b7280', muted: '#d1d5db',
    input: '#f9fafb', th: '#f9fafb',
  }

  const tareasScope = tareasD.filter(t => {
    const enSemana = t.fecha >= week.start && t.fecha <= week.end
    if (!enSemana) return false
    if (filterEditor !== 'all' && t.editor !== filterEditor) return false
    if (filterTipo   !== 'all' && (t.tipo ?? 'interno') !== filterTipo) return false
    return true
  })

  const hechas    = tareasScope.filter(t => t.hecha).length
  const pendientes = tareasScope.filter(t => !t.hecha).length
  const vencidas   = tareasScope.filter(t => !t.hecha && t.fechaLimite && t.fechaLimite < today).length
  const progreso   = tareasScope.length > 0 ? Math.round((hechas / tareasScope.length) * 100) : 0

  // Agrupar por fecha dentro de la semana
  const byFecha: Record<string, TareaD[]> = {}
  tareasScope.forEach(t => {
    if (!byFecha[t.fecha]) byFecha[t.fecha] = []
    byFecha[t.fecha].push(t)
  })
  const fechas = Object.keys(byFecha).sort()

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

  function fmtFecha(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`
  }

  const defaultEditor = team[0]?.name ?? ''

  async function addTask(data: Omit<Parameters<typeof addTareaD>[0], 'hecha'> & { tipo: TareaTipo }) {
    await addTareaD({ ...data, hecha: false })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: T.page }}>

      {/* Header */}
      <div className="px-5 h-14 flex items-center gap-3 shrink-0"
        style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[13px]" style={{ color: T.sub }}>Producción</span>
          <span style={{ color: T.border }}>›</span>
          <span className="text-[13px] font-semibold" style={{ color: T.text }}>Tareas diarias</span>
        </div>

        {/* Stats */}
        {vencidas > 0 && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
            ⚠ {vencidas} vencida{vencidas > 1 ? 's' : ''}
          </span>
        )}
        <span className="text-[11px]" style={{ color: T.sub }}>
          {pendientes} pendiente{pendientes !== 1 ? 's' : ''} · {hechas} hechas
        </span>

        {/* Progreso */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progreso}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }} />
          </div>
          <span className="text-[13px] font-bold" style={{ color: '#7c3aed' }}>{progreso}%</span>
        </div>

        {/* Nav semana */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors"
            style={{ borderColor: T.border, color: T.sub }}>
            <ChevronLeft size={13} />
          </button>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
            style={{ background: T.th, color: T.text }}>{week.label}</span>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors"
            style={{ borderColor: T.border, color: T.sub }}>
            <ChevronRight size={13} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: isDark ? 'rgba(124,58,237,0.2)' : '#f5f3ff', color: '#7c3aed' }}>
              Hoy
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterEditor} onChange={e => setFilterEditor(e.target.value)}
            className="px-3 py-2 text-[12px] rounded-xl border outline-none"
            style={{ background: T.card, color: T.text, borderColor: T.border }}>
            <option value="all">Todos los responsables</option>
            {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>

          <div className="flex gap-1">
            {(['all', 'produccion', 'cliente', 'interno'] as const).map(t => {
              const active = filterTipo === t
              const m = t !== 'all' ? TIPO_META[t] : null
              return (
                <button key={t} onClick={() => setFilterTipo(t)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                  style={active
                    ? { background: m ? m.color : '#7c3aed', color: 'white' }
                    : { background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: T.sub }}>
                  {t === 'all' ? 'Todas' : TIPO_META[t].label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <AddTaskForm defaultEditor={defaultEditor} defaultFecha={today} isDark={isDark} T={T} onAdd={addTask} />

        {/* Tabla agrupada por fecha */}
        {tareasScope.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center"
            style={{ background: T.card, borderColor: T.border }}>
            <p className="text-[15px] font-bold" style={{ color: T.text }}>Sin tareas esta semana</p>
            <p className="text-[13px] mt-1" style={{ color: T.sub }}>Agrega la primera tarea en el formulario de arriba</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {fechas.map(fecha => {
              const items = byFecha[fecha]
              const itemsDone = items.filter(t => t.hecha).length
              const isToday = fecha === today
              return (
                <div key={fecha} className="rounded-2xl border overflow-hidden"
                  style={{
                    background: T.card, borderColor: isToday
                      ? (isDark ? 'rgba(124,58,237,0.4)' : '#c4b5fd')
                      : T.border,
                  }}>
                  {/* Cabecera de día */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5"
                    style={{ background: isToday ? (isDark ? 'rgba(124,58,237,0.1)' : '#faf5ff') : T.th, borderBottom: `1px solid ${T.border}` }}>
                    <span className="text-[12px] font-bold uppercase tracking-wide"
                      style={{ color: isToday ? '#7c3aed' : T.text }}>
                      {fmtFecha(fecha)}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#7c3aed', color: 'white' }}>HOY</span>
                    )}
                    <span className="ml-auto text-[11px]" style={{ color: T.sub }}>
                      {itemsDone}/{items.length}
                    </span>
                  </div>

                  {/* Tabla */}
                  <table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: 28 }} />   {/* handle */}
                      <col style={{ width: 36 }} />   {/* check */}
                      <col style={{ width: 90 }} />   {/* tipo */}
                      <col />                          {/* tarea */}
                      <col style={{ width: 140 }} />  {/* cliente */}
                      <col style={{ width: 160 }} />  {/* responsable */}
                      <col style={{ width: 90 }} />   {/* prioridad */}
                      <col style={{ width: 160 }} />  {/* obs */}
                      <col style={{ width: 80 }} />   {/* fecha */}
                      <col style={{ width: 36 }} />   {/* delete */}
                    </colgroup>
                    <thead>
                      <tr style={{ background: T.th, borderBottom: `1px solid ${T.border}` }}>
                        <th></th><th></th>
                        {['TIPO', 'TAREA', 'CLIENTE', 'RESPONSABLE', 'PRIORIDAD', 'OBSERVACIONES', 'ÚLTIMA ACT.'].map(h => (
                          <th key={h} className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: T.sub }}>{h}</th>
                        ))}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(t => (
                        <TaskRow
                          key={t.id}
                          t={t}
                          onToggle={() => toggleTareaD(t.id, !t.hecha)}
                          onDelete={() => deleteTareaD(t.id)}
                          onUpdate={patch => updateTareaD(t.id, patch)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
