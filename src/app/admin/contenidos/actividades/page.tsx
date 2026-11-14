'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Plus, Trash2, Check, X, ChevronDown, Link2, Unlink,
  FolderKanban, ExternalLink, MessageSquare, Send, Calendar,
  User, Tag, AlignLeft, Paperclip, Workflow, Flag, Layers,
  PlayCircle, PauseCircle, CheckCircle2, Search, SlidersHorizontal,
  LayoutList, CalendarDays, ChevronLeft, ChevronRight,
  ImagePlus, Loader2, File as FileIcon, AlertCircle, Circle,
} from 'lucide-react'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, serverTimestamp, deleteField, arrayUnion, arrayRemove,
  query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/services/firebase/client'
import { compressImage } from '@/services/firebase/imageCompress'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { getActividadAssignees, actividadHasAssignee, ACTIV_CATEGORIES } from '@/cmhub/activities'
import { STATUS_COLORS } from '@/cmhub/projects/domain'
import { usePointsActions } from '@/cmhub/usePointsActions'
import { botMsg, classifyDelivery, pointsForDelivery } from '@/cmhub/points'
import type { TeamMember, Proyecto, HubFlujo } from '@/cmhub/types'
import { advanceFlujo, COL_FLUJOS } from '@/cmhub/flujos'
import ProyectoModal from '@/components/cmhub/ProyectoModal'
import IniciarFlujoModal from '@/components/cmhub/IniciarFlujoModal'

// ── Tipos ──────────────────────────────────────────────────────────────────
type ActivityStatus = 'pendiente' | 'en_curso' | 'completado'

interface Comentario {
  id: string
  texto: string
  autor: string
  fecha: string
}

type ActivityPriority = 'urgente' | 'alta' | 'normal'

interface Activity {
  id: string
  title: string
  description?: string
  dueDate?: string
  startDate?: string
  status: ActivityStatus
  assignee?: string
  assignees?: string[]
  assigneeIds?: string[]
  category?: string
  proyectoId?: string | null
  parentId?: string | null
  milestone?: boolean
  progress?: number
  priority?: ActivityPriority
  linkEntrega?: string
  comentarios?: Comentario[]
  createdAt?: unknown
  flujoId?: string
  pasoIndex?: number
  totalPasos?: number
  flujoNombre?: string
  adjuntos?: import('@/cmhub/types').ActividadAdjunto[]
  isGroup?: boolean
  archived?: boolean
  sortOrder?: number
}

// ── Config ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ActivityStatus, {
  label: string; color: string; bg: string; dot: string; darkBg: string; next: ActivityStatus
}> = {
  pendiente:  { ...STATUS_COLORS.pendiente,  next: 'en_curso'   },
  en_curso:   { ...STATUS_COLORS.en_curso,   next: 'completado' },
  completado: { ...STATUS_COLORS.completado, next: 'pendiente'  },
}

// Incluye 'Reunión'/'Llamada' aunque ya no se puedan asignar a actividades nuevas (ver ACTIV_CATEGORIES
// en ActividadModal.tsx) para que las actividades antiguas con esas categorías sigan siendo filtrables.
const CATEGORIES = ['Reunión', 'Llamada', 'Diseño', 'Capacitación', 'Administrativo', 'Investigación', 'Otro']
const COL = 'hubActividades'
// grid full:    circle | title | estado | categoría | responsable | fecha | delete
// grid compact: circle | title | estado | fecha | delete  (sin categoría ni responsable)
const COLS_FULL    = '20px 1fr 110px 110px 150px 90px 28px'
const COLS_COMPACT = '20px 1fr 100px 80px 28px'

// Colores por categoría — permite escanear visualmente el tipo de trabajo sin leer el texto.
const CATEGORY_COLORS: Record<string, string> = {
  Entrega: '#0d9488', Revisión: '#a78bfa', Diseño: '#ec4899', Edición: '#f97316',
  Capacitación: '#0ea5e9', Administrativo: '#64748b', Estrategia: '#6366f1',
  Investigación: '#0ea5e9', Otro: '#64748b', Reunión: '#94a3b8', Llamada: '#94a3b8',
}
function categoryColor(cat?: string): string | undefined {
  return cat ? (CATEGORY_COLORS[cat] ?? '#64748b') : undefined
}

// Paleta de respaldo para proyectos sin marca asociada — determinista por id,
// para que cada proyecto tenga siempre el mismo color entre renders.
const PROJECT_FALLBACK_COLORS = ['#7c3aed', '#0d9488', '#f97316', '#2563eb', '#db2777', '#65a30d']
function fallbackProjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PROJECT_FALLBACK_COLORS[hash % PROJECT_FALLBACK_COLORS.length]
}

// ── Prioridad ──────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<ActivityPriority, { label: string; color: string; bg: string; darkBg: string; dot: string }> = {
  urgente: { label: 'Urgente', color: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.18)', dot: '#ef4444' },
  alta:    { label: 'Alta',    color: '#ea580c', bg: '#fff7ed', darkBg: 'rgba(234,88,12,0.18)',  dot: '#f97316' },
  normal:  { label: 'Normal',  color: '#6b7280', bg: '#f9fafb', darkBg: 'rgba(107,114,128,0.1)', dot: '#9ca3af' },
}
const PRIORITIES: ActivityPriority[] = ['urgente', 'alta', 'normal']

function todayISO() { return new Date().toISOString().slice(0, 10) }
function addDaysISO(d: string, n: number) { return new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10) }
function isOverdueActivity(a: Activity) { return !!(a.dueDate && a.dueDate < todayISO() && a.status !== 'completado') }
function isDueTodayActivity(a: Activity) { return !!(a.dueDate && a.dueDate === todayISO() && a.status !== 'completado') }

// Vencidas primero, luego urgente, luego vence-hoy/alta, luego el resto, completadas al fondo.
function sortActivities(list: Activity[]) {
  const rank = (a: Activity) => {
    if (a.status === 'completado') return 5
    if (isOverdueActivity(a)) return 0
    if (a.priority === 'urgente') return 1
    if (isDueTodayActivity(a) || a.priority === 'alta') return 2
    return 3
  }
  return [...list].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

function fmt(d?: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtShort(d?: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

// ── useCompact ────────────────────────────────────────────────────────────
// Detecta viewport angosto para cambiar el layout de filas → tarjetas compactas.
// El umbral 1200px cubre laptops de 13" y cualquier pantalla con sidebar visible.
function useCompact() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 1200)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return compact
}

// ── usePortalDropdown ──────────────────────────────────────────────────────
// Las filas viven dentro de contenedores con scroll (overflow-y-auto), así que
// un dropdown `absolute` normal se recorta. Lo montamos en document.body con
// posición fija calculada desde el botón, igual que en otras partes del cmhub.
function usePortalDropdown() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = useCallback((e: React.MouseEvent, panelWidth = 180) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const left = Math.min(r.left, window.innerWidth - panelWidth - 8)
      setPos({ top: r.bottom + 4, left: Math.max(8, left) })
    }
    setOpen(o => !o)
  }, [open])

  return { open, setOpen, pos, btnRef, panelRef, toggle }
}

