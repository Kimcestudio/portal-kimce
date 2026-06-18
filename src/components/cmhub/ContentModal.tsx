'use client'
import React, { useState, useEffect, useRef } from 'react'
import {
  X, Copy, Trash2, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, Check, ArrowRight, Link2, FolderOpen, Pencil, Plus, ChevronDown,
} from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useAuth } from '@/components/auth/AuthProvider'
import { useHubMeta, useHubTheme } from '@/cmhub/theme'
import { NETWORK_META, STATUS_META, PRIORITY_META, ALL_NETWORKS, ALL_STATUSES, PRODUCTION_STATUSES } from '@/cmhub/data'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import EditableTitle from '@/components/cmhub/EditableTitle'
import type { Content, ContentStatus, Network, Format, Priority, ContentMetrics } from '@/cmhub/types'

interface Props {
  initial?: Partial<Content>
  defaultBrandId?: string
  onClose: () => void
  onSaved?: (c: Content) => void
  mode?: 'modal' | 'drawer'
}

const TABS = ['Resumen', 'Producción', 'Copy', 'Métricas', 'Comentarios'] as const
type Tab = typeof TABS[number]

type MetricsForm = {
  reach: string; impressions: string; interactions: string; likes: string
  comments: string; shares: string; saves: string; clicks: string
  views: string; engagementRate: string; performanceNotes: string
}

type FormState = {
  brandId: string
  title: string
  channels: Network[]
  format: Format
  date: string       // fecha de publicación
  dueDate: string    // fecha de finalización (entrega creativa)
  time: string
  status: ContentStatus
  priority: Priority
  responsible: string
  copy: string
  visualDescription: string
  cta: string
  hashtags: string
  designUrl: string  // link de Canva (referencia)
  pag: string
  driveUrl: string   // link final de Drive (pieza lista)
  channelUrls: Partial<Record<Network, string>>  // link por canal de publicación
  message: string
  dueAssignee: string
  responsables: string[]
  internalNotes: string
  internalComments: string
  clientComments: string
  metrics: MetricsForm
}

function metricsToForm(m?: ContentMetrics): MetricsForm {
  return {
    reach: m?.reach?.toString() ?? '',
    impressions: m?.impressions?.toString() ?? '',
    interactions: m?.interactions?.toString() ?? '',
    likes: m?.likes?.toString() ?? '',
    comments: m?.comments?.toString() ?? '',
    shares: m?.shares?.toString() ?? '',
    saves: m?.saves?.toString() ?? '',
    clicks: m?.clicks?.toString() ?? '',
    views: m?.views?.toString() ?? '',
    engagementRate: m?.engagementRate?.toString() ?? '',
    performanceNotes: m?.performanceNotes ?? '',
  }
}

function formToMetrics(m: MetricsForm): ContentMetrics | undefined {
  const n = (s: string) => (s !== '' ? parseFloat(s) : undefined)
  const r: ContentMetrics = {
    reach: n(m.reach), impressions: n(m.impressions), interactions: n(m.interactions),
    likes: n(m.likes), comments: n(m.comments), shares: n(m.shares),
    saves: n(m.saves), clicks: n(m.clicks), views: n(m.views),
    engagementRate: n(m.engagementRate), performanceNotes: m.performanceNotes || undefined,
  }
  return Object.values(r).some(v => v !== undefined) ? r : undefined
}

function initForm(initial: Partial<Content> | undefined, defaultBrandId: string, firstBrandId: string): FormState {
  return {
    brandId:    initial?.brandId   ?? defaultBrandId ?? firstBrandId ?? '',
    title:      initial?.title     ?? '',
    channels:   initial?.channels?.length ? initial.channels : (initial?.channel ? [initial.channel] : ['instagram']),
    format:     initial?.format    ?? 'Post',
    date:       initial?.date      ?? '',
    dueDate:    initial?.dueDate   ?? '',
    time:       initial?.time      ?? '',
    status:     initial?.status    ?? 'idea',
    priority:   initial?.priority  ?? 'media',
    responsible: initial?.responsible ?? '',
    copy:       initial?.copy      ?? '',
    visualDescription: initial?.visualDescription ?? '',
    cta:        initial?.cta       ?? '',
    hashtags:   initial?.hashtags  ?? '',
    designUrl:  initial?.designUrl ?? '',
    pag:        initial?.pag       ?? '',
    driveUrl:   initial?.driveUrl  ?? '',
    channelUrls: (() => {
      if (initial?.channelUrls && Object.keys(initial.channelUrls).length > 0) return initial.channelUrls
      if (initial?.postUrl && initial?.channel) return { [initial.channel]: initial.postUrl }
      return {}
    })(),
    message:         initial?.message         ?? '',
    dueAssignee:     initial?.dueAssignee     ?? '',
    responsables:    initial?.responsables    ?? [],
    internalNotes:   initial?.internalNotes   ?? '',
    internalComments: initial?.internalComments ?? '',
    clientComments:   initial?.clientComments  ?? '',
    metrics:    metricsToForm(initial?.metrics),
  }
}

// ── Hook dropdown genérico ────────────────────────────────────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return { open, setOpen, ref }
}