// ── InlineSelect ───────────────────────────────────────────────────────────
function InlineSelect<T extends string>({ value, options, onChange, renderTrigger, renderOption, tk }: {
  value: T; options: T[]; onChange: (v: T) => void
  renderTrigger: (v: T) => React.ReactNode
  renderOption:  (v: T) => React.ReactNode
  tk: Record<string, string>
}) {
  const { open, setOpen, pos, btnRef, panelRef, toggle } = usePortalDropdown()
  return (
    <div className="relative inline-block">
      <button ref={btnRef} onClick={e => toggle(e, 130)}
        className="cursor-pointer hover:opacity-75 transition-opacity">{renderTrigger(value)}</button>
      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, background: tk.card, borderColor: tk.border }}
          className="z-[300] rounded-xl border shadow-xl overflow-hidden min-w-[130px]">
          {options.map(o => (
            <button key={o} onClick={e => { e.stopPropagation(); onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] transition-colors"
              style={{ background: o === value ? tk.page : 'transparent', color: tk.text }}
              onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
              onMouseLeave={e => (e.currentTarget.style.background = o === value ? tk.page : 'transparent')}>
              {renderOption(o)}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── PersonMultiPicker ──────────────────────────────────────────────────────
function PersonMultiPicker({ value, team, onChange, tk }: {
  value: string[]
  team: { id: string; name: string; initials: string; color: string }[]
  onChange: (v: string[]) => void
  tk: Record<string, string>
}) {
  const { open, pos, btnRef, panelRef, toggle } = usePortalDropdown()
  const members = value
    .map(name => team.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase()))
    .filter(Boolean) as typeof team
  function togglePerson(name: string) {
    onChange(value.some(v => v.trim().toLowerCase() === name.trim().toLowerCase())
      ? value.filter(v => v.trim().toLowerCase() !== name.trim().toLowerCase())
      : [...value, name])
  }
  return (
    <div className="relative">
      <button ref={btnRef} onClick={e => toggle(e, 192)}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-75 transition-opacity">
        {members.length > 0 ? (
          <>
            <div className="flex -space-x-1.5 shrink-0">
              {members.slice(0, 3).map(m => (
                <div key={m.id} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 shrink-0"
                  style={{ background: m.color, borderColor: tk.card }}>{m.initials}</div>
              ))}
            </div>
            {members.length === 1
              ? <span className="text-[11px] truncate" style={{ color: tk.text, maxWidth: 90 }}>{members[0].name}</span>
              : <span className="text-[11px]" style={{ color: tk.text }}>{members.length} personas</span>}
          </>
        ) : (
          <span className="text-[11px] italic" style={{ color: tk.muted }}>Sin asignar</span>
        )}
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, background: tk.card, borderColor: tk.border }}
          className="z-[300] rounded-xl border shadow-xl overflow-hidden w-48 max-h-56 overflow-y-auto">
          {team.map(m => {
            const active = value.some(v => v.trim().toLowerCase() === m.name.trim().toLowerCase())
            return (
              <button key={m.id} onClick={e => { e.stopPropagation(); togglePerson(m.name) }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                style={{ background: active ? tk.page : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
                onMouseLeave={e => (e.currentTarget.style.background = active ? tk.page : 'transparent')}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: m.color }}>{m.initials}</div>
                <span className="text-[12px] flex-1 truncate" style={{ color: tk.text }}>{m.name}</span>
                {active && <Check size={11} className="shrink-0" style={{ color: '#7c3aed' }} />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── DateCell ───────────────────────────────────────────────────────────────
function DateCell({ value, onSave, tk, isOverdue, isDueToday }: {
  value?: string; onSave: (v: string) => void; tk: Record<string, string>; isOverdue?: boolean; isDueToday?: boolean
}) {
  const [editing, setEditing] = useState(false)
  if (editing) return (
    <input type="date" defaultValue={value ?? ''} autoFocus
      className="text-[11px] rounded-lg px-2 py-0.5 border outline-none w-full"
      style={{ background: tk.input, color: tk.text, borderColor: '#7c3aed' }}
      onChange={e => { onSave(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)} />
  )
  return (
    <button onClick={e => { e.stopPropagation(); setEditing(true) }}
      className="text-[11px] font-medium cursor-pointer hover:opacity-70 transition-opacity text-left w-full"
      style={{ color: isOverdue ? '#ef4444' : isDueToday ? '#d97706' : value ? tk.sub : tk.muted }}>
      {value
        ? isDueToday ? '● Vence hoy' : (isOverdue ? '⚠ ' : '') + fmtShort(value)
        : <span className="opacity-30">—</span>}
    </button>
  )
}

// ── Modal de detalle ───────────────────────────────────────────────────────
function ActivityModal({ a, activities, team, proyectos, isDark, tk, myName, onClose, onUpdate, onDelete }: {
  a: Activity
  activities: Activity[]
  team: { id: string; name: string; initials: string; color: string }[]
  proyectos: Proyecto[]
  isDark: boolean; tk: Record<string, string>; myName: string
  onClose: () => void
  onUpdate: (patch: Partial<Activity>) => void
  onDelete: () => void
}) {
  const s = STATUS_CFG[a.status]
  const isOverdue  = isOverdueActivity(a)
  const isDueToday = isDueTodayActivity(a)
  const fase = a.parentId ? activities.find(x => x.id === a.parentId) : null

  const [desc, setDesc]         = useState(a.description ?? '')
  const [link, setLink]         = useState(a.linkEntrega ?? '')
  const [comment, setComment]   = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(a.title)
  const proyecto = proyectos.find(p => p.id === a.proyectoId) ?? null
  const hasCtx = !!(proyecto?.descripcion || proyecto?.criterioExito || proyecto?.objetivoGeneral)
  const [ctxOpen, setCtxOpen]   = useState(hasCtx)
  const [adjuntos, setAdjuntos] = useState<import('@/cmhub/types').ActividadAdjunto[]>(a.adjuntos ?? [])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/')
        const compressed = isImage ? await compressImage(file) : file
        const ext = compressed.name.split('.').pop() ?? 'bin'
        const path = `hubActividades/${a.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const storRef = ref(storage, path)
        await uploadBytes(storRef, compressed)
        const url = await getDownloadURL(storRef)
        const adjunto: import('@/cmhub/types').ActividadAdjunto = { url, nombre: file.name, tipo: isImage ? 'imagen' : 'archivo', storagePath: path }
        await updateDoc(doc(db, 'hubActividades', a.id), { adjuntos: arrayUnion(adjunto) })
        setAdjuntos(prev => [...prev, adjunto])
      }
    } catch (e) { console.error('Error subiendo adjunto:', e) }
    finally { setUploading(false) }
  }

  async function removeAdjunto(adjunto: import('@/cmhub/types').ActividadAdjunto) {
    try { await deleteObject(ref(storage, adjunto.storagePath)) } catch {}
    await updateDoc(doc(db, 'hubActividades', a.id), { adjuntos: arrayRemove(adjunto) })
    setAdjuntos(prev => prev.filter(x => x.storagePath !== adjunto.storagePath))
  }

  function saveDesc() {
    if (desc !== (a.description ?? '')) onUpdate({ description: desc || undefined })
  }
  function saveLink() {
    if (link !== (a.linkEntrega ?? '')) onUpdate({ linkEntrega: link || undefined })
  }
  function saveTitle() {
    setEditingTitle(false)
    if (titleVal.trim() && titleVal.trim() !== a.title) onUpdate({ title: titleVal.trim() })
  }
  function addComment() {
    if (!comment.trim()) return
    const nuevo: Comentario = {
      id: Date.now().toString(), texto: comment.trim(),
      autor: myName || 'Yo', fecha: new Date().toISOString(),
    }
    onUpdate({ comentarios: [...(a.comentarios ?? []), nuevo] })
    setComment('')
  }

  const inputStyle = {
    background: tk.input, color: tk.text, borderColor: tk.inputBorder,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: tk.card, border: `1px solid ${tk.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* ── Cabecera ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 p-6 pb-4"
          style={{ borderBottom: `1px solid ${tk.border}` }}>
          {/* Círculo de estado — para flujos en_curso no avanza a completado (usa botón dedicado) */}
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
            style={{
              borderColor: s.dot,
              background: a.status === 'completado' ? s.dot : 'transparent',
              cursor: a.flujoId && a.status === 'en_curso' ? 'default' : 'pointer',
            }}
            onClick={() => {
              if (a.flujoId && a.status === 'en_curso') return
              onUpdate({ status: STATUS_CFG[a.status].next })
            }}>
            {a.status === 'completado' && <Check size={14} color="#fff" strokeWidth={3} />}
            {a.status === 'en_curso' && <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />}
          </div>
          <div className="flex-1 min-w-0">
            {a.flujoId ? (
              <h2 className="text-[17px] font-bold leading-tight" style={{ color: tk.text }}>
                {a.flujoNombre ?? a.title}
              </h2>
            ) : editingTitle ? (
              <input
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(a.title); setEditingTitle(false) } }}
                autoFocus
                className="text-[17px] font-bold leading-tight w-full rounded-lg px-2 py-0.5 outline-none border"
                style={{ background: tk.input, color: tk.text, borderColor: '#7c3aed' }}
              />
            ) : (
              <h2
                className="text-[17px] font-bold leading-tight cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: tk.text }}
                onClick={() => setEditingTitle(true)}
                title="Clic para editar título"
              >
                {a.title}
              </h2>
            )}
            {a.flujoId && a.totalPasos != null && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}>
                <Workflow size={9} />
                Paso {(a.pasoIndex ?? 0) + 1}/{a.totalPasos} · {a.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status: flujos tienen botones dedicados, el resto usa selector libre */}
            {a.flujoId ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: isDark ? s.darkBg : s.bg, color: s.color }}>{s.label}</span>
                {a.status === 'pendiente' && (
                  <button onClick={() => onUpdate({ status: 'en_curso' })}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                    style={{ background: '#3b82f6' }}>
                    Iniciar paso
                  </button>
                )}
                {a.status === 'en_curso' && (
                  <button onClick={() => onUpdate({ status: 'completado' })}
                    className="text-[11px] font-bold px-3 py-1 rounded-full text-white flex items-center gap-1"
                    style={{ background: '#7c3aed' }}>
                    <Check size={10} strokeWidth={3} />
                    Completar Paso {(a.pasoIndex ?? 0) + 1}/{a.totalPasos ?? '?'}
                  </button>
                )}
              </div>
            ) : (
              <InlineSelect value={a.status} options={['pendiente','en_curso','completado'] as ActivityStatus[]}
                onChange={v => onUpdate({ status: v })} tk={tk}
                renderTrigger={v => {
                  const cfg = STATUS_CFG[v]
                  return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: isDark ? cfg.darkBg : cfg.bg, color: cfg.color }}>{cfg.label}</span>
                }}
                renderOption={v => {
                  const cfg = STATUS_CFG[v]
                  return <span className="text-[12px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                }} />
            )}
            <button onClick={onClose}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
              style={{ color: tk.sub }}
              onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Cuerpo ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Meta grid 2×2 */}
          <div className="grid grid-cols-2 gap-px" style={{ background: tk.border }}>
            {[
              {
                Icon: User, label: 'Responsables',
                content: (
                  <PersonMultiPicker value={getActividadAssignees(a)} team={team}
                    onChange={v => onUpdate({ assignees: v, assignee: v[0] ?? undefined })} tk={tk} />
                ),
              },
              {
                Icon: Tag, label: 'Categoría',
                content: (
                  <InlineSelect value={a.category ?? ''} options={['', ...ACTIV_CATEGORIES] as string[]}
                    onChange={v => onUpdate({ category: v || undefined })} tk={tk}
                    renderTrigger={v => {
                      const c = categoryColor(v)
                      return (
                        <span className="text-[13px] flex items-center gap-1.5" style={{ color: v ? tk.text : tk.muted }}>
                          {c && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />}
                          {v || <span className="italic opacity-60">Sin categoría</span>}
                        </span>
                      )
                    }}
                    renderOption={v => {
                      const c = categoryColor(v)
                      return (
                        <span className="text-[12px] flex items-center gap-1.5" style={{ color: v ? tk.text : tk.muted }}>
                          {c && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />}
                          {v || 'Sin categoría'}
                        </span>
                      )
                    }} />
                ),
              },
              {
                Icon: Calendar, label: 'Fecha límite',
                content: (
                  <div>
                    <input type="date" defaultValue={a.dueDate ?? ''}
                      className="text-[13px] bg-transparent outline-none border-none w-full"
                      style={{ color: isOverdue ? '#ef4444' : isDueToday ? '#d97706' : tk.text }}
                      onChange={e => onUpdate({ dueDate: e.target.value || undefined })} />
                    {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Vencida</p>}
                    {isDueToday && <p className="text-[10px] mt-0.5" style={{ color: '#d97706' }}>Vence hoy</p>}
                  </div>
                ),
              },
              {
                Icon: FolderKanban, label: 'Proyecto',
                content: (
                  <InlineSelect
                    value={a.proyectoId ?? ''}
                    options={['', ...proyectos.filter(p => !p.archived).map(p => p.id)]}
                    onChange={v => onUpdate({ proyectoId: v || null })}
                    tk={tk}
                    renderTrigger={v => {
                      const p = proyectos.find(x => x.id === v)
                      return (
                        <span className="text-[13px] flex items-center gap-1.5" style={{ color: v ? tk.text : tk.muted }}>
                          {p
                            ? <><span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#7c3aed' }} />{p.nombre}</>
                            : <span className="italic opacity-60">Sin proyecto</span>}
                        </span>
                      )
                    }}
                    renderOption={v => {
                      const p = proyectos.find(x => x.id === v)
                      return (
                        <span className="text-[12px]" style={{ color: v ? tk.text : tk.muted }}>
                          {p ? p.nombre : 'Sin proyecto (independiente)'}
                        </span>
                      )
                    }}
                  />
                ),
              },
              ...(a.proyectoId ? [{
                Icon: PlayCircle, label: 'Avance',
                content: (
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} step={5}
                      defaultValue={a.progress ?? 0}
                      className="flex-1 h-1.5 accent-[#7c3aed]"
                      onChange={e => onUpdate({ progress: Number(e.target.value) })} />
                    <span className="text-[12px] font-bold tabular-nums w-8 text-right"
                      style={{ color: '#7c3aed' }}>{a.progress ?? 0}%</span>
                  </div>
                ),
              }] : []),
              ...(fase ? [{
                Icon: Workflow, label: 'Fase',
                content: (
                  <span className="text-[13px] flex items-center gap-1.5" style={{ color: tk.text }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#818cf8' }} />{fase.title}
                  </span>
                ),
              }] : []),
              {
                Icon: AlertCircle, label: 'Prioridad',
                content: (
                  <InlineSelect
                    value={a.priority ?? 'normal'}
                    options={['urgente', 'alta', 'normal'] as const}
                    onChange={v => onUpdate({ priority: v as 'urgente' | 'alta' | 'normal' })}
                    tk={tk}
                    renderTrigger={v => {
                      const cfg = PRIORITY_CFG[v as ActivityPriority] ?? PRIORITY_CFG.normal
                      return (
                        <span className="text-[13px] flex items-center gap-1.5" style={{ color: cfg.color }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      )
                    }}
                    renderOption={v => {
                      const cfg = PRIORITY_CFG[v as ActivityPriority] ?? PRIORITY_CFG.normal
                      return (
                        <span className="text-[12px] flex items-center gap-1.5" style={{ color: cfg.color }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      )
                    }}
                  />
                ),
              },
              {
                Icon: CalendarDays, label: 'Fecha de inicio',
                content: (
                  <input type="date" defaultValue={a.startDate ?? ''}
                    className="text-[13px] bg-transparent outline-none border-none w-full"
                    style={{ color: tk.text }}
                    onChange={e => onUpdate({ startDate: e.target.value || undefined })} />
                ),
              },
            ].map(({ Icon, label, content }) => (
              <div key={label} className="p-4" style={{ background: tk.card }}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1"
                  style={{ color: tk.muted }}>
                  <Icon size={9} /> {label}
                </p>
                {content}
              </div>
            ))}
          </div>

          {/* ── Contexto del proyecto ───────────────────────────── */}
          {proyecto && (
            <div className="mx-6 mt-4 rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : '#e9d5ff'}`, background: isDark ? 'rgba(124,58,237,0.07)' : '#faf5ff' }}>
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-opacity hover:opacity-80"
                onClick={() => setCtxOpen(o => !o)}
              >
                <FolderKanban size={12} style={{ color: '#7c3aed', flexShrink: 0 }} />
                <span className="flex-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#7c3aed' }}>
                  Contexto · {proyecto.nombre}
                </span>
                <ChevronDown size={13} style={{ color: '#7c3aed', transform: ctxOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {ctxOpen && (
                <div className="px-4 pb-4 flex flex-col gap-3"
                  style={{ borderTop: `1px solid ${isDark ? 'rgba(124,58,237,0.15)' : '#e9d5ff'}` }}>
                  {proyecto.criterioExito && (
                    <div className="pt-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9333ea' }}>Criterio de éxito</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: isDark ? '#d4b8fa' : '#4c1d95' }}>{proyecto.criterioExito}</p>
                    </div>
                  )}
                  {proyecto.descripcion && (
                    <div className={proyecto.criterioExito ? '' : 'pt-3'}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9333ea' }}>Resultado esperado</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: isDark ? '#d4b8fa' : '#4c1d95' }}>{proyecto.descripcion}</p>
                    </div>
                  )}
                  {proyecto.objetivoGeneral && !proyecto.descripcion && (
                    <div className="pt-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9333ea' }}>Objetivo general</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: isDark ? '#d4b8fa' : '#4c1d95' }}>{proyecto.objetivoGeneral}</p>
                    </div>
                  )}
                  {!hasCtx && (
                    <p className="pt-3 text-[12px] italic" style={{ color: isDark ? 'rgba(212,184,250,0.5)' : '#a78bfa' }}>
                      Sin brief definido para este proyecto.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="p-6 flex flex-col gap-5">
            {/* Descripción */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                style={{ color: tk.sub }}>
                <AlignLeft size={11} /> Descripción
              </p>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onBlur={saveDesc}
                placeholder="Agrega una descripción detallada de la actividad…"
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none border resize-none transition-colors"
                style={{ ...inputStyle, lineHeight: 1.6 }}
              />
            </div>

            {/* Link de entrega */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                style={{ color: tk.sub }}>
                <Paperclip size={11} /> Link de entrega
              </p>
              <div className="flex gap-2">
                <input
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  onBlur={saveLink}
                  placeholder="https://…"
                  className="flex-1 rounded-xl px-3 py-2 text-[13px] outline-none border transition-colors"
                  style={inputStyle}
                />
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe', color: '#7c3aed' }}>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>

            {/* Adjuntos */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                style={{ color: tk.sub }}>
                <Paperclip size={11} /> Archivos adjuntos
                {adjuntos.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tk.sub }}>
                    {adjuntos.length}
                  </span>
                )}
              </p>
              {adjuntos.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {adjuntos.map(adj => (
                    <div key={adj.storagePath} className="flex items-center gap-2 p-2 rounded-xl border group"
                      style={{ background: tk.input, borderColor: tk.border }}>
                      {adj.tipo === 'imagen'
                        ? <img src={adj.url} alt={adj.nombre} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                            <FileIcon size={14} style={{ color: tk.sub }} />
                          </div>}
                      <a href={adj.url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-[12px] truncate hover:underline" style={{ color: tk.text }}>
                        {adj.nombre}
                      </a>
                      <button onClick={() => removeAdjunto(adj)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={e => handleUpload(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border w-full justify-center transition-colors"
                style={{ borderColor: tk.border, color: uploading ? tk.muted : tk.sub, borderStyle: 'dashed' }}>
                {uploading
                  ? <><Loader2 size={13} className="animate-spin" />Subiendo…</>
                  : <><ImagePlus size={13} />Adjuntar archivo o imagen</>}
              </button>
            </div>

            {/* Comentarios */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"
                style={{ color: tk.sub }}>
                <MessageSquare size={11} /> Comentarios
                {(a.comentarios?.length ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tk.sub }}>
                    {a.comentarios!.length}
                  </span>
                )}
              </p>

              {/* Lista */}
              {(a.comentarios?.length ?? 0) === 0 ? (
                <p className="text-[12px] italic mb-3" style={{ color: tk.muted }}>Sin comentarios aún.</p>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {a.comentarios!.map(c => {
                    const m = team.find(t => t.name === c.autor)
                    return (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: m?.color ?? '#7c3aed' }}>
                          {m?.initials ?? c.autor.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[12px] font-semibold" style={{ color: tk.text }}>{c.autor}</span>
                            <span className="text-[10px]" style={{ color: tk.muted }}>{timeAgo(c.fecha)}</span>
                          </div>
                          <p className="text-[13px] rounded-xl px-3 py-2"
                            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: tk.text }}>
                            {c.texto}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Input nuevo comentario */}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: team.find(m => m.name === myName)?.color ?? '#7c3aed' }}>
                  {team.find(m => m.name === myName)?.initials ?? (myName.slice(0, 2).toUpperCase() || 'Yo')}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                    placeholder="Escribe un comentario…"
                    className="flex-1 rounded-xl px-3 py-2 text-[13px] outline-none border transition-colors"
                    style={inputStyle}
                  />
                  <button onClick={addComment} disabled={!comment.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
                    style={{ background: '#7c3aed', color: '#fff' }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: `1px solid ${tk.border}` }}>
          <button onClick={() => { if (confirm('¿Eliminar actividad?')) { onDelete(); onClose() } }}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Trash2 size={13} /> Eliminar actividad
          </button>
          <div className="text-[11px]" style={{ color: tk.muted }}>
            {a.dueDate ? `Entrega: ${fmt(a.dueDate)}` : 'Sin fecha de entrega'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Fila de actividad ──────────────────────────────────────────────────────
function ActivityRow({ a, tk, isDark, team, proyectos, onToggle, onDelete, onUpdate, onOpen, onClaim, compact }: {
  a: Activity; tk: Record<string, string>; isDark: boolean
  team: { id: string; name: string; initials: string; color: string }[]
  proyectos: import('@/cmhub/types').Proyecto[]
  onToggle: () => void; onDelete: () => void
  onUpdate: (patch: Partial<Activity>) => void; onOpen: () => void
  onClaim?: () => void
  compact?: boolean
}) {
  const s = STATUS_CFG[a.status]
  const isOverdue  = isOverdueActivity(a)
  const isDueToday = isDueTodayActivity(a)
  const done = a.status === 'completado'
  const priorityCfg = a.priority && a.priority !== 'normal' ? PRIORITY_CFG[a.priority] : null
  const accent = done ? tk.border : isOverdue ? '#ef4444' : a.priority === 'urgente' ? '#dc2626' : isDueToday ? '#d97706' : a.priority === 'alta' ? '#f97316' : s.dot
  const assignees = getActividadAssignees(a)

  const circleBtn = (
    <button onClick={e => { e.stopPropagation(); onToggle() }}
      title={`→ ${STATUS_CFG[s.next].label}`}
      className="rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
      style={{ width: 20, height: 20, borderColor: s.dot, background: done ? s.dot : 'transparent' }}>
      {done ? <Check size={10} color="#fff" strokeWidth={3} />
        : a.status === 'en_curso' ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
        : null}
    </button>
  )

  const statusBadge = (size: 'sm' | 'xs' = 'sm') => (
    <span className={`font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}
      style={{ background: isDark ? s.darkBg : s.bg, color: s.color }}>{s.label}</span>
  )

  const deleteBtn = (
    <button onClick={e => { e.stopPropagation(); onDelete() }}
      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0"
      style={{ color: '#ef4444' }}>
      <Trash2 size={11} />
    </button>
  )

  const rowBg = done ? (isDark ? 'rgba(255,255,255,0.015)' : '#fafafa')
    : isOverdue ? (isDark ? 'rgba(239,68,68,0.05)' : '#fffbfb') : tk.card

  // ── Layout compacto: tarjeta de 2 líneas, sin columnas fijas ──────────────
  if (compact) {
    return (
      <div className="group transition-colors rounded-xl border"
        style={{
          padding: '10px 12px',
          background: rowBg,
          borderColor: tk.border,
          borderLeft: `3px solid ${accent}`,
          opacity: done ? 0.65 : 1,
        }}>
        {/* Línea 1: toggle + título + estado + delete */}
        <div className="flex items-center gap-2">
          {circleBtn}
          <button onClick={onOpen}
            className="flex-1 flex flex-col items-start gap-0.5 text-left min-w-0 hover:underline"
            style={{ color: tk.text }}>
            <span className="text-[13px] font-medium truncate w-full"
              style={{ textDecoration: done ? 'line-through' : 'none' }}>
              {a.flujoId && a.flujoNombre ? a.flujoNombre : a.title}
            </span>
            {a.flujoId && a.totalPasos != null && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}>
                <Workflow size={8} />
                Paso {(a.pasoIndex ?? 0) + 1}/{a.totalPasos} · {a.title}
              </span>
            )}
          </button>
          <InlineSelect value={a.status} options={['pendiente','en_curso','completado'] as ActivityStatus[]}
            onChange={v => onUpdate({ status: v })} tk={tk}
            renderTrigger={() => statusBadge('xs')}
            renderOption={v => {
              const cfg = STATUS_CFG[v]
              return <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
            }} />
          {deleteBtn}
        </div>
        {/* Línea 2: metadata secundaria */}
        {(a.category || a.dueDate || assignees.length > 0) && (
          <div className="flex items-center gap-2 mt-1 ml-7 flex-wrap">
            {a.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${categoryColor(a.category)}1c`, color: categoryColor(a.category) ?? tk.sub }}>
                {a.category}
              </span>
            )}
            {assignees.length > 0 ? (
              <span className="text-[10px]" style={{ color: tk.sub }}>
                {assignees[0]}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
              </span>
            ) : !done && (
              <button
                onClick={e => { e.stopPropagation(); onClaim?.() }}
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-pointer transition-colors"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}
                title="Reclamar esta actividad"
              >
                + Me pongo en esto
              </button>
            )}
            {a.dueDate && (
              <span className="text-[10px] font-medium"
                style={{ color: isOverdue ? '#ef4444' : isDueToday ? '#d97706' : tk.sub }}>
                {isDueToday ? '● Vence hoy' : (isOverdue ? '⚠ ' : '') + fmtShort(a.dueDate)}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Layout escritorio: grid de 7 columnas ─────────────────────────────────
  return (
    <div className="group transition-colors rounded-xl border"
      style={{
        display: 'grid', gridTemplateColumns: COLS_FULL, alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: rowBg,
        borderColor: tk.border,
        borderLeft: `3px solid ${accent}`,
        opacity: done ? 0.65 : 1,
      }}>

      {circleBtn}

      {/* Título → abre modal */}
      <button onClick={onOpen}
        className="flex flex-col items-start justify-center gap-0.5 text-left min-w-0 hover:underline truncate"
        style={{ color: tk.text, textDecoration: done ? 'line-through' : 'none' }}>
        <span className="text-[13px] font-medium truncate w-full flex items-center gap-1">
          {a.milestone && <Flag size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />}
          {priorityCfg && !done && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: isDark ? priorityCfg.darkBg : priorityCfg.bg, color: priorityCfg.color }}>
              {priorityCfg.label}
            </span>
          )}
          {a.flujoId && a.flujoNombre ? a.flujoNombre : a.title}
        </span>
        <span className="flex items-center gap-1 flex-wrap">
          {a.proyectoId && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              <Layers size={8} />{proyectos.find(p => p.id === a.proyectoId)?.nombre ?? 'Proyecto'}
            </span>
          )}
          {a.flujoId && a.totalPasos != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"
              style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}>
              <Workflow size={8} />
              Paso {(a.pasoIndex ?? 0) + 1}/{a.totalPasos} · {a.title}
            </span>
          )}
        </span>
      </button>

      {/* ESTADO */}
      <div>
        <InlineSelect value={a.status} options={['pendiente','en_curso','completado'] as ActivityStatus[]}
          onChange={v => onUpdate({ status: v })} tk={tk}
          renderTrigger={() => statusBadge()}
          renderOption={v => {
            const cfg = STATUS_CFG[v]
            return <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          }} />
      </div>

      {/* CATEGORÍA */}
      <div>
        <InlineSelect value={a.category ?? ''} options={['', ...ACTIV_CATEGORIES] as string[]}
          onChange={v => onUpdate({ category: v || undefined })} tk={tk}
          renderTrigger={v => {
            const c = categoryColor(v)
            return (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1"
                style={{ background: c ? `${c}1c` : (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), color: c ?? (v ? tk.sub : tk.muted) }}>
                {v || <span className="italic opacity-50 font-normal">—</span>}
              </span>
            )
          }}
          renderOption={v => {
            const c = categoryColor(v)
            return (
              <span className="text-[11px] flex items-center gap-1.5" style={{ color: v ? tk.text : tk.muted }}>
                {c && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />}
                {v || 'Sin categoría'}
              </span>
            )
          }} />
      </div>

      {/* RESPONSABLES */}
      <PersonMultiPicker value={assignees} team={team}
        onChange={v => onUpdate({ assignees: v, assignee: v[0] ?? undefined })} tk={tk} />

      {/* FECHA */}
      <DateCell value={a.dueDate} isOverdue={isOverdue} isDueToday={isDueToday} tk={tk}
        onSave={v => onUpdate({ dueDate: v || undefined })} />

      {deleteBtn}
    </div>
  )
}

// ── AssigneeFilterPicker ──────────────────────────────────────────────────
function AssigneeFilterPicker({ value, team, tk, isDark, onChange }: {
  value: string
  team: { id: string; name: string; initials: string; color: string }[]
  tk: Record<string, string>
  isDark: boolean
  onChange: (v: string) => void
}) {
  const { open, setOpen, pos, btnRef, panelRef, toggle } = usePortalDropdown()
  const selMember = team.find(m => m.name === value)
  const active = value !== 'all'

  return (
    <>
      <button ref={btnRef} onClick={e => toggle(e, 210)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all shrink-0"
        style={{
          background: active ? (isDark ? 'rgba(124,58,237,0.18)' : '#f5f3ff') : tk.card,
          color: active ? '#7c3aed' : tk.sub,
          borderColor: active ? '#c4b5fd' : tk.border,
          boxShadow: active ? '0 0 0 2px rgba(124,58,237,0.12)' : 'none',
        }}>
        {selMember
          ? <>
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{ background: selMember.color }}>{selMember.initials}</div>
              <span className="max-w-[80px] truncate">{selMember.name.split(' ')[0]}</span>
            </>
          : <><User size={11} /><span>Responsable</span></>}
        <ChevronDown size={9} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {open && createPortal(
        <div ref={panelRef}
          className="fixed z-[300] rounded-xl border shadow-xl overflow-hidden py-1"
          style={{ top: pos.top, left: pos.left, minWidth: 210, background: tk.card, borderColor: tk.border }}>

          {/* Opción: Todos */}
          <button onClick={() => { onChange('all'); setOpen(false) }}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors"
            style={{ background: value === 'all' ? (isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb') : 'transparent', color: tk.text }}
            onMouseEnter={e => { if (value !== 'all') e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}
            onMouseLeave={e => { if (value !== 'all') e.currentTarget.style.background = 'transparent' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
              <User size={11} style={{ color: tk.sub }} />
            </div>
            <span className="flex-1 font-medium">Todos</span>
            {value === 'all' && <Check size={11} style={{ color: '#7c3aed' }} />}
          </button>

          <div className="mx-3 my-1 h-px" style={{ background: tk.border }} />

          {team.map(m => {
            const isSel = value === m.name
            return (
              <button key={m.id} onClick={() => { onChange(m.name); setOpen(false) }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors"
                style={{ background: isSel ? 'rgba(124,58,237,0.08)' : 'transparent', color: isSel ? '#7c3aed' : tk.text }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: m.color }}>{m.initials}</div>
                <span className="flex-1 truncate font-medium">{m.name}</span>
                {isSel && <Check size={11} style={{ color: '#7c3aed' }} />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Cabecera de columnas ───────────────────────────────────────────────────
function ColHeader({ tk, compact }: { tk: Record<string, string>; compact?: boolean }) {
  const cols    = compact ? COLS_COMPACT : COLS_FULL
  const headers = compact
    ? ['ACTIVIDAD', 'ESTADO', 'FECHA', '']
    : ['ACTIVIDAD', 'ESTADO', 'CATEGORÍA', 'RESPONSABLE', 'FECHA', '']
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols,
      gap: 8, padding: '6px 14px',
      background: 'transparent',
    }}>
      <span />
      {headers.map(h => (
        <span key={h} className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: tk.muted }}>{h}</span>
      ))}
    </div>
  )
}

// ── Cuerpo de un grupo (proyecto o independientes) ─────────────────────────
// Pendientes/en curso: siempre visibles.
// Completadas: visibles por defecto cuando no hay pendientes (grupo 100%);
//              colapsadas cuando hay trabajo pendiente (para no distraer).
function GroupActivities({ activities, tk, isDark, team, proyectos, onToggle, onDelete, onUpdate, onOpen, onClaim, compact }: {
  activities: Activity[]
  tk: Record<string, string>; isDark: boolean
  team: { id: string; name: string; initials: string; color: string }[]
  proyectos: import('@/cmhub/types').Proyecto[]
  onToggle: (a: Activity) => void
  onDelete: (a: Activity) => void
  onUpdate: (a: Activity, patch: Partial<Activity>) => void
  onOpen: (a: Activity) => void
  onClaim?: (a: Activity) => void
  compact?: boolean
}) {
  const pending = activities.filter(a => a.status !== 'completado')
  const done    = activities.filter(a => a.status === 'completado')
  // Auto-expandir completadas cuando no hay pendientes (grupo 100%)
  const [showDone, setShowDone] = useState(() => pending.length === 0 && done.length > 0)

  return (
    <>
      {pending.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {pending.map(a => (
            <ActivityRow key={a.id} a={a} tk={tk} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
              onToggle={() => onToggle(a)} onDelete={() => onDelete(a)}
              onUpdate={patch => onUpdate(a, patch)} onOpen={() => onOpen(a)}
              onClaim={() => onClaim?.(a)} />
          ))}
        </div>
      ) : done.length > 0 && !showDone ? (
        <div className="flex items-center justify-center gap-1.5 py-3 text-[12px] font-medium"
          style={{ color: '#16a34a' }}>
          <Check size={13} /> Todo completado
        </div>
      ) : null}

      {done.length > 0 && (
        <div className="mt-1 px-1">
          <button onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
            style={{ color: tk.sub }}>
            <ChevronDown size={11} style={{ transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            {showDone ? 'Ocultar' : 'Ver'} completadas ({done.length})
          </button>
          {showDone && (
            <div className="flex flex-col gap-1.5">
              {done.map(a => (
                <ActivityRow key={a.id} a={a} tk={tk} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
                  onToggle={() => onToggle(a)} onDelete={() => onDelete(a)}
                  onUpdate={patch => onUpdate(a, patch)} onOpen={() => onOpen(a)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Vista Calendario ───────────────────────────────────────────────────────
const CAL_DAYS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const CAL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon-first
  const prevMonthDays = new Date(year, month, 0).getDate()
  const cells: { day: number; thisMonth: boolean; dateISO: string }[] = []
  for (let i = 0; i < startOffset; i++) {
    const d = prevMonthDays - startOffset + 1 + i
    const pm = month === 0 ? 11 : month - 1, py = month === 0 ? year - 1 : year
    cells.push({ day: d, thisMonth: false, dateISO: `${py}-${String(pm + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, thisMonth: true, dateISO: `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }
  const remaining = (7 - (cells.length % 7)) % 7
  const nm = month === 11 ? 0 : month + 1, ny = month === 11 ? year + 1 : year
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, thisMonth: false, dateISO: `${ny}-${String(nm + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}` })
  }
  return cells
}

function ActivityCalendarView({ activities, year, month, onYearMonth, tk, isDark, onOpen }: {
  activities: Activity[]; year: number; month: number
  onYearMonth: (y: number, m: number) => void
  tk: Record<string, string>; isDark: boolean
  onOpen: (a: Activity) => void
}) {
  const cells = buildCalendarCells(year, month)
  const today = new Date().toISOString().slice(0, 10)

  const byDate = new Map<string, Activity[]>()
  for (const a of activities) {
    if (!a.dueDate) continue
    if (!byDate.has(a.dueDate)) byDate.set(a.dueDate, [])
    byDate.get(a.dueDate)!.push(a)
  }

  function navMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    onYearMonth(d.getFullYear(), d.getMonth())
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Navegación */}
      <div className="flex items-center gap-3">
        <button onClick={() => navMonth(-1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: tk.sub }}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-[15px] font-bold flex-1 text-center" style={{ color: tk.text }}>
          {CAL_MONTHS[month]} {year}
        </span>
        <button onClick={() => navMonth(1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: tk.sub }}>
          <ChevronRight size={14} />
        </button>
        <button onClick={() => { const n = new Date(); onYearMonth(n.getFullYear(), n.getMonth()) }}
          className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors"
          style={{ background: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff', color: '#7c3aed' }}>
          Hoy
        </button>
      </div>

      {/* Cabecera días */}
      <div className="grid grid-cols-7 gap-1">
        {CAL_DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider py-1"
            style={{ color: tk.sub }}>{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(cell => {
          const acts = byDate.get(cell.dateISO) ?? []
          const isToday = cell.dateISO === today
          const overdue = acts.some(a => a.status !== 'completado' && cell.dateISO < today)
          return (
            <div key={cell.dateISO}
              className="rounded-xl border overflow-hidden"
              style={{
                minHeight: 88,
                background: isToday
                  ? (isDark ? 'rgba(124,58,237,0.12)' : '#faf5ff')
                  : cell.thisMonth ? tk.card : 'transparent',
                borderColor: isToday ? '#7c3aed' : (overdue && cell.thisMonth ? 'rgba(239,68,68,0.35)' : tk.border),
                opacity: cell.thisMonth ? 1 : 0.35,
              }}>
              <div className="px-1.5 pt-1.5 pb-0.5 flex items-center justify-between">
                <span className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${isToday ? 'text-white' : ''}`}
                  style={{ background: isToday ? '#7c3aed' : 'transparent', color: isToday ? '#fff' : (cell.thisMonth ? tk.text : tk.muted) }}>
                  {cell.day}
                </span>
                {acts.length > 0 && !isToday && (
                  <span className="text-[9px] font-bold px-1 rounded-full"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tk.sub }}>
                    {acts.length}
                  </span>
                )}
              </div>
              <div className="px-1 pb-1 flex flex-col gap-0.5">
                {acts.slice(0, 3).map(a => {
                  const s = STATUS_CFG[a.status]
                  return (
                    <button key={a.id} onClick={() => onOpen(a)}
                      className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate block leading-tight"
                      style={{ background: isDark ? s.darkBg : s.bg, color: s.color }}
                      title={a.flujoId && a.flujoNombre ? a.flujoNombre : a.title}>
                      {a.flujoId && a.flujoNombre ? a.flujoNombre : a.title}
                    </button>
                  )
                })}
                {acts.length > 3 && (
                  <span className="text-[9px] font-medium px-1.5" style={{ color: tk.sub }}>
                    +{acts.length - 3} más
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 pt-2 flex-wrap">
        {(Object.keys(STATUS_CFG) as ActivityStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? STATUS_CFG[s].darkBg : STATUS_CFG[s].bg, border: `1px solid ${STATUS_CFG[s].dot}60` }} />
            <span className="text-[11px] font-medium" style={{ color: tk.sub }}>{STATUS_CFG[s].label}</span>
          </div>
        ))}
        <span className="text-[11px] ml-auto" style={{ color: tk.muted }}>
          {activities.filter(a => a.dueDate).length} con fecha asignada
        </span>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────
// ── FlujoCardItem ─────────────────────────────────────────────────────────────
const PLANTILLA_LABELS: Record<string, string> = {
  contenido_completo: 'Flujo Contenido',
  revision_interna:   'Revisión Interna',
  custom:             'Personalizado',
}

function FlujoCardItem({ flujo, tk, isDark }: { flujo: HubFlujo; tk: Record<string, string>; isDark: boolean }) {
  const pct = flujo.pasos.length > 0
    ? Math.round((flujo.pasoActual / flujo.pasos.length) * 100)
    : 0
  const isComplete  = flujo.estado === 'completado'
  const currentPaso = flujo.pasos[flujo.pasoActual] ?? null
  const assignees   = currentPaso?.assigneeNames ?? []
  const dueDate     = currentPaso?.dueDate ?? null
  const accent      = isComplete ? '#10b981' : '#7c3aed'
  const badgeBg     = isComplete ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe')
  const badgeColor  = isComplete ? '#059669' : '#7c3aed'

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md"
      style={{ background: tk.card, borderColor: tk.border, borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold truncate" style={{ color: tk.text }}>{flujo.nombre}</h3>
          {flujo.descripcion && <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: tk.sub }}>{flujo.descripcion}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {flujo.plantillaId && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: tk.sub }}>
              {PLANTILLA_LABELS[flujo.plantillaId] ?? flujo.plantillaId}
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>
            {isComplete ? 'Completado' : 'Activo'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold" style={{ color: tk.sub }}>
            {isComplete ? 'Completado' : `Paso ${flujo.pasoActual + 1} de ${flujo.pasos.length}`}
          </span>
          <span className="text-[11px] font-bold" style={{ color: accent }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: accent }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {flujo.pasos.map((paso, i) => {
          const done    = i < flujo.pasoActual || isComplete
          const current = i === flujo.pasoActual && !isComplete
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className="shrink-0" style={{ color: done ? '#10b981' : current ? '#7c3aed' : tk.muted }}>
                {done
                  ? <Check size={13} strokeWidth={3} />
                  : current
                    ? <Circle size={12} strokeWidth={2.5} style={{ fill: '#7c3aed', color: '#7c3aed' }} />
                    : <Circle size={12} strokeWidth={1.5} />}
              </span>
              <span className="text-[12px] truncate"
                style={{ color: done ? tk.sub : current ? tk.text : tk.sub, fontWeight: current ? 600 : 400, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                {paso.titulo}
                {paso.category && <span className="ml-1.5 text-[10px]" style={{ color: tk.muted }}>· {paso.category}</span>}
              </span>
            </div>
          )
        })}
      </div>
      {!isComplete && (assignees.length > 0 || dueDate) && (
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: tk.border }}>
          {assignees.length > 0 && (
            <div className="flex items-center gap-1">
              {assignees.slice(0, 3).map((name, i) => (
                <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: ['#7c3aed','#2563eb','#d97706','#059669'][i % 4] }} title={name}>
                  {name.split(' ').map((w: string) => w[0] ?? '').join('').toUpperCase().slice(0, 2)}
                </div>
              ))}
              {assignees.length > 3 && <span className="text-[10px]" style={{ color: tk.sub }}>+{assignees.length - 3}</span>}
            </div>
          )}
          {dueDate && (
            <span className="ml-auto text-[10px] font-semibold" style={{ color: tk.sub }}>
              {new Date(dueDate + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ActividadesPage() {
  const { isDark } = useHubTheme()
  const { team, proyectos, archivedProyectos, brands, actividades, loadingActividades, updateProyecto, addProyecto } = useHub()
  const compact = useCompact()
  const auth    = useOptionalAuth()
  const myName  = (auth?.profile as { displayName?: string } | null)?.displayName ?? ''
  const myUid   = auth?.authUser?.uid ?? null
  const { awardAndPost, postBotSala } = usePointsActions()
  const searchParams = useSearchParams()

  const archivedProjectIds = useMemo(() => new Set(archivedProyectos.map(p => p.id)), [archivedProyectos])
  const activities = actividades.filter(a => !a.proyectoId || !archivedProjectIds.has(a.proyectoId)) as unknown as Activity[]
  const loading    = loadingActividades
  const [selected, setSelected]     = useState<Activity | null>(null)
  const openedFromLinkRef = useRef(false)

  const [filterStatus,   setFilterStatus]   = useState<ActivityStatus | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterProject,  setFilterProject]  = useState('all')
  const [filterOverdue,  setFilterOverdue]  = useState(false)
  const [filterHorizon,  setFilterHorizon]  = useState<'today' | 'week' | '14d' | 'all'>('week')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  const [focusedPhase, setFocusedPhase] = useState<{ phase: Activity; acts: Activity[]; color: string; proyecto: Proyecto } | null>(null)
  const [confirmConvertPhase, setConfirmConvertPhase] = useState(false)
  const [convertingPhase, setConvertingPhase] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [collapsedIndep, setCollapsedIndep] = useState(false)
  const [showCompletedProjects, setShowCompletedProjects] = useState(false)
  const [listTab, setListTab] = useState<'activos' | 'completados'>('activos')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [mainSection, setMainSection] = useState<'actividades' | 'flujos'>('actividades')
  const [hubFlujos, setHubFlujos] = useState<HubFlujo[]>([])
  const [flujoLoading, setFlujoLoading] = useState(false)
  const [flujoLoadError, setFlujoLoadError] = useState(false)
  const [flujoTab, setFlujoTab] = useState<'activo' | 'completado'>('activo')
  const [showFlujoModal, setShowFlujoModal] = useState(false)
  const activeTeam = team.filter(m => m.status === 'active').map(m => ({ id: m.id, name: m.name, color: m.color }))
  const now = new Date()
  const [calYear, setCalYear]   = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [projectDropdownPos, setProjectDropdownPos] = useState({ top: 0, left: 0 })
  const projectDropdownBtnRef = useRef<HTMLButtonElement>(null)
  const [stepToast, setStepToast] = useState<{ paso: number; total: number; isLast: boolean } | null>(null)
  const [pointsToast, setPointsToast] = useState<{ pts: number; titulo: string } | null>(null)
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; proyecto: Proyecto } | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  const hasSetDefaultFilter = useRef(false)
  useEffect(() => {
    if (!hasSetDefaultFilter.current && myName) {
      setFilterAssignee(myName)
      hasSetDefaultFilter.current = true
    }
  }, [myName])

  useEffect(() => {
    setFlujoLoading(true)
    const q = query(collection(db, COL_FLUJOS), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      snap => { setHubFlujos(snap.docs.map(d => ({ id: d.id, ...d.data() } as HubFlujo))); setFlujoLoading(false) },
      () => { setFlujoLoadError(true); setFlujoLoading(false) }
    )
  }, [])

  function handleToggleObjetivo(proyectoId: string, index: number) {
    const p = proyectos.find(x => x.id === proyectoId)
    if (!p) return
    const objetivos = [...(p.objetivos ?? [])]
    objetivos[index] = { ...objetivos[index], done: !objetivos[index].done }
    updateProyecto(proyectoId, { objetivos })
  }

  async function handleConvertPhaseToProject() {
    if (!focusedPhase) return
    setConvertingPhase(true)
    setConvertError(null)
    try {
      const { phase, acts, proyecto } = focusedPhase
      const today = new Date().toISOString().slice(0, 10)

      // Recolectar TODOS los descendientes (hijos directos + sub-fases + sus hijos)
      // usando los acts ya precalculados del drawer más una búsqueda en el árbol completo
      const allProjectActs = (actividades as unknown as Activity[]).filter(a => a.proyectoId === phase.proyectoId)
      const allDescendants: Activity[] = []
      const queue = [phase.id]
      while (queue.length > 0) {
        const parentId = queue.shift()!
        const children = allProjectActs.filter(a => a.parentId === parentId)
        for (const child of children) {
          allDescendants.push(child)
          if (child.isGroup) queue.push(child.id)
        }
      }
      // Fallback: usar los acts del drawer si la búsqueda no encontró nada
      const toMove = allDescendants.length > 0 ? allDescendants : acts

      const leaves = toMove.filter(a => !a.isGroup)
      const starts = leaves.map(a => a.startDate ?? a.dueDate).filter(Boolean) as string[]
      const ends   = leaves.map(a => a.dueDate).filter(Boolean) as string[]
      const fechaInicio = starts.sort()[0] ?? today
      const endsSorted  = ends.sort()
      const fechaFin    = endsSorted[endsSorted.length - 1] ?? undefined
      const allAssignees = [...new Set(leaves.flatMap(a => getActividadAssignees(a as unknown as import('@/cmhub/types').HubActividad)).filter(Boolean))]

      const isoNow = new Date().toISOString()
      const projRef = doc(collection(db, 'cmhub_proyectos'))

      const batch = writeBatch(db)

      // Crear el proyecto
      batch.set(projRef, {
        id: projRef.id,
        nombre: phase.title,
        brandId: proyecto.brandId,
        estado: 'activo',
        avance: 0,
        fechaInicio,
        ...(fechaFin ? { fechaFin } : {}),
        responsable: allAssignees[0] ?? proyecto.responsable,
        responsables: allAssignees.length > 0 ? allAssignees : proyecto.responsables ?? [],
        ...(phase.description ? { descripcion: phase.description } : {}),
        tasksMigrated: true,
        ownerIds: proyecto.ownerIds ?? [],
        createdAt: isoNow,
        updatedAt: isoNow,
        _ts: serverTimestamp(),
      })

      // Mover todos los descendientes: limpiar parentId solo si es hijo directo de la fase
      for (const desc of toMove) {
        const update: Record<string, unknown> = { proyectoId: projRef.id }
        if (desc.parentId === phase.id) update.parentId = deleteField()
        batch.update(doc(db, COL, desc.id), update)
      }

      // Eliminar la fase
      batch.delete(doc(db, COL, phase.id))

      await batch.commit()

      setFocusedPhase(null)
      setConfirmConvertPhase(false)
    } catch (e) {
      console.error('[convert phase] Error:', e)
      setConvertError(e instanceof Error ? e.message : 'No se pudo crear el proyecto. Intenta de nuevo.')
    } finally {
      setConvertingPhase(false)
    }
  }

  function toggleProjectCollapse(id: string) {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePhaseCollapse(id: string) {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fTitle, setFTitle]       = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fDate, setFDate]         = useState('')
  const [fStatus, setFStatus]     = useState<ActivityStatus>('pendiente')
  const [fAssignees, setFAssignees] = useState<string[]>([])
  const [fCategory, setFCategory] = useState('')
  const [fProyecto, setFProyecto]     = useState('')
  const [fPhase, setFPhase]           = useState('')
  const [fPriority, setFPriority]     = useState<ActivityPriority>('normal')
  const [fStartDate, setFStartDate]   = useState('')

  // Sync selected when activities update
  useEffect(() => {
    if (selected) setSelected(activities.find(a => a.id === selected.id) ?? null)
  }, [activities]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link desde una notificación (?actividadId=xxx) — abre la actividad referida
  // apenas carguen las actividades. Solo una vez por carga de página.
  useEffect(() => {
    if (openedFromLinkRef.current) return
    const actividadId = searchParams.get('actividadId')
    if (!actividadId || activities.length === 0) return
    const found = activities.find(a => a.id === actividadId)
    if (found) {
      openedFromLinkRef.current = true
      setSelected(found)
    }
  }, [searchParams, activities])

  useEffect(() => {
    if (openedFromLinkRef.current) return
    const projectId = searchParams.get('proyectoId')
    if (projectId && searchParams.get('nuevo') === '1') {
      openedFromLinkRef.current = true
      openNewForProject(projectId)
    }
  }, [searchParams])

  function resolveAssigneeUid(name: string): string | null {
    return team.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ?? null
  }

  async function awardCompletionPoints(a: Activity, completedAtISO: string) {
    const timing    = classifyDelivery(completedAtISO, a.dueDate)
    const assignees = a.assignees?.length ? a.assignees : (a.assignee ? [a.assignee] : [])
    for (const name of assignees) {
      const userId = resolveAssigneeUid(name)
      if (!userId) continue
      const pts = pointsForDelivery(timing)
      await awardAndPost({
        userId, userName: name,
        amount:  pts,
        reason:  timing === 'early'   ? 'Actividad completada antes de fecha'
               : timing === 'on_time' ? 'Actividad completada en el límite'
               :                        'Actividad completada con retraso',
        refType: 'actividad',
        refId:   a.id,
        botTexto: botMsg('actividad_completada', { quien: name, titulo: a.title, puntos: pts }),
      })
    }
    return timing
  }

  async function patchActivity(id: string, patch: Partial<Activity>) {
    const current = activities.find(item => item.id === id)
    const becomingComplete = patch.status === 'completado' && current?.status !== 'completado'

    const update: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      update[k] = (v === undefined || v === null) ? deleteField() : v
    }

    if (current?.proyectoId) update.completionSource = 'project-workspace'
    if (patch.assignees) update.assigneeIds = team.filter(m => patch.assignees?.includes(m.name)).map(m => m.id)
    if (becomingComplete && current) {
      const completedAt = new Date().toISOString()
      update.completedAt = completedAt
      try {
        const timing = await awardCompletionPoints(current, completedAt)
        update.deliveryTiming = timing
        const pts = pointsForDelivery(timing)
        setPointsToast({ pts, titulo: current.title })
        setTimeout(() => setPointsToast(null), 4000)
      } catch (err) {
        console.error('[awardCompletionPoints]', err)
      }
      if (current.flujoId != null && current.pasoIndex != null) {
        const result = await advanceFlujo(current.flujoId, current.pasoIndex).catch(() => null)
        if (result != null && current.totalPasos != null) {
          const paso = current.pasoIndex + 1
          setStepToast({ paso, total: current.totalPasos, isLast: result.isLast })
          setSelected(null)
          setTimeout(() => setStepToast(null), 5000)
          // Notificar a los responsables del siguiente paso
          const nextAssignees = result.nextAssigneeNames ?? []
          if (!result.isLast && result.nextId && nextAssignees.length > 0) {
            const nextPaso = paso + 1
            for (const name of nextAssignees) {
              const member = team.find((m: TeamMember) => m.name.trim().toLowerCase() === name.trim().toLowerCase())
              if (!member?.id) continue
              addDoc(collection(db, 'notifications'), {
                userId: member.id,
                type: 'activity_new',
                category: 'Flujo',
                title: `Paso ${nextPaso}/${current.totalPasos} disponible`,
                message: `El paso anterior de "${current.flujoNombre ?? 'un flujo'}" fue completado. Tu tarea está lista para iniciar.`,
                link: `/admin/contenidos/actividades?actividadId=${result.nextId}`,
                actividadId: result.nextId,
                read: false,
                createdAt: serverTimestamp(),
              }).catch(console.error)
            }
          }
        }
      }
    }

    await updateDoc(doc(db, COL, id), update)
  }

  function openNew() {
    setEditingId(null); setFTitle(''); setFDesc(''); setFDate('')
    setFStatus('pendiente'); setFAssignees(myName ? [myName] : []); setFCategory('')
    setFProyecto(''); setFPhase(''); setShowForm(true)
  }

  function openNewForProject(proyectoId: string) {
    setEditingId(null); setFTitle(''); setFDesc(''); setFDate('')
    setFStatus('pendiente'); setFAssignees(myName ? [myName] : []); setFCategory('')
    setFProyecto(proyectoId); setFPhase(''); setShowForm(true)
  }

  async function save() {
    if (!fTitle.trim()) return
    const safePhase = fProyecto ? fPhase : ''
    const base: Record<string, unknown> = {
      title: fTitle.trim(), status: fStatus, ...(fProyecto ? {completionSource:'project-workspace'} : {}), assigneeIds: team.filter(m => fAssignees.includes(m.name)).map(m => m.id),
      proyectoId: fProyecto || null,
      ...(fProyecto && safePhase ? { parentId: safePhase } : {}),
      priority: fPriority,
    }
    if (editingId) {
      await updateDoc(doc(db, COL, editingId), {
        ...base,
        description: fDesc.trim()     ? fDesc.trim()     : deleteField(),
        startDate:   fStartDate        ? fStartDate       : deleteField(),
        dueDate:     fDate            ? fDate            : deleteField(),
        assignee:    fAssignees[0]    ? fAssignees[0]     : deleteField(),
        assignees:   fAssignees.length ? fAssignees       : deleteField(),
        category:    fCategory        ? fCategory         : deleteField(),
      })
    } else {
      if (fDesc.trim())      base.description = fDesc.trim()
      if (fStartDate)        base.startDate   = fStartDate
      if (fDate)             base.dueDate     = fDate
      if (fAssignees.length) { base.assignee = fAssignees[0]; base.assignees = fAssignees }
      if (fCategory)         base.category    = fCategory
      await addDoc(collection(db, COL), { ...base, createdAt: serverTimestamp() })
    }
    setShowForm(false); setEditingId(null)
  }

  async function toggleStatus(a: Activity) {
    const next = STATUS_CFG[a.status].next as ActivityStatus
    const completedAt = new Date().toISOString()
    const update: Record<string, unknown> = { status: next, ...(a.proyectoId ? { completionSource: 'project-workspace' } : {}) }
    if (next === 'completado' && !a.proyectoId) {
      update.completedAt = completedAt
      try {
        const timing = await awardCompletionPoints(a, completedAt)
        update.deliveryTiming = timing
      } catch (err) {
        console.error('[awardCompletionPoints]', err)
      }
      if (a.flujoId != null && a.pasoIndex != null) {
        const result = await advanceFlujo(a.flujoId, a.pasoIndex).catch(() => null)
        if (result != null && a.totalPasos != null) {
          const paso = a.pasoIndex + 1
          setStepToast({ paso, total: a.totalPasos, isLast: result.isLast })
          setTimeout(() => setStepToast(null), 5000)
        }
      }
    }
    await updateDoc(doc(db, COL, a.id), update)
  }

  async function claimActivity(a: Activity) {
    if (!myName) return
    await updateDoc(doc(db, COL, a.id), {
      assignee:  myName,
      assignees: [myName],
    })
    await postBotSala(botMsg('actividad_reclamada', { quien: myName, titulo: a.title }))
  }

  async function remove(id: string) { const activity = activities.find(a => a.id === id); if (activity?.proyectoId) { await updateDoc(doc(db, COL, id), { archived: true }); } else { await deleteDoc(doc(db, COL, id)); } }

  const hasActiveFilters = filterStatus !== 'all' || filterAssignee !== 'all' || filterProject !== 'all' || filterOverdue || searchQuery.trim() !== '' || filterHorizon !== 'week'
  function clearAllFilters() {
    setFilterStatus('all'); setFilterAssignee('all'); setFilterProject('all')
    setFilterOverdue(false); setSearchQuery(''); setFilterHorizon('week')
  }

  const filtered = activities.filter(a => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!a.title.toLowerCase().includes(q) && !(a.description?.toLowerCase().includes(q))) return false
    }
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterOverdue && !isOverdueActivity(a)) return false
    if (filterAssignee !== 'all' && !actividadHasAssignee(a, filterAssignee)) return false
    if (filterProject === 'none' && a.proyectoId) return false
    if (filterProject !== 'all' && filterProject !== 'none' && a.proyectoId !== filterProject) return false
    // Filtro de horizonte: oculta actividades fuera de la ventana seleccionada
    if (filterHorizon !== 'all' && a.status !== 'completado') {
      const today = todayISO()
      // Si tiene startDate en el futuro, no es accionable aún
      if (a.startDate && a.startDate > today) return false
      // Si tiene dueDate, aplicar el límite del horizonte
      if (a.dueDate) {
        const limit = filterHorizon === 'today' ? today
          : filterHorizon === 'week'            ? addDaysISO(today, 7)
          :                                       addDaysISO(today, 14)
        if (a.dueDate > limit) return false
      }
    }
    return true
  })

  // Proyectos con actividades pendientes/vencidas primero, luego por menor avance — así
  // el colaborador ve de inmediato dónde falta trabajo en vez de tener que escanear todo.
  const activeProyectos = proyectos
    .filter(p => filtered.some(a => a.proyectoId === p.id))
    .map(p => {
      const pActs   = sortActivities(filtered.filter(a => a.proyectoId === p.id))
      const pLeaves = pActs.filter(a => !a.isGroup)
      const done    = pLeaves.filter(a => a.status === 'completado').length
      const pct     = pLeaves.length ? Math.round(done / pLeaves.length * 100) : 0
      const overdue = pLeaves.some(isOverdueActivity)
      const color   = brands.find(b => b.id === p.brandId)?.color ?? fallbackProjectColor(p.id)
      return { p, pActs, done, pct, overdue, color }
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      if (a.pct !== b.pct) return a.pct - b.pct
      return a.p.nombre.localeCompare(b.p.nombre)
    })
  const independent = sortActivities(filtered.filter(a => !a.proyectoId || !proyectos.some(p => p.id === a.proyectoId)))

  const counts = {
    pendiente:  activities.filter(a => a.status === 'pendiente').length,
    en_curso:   activities.filter(a => a.status === 'en_curso').length,
    completado: activities.filter(a => a.status === 'completado').length,
  }
  const overdueCount = activities.filter(isOverdueActivity).length

  const T: Record<string, string> = isDark ? {
    page: '#0d0f12', card: '#161820', border: 'rgba(255,255,255,0.07)',
    text: '#f1f5f9', sub: '#94a3b8', muted: '#4b5563',
    input: '#1e2028', inputBorder: 'rgba(255,255,255,0.12)',
    groupBg: 'rgba(255,255,255,0.02)',
  } : {
    page: '#f8fafc', card: '#ffffff', border: '#e5e7eb',
    text: '#111827', sub: '#6b7280', muted: '#d1d5db',
    input: '#f9fafb', inputBorder: '#e5e7eb',
    groupBg: '#fafafa',
  }

  const inputCls = 'w-full rounded-xl px-3 py-2.5 text-[13px] outline-none border transition-colors'

  return (
    <>
      {/* ── Toast de paso completado ─────────────────────────────── */}
      {stepToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-[13px] font-semibold"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
          <Check size={16} className="text-[#10b981] shrink-0" />
          {stepToast.isLast
            ? `🎉 Flujo completado — todos los pasos terminados`
            : `Paso ${stepToast.paso}/${stepToast.total} completado — Paso ${stepToast.paso + 1} disponible en la lista`
          }
        </div>
      )}

      {/* ── Toast de puntos ─────────────────────────────────────── */}
      {pointsToast && (
        <div className="fixed bottom-6 right-6 z-[500] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: isDark ? '#1e2028' : '#fff', border: `1px solid ${T.border}` }}>
          <Check size={20} style={{ color: '#22c55e', flexShrink: 0 }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: T.text }}>Actividad completada</p>
            <p className="text-[11px]" style={{ color: '#22c55e' }}>+{pointsToast.pts} pts · {pointsToast.titulo.slice(0, 40)}</p>
          </div>
        </div>
      )}

      {/* ── Modal de detalle ─────────────────────────────────────── */}
      {selected && (
        <ActivityModal
          a={selected} activities={activities} team={team} proyectos={proyectos}
          isDark={isDark} tk={T} myName={myName}
          onClose={() => setSelected(null)}
          onUpdate={patch => patchActivity(selected.id, patch)}
          onDelete={() => remove(selected.id)}
        />
      )}

      {/* ── Drawer de fase ───────────────────────────────────────── */}
      {focusedPhase && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => { setFocusedPhase(null); setConfirmConvertPhase(false) }}>
          <div className="h-full w-full max-w-[520px] flex flex-col shadow-2xl overflow-hidden"
            style={{ background: isDark ? '#111114' : '#fff', borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${focusedPhase.color}18` }}>
                <Layers size={14} style={{ color: focusedPhase.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold truncate" style={{ color: isDark ? '#f9fafb' : '#111827' }}>{focusedPhase.phase.title}</h2>
                <p className="text-[11px] truncate" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>{focusedPhase.proyecto.nombre}</p>
              </div>
              {(() => {
                const done = focusedPhase.acts.filter(a => a.status === 'completado').length
                const pct  = Math.round(done / focusedPhase.acts.length * 100)
                return (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: focusedPhase.color }}>{pct}%</span>
                    <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{done}/{focusedPhase.acts.length}</span>
                  </div>
                )
              })()}
              <button onClick={() => { setFocusedPhase(null); setConfirmConvertPhase(false) }}
                className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0"
                style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}
                onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={14} />
              </button>
            </div>
            {/* Activity list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <GroupActivities
                activities={focusedPhase.acts}
                tk={T} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
                onToggle={a => { toggleStatus(a); setFocusedPhase(prev => prev ? { ...prev, acts: prev.acts.map(x => x.id === a.id ? { ...x, status: STATUS_CFG[x.status].next } : x) } : null) }}
                onDelete={a => { remove(a.id); setFocusedPhase(prev => prev ? { ...prev, acts: prev.acts.filter(x => x.id !== a.id) } : null) }}
                onUpdate={(a, patch) => { patchActivity(a.id, patch); setFocusedPhase(prev => prev ? { ...prev, acts: prev.acts.map(x => x.id === a.id ? { ...x, ...patch } : x) } : null) }}
                onOpen={a => setSelected(a)}
                onClaim={claimActivity}
              />
            </div>

            {/* Footer — convertir en proyecto */}
            <div className="shrink-0 px-5 py-4" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'}` }}>
              {!confirmConvertPhase ? (
                <button
                  onClick={() => setConfirmConvertPhase(true)}
                  className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-xl w-full justify-center transition-colors"
                  style={{ border: `1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`, color: T.sub }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.background = isDark ? 'rgba(124,58,237,0.08)' : '#faf5ff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'; e.currentTarget.style.color = T.sub; e.currentTarget.style.background = 'transparent' }}>
                  <FolderKanban size={13} />
                  Convertir en proyecto independiente
                </button>
              ) : (
                <div className="rounded-xl p-4" style={{ background: isDark ? 'rgba(124,58,237,0.10)' : '#faf5ff', border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : '#e9d5ff'}` }}>
                  <p className="text-[13px] font-semibold mb-1" style={{ color: isDark ? '#d4b8fa' : '#4c1d95' }}>
                    ¿Crear proyecto "{focusedPhase.phase.title}"?
                  </p>
                  <p className="text-[11px] mb-3" style={{ color: isDark ? 'rgba(212,184,250,0.7)' : '#7c3aed' }}>
                    Todas las actividades y sub-fases se moverán al nuevo proyecto. La fase se eliminará de {focusedPhase.proyecto.nombre}.
                  </p>
                  {convertError && (
                    <p className="text-[11px] mb-3 px-3 py-2 rounded-lg font-medium" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                      {convertError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmConvertPhase(false); setConvertError(null) }}
                      disabled={convertingPhase}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-40"
                      style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`, color: T.sub }}>
                      Cancelar
                    </button>
                    <button
                      onClick={handleConvertPhaseToProject}
                      disabled={convertingPhase}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-colors disabled:opacity-60"
                      style={{ background: '#7c3aed' }}>
                      {convertingPhase ? 'Creando…' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de proyecto ────────────────────────────────────── */}
      {selectedProyecto && (
        <ProyectoModal
          proyecto={selectedProyecto}
          activities={activities.filter(a => a.proyectoId === selectedProyecto.id) as any}
          brands={brands}
          isDark={isDark}
          onClose={() => setSelectedProyecto(null)}
          onOpenActivity={a => { setSelectedProyecto(null); setSelected(activities.find(x => x.id === a.id) ?? null) }}
          onNewActivity={() => { setSelectedProyecto(null); openNewForProject(selectedProyecto.id) }}
          onToggleObjetivo={i => handleToggleObjetivo(selectedProyecto.id, i)}
        />
      )}

      {/* ── Menú contextual de proyecto (click derecho) ─────────────── */}
      {ctxMenu && createPortal(
        <div
          className="fixed z-[400] rounded-xl shadow-2xl overflow-hidden text-[13px]"
          style={{
            left: ctxMenu.x, top: ctxMenu.y, minWidth: 200,
            background: isDark ? '#1e2028' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:opacity-80 transition-opacity text-left"
            style={{ color: T.text }}
            onClick={() => { setSelectedProyecto(ctxMenu.proyecto); setCtxMenu(null) }}
          >
            <FolderKanban size={13} style={{ opacity: 0.7 }} /> Ver detalle
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:opacity-80 transition-opacity text-left"
            style={{ color: T.text }}
            onClick={() => { openNewForProject(ctxMenu.proyecto.id); setCtxMenu(null) }}
          >
            <Plus size={13} style={{ opacity: 0.7 }} /> Nueva actividad
          </button>
          <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }} />
          {ctxMenu.proyecto.estado !== 'activo' && (
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:opacity-80 transition-opacity text-left"
              style={{ color: '#16a34a' }}
              onClick={() => { updateProyecto(ctxMenu.proyecto.id, { estado: 'activo' }); setCtxMenu(null) }}
            >
              <PlayCircle size={13} /> Activar proyecto
            </button>
          )}
          {ctxMenu.proyecto.estado !== 'pausado' && (
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:opacity-80 transition-opacity text-left"
              style={{ color: '#d97706' }}
              onClick={() => { updateProyecto(ctxMenu.proyecto.id, { estado: 'pausado' }); setCtxMenu(null) }}
            >
              <PauseCircle size={13} /> Pausar proyecto
            </button>
          )}
          {ctxMenu.proyecto.estado !== 'completado' && (
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:opacity-80 transition-opacity text-left"
              style={{ color: '#7c3aed' }}
              onClick={() => { updateProyecto(ctxMenu.proyecto.id, { estado: 'completado' }); setCtxMenu(null) }}
            >
              <CheckCircle2 size={13} /> Marcar completado
            </button>
          )}
        </div>,
        document.body
      )}

      <div className="flex flex-col h-full overflow-hidden" style={{ background: T.page }}>

        {/* ── Barra primaria: navegación + acción principal ──────── */}
        <div className="px-5 flex items-center gap-3 shrink-0"
          style={{
            background: isDark ? 'rgba(13,15,18,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
            height: 52,
          }}>
          {/* Tabs de sección */}
          <div className="flex items-center gap-1.5 mr-auto">
            <span className="text-[12px]" style={{ color: T.sub }}>Producción</span>
            <span className="text-[12px]" style={{ color: T.border }}>›</span>
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
              {(['actividades', 'flujos'] as const).map(s => (
                <button key={s} onClick={() => setMainSection(s)}
                  className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    background: mainSection === s ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                    color: mainSection === s ? T.text : T.sub,
                    boxShadow: mainSection === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {s === 'actividades' ? 'Actividades' : 'Flujos'}
                </button>
              ))}
            </div>
          </div>

          {/* Flujos: controles en la barra primaria */}
          {mainSection === 'flujos' && (
            <>
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                {(['activo', 'completado'] as const).map(t => {
                  const cnt = hubFlujos.filter(f => f.estado === t).length
                  return (
                    <button key={t} onClick={() => setFlujoTab(t)}
                      className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-all"
                      style={{
                        background: flujoTab === t ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                        color: flujoTab === t ? T.text : T.sub,
                        boxShadow: flujoTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}>
                      {t === 'activo' ? `Activos (${cnt})` : `Completados (${cnt})`}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setShowFlujoModal(true)}
                className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                <Plus size={15} /> Nuevo flujo
              </button>
            </>
          )}

          {/* Actividades: solo alerta de vencidas + toggle vista + botón primario */}
          {mainSection === 'actividades' && (
            <div className="flex items-center gap-2 shrink-0">
              {overdueCount > 0 && (
                <button onClick={() => setFilterOverdue(o => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={{
                    background: filterOverdue ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.07)',
                    color: '#ef4444',
                    border: `1px solid ${filterOverdue ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                  <AlertCircle size={11} />
                  {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
                </button>
              )}
              <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                {(['list', 'calendar'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      background: view === v ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                      color: view === v ? '#7c3aed' : T.sub,
                      boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {v === 'list' ? <LayoutList size={14} /> : <CalendarDays size={14} />}
                  </button>
                ))}
              </div>
              <button onClick={openNew}
                className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                <Plus size={15} /> Nueva
              </button>
            </div>
          )}
        </div>

        {/* ── Barra secundaria: filtros (solo Actividades) ─────── */}
        {mainSection === 'actividades' && (
          <div className="px-5 flex items-center gap-1.5 flex-wrap shrink-0"
            style={{
              background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
              minHeight: 40,
              paddingTop: 6,
              paddingBottom: 6,
            }}>
            {(['pendiente', 'en_curso', 'completado'] as ActivityStatus[]).map(s => {
              const cfg = STATUS_CFG[s]; const active = filterStatus === s
              if (compact && counts[s] === 0 && !active) return null
              return (
                <button key={s} onClick={() => setFilterStatus(active ? 'all' : s)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? (isDark ? cfg.darkBg : cfg.bg) : 'transparent',
                    color: active ? cfg.color : T.sub,
                    border: `1px solid ${active ? cfg.dot + '60' : 'transparent'}`,
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot, opacity: active ? 1 : 0.5 }} />
                  {counts[s]}
                  {!compact && <span className="opacity-70 ml-0.5">{cfg.label}</span>}
                </button>
              )
            })}
            {activeProyectos.length > 0 && (
              <>
                <div className="w-px h-3.5 shrink-0 mx-0.5" style={{ background: T.border }} />
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  {(['activos', 'completados'] as const).map(key => (
                    <button key={key} onClick={() => setListTab(key)}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all"
                      style={{
                        background: listTab === key ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                        color: listTab === key ? T.text : T.sub,
                        boxShadow: listTab === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      }}>
                      {key === 'activos' ? 'Activos' : 'Completados'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
              {([
                ['today', 'Hoy'],
                ['week',  '7d'],
                ['14d',   '14d'],
                ['all',   'Todo'],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilterHorizon(key)}
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap"
                  style={{
                    background: filterHorizon === key ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                    color: filterHorizon === key ? (isDark ? '#818cf8' : '#7c3aed') : T.sub,
                    boxShadow: filterHorizon === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Sección Flujos ───────────────────────────────────────── */}
        {mainSection === 'flujos' && (
          <div className="flex-1 overflow-y-auto p-4">
            {flujoLoading ? (
              <div className="flex items-center justify-center h-40 gap-2" style={{ color: T.sub }}>
                <Loader2 size={18} className="animate-spin" />
                <span className="text-[13px]">Cargando flujos…</span>
              </div>
            ) : flujoLoadError ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 rounded-2xl border border-dashed"
                style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fff5f5' }}>
                <p className="text-[13px] font-semibold">No se pudieron cargar los flujos.</p>
                <p className="text-[11px]">Sin permisos o sin conexión.</p>
              </div>
            ) : (() => {
              const visible = hubFlujos.filter(f => f.estado === flujoTab)
              return visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: T.sub }}>
                  <CheckCircle2 size={32} strokeWidth={1.5} />
                  <p className="text-[13px] font-medium">
                    {flujoTab === 'activo' ? 'No hay flujos activos' : 'No hay flujos completados'}
                  </p>
                  {flujoTab === 'activo' && (
                    <button onClick={() => setShowFlujoModal(true)}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white"
                      style={{ background: '#7c3aed' }}>
                      Crear primer flujo
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map(f => <FlujoCardItem key={f.id} flujo={f} tk={T} isDark={isDark} />)}
                </div>
              )
            })()}
          </div>
        )}

        {mainSection === 'actividades' && <div className="flex-1 overflow-hidden flex">

          {/* ── Vista Calendario ─────────────────────────────────── */}
          {view === 'calendar' && (
            <div className="flex-1 overflow-y-auto p-4">
              <ActivityCalendarView
                activities={filtered}
                year={calYear} month={calMonth}
                onYearMonth={(y, m) => { setCalYear(y); setCalMonth(m) }}
                tk={T} isDark={isDark}
                onOpen={a => setSelected(a)}
              />
            </div>
          )}

          {/* ── Vista Lista ───────────────────────────────────────── */}
          {view === 'list' && <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">

            {/* ── Barra de búsqueda ─────────────────────────────────── */}
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1" style={{ maxWidth: 320 }}>
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: searchQuery ? '#7c3aed' : T.muted }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar actividades…"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl text-[12px] border outline-none transition-all"
                  style={{
                    background: T.input,
                    color: T.text,
                    borderColor: searchQuery ? '#7c3aed' : T.border,
                    boxShadow: searchQuery ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb', color: T.sub }}>
                    <X size={9} />
                  </button>
                )}
              </div>

              {/* Separador visual */}
              <div className="w-px h-5 shrink-0" style={{ background: T.border }} />

              {/* Dropdown de proyecto */}
              {(() => {
                const allOpts = [
                  { id: 'all',  label: 'Todos los proyectos', color: T.sub },
                  ...proyectos.filter(p => !p.archived).map(p => ({ id: p.id, label: p.nombre, color: brands.find(b => b.id === p.brandId)?.color ?? '#7c3aed' })),
                  { id: 'none', label: 'Sin proyecto', color: T.sub },
                ]
                const sel = allOpts.find(o => o.id === filterProject) ?? allOpts[0]
                const active = filterProject !== 'all'
                return (
                  <>
                    <button
                      ref={projectDropdownBtnRef}
                      onClick={e => {
                        e.stopPropagation()
                        if (!projectDropdownOpen && projectDropdownBtnRef.current) {
                          const r = projectDropdownBtnRef.current.getBoundingClientRect()
                          setProjectDropdownPos({ top: r.bottom + 4, left: r.left })
                        }
                        setProjectDropdownOpen(o => !o)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all shrink-0"
                      style={{
                        background: active ? (isDark ? `${sel.color}22` : `${sel.color}12`) : T.card,
                        color: active ? sel.color : T.sub,
                        borderColor: active ? `${sel.color}60` : T.border,
                        boxShadow: active ? `0 0 0 2px ${sel.color}20` : 'none',
                      }}>
                      <FolderKanban size={11} />
                      <span className="max-w-[140px] truncate">{active ? sel.label : 'Proyecto'}</span>
                      <ChevronDown size={9} style={{ transform: projectDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                    </button>
                    {projectDropdownOpen && createPortal(
                      <>
                        <div className="fixed inset-0 z-[299]" onClick={() => setProjectDropdownOpen(false)} />
                        <div className="fixed z-[300] rounded-xl border shadow-xl overflow-hidden py-1"
                          style={{ top: projectDropdownPos.top, left: projectDropdownPos.left, minWidth: 230, background: T.card, borderColor: T.border }}>
                          {allOpts.map(o => {
                            const isSel = filterProject === o.id
                            return (
                              <button key={o.id}
                                onClick={() => { setFilterProject(o.id); setProjectDropdownOpen(false) }}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors"
                                style={{ background: isSel ? (isDark ? 'rgba(255,255,255,0.06)' : `${o.color}10`) : 'transparent', color: isSel ? o.color : T.text }}
                                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}
                                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                                {o.id !== 'all' && o.id !== 'none'
                                  ? <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: o.color }} />
                                  : <span className="w-2.5 h-2.5 shrink-0" />}
                                <span className="flex-1 truncate font-medium">{o.label}</span>
                                {isSel && <Check size={11} style={{ color: o.color, flexShrink: 0 }} />}
                              </button>
                            )
                          })}
                        </div>
                      </>,
                      document.body
                    )}
                  </>
                )
              })()}

              {/* Responsable — avatar picker */}
              <AssigneeFilterPicker
                value={filterAssignee}
                team={team}
                tk={T}
                isDark={isDark}
                onChange={setFilterAssignee}
              />

              {/* Mis actividades — atajo rápido con avatar */}
              {myName && (() => {
                const me = team.find(m => m.name === myName)
                const active = filterAssignee === myName
                return (
                  <button onClick={() => setFilterAssignee(active ? 'all' : myName)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all"
                    style={{
                      background: active ? (isDark ? 'rgba(124,58,237,0.18)' : '#f5f3ff') : T.card,
                      color: active ? '#7c3aed' : T.sub,
                      borderColor: active ? '#c4b5fd' : T.border,
                    }}>
                    {me
                      ? <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                          style={{ background: me.color }}>{me.initials}</div>
                      : <User size={10} />}
                    Mis actividades
                  </button>
                )
              })()}


              {/* Limpiar filtros */}
              {hasActiveFilters && (
                <button onClick={clearAllFilters}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
                  style={{ color: '#ef4444', background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' }}>
                  <X size={10} /> Limpiar
                </button>
              )}

              <span className="ml-auto text-[11px] whitespace-nowrap shrink-0" style={{ color: T.sub }}>
                {filtered.length} {filtered.length === 1 ? 'actividad' : 'actividades'}
                {filterHorizon !== 'all' && (
                  <span className="ml-1 opacity-60">
                    {filterHorizon === 'today' ? '· hoy' : filterHorizon === 'week' ? '· próx. 7 d' : '· próx. 14 d'}
                  </span>
                )}
              </span>
            </div>

            {/* Cabecera de columnas global — una sola vez, sin sticky para evitar conflictos */}
            {!loading && filtered.length > 0 && (
              <ColHeader tk={T} compact={compact} />
            )}

            {loading && <div className="text-center py-12 text-[13px]" style={{ color: T.sub }}>Cargando…</div>}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px]"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
                  {searchQuery ? '🔍' : '📋'}
                </div>
                <p className="text-[14px] font-semibold" style={{ color: T.sub }}>
                  {searchQuery ? `Sin resultados para "${searchQuery}"` : 'Sin actividades'}
                </p>
                {searchQuery
                  ? <button onClick={() => setSearchQuery('')}
                      className="text-[12px] font-semibold px-4 py-2 rounded-xl border transition-colors"
                      style={{ color: T.sub, borderColor: T.border }}>
                      Limpiar búsqueda
                    </button>
                  : <button onClick={openNew}
                      className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors">
                      <Plus size={13} /> Nueva actividad
                    </button>
                }
              </div>
            )}

            {/* Grupos por proyecto + Sin proyecto, separados por tab ───── */}
            {(() => {
              const pendingProyectos   = activeProyectos.filter(({ pct }) => pct < 100)
              const completedProyectos = activeProyectos.filter(({ pct }) => pct === 100)
              const indepActive    = independent.filter(a => a.status !== 'completado')
              const indepCompleted = independent.filter(a => a.status === 'completado')

              function renderProyecto({ p, pActs, done, pct, overdue, color }: typeof activeProyectos[0]) {
                const complete     = pct === 100
                const collapsed    = collapsedProjects.has(p.id)
                const borderColor  = isDark ? `${color}40` : `${color}45`
                const headerBg     = isDark ? `${color}14` : `${color}10`
                const headerBorder = isDark ? `${color}22` : `${color}1c`
                return (
                  <div key={p.id} className="rounded-2xl border overflow-hidden" style={{ borderColor, borderLeft: `3px solid ${color}` }}
                    onContextMenu={e => { e.preventDefault(); const x = Math.min(e.clientX, window.innerWidth - 210); const y = Math.min(e.clientY, window.innerHeight - 200); setCtxMenu({ x, y, proyecto: p }) }}
                  >
                    <div className="flex items-center gap-2 px-4 py-2"
                      style={{ background: headerBg, borderBottom: collapsed ? 'none' : `1px solid ${headerBorder}` }}>
                      <button onClick={() => toggleProjectCollapse(p.id)}
                        className="flex items-center justify-center shrink-0 hover:opacity-70 transition-opacity">
                        <ChevronDown size={12} style={{ color, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>
                      <button onClick={() => setSelectedProyecto(p)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0 shrink-0"
                        title="Ver detalle del proyecto">
                        <FolderKanban size={13} style={{ color, flexShrink: 0 }} />
                        <span className="text-[12px] font-bold truncate max-w-[260px]" style={{ color }}>{p.nombre}</span>
                      </button>
                      {(() => { const bn = brands.find(b => b.id === p.brandId)?.name; return bn ? <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: T.sub }}>{bn}</span> : null })()}
                      {overdue && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: isDark ? 'rgba(239,68,68,0.18)' : '#fef2f2', color: '#ef4444' }}>
                          ⚠ Vencida
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ background: headerBorder, color }}>
                        {done}/{pActs.filter(a => !a.isGroup).length}
                      </span>
                      <button onClick={() => toggleProjectCollapse(p.id)}
                        className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[40px]"
                          style={{ background: isDark ? 'rgba(255,255,255,0.1)' : `${color}20` }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        {complete
                          ? <Check size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
                          : <span className="text-[10px] font-bold shrink-0" style={{ color }}>{pct}%</span>}
                      </button>
                      <button onClick={e => { e.stopPropagation(); openNewForProject(p.id) }}
                        className="flex items-center justify-center w-6 h-6 rounded-lg transition-opacity hover:opacity-80 shrink-0"
                        style={{ background: `${color}28`, color }} title="Nueva actividad en este proyecto">
                        <Plus size={12} />
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="px-2 pt-1 pb-2" style={{ background: T.groupBg }}>
                        {(() => {
                          const phases  = pActs.filter(a => a.isGroup)
                          const orphans = pActs.filter(a => !a.isGroup && !phases.find(ph => ph.id === a.parentId))
                          if (phases.length === 0) {
                            return (
                              <GroupActivities activities={pActs.filter(a => !a.isGroup)} tk={T} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
                                onToggle={toggleStatus} onDelete={a => remove(a.id)}
                                onUpdate={(a, patch) => patchActivity(a.id, patch)}
                                onOpen={a => setSelected(a)} onClaim={claimActivity} />
                            )
                          }
                          return (
                            <>
                              {phases.map(phase => {
                                const phaseActs = pActs.filter(a => !a.isGroup && a.parentId === phase.id)
                                if (phaseActs.length === 0) return null
                                const phaseDone = phaseActs.filter(a => a.status === 'completado').length
                                const phasePct  = Math.round(phaseDone / phaseActs.length * 100)
                                const phaseOver = phaseActs.some(isOverdueActivity)
                                return (
                                  <div key={phase.id} className="mb-1.5">
                                    <button
                                      onClick={() => setFocusedPhase({ phase, acts: phaseActs, color, proyecto: p })}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-opacity hover:opacity-80"
                                      style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                                      <Layers size={11} style={{ color, flexShrink: 0 }} />
                                      <span className="text-[12px] font-bold flex-1 text-left" style={{ color }}>{phase.title}</span>
                                      {phaseOver && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: isDark ? 'rgba(239,68,68,0.18)' : '#fef2f2', color: '#ef4444' }}>Vencida</span>}
                                      <span className="text-[10px] font-semibold shrink-0 tabular-nums" style={{ color: T.sub }}>{phaseDone}/{phaseActs.length}</span>
                                      <div className="w-12 h-1 rounded-full overflow-hidden shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : `${color}20` }}>
                                        <div className="h-full rounded-full" style={{ width: `${phasePct}%`, background: color }} />
                                      </div>
                                      <ChevronRight size={12} style={{ color: T.muted, flexShrink: 0 }} />
                                    </button>
                                  </div>
                                )
                              })}
                              {orphans.length > 0 && (
                                <div className="mt-1">
                                  <div className="flex items-center gap-1.5 px-3 py-1 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.sub }}>Sin fase</span>
                                    <span className="text-[9px] px-1 rounded" style={{ background: T.border, color: T.sub }}>{orphans.length}</span>
                                  </div>
                                  <GroupActivities activities={orphans} tk={T} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
                                    onToggle={toggleStatus} onDelete={a => remove(a.id)}
                                    onUpdate={(a, patch) => patchActivity(a.id, patch)}
                                    onOpen={a => setSelected(a)} onClaim={claimActivity} />
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              }

              // Sección "Sin proyecto" reutilizable
              function renderSinProyecto(acts: Activity[], showCollapsed = true) {
                if (acts.length === 0) return null
                return (
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border, borderLeft: `3px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}` }}>
                    <div className="flex items-center gap-2 px-4 py-2"
                      style={{ background: T.groupBg, borderBottom: collapsedIndep ? 'none' : `1px solid ${T.border}` }}>
                      <button onClick={() => setCollapsedIndep(v => !v)}
                        className="flex items-center gap-2 flex-1 cursor-pointer">
                        <ChevronDown size={12} style={{ color: T.sub, transform: collapsedIndep && showCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
                        <Link2 size={12} style={{ color: T.sub }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.sub }}>Sin proyecto</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: T.sub }}>
                          {acts.length}
                        </span>
                        {acts.some(isOverdueActivity) && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: isDark ? 'rgba(239,68,68,0.18)' : '#fef2f2', color: '#ef4444' }}>
                            ⚠ {acts.filter(isOverdueActivity).length} vencida{acts.filter(isOverdueActivity).length > 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                    </div>
                    {(!collapsedIndep || !showCollapsed) && (
                      <div className="px-2 pt-1 pb-2" style={{ background: T.groupBg }}>
                        <GroupActivities activities={acts} tk={T} isDark={isDark} team={team} proyectos={proyectos} compact={compact}
                          onToggle={toggleStatus} onDelete={a => remove(a.id)}
                          onUpdate={(a, patch) => patchActivity(a.id, patch)}
                          onOpen={a => setSelected(a)} onClaim={claimActivity} />
                      </div>
                    )}
                  </div>
                )
              }

              if (listTab === 'activos') {
                return (
                  <>
                    {pendingProyectos.map(renderProyecto)}
                    {renderSinProyecto(indepActive)}
                  </>
                )
              }

              // Tab completados
              return (
                <>
                  {completedProyectos.length === 0 && indepCompleted.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <CheckCircle2 size={32} strokeWidth={1.5} style={{ color: T.sub, opacity: 0.4 }} />
                      <p className="text-[13px] font-medium" style={{ color: T.sub }}>Sin elementos completados</p>
                    </div>
                  )}
                  {completedProyectos.map(renderProyecto)}
                  {renderSinProyecto(indepCompleted, false)}
                </>
              )
            })()}

          </div>
          </div>}

          {/* ── Panel nueva actividad ───────────────────────────── */}
          {showForm && (
            <div className="w-72 shrink-0 flex flex-col overflow-hidden"
              style={{ borderLeft: `1px solid ${T.border}`, background: T.card }}>
              <div className="flex items-center justify-between px-4 py-3.5 shrink-0"
                style={{ borderBottom: `1px solid ${T.border}` }}>
                <p className="text-[13px] font-bold" style={{ color: T.text }}>Nueva actividad</p>
                <button onClick={() => setShowForm(false)} style={{ color: T.sub }}><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>TÍTULO *</label>
                  <input value={fTitle} onChange={e => setFTitle(e.target.value)}
                    placeholder="Nombre de la actividad" autoFocus className={inputCls}
                    style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>DESCRIPCIÓN</label>
                  <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                    placeholder="Detalles…" rows={2} className={inputCls + ' resize-none'}
                    style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>ESTADO</label>
                    <select value={fStatus} onChange={e => setFStatus(e.target.value as ActivityStatus)}
                      className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                      {(Object.keys(STATUS_CFG) as ActivityStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>PRIORIDAD</label>
                    <select value={fPriority} onChange={e => setFPriority(e.target.value as ActivityPriority)}
                      className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                      {PRIORITIES.map(p => (
                        <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>FECHA LÍMITE</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                    className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1.5 block" style={{ color: T.sub }}>RESPONSABLES</label>
                  <div className="flex flex-wrap gap-1.5">
                    {team.map(m => {
                      const active = fAssignees.includes(m.name)
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setFAssignees(prev => active ? prev.filter(n => n !== m.name) : [...prev, m.name])}
                          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition-colors"
                          style={{
                            background: active ? `${m.color}22` : T.input,
                            color: active ? m.color : T.sub,
                            borderColor: active ? m.color : T.inputBorder,
                          }}>
                          {m.name}
                        </button>
                      )
                    })}
                    {team.length === 0 && (
                      <span className="text-[11px]" style={{ color: T.muted }}>Sin colaboradores</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>PROYECTO (opcional)</label>
                  <select value={fProyecto} onChange={e => { setFProyecto(e.target.value); setFPhase('') }}
                    className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                    <option value="">Sin proyecto</option>
                    {proyectos.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {fProyecto && (() => {
                    const phases = (actividades as unknown as Activity[]).filter(a => a.proyectoId === fProyecto && (a as unknown as {isGroup?:boolean}).isGroup)
                    return phases.length > 0 ? (
                      <select value={fPhase} onChange={e => setFPhase(e.target.value)}
                        className={inputCls + ' mt-2'}
                        style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                        <option value="">Sin fase específica</option>
                        {phases.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    ) : null
                  })()}
                </div>
              </div>
              <div className="px-4 py-3 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-medium border transition-colors"
                  style={{ borderColor: T.border, color: T.sub }}>Cancelar</button>
                <button onClick={save} disabled={!fTitle.trim()}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors disabled:opacity-40">
                  Crear
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>

      {showFlujoModal && (
        <IniciarFlujoModal team={activeTeam} onClose={() => setShowFlujoModal(false)} />
      )}
    </>
  )
}