// ── Dropdown de Marca ─────────────────────────────────────────────────────────
function BrandDropdown({ value, brands, onChange }: {
  value: string
  brands: { id: string; name: string; color?: string; initials?: string }[]
  onChange: (v: string) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const selected = brands.find(b => b.id === value)
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] hover:border-[#7c3aed] transition-colors w-full cursor-pointer">
        {selected ? (
          <>
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ background: selected.color ?? '#6366f1' }}>{selected.initials ?? selected.name[0]}</div>
            <span className="flex-1 text-left text-[12px] font-semibold text-[#111827] truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-[12px] text-[#9ca3af]">Seleccionar marca…</span>
        )}
        <ChevronDown size={13} className="text-[#9ca3af] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-full max-h-52 overflow-y-auto">
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] text-[12px] text-[#9ca3af] cursor-pointer transition-colors">
            Sin marca
          </button>
          {brands.map(b => (
            <button key={b.id} type="button" onClick={() => { onChange(b.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer transition-colors">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{ background: b.color ?? '#6366f1' }}>{b.initials ?? b.name[0]}</div>
              <span className="text-[12px] text-[#111827] truncate">{b.name}</span>
              {b.id === value && <Check size={11} className="ml-auto text-[#7c3aed] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dropdown de Formato ───────────────────────────────────────────────────────
const FORMAT_COLORS: Record<string, { bg: string; color: string }> = {
  Reel:     { bg: '#fce7f3', color: '#be185d' },
  Post:     { bg: '#ede9fe', color: '#6d28d9' },
  Historia: { bg: '#fef3c7', color: '#92400e' },
  Carrusel: { bg: '#dbeafe', color: '#1d4ed8' },
  Video:    { bg: '#fee2e2', color: '#b91c1c' },
  Email:    { bg: '#d1fae5', color: '#065f46' },
  Story:    { bg: '#fef3c7', color: '#92400e' },
  Short:    { bg: '#fee2e2', color: '#b91c1c' },
  Mensaje:  { bg: '#e0f2fe', color: '#0369a1' },
}
const ALL_FORMAT_OPTIONS = ['Reel','Post','Historia','Carrusel','Video','Email','Story','Short','Mensaje']

function FormatoDropdown({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const { open, setOpen, ref } = useDropdown()
  const m = FORMAT_COLORS[value] ?? { bg: '#f3f4f6', color: '#374151' }
  const dropBg    = isDark ? '#1e2028' : '#ffffff'
  const dropBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const hoverBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer hover:opacity-80 transition-opacity w-full"
        style={{ background: m.bg, color: m.color }}>
        <span className="flex-1 text-left truncate">{value || '—'}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl shadow-lg z-50 py-1 min-w-full border"
          style={{ background: dropBg, borderColor: dropBorder }}>
          {ALL_FORMAT_OPTIONS.map(f => {
            const fm = FORMAT_COLORS[f] ?? { bg: '#f3f4f6', color: '#374151' }
            return (
              <button key={f} type="button" onClick={() => { onChange(f); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg flex-1 text-left"
                  style={{ background: fm.bg, color: fm.color }}>{f}</span>
                {f === value && <Check size={11} className="text-[#7c3aed] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Dropdown de Estado ────────────────────────────────────────────────────────
function StatusDropdown({ value, statusMeta, onChange, isDark }: {
  value: string
  statusMeta: Record<string, { label: string; bg: string; text: string }>
  onChange: (v: string) => void
  isDark: boolean
}) {
  const { open, setOpen, ref } = useDropdown()
  const m = statusMeta[value]
  const dropBg    = isDark ? '#1e2028' : '#ffffff'
  const dropBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const hoverBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity w-full"
        style={m ? { background: m.bg, color: m.text } : { background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: isDark ? '#9ca3af' : '#9ca3af' }}>
        <span className="flex-1 text-left">{m ? m.label : 'Estado…'}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl shadow-lg z-50 py-1 min-w-full border"
          style={{ background: dropBg, borderColor: dropBorder }}>
          {ALL_STATUSES.filter(s => statusMeta[s]).map(s => {
            const sm = statusMeta[s]
            return (
              <button key={s} type="button" onClick={() => { onChange(s); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg flex-1 text-left"
                  style={{ background: sm.bg, color: sm.text }}>{sm.label}</span>
                {s === value && <Check size={11} className="text-[#7c3aed] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Dropdown de Prioridad ─────────────────────────────────────────────────────
function PriorityDropdown({ value, priorityMeta, onChange, isDark }: {
  value: string
  priorityMeta: Record<string, { label: string; bg: string; text: string }>
  onChange: (v: string) => void
  isDark: boolean
}) {
  const { open, setOpen, ref } = useDropdown()
  const m = priorityMeta[value]
  const dropBg    = isDark ? '#1e2028' : '#ffffff'
  const dropBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const hoverBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity w-full"
        style={m ? { background: m.bg, color: m.text } : { background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: '#9ca3af' }}>
        <span className="flex-1 text-left">{m ? m.label : 'Prioridad…'}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl shadow-lg z-50 py-1 min-w-full border"
          style={{ background: dropBg, borderColor: dropBorder }}>
          {Object.entries(priorityMeta).map(([p, pm]) => (
            <button key={p} type="button" onClick={() => { onChange(p); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg flex-1 text-left"
                style={{ background: pm.bg, color: pm.text }}>{pm.label}</span>
              {p === value && <Check size={11} className="text-[#7c3aed] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ResumenFieldRow (sin etiqueta lateral, solo label encima) ─────────────────
function ResumenFieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-[#f5f5f5]">
      <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">{label}</span>
      {children}
    </div>
  )
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[#f5f5f5] last:border-0">
      <div className="w-28 shrink-0 mt-2.5">
        <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block">{label}</span>
        {hint && <span className="text-[9px] text-[#d1d5db] leading-tight block mt-0.5">{hint}</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function FieldInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent border-0 border-b border-transparent hover:border-[#e5e7eb] focus:border-[#7c3aed] outline-none py-1.5 text-[13px] text-[#111827] placeholder-[#c8cdd6] transition-colors"
    />
  )
}

function FieldSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-transparent border-0 border-b border-transparent hover:border-[#e5e7eb] focus:border-[#7c3aed] outline-none py-1.5 text-[13px] text-[#111827] transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  )
}

function FieldTextarea({ value, onChange, rows = 4, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#c8cdd6] focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 resize-none transition-all"
    />
  )
}

function MetricInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="border border-[#e5e7eb] rounded-xl px-3 py-2 text-[14px] font-semibold text-[#111827] focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-[#d1d5db] transition-all"
      />
    </div>
  )
}

// Production link row with icon, label, input and optional external link
function ProdLinkRow({
  step, icon: Icon, label, sublabel, value, onChange, placeholder, accent = '#7c3aed',
  action, actionLabel,
}: {
  step: number; icon: React.ElementType; label: string; sublabel: string
  value: string; onChange: (v: string) => void; placeholder: string; accent?: string
  action?: () => void; actionLabel?: string
}) {
  return (
    <div className="flex gap-3">
      {/* Step indicator */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: value ? accent : '#d1d5db' }}>
          {value ? <Check size={12} /> : step}
        </div>
        {step < 3 && <div className="w-px flex-1 bg-[#e5e7eb] mt-1" style={{ minHeight: 20 }} />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-5">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon size={12} className="shrink-0" style={{ color: value ? accent : '#9ca3af' }} />
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: value ? accent : '#9ca3af' }}>{label}</span>
        </div>
        <p className="text-[11px] text-[#b0b7c3] mb-2">{sublabel}</p>
        <div className="relative">
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 placeholder-[#d1d5db] transition-all"
          />
          {value && (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#7c3aed]">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        {action && actionLabel && value && (
          <button
            type="button"
            onClick={action}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: accent + '15', color: accent }}
          >
            {actionLabel} <ArrowRight size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ContentModal({ initial, defaultBrandId, onClose, onSaved, mode = 'modal' }: Props) {
  const { STATUS_META, PRIORITY_META, NETWORK_META } = useHubMeta()
  const { isDark } = useHubTheme()
  const { brands, team, contents, tareasD, addTareaD, toggleTareaD, deleteTareaD, addContent, updateContent, deleteContent, duplicateContent } = useHub()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const activeTeam = team.filter(m => m.status === 'active')
  // Si el usuario no cargó aún o es admin → ve todo el equipo
  // Colaboradores → solo se ven a sí mismos
  const visibleTeam = (!user || isAdmin)
    ? activeTeam
    : activeTeam.filter(m => m.email === user.email)
  const isEdit = !!initial?.id
  const [tab, setTab] = useState<Tab>('Resumen')
  const [form, setForm] = useState<FormState>(() => initForm(initial, defaultBrandId ?? '', brands[0]?.id ?? ''))
  const [titleError, setTitleError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // ── Tareas vinculadas ──
  const [newTaskText,   setNewTaskText]   = useState('')
  const [newTaskEditor, setNewTaskEditor] = useState(team[0]?.name ?? '')
  const [newTaskPrio,   setNewTaskPrio]   = useState<'alta'|'media'|'baja'>('media')
  const [addingTask,    setAddingTask]    = useState(false)
  const contentTareas  = tareasD.filter(t => t.contentId === initial?.id)
  const tasksDone      = contentTareas.filter(t => t.hecha).length
  const tasksTotal     = contentTareas.length
  const tasksProgress  = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0

  async function addLinkedTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskText.trim() || !initial?.id) return
    setAddingTask(true)
    await addTareaD({
      texto: newTaskText.trim(), editor: newTaskEditor,
      prioridad: newTaskPrio, hecha: false,
      tipo: 'produccion',
      fecha: new Date().toISOString().split('T')[0],
      contentId: initial.id,
      brandId: initial.brandId,
    })
    setNewTaskText('')
    setAddingTask(false)
  }
  // "Requiere entrega" siempre colapsado por defecto
  const [showDueSection, setShowDueSection] = useState(() => !!(initial?.dueAssignee))
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const teamPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTeamPicker) return
    function handle(e: MouseEvent) {
      if (teamPickerRef.current && !teamPickerRef.current.contains(e.target as Node)) {
        setShowTeamPicker(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showTeamPicker])

  const primaryChannel = form.channels[0] ?? 'instagram'
  const net = NETWORK_META[primaryChannel]
  const st  = STATUS_META[form.status] ?? STATUS_META.idea
  const pr  = PRIORITY_META[form.priority]

  const isProduction  = (PRODUCTION_STATUSES as readonly string[]).includes(form.status)
  const isAprobado    = form.status === 'aprobado'
  const isPublicado   = form.status === 'publicado'
  const isDone        = isPublicado

  const anyChannelUrlFilled = form.channels.some(ch => form.channelUrls[ch])

  // Workflow alerts
  const overdue = isAprobado && !!form.date && new Date(form.date) < new Date()
  const finSinDrive = isAprobado && !form.driveUrl
  const pubSinLink  = isPublicado && !anyChannelUrlFilled

  const set = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setM = (key: keyof MetricsForm, value: string) =>
    setForm(prev => ({ ...prev, metrics: { ...prev.metrics, [key]: value } }))

  const setChannelUrl = (ch: Network, url: string) =>
    setForm(prev => ({ ...prev, channelUrls: { ...prev.channelUrls, [ch]: url } }))

  function handleTabWheel(e: React.WheelEvent) {
    e.preventDefault()
    const idx = TABS.indexOf(tab)
    if (e.deltaY > 0 && idx < TABS.length - 1) setTab(TABS[idx + 1])
    else if (e.deltaY < 0 && idx > 0) setTab(TABS[idx - 1])
  }

  function addResponsable(name: string) {
    if (!form.responsables.includes(name))
      setForm(prev => ({ ...prev, responsables: [...prev.responsables, name] }))
    setShowTeamPicker(false)
  }
  function removeResponsable(name: string) {
    setForm(prev => ({ ...prev, responsables: prev.responsables.filter(n => n !== name) }))
  }

  function setDueAssignee(name: string) {
    setForm(prev => ({ ...prev, dueAssignee: name }))
  }

  function setDueDate(v: string) {
    setForm(prev => ({
      ...prev,
      dueDate: v,
      // clear assignee if date is removed
      dueAssignee: v ? prev.dueAssignee : '',
    }))
  }

  function toggleChannel(n: Network) {
    setForm(prev => {
      const has = prev.channels.includes(n)
      if (has && prev.channels.length === 1) return prev
      const next = has ? prev.channels.filter(c => c !== n) : [...prev.channels, n]
      return { ...prev, channels: next }
    })
  }

  // Quick status transitions
  function marcarAprobado() {
    if (!form.driveUrl) { setTab('Producción'); return }
    setForm(p => ({ ...p, status: 'aprobado' }))
  }

  function marcarPublicado() {
    if (!anyChannelUrlFilled) { setTab('Producción'); return }
    setForm(p => ({ ...p, status: 'publicado' }))
  }

  function buildPayload(): Omit<Content, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      brandId:    form.brandId,
      title:      form.title.trim(),
      channel:    form.channels[0] ?? 'instagram',
      channels:   form.channels,
      format:     form.format,
      date:       form.date    || null,
      dueDate:    form.dueDate || null,
      time:       form.time    || null,
      status:     form.status,
      priority:   form.priority,
      responsible: form.responsables[0] || '',
      tags: [],
      copy:       form.copy,
      visualDescription: form.visualDescription || undefined,
      cta:        form.cta,
      hashtags:   form.hashtags,
      designUrl:  form.designUrl,
      pag:        form.pag,
      driveUrl:   form.driveUrl,
      message:    form.message,
      dueAssignee: form.dueAssignee,
      channelUrls: Object.keys(form.channelUrls).length > 0 ? form.channelUrls : undefined,
      postUrl:    form.channelUrls[form.channels[0] ?? 'instagram'] || '',
      responsables: form.responsables,
      internalNotes: form.internalNotes || undefined,
      internalComments: form.internalComments || undefined,
      clientComments:   form.clientComments   || undefined,
      metrics:    formToMetrics(form.metrics),
      approvalStatus: ['aprobado','programado','publicado'].includes(form.status) ? 'approved' : 'pending',
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setTitleError(true); return }
    if (!form.brandId) return
    setTitleError(false)
    setSaveStatus('saving')
    try {
      const payload = buildPayload()
      if (isEdit && initial?.id) {
        updateContent(initial.id, payload)
        onSaved?.({ ...payload, id: initial.id, createdAt: initial.createdAt!, updatedAt: new Date().toISOString() })
        setSaveStatus('saved')
        setTimeout(() => onClose(), 700)
      } else {
        const saved = await addContent(payload)
        onSaved?.(saved)
        setSaveStatus('saved')
        setTimeout(() => onClose(), 700)
      }
    } catch {
      setSaveStatus('error')
    }
  }

  function handleDuplicate() {
    if (!initial?.id) return
    duplicateContent(initial.id)
    onClose()
  }

  function handleDelete() {
    if (!initial?.id) return
    deleteContent(initial.id)
    onClose()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex ${mode === 'drawer' ? 'items-start justify-end' : 'items-center justify-center p-4'}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-white flex flex-col overflow-hidden shadow-2xl ${mode === 'drawer' ? 'h-full w-full max-w-[700px] rounded-l-2xl' : 'rounded-2xl w-full max-w-[720px] max-h-[92vh]'}`}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-[#f3f4f6] shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: net.bg, color: net.dot }}>
              <NetworkIcon network={primaryChannel} size={17} />
            </div>

            <div className="flex-1 min-w-0">
              <div className={`text-[18px] font-bold leading-snug ${titleError ? 'text-red-500' : 'text-[#111827]'}`}>
                <EditableTitle
                  value={form.title}
                  onChange={v => { setForm(p => ({ ...p, title: v })); setTitleError(false) }}
                  placeholder="Escribe un título…"
                  className="text-[18px] font-bold text-[#111827] w-full"
                />
              </div>
              {titleError && <p className="text-[11px] text-red-500 mt-0.5">El título es obligatorio</p>}

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: st.bg, color: st.text }}>{st.label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                {form.dueDate && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    Entrega {form.dueDate}{form.dueAssignee ? ` · ${form.dueAssignee.split(' ')[0]}` : <AlertTriangle size={9} className="inline ml-0.5" />}
                  </span>
                )}
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isAprobado || isDone ? 'bg-green-50 text-green-700' : 'bg-[#f3f4f6] text-[#c8cdd6]'}`}>
                  <CheckCircle2 size={9} className={isAprobado || isDone ? 'text-green-500' : 'text-[#d1d5db]'} /> Aprobado
                </span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDone ? 'bg-purple-50 text-purple-700' : 'bg-[#f3f4f6] text-[#c8cdd6]'}`}>
                  <CheckCircle2 size={9} className={isDone ? 'text-purple-500' : 'text-[#d1d5db]'} /> Publicado
                </span>
              </div>

              {/* Equipo — avatares + picker */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#b0b7c3] font-semibold shrink-0">Equipo:</span>
                    <div className="flex items-center gap-1 ml-1">
                      {form.responsables.map(name => {
                        const member = team.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase())
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => removeResponsable(name)}
                            title={`${name} — clic para quitar`}
                            className="group relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-opacity hover:opacity-80"
                            style={{ background: member?.color ?? '#94a3b8' }}
                          >
                            {member?.initials ?? name.slice(0, 2).toUpperCase()}
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] hidden group-hover:flex items-center justify-center">×</span>
                          </button>
                        )
                      })}

                      {/* Botón + picker */}
                      <div ref={teamPickerRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTeamPicker(v => !v)}
                          className="w-6 h-6 rounded-full border border-dashed border-[#d1d5db] flex items-center justify-center text-[14px] text-[#9ca3af] hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors leading-none"
                        >
                          +
                        </button>
                        {showTeamPicker && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-[170px]">
                            {team
                              .filter(m => m.status === 'active' && !form.responsables.some(r => r.trim().toLowerCase() === m.name.trim().toLowerCase()))
                              .map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => addResponsable(m.name)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
                                >
                                  <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ background: m.color }}
                                  >
                                    {m.initials}
                                  </span>
                                  {m.name}
                                </button>
                              ))}
                            {team.filter(m => m.status === 'active' && !form.responsables.includes(m.name)).length === 0 && (
                              <p className="px-3 py-2 text-[11px] text-[#9ca3af]">Todos ya están en el equipo</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {isEdit && (
                <button onClick={handleDuplicate}
                  className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-xl transition-colors" title="Duplicar">
                  <Copy size={14} />
                </button>
              )}
              {isEdit && (
                <button onClick={() => setConfirmDelete(true)}
                  className="p-2 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={onClose} className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-xl transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Workflow alerts ─────────────────────────────────────── */}
        {finSinDrive && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-[12px] shrink-0">
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            Marcado como aprobado pero sin link de Drive. Agrega la pieza final en la pestaña Producción.
          </div>
        )}
        {pubSinLink && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-[12px] shrink-0">
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            Publicado sin link de publicación. Agrégalo en Producción para cruzar métricas.
          </div>
        )}
        {overdue && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-[12px] shrink-0">
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            Finalizado pero aún no publicado — la fecha de publicación ya pasó.
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex border-b border-[#f3f4f6] shrink-0 px-6" onWheel={handleTabWheel}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-[12px] font-semibold border-b-2 transition-colors -mb-px ${
                tab === t ? 'text-[#7c3aed] border-[#7c3aed]' : 'text-[#9ca3af] border-transparent hover:text-[#6b7280]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* TAB: Resumen */}
          {tab === 'Resumen' && (
            <div className="px-6 py-2">

              {/* Marca — dropdown bonito */}
              <ResumenFieldRow label="Marca">
                <BrandDropdown value={form.brandId} brands={brands} onChange={v => set('brandId', v)} />
              </ResumenFieldRow>

              <FieldRow label="Redes">
                <div className="flex flex-wrap gap-1.5 py-1">
                  {ALL_NETWORKS.map(n => {
                    const m = NETWORK_META[n]
                    const active = form.channels.includes(n)
                    return (
                      <button key={n} type="button" onClick={() => toggleChannel(n)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all select-none ${active ? 'shadow-sm' : 'opacity-40 hover:opacity-70'}`}
                        style={active ? { background: m.dot, color: '#fff' } : { background: m.bg, color: m.text }}>
                        <NetworkIcon network={n} size={11} />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </FieldRow>

              {/* Formato · Estado · Prioridad — dropdowns bonitos en una línea */}
              <div className="grid grid-cols-3 gap-3 py-2.5 border-b border-[#f5f5f5]">
                <div>
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Formato</span>
                  <FormatoDropdown value={form.format} onChange={v => set('format', v as Format)} isDark={isDark} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Estado</span>
                  <StatusDropdown value={form.status} statusMeta={STATUS_META} onChange={v => set('status', v as ContentStatus)} isDark={isDark} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Prioridad</span>
                  <PriorityDropdown value={form.priority} priorityMeta={PRIORITY_META} onChange={v => set('priority', v as Priority)} isDark={isDark} />
                </div>
              </div>

              {/* Fecha pub. + Hora — una sola línea */}
              <div className="grid grid-cols-2 gap-3 py-2.5 border-b border-[#f5f5f5]">
                <div>
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Fecha publicación</span>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-2.5 py-1.5 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Hora</span>
                  <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-2.5 py-1.5 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed]" />
                </div>
              </div>

              {/* Entrega a otra persona — siempre colapsado por defecto */}
              <div className="py-2.5 border-b border-[#f5f5f5]">
                <button
                  type="button"
                  onClick={() => {
                    if (showDueSection) {
                      // Cerrar: limpiar campos
                      setForm(p => ({ ...p, dueDate: '', dueAssignee: '' }))
                      setShowDueSection(false)
                    } else {
                      // Abrir: pre-llenar fecha si está vacía
                      if (!form.dueDate)
                        setForm(p => ({ ...p, dueDate: new Date().toISOString().slice(0, 10) }))
                      setShowDueSection(true)
                    }
                  }}
                  className={`flex items-center gap-2 text-[11px] font-semibold transition-colors ${
                    showDueSection
                      ? 'text-amber-600'
                      : 'text-[#9ca3af] hover:text-[#374151]'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    showDueSection ? 'bg-amber-500 border-amber-500' : 'border-[#d1d5db]'
                  }`}>
                    {showDueSection && <Check size={9} className="text-white" />}
                  </span>
                  Requiere entrega de otra persona (diseño, edición…)
                </button>

                {showDueSection && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">Fecha límite</span>
                      <input type="date" value={form.dueDate} onChange={e => setDueDate(e.target.value)}
                        className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-2.5 py-1.5 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">
                        Responsable{!form.dueAssignee && <AlertTriangle size={11} className="inline text-amber-400 ml-1" />}
                      </span>
                      <select value={form.dueAssignee} onChange={e => setDueAssignee(e.target.value)}
                        className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-2.5 py-1.5 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed] appearance-none cursor-pointer">
                        <option value="">Asignar persona…</option>
                        {activeTeam.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>


              {/* ── Checklist de producción ─────────────────────────────── */}
              {isEdit && (
                <div className="py-2.5 border-b border-[#f5f5f5]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">Checklist</span>
                    {tasksTotal > 0 && (
                      <span className="text-[11px] font-semibold text-[#374151]">{tasksDone}/{tasksTotal} · {tasksProgress}%</span>
                    )}
                  </div>
                  {tasksTotal > 0 && (
                    <>
                      <div className="h-1 bg-[#f3f4f6] rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${tasksProgress}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }} />
                      </div>
                      <div className="flex flex-col gap-0 mb-2">
                        {contentTareas.map(t => (
                          <div key={t.id} className="flex items-center gap-2.5 py-1.5 group">
                            <button onClick={() => toggleTareaD(t.id, !t.hecha)}
                              className="rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                              style={{ width: 16, height: 16, borderColor: t.hecha ? '#7c3aed' : '#d1d5db', background: t.hecha ? '#7c3aed' : 'transparent' }}>
                              {t.hecha && <Check size={9} className="text-white" />}
                            </button>
                            <span className={`flex-1 text-[12px] ${t.hecha ? 'line-through text-[#9ca3af]' : 'text-[#374151]'}`}>{t.texto}</span>
                            <span className="text-[10px] text-[#9ca3af] shrink-0">{t.editor}</span>
                            <button onClick={() => deleteTareaD(t.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-red-500 cursor-pointer transition-opacity">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <form onSubmit={addLinkedTask} className="flex gap-2 flex-wrap mt-1">
                    <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
                      placeholder="Nueva tarea…"
                      className="flex-1 min-w-[120px] px-3 py-1.5 text-[12px] rounded-lg border border-[#e5e7eb] focus:outline-none focus:border-[#7c3aed]" />
                    <select value={newTaskEditor} onChange={e => setNewTaskEditor(e.target.value)}
                      className="px-2.5 py-1.5 text-[12px] rounded-lg border border-[#e5e7eb] text-[#4b5563] cursor-pointer focus:outline-none focus:border-[#7c3aed]">
                      {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                    <button type="submit" disabled={addingTask || !newTaskText.trim()}
                      className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#7c3aed] text-white disabled:opacity-40 cursor-pointer hover:bg-[#5b21b6] transition-colors">
                      <Plus size={12} /> {addingTask ? '…' : 'Añadir'}
                    </button>
                  </form>
                </div>
              )}

            </div>
          )}

          {/* TAB: Producción */}
          {tab === 'Producción' && (
            <div className="px-6 py-5 flex flex-col gap-6">

              <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest">Flujo de producción</p>

              {/* Step 1 — Canva + PAG en la misma fila */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: form.designUrl ? '#7c3aed' : '#d1d5db' }}>
                    {form.designUrl ? <Check size={12} /> : 1}
                  </div>
                  <div className="w-px flex-1 bg-[#e5e7eb] mt-1" style={{ minHeight: 20 }} />
                </div>
                <div className="flex-1 pb-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Pencil size={12} className="shrink-0" style={{ color: form.designUrl ? '#7c3aed' : '#9ca3af' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: form.designUrl ? '#7c3aed' : '#9ca3af' }}>
                      Referencia (Canva)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#b0b7c3] mb-2">Link del diseño o brief en Canva</p>
                  <div className="flex gap-2">
                    {/* Canva URL */}
                    <div className="flex-1 relative">
                      <input
                        type="url"
                        value={form.designUrl}
                        onChange={e => set('designUrl', e.target.value)}
                        placeholder="https://canva.com/design/…"
                        className="w-full text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 placeholder-[#d1d5db] transition-all"
                      />
                      {form.designUrl && (
                        <a href={form.designUrl} target="_blank" rel="noopener noreferrer"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#7c3aed]">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {/* PAG */}
                    <div className="flex items-center gap-1.5 bg-[#f5f3ff] border border-[#ede9fe] rounded-xl px-3 py-2 shrink-0">
                      <span className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-wide shrink-0">PAG</span>
                      <input
                        type="text"
                        value={form.pag}
                        onChange={e => set('pag', e.target.value)}
                        placeholder="—"
                        className="w-24 bg-transparent text-[12px] font-mono text-[#6b7280] outline-none placeholder-[#c4b5fd]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <ProdLinkRow
                step={2}
                icon={FolderOpen}
                label="Pieza final (Drive)"
                sublabel="Link de la pieza terminada en Drive"
                value={form.driveUrl}
                onChange={v => set('driveUrl', v)}
                placeholder="https://drive.google.com/…"
                accent="#22c55e"
                action={isProduction ? marcarAprobado : undefined}
                actionLabel="Marcar como Aprobado"
              />

              {/* Step 3 – Links por canal */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: anyChannelUrlFilled ? '#8b5cf6' : '#d1d5db' }}>
                    {anyChannelUrlFilled ? <Check size={12} /> : 3}
                  </div>
                </div>
                <div className="flex-1 pb-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Link2 size={12} className="shrink-0" style={{ color: anyChannelUrlFilled ? '#8b5cf6' : '#9ca3af' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: anyChannelUrlFilled ? '#8b5cf6' : '#9ca3af' }}>
                      Links de publicación por canal
                    </span>
                  </div>
                  <p className="text-[11px] text-[#b0b7c3] mb-3">
                    URL de cada publicación en su red social — necesaria para cruzar métricas automáticamente
                  </p>
                  <div className="flex flex-col gap-2">
                    {form.channels.map(ch => {
                      const m = NETWORK_META[ch]
                      const val = form.channelUrls[ch] ?? ''
                      return (
                        <div key={ch} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: val ? m.dot + '22' : m.bg, color: val ? m.dot : m.text }}>
                            <NetworkIcon network={ch} size={13} />
                          </div>
                          <div className="flex-1 relative">
                            <input
                              type="url"
                              value={val}
                              onChange={e => setChannelUrl(ch, e.target.value)}
                              placeholder={`Link de ${m.label}…`}
                              className="w-full text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 placeholder-[#d1d5db] transition-all"
                            />
                            {val && (
                              <a href={val} target="_blank" rel="noopener noreferrer"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#7c3aed]">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {isAprobado && form.driveUrl && anyChannelUrlFilled && (
                    <button
                      type="button"
                      onClick={marcarPublicado}
                      className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: '#8b5cf615', color: '#8b5cf6' }}
                    >
                      Marcar como Publicado <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status summary */}
              <div className="mt-2 p-4 bg-[#f9fafb] rounded-2xl border border-[#e5e7eb]">
                <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wide mb-3">Estado actual del flujo</p>
                <div className="flex flex-col gap-2">
                  {[
                    { ok: !!form.designUrl, label: 'Referencia cargada (Canva)' },
                    { ok: !!form.driveUrl,  label: 'Pieza final entregada (Drive)' },
                    { ok: isAprobado || isDone, label: 'Marcado como Aprobado' },
                    { ok: anyChannelUrlFilled, label: `Link${form.channels.length > 1 ? 's' : ''} de publicación guardado${form.channels.length > 1 ? 's' : ''} (${form.channels.filter(ch => form.channelUrls[ch]).length}/${form.channels.length} canales)` },
                    { ok: isDone,           label: 'Publicado' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-green-100' : 'bg-[#f3f4f6]'}`}>
                        <Check size={9} className={item.ok ? 'text-green-600' : 'text-[#d1d5db]'} />
                      </div>
                      <span className={`text-[12px] ${item.ok ? 'text-[#374151] font-medium' : 'text-[#9ca3af]'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Copy */}
          {tab === 'Copy' && (
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Copy</span>
                </div>
                <FieldTextarea value={form.copy} onChange={v => set('copy', v)} rows={5} placeholder="Escribe el copy principal…" />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Mensaje</span>
                <FieldTextarea value={form.message} onChange={v => set('message', v)} rows={3} placeholder="Mensaje directo, WhatsApp, comunidad…" />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Descripción visual</span>
                <FieldTextarea value={form.visualDescription} onChange={v => set('visualDescription', v)} rows={3} placeholder="Descripción del arte o pieza visual…" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">CTA</span>
                  <FieldInput value={form.cta} onChange={v => set('cta', v)} placeholder="Ver más en bio…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Hashtags</span>
                  <FieldInput value={form.hashtags} onChange={v => set('hashtags', v)} placeholder="#marca #hashtag" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Notas internas</span>
                <FieldTextarea value={form.internalNotes} onChange={v => set('internalNotes', v)} rows={3} placeholder="Observaciones para el equipo…" />
              </div>
            </div>
          )}

          {/* TAB: Métricas */}
          {tab === 'Métricas' && (
            <div className="px-6 py-4 flex flex-col gap-5">
              {!isDone && (
                <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-4 py-3 text-[12px] text-[#9ca3af]">
                  Las métricas aplican solo a publicaciones ya publicadas. Cambia el estado a "Publicado" para habilitar.
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <MetricInput label="Alcance"       value={form.metrics.reach}        onChange={v => setM('reach', v)} />
                <MetricInput label="Impresiones"   value={form.metrics.impressions}  onChange={v => setM('impressions', v)} />
                <MetricInput label="Interacciones" value={form.metrics.interactions} onChange={v => setM('interactions', v)} />
                <MetricInput label="Likes"         value={form.metrics.likes}        onChange={v => setM('likes', v)} />
                <MetricInput label="Comentarios"   value={form.metrics.comments}     onChange={v => setM('comments', v)} />
                <MetricInput label="Compartidos"   value={form.metrics.shares}       onChange={v => setM('shares', v)} />
                <MetricInput label="Guardados"     value={form.metrics.saves}        onChange={v => setM('saves', v)} />
                <MetricInput label="Clics"         value={form.metrics.clicks}       onChange={v => setM('clicks', v)} />
                <MetricInput label="Vistas"        value={form.metrics.views}        onChange={v => setM('views', v)} />
                <MetricInput label="Engagement %"  value={form.metrics.engagementRate} onChange={v => setM('engagementRate', v)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Observaciones de desempeño</span>
                <FieldTextarea value={form.metrics.performanceNotes} onChange={v => setM('performanceNotes', v)} rows={4} placeholder="Notas sobre el rendimiento de esta publicación…" />
              </div>
            </div>
          )}

          {/* TAB: Comentarios */}
          {tab === 'Comentarios' && (
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Comentarios internos (equipo)</span>
                <FieldTextarea value={form.internalComments} onChange={v => set('internalComments', v)} rows={4} placeholder="Notas del equipo sobre esta publicación…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Comentarios del cliente</span>
                <FieldTextarea value={form.clientComments} onChange={v => set('clientComments', v)} rows={4} placeholder="Feedback del cliente…" />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-t border-[#f3f4f6] flex items-center justify-between shrink-0 bg-[#fafafa]">
          <button onClick={onClose} className="text-[13px] text-[#9ca3af] hover:text-[#6b7280] transition-colors">
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
                <Loader2 size={12} className="animate-spin" /> Guardando…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-[12px] text-green-600">
                <Check size={12} /> Guardado
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[12px] text-red-500">Error al guardar</span>
            )}

            {/* Quick action */}
            {isProduction && form.driveUrl && (
              <button
                type="button"
                onClick={marcarAprobado}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <Check size={12} /> Marcar como aprobado
              </button>
            )}
            {isAprobado && !anyChannelUrlFilled && (
              <button
                type="button"
                onClick={() => setTab('Producción')}
                className="flex items-center gap-1.5 border border-[#7c3aed] text-[#7c3aed] text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-[#f5f3ff]"
              >
                Agregar links y publicar →
              </button>
            )}
            {isAprobado && anyChannelUrlFilled && (
              <button
                type="button"
                onClick={marcarPublicado}
                className="flex items-center gap-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <Check size={12} /> Marcar como publicado
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {isEdit ? 'Guardar cambios' : 'Crear publicación'}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60">
          <div className="bg-white rounded-2xl p-6 w-[360px] shadow-2xl">
            <div className="text-[16px] font-bold text-[#111827] mb-1.5">¿Eliminar publicación?</div>
            <div className="text-[13px] text-[#9ca3af] mb-5">Esta acción no se puede deshacer.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-[#e5e7eb] text-[#6b7280] text-[13px] py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
