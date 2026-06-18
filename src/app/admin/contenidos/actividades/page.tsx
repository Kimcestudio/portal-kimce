'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, Check, X, ChevronDown, Link2, Unlink,
  FolderKanban, ExternalLink, MessageSquare, Send, Calendar,
  User, Tag, AlignLeft, Paperclip,
} from 'lucide-react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, deleteField,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'

// ── Tipos ──────────────────────────────────────────────────────────────────
type ActivityStatus = 'pendiente' | 'en_curso' | 'completado'

interface Comentario {
  id: string
  texto: string
  autor: string
  fecha: string
}

interface Activity {
  id: string
  title: string
  description?: string
  dueDate?: string
  status: ActivityStatus
  assignee?: string
  category?: string
  proyectoId?: string | null
  linkEntrega?: string
  comentarios?: Comentario[]
  createdAt?: unknown
}

// ── Config ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ActivityStatus, {
  label: string; color: string; bg: string; dot: string; darkBg: string; next: ActivityStatus
}> = {
  pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(217,119,6,0.2)',  dot: '#f59e0b', next: 'en_curso'   },
  en_curso:   { label: 'En curso',   color: '#2563eb', bg: '#dbeafe', darkBg: 'rgba(37,99,235,0.2)',  dot: '#3b82f6', next: 'completado' },
  completado: { label: 'Completado', color: '#16a34a', bg: '#dcfce7', darkBg: 'rgba(22,163,74,0.2)',  dot: '#22c55e', next: 'pendiente'  },
}

const CATEGORIES = ['Reunión', 'Llamada', 'Capacitación', 'Administrativo', 'Investigación', 'Otro']
const COL = 'hubActividades'
// grid: circle | title | estado | categoría | responsable | fecha | delete
const COLS = '20px 1fr 110px 110px 150px 90px 28px'

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

// ── InlineSelect ───────────────────────────────────────────────────────────
function InlineSelect<T extends string>({ value, options, onChange, renderTrigger, renderOption, tk }: {
  value: T; options: T[]; onChange: (v: T) => void
  renderTrigger: (v: T) => React.ReactNode
  renderOption:  (v: T) => React.ReactNode
  tk: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="cursor-pointer hover:opacity-75 transition-opacity">{renderTrigger(value)}</button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl overflow-hidden min-w-[130px]"
          style={{ background: tk.card, borderColor: tk.border }}>
          {options.map(o => (
            <button key={o} onClick={e => { e.stopPropagation(); onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] transition-colors"
              style={{ background: o === value ? tk.page : 'transparent', color: tk.text }}
              onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
              onMouseLeave={e => (e.currentTarget.style.background = o === value ? tk.page : 'transparent')}>
              {renderOption(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PersonPicker ───────────────────────────────────────────────────────────
function PersonPicker({ value, team, onChange, tk }: {
  value?: string
  team: { id: string; name: string; initials: string; color: string }[]
  onChange: (v: string) => void
  tk: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const member = team.find(m => m.name === value)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-75 transition-opacity">
        {member
          ? <><div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{ background: member.color }}>{member.initials}</div>
            <span className="text-[11px] truncate" style={{ color: tk.text, maxWidth: 90 }}>{member.name}</span></>
          : <span className="text-[11px] italic" style={{ color: tk.muted }}>Sin asignar</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl overflow-hidden w-48"
          style={{ background: tk.card, borderColor: tk.border }}>
          <button onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-[11px] italic transition-colors"
            style={{ color: tk.muted }}
            onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Sin asignar</button>
          {team.map(m => (
            <button key={m.id} onClick={e => { e.stopPropagation(); onChange(m.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
              style={{ background: m.name === value ? tk.page : 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = tk.page)}
              onMouseLeave={e => (e.currentTarget.style.background = m.name === value ? tk.page : 'transparent')}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ background: m.color }}>{m.initials}</div>
              <span className="text-[12px]" style={{ color: tk.text }}>{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DateCell ───────────────────────────────────────────────────────────────
function DateCell({ value, onSave, tk, isOverdue }: {
  value?: string; onSave: (v: string) => void; tk: Record<string, string>; isOverdue?: boolean
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
      className="text-[11px] cursor-pointer hover:opacity-70 transition-opacity text-left w-full"
      style={{ color: isOverdue ? '#ef4444' : value ? tk.sub : tk.muted }}>
      {value ? (isOverdue ? '⚠ ' : '') + fmtShort(value) : <span className="opacity-30">—</span>}
    </button>
  )
}

// ── Modal de detalle ───────────────────────────────────────────────────────
function ActivityModal({ a, team, proyectos, isDark, tk, myName, onClose, onUpdate, onDelete }: {
  a: Activity
  team: { id: string; name: string; initials: string; color: string }[]
  proyectos: { id: string; nombre: string }[]
  isDark: boolean; tk: Record<string, string>; myName: string
  onClose: () => void
  onUpdate: (patch: Partial<Activity>) => void
  onDelete: () => void
}) {
  const s = STATUS_CFG[a.status]
  const proyecto = proyectos.find(p => p.id === a.proyectoId)
  const member   = team.find(m => m.name === a.assignee)
  const today    = new Date().toISOString().slice(0, 10)
  const isOverdue = !!(a.dueDate && a.dueDate < today && a.status !== 'completado')

  const [desc, setDesc]     = useState(a.description ?? '')
  const [link, setLink]     = useState(a.linkEntrega ?? '')
  const [comment, setComment] = useState('')

  function saveDesc() {
    if (desc !== (a.description ?? '')) onUpdate({ description: desc || undefined })
  }
  function saveLink() {
    if (link !== (a.linkEntrega ?? '')) onUpdate({ linkEntrega: link || undefined })
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
          {/* Círculo de estado */}
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
            style={{ borderColor: s.dot, background: a.status === 'completado' ? s.dot : 'transparent' }}
            onClick={() => onUpdate({ status: STATUS_CFG[a.status].next })}>
            {a.status === 'completado' && <Check size={14} color="#fff" strokeWidth={3} />}
            {a.status === 'en_curso' && <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold leading-tight" style={{ color: tk.text }}>{a.title}</h2>
            {proyecto && (
              <span className="flex items-center gap-1 mt-1 text-[11px] font-semibold"
                style={{ color: '#7c3aed' }}>
                <FolderKanban size={11} /> {proyecto.nombre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status selector */}
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
          {/* Meta row */}
          <div className="grid grid-cols-3 gap-px" style={{ background: tk.border }}>
            {[
              {
                Icon: User, label: 'Responsable',
                content: (
                  <PersonPicker value={a.assignee} team={team}
                    onChange={v => onUpdate({ assignee: v || undefined })} tk={tk} />
                ),
              },
              {
                Icon: Tag, label: 'Categoría',
                content: (
                  <InlineSelect value={a.category ?? ''} options={['', ...CATEGORIES] as string[]}
                    onChange={v => onUpdate({ category: v || undefined })} tk={tk}
                    renderTrigger={v => <span className="text-[13px]" style={{ color: v ? tk.text : tk.muted }}>{v || 'Sin categoría'}</span>}
                    renderOption={v => <span className="text-[12px]" style={{ color: v ? tk.text : tk.muted }}>{v || 'Sin categoría'}</span>} />
                ),
              },
              {
                Icon: Calendar, label: 'Fecha límite',
                content: (
                  <div>
                    <input type="date" defaultValue={a.dueDate ?? ''}
                      className="text-[13px] bg-transparent outline-none border-none w-full"
                      style={{ color: isOverdue ? '#ef4444' : tk.text }}
                      onChange={e => onUpdate({ dueDate: e.target.value || undefined })} />
                    {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Vencida</p>}
                  </div>
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
function ActivityRow({ a, tk, isDark, team, onToggle, onDelete, onUpdate, onOpen }: {
  a: Activity; tk: Record<string, string>; isDark: boolean
  team: { id: string; name: string; initials: string; color: string }[]
  onToggle: () => void; onDelete: () => void
  onUpdate: (patch: Partial<Activity>) => void; onOpen: () => void
}) {
  const s = STATUS_CFG[a.status]
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = !!(a.dueDate && a.dueDate < today && a.status !== 'completado')
  const done = a.status === 'completado'

  return (
    <div className="group transition-colors rounded-xl border"
      style={{
        display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background: done ? (isDark ? 'rgba(255,255,255,0.015)' : '#fafafa') : tk.card,
        borderColor: tk.border,
        borderLeft: `3px solid ${done ? tk.border : s.dot}`,
        opacity: done ? 0.65 : 1,
      }}>

      {/* Círculo toggle */}
      <button onClick={e => { e.stopPropagation(); onToggle() }}
        title={`→ ${STATUS_CFG[s.next].label}`}
        className="rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
        style={{ width: 20, height: 20, borderColor: s.dot, background: done ? s.dot : 'transparent' }}>
        {done ? <Check size={10} color="#fff" strokeWidth={3} />
          : a.status === 'en_curso' ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
          : null}
      </button>

      {/* Título → abre modal */}
      <button onClick={onOpen}
        className="text-[13px] font-medium text-left truncate hover:underline"
        style={{ color: tk.text, textDecoration: done ? 'line-through' : 'none' }}>
        {a.title}
      </button>

      {/* ESTADO */}
      <div>
        <InlineSelect value={a.status} options={['pendiente','en_curso','completado'] as ActivityStatus[]}
          onChange={v => onUpdate({ status: v })} tk={tk}
          renderTrigger={v => {
            const cfg = STATUS_CFG[v]
            return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: isDark ? cfg.darkBg : cfg.bg, color: cfg.color }}>{cfg.label}</span>
          }}
          renderOption={v => {
            const cfg = STATUS_CFG[v]
            return <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          }} />
      </div>

      {/* CATEGORÍA */}
      <div>
        <InlineSelect value={a.category ?? ''} options={['', ...CATEGORIES] as string[]}
          onChange={v => onUpdate({ category: v || undefined })} tk={tk}
          renderTrigger={v => <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: v ? tk.sub : tk.muted }}>
            {v || <span className="italic opacity-50">—</span>}</span>}
          renderOption={v => <span className="text-[11px]" style={{ color: v ? tk.text : tk.muted }}>{v || 'Sin categoría'}</span>} />
      </div>

      {/* RESPONSABLE */}
      <PersonPicker value={a.assignee} team={team}
        onChange={v => onUpdate({ assignee: v || undefined })} tk={tk} />

      {/* FECHA */}
      <DateCell value={a.dueDate} isOverdue={isOverdue} tk={tk}
        onSave={v => onUpdate({ dueDate: v || undefined })} />

      {/* Eliminar */}
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ color: '#ef4444' }}>
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── Cabecera de columnas ───────────────────────────────────────────────────
function ColHeader({ tk }: { tk: Record<string, string> }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COLS,
      gap: 8, padding: '6px 14px',
      background: 'transparent',
    }}>
      <span />
      {['ACTIVIDAD', 'ESTADO', 'CATEGORÍA', 'RESPONSABLE', 'FECHA', ''].map(h => (
        <span key={h} className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: tk.muted }}>{h}</span>
      ))}
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────
export default function ActividadesPage() {
  const { isDark } = useHubTheme()
  const { team, proyectos } = useHub()
  const auth   = useOptionalAuth()
  const myName = auth?.profile?.displayName ?? ''

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Activity | null>(null)

  const [filterStatus,   setFilterStatus]   = useState<ActivityStatus | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterProject,  setFilterProject]  = useState('all')

  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fTitle, setFTitle]       = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fDate, setFDate]         = useState('')
  const [fStatus, setFStatus]     = useState<ActivityStatus>('pendiente')
  const [fAssignee, setFAssignee] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fLinked, setFLinked]     = useState(false)
  const [fProyecto, setFProyecto] = useState('')

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Activity))
      setLoading(false)
    })
  }, [])

  // Sync selected when activities update
  useEffect(() => {
    if (selected) setSelected(activities.find(a => a.id === selected.id) ?? null)
  }, [activities]) // eslint-disable-line react-hooks/exhaustive-deps

  async function patchActivity(id: string, patch: Partial<Activity>) {
    const update: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      update[k] = (v === undefined || v === null) ? deleteField() : v
    }
    await updateDoc(doc(db, COL, id), update)
  }

  function openNew() {
    setEditingId(null); setFTitle(''); setFDesc(''); setFDate('')
    setFStatus('pendiente'); setFAssignee(myName); setFCategory('')
    setFLinked(false); setFProyecto(''); setShowForm(true)
  }

  async function save() {
    if (!fTitle.trim()) return
    const base: Record<string, unknown> = {
      title: fTitle.trim(), status: fStatus,
      proyectoId: fLinked && fProyecto ? fProyecto : null,
    }
    if (editingId) {
      await updateDoc(doc(db, COL, editingId), {
        ...base,
        description: fDesc.trim() ? fDesc.trim() : deleteField(),
        dueDate:     fDate        ? fDate         : deleteField(),
        assignee:    fAssignee    ? fAssignee      : deleteField(),
        category:    fCategory    ? fCategory      : deleteField(),
      })
    } else {
      if (fDesc.trim()) base.description = fDesc.trim()
      if (fDate)        base.dueDate     = fDate
      if (fAssignee)    base.assignee    = fAssignee
      if (fCategory)    base.category    = fCategory
      await addDoc(collection(db, COL), { ...base, createdAt: serverTimestamp() })
    }
    setShowForm(false); setEditingId(null)
  }

  async function toggleStatus(a: Activity) {
    await updateDoc(doc(db, COL, a.id), { status: STATUS_CFG[a.status].next })
  }
  async function remove(id: string) { await deleteDoc(doc(db, COL, id)) }

  const filtered = activities.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterAssignee !== 'all' && a.assignee !== filterAssignee) return false
    if (filterProject === 'none' && a.proyectoId) return false
    if (filterProject !== 'all' && filterProject !== 'none' && a.proyectoId !== filterProject) return false
    return true
  })

  const activeProyectos = proyectos.filter(p => filtered.some(a => a.proyectoId === p.id))
  const independent     = filtered.filter(a => !a.proyectoId)
  const counts = {
    pendiente:  activities.filter(a => a.status === 'pendiente').length,
    en_curso:   activities.filter(a => a.status === 'en_curso').length,
    completado: activities.filter(a => a.status === 'completado').length,
  }

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
      {/* ── Modal de detalle ─────────────────────────────────────── */}
      {selected && (
        <ActivityModal
          a={selected} team={team} proyectos={proyectos}
          isDark={isDark} tk={T} myName={myName}
          onClose={() => setSelected(null)}
          onUpdate={patch => patchActivity(selected.id, patch)}
          onDelete={() => remove(selected.id)}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden" style={{ background: T.page }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="px-5 h-14 flex items-center gap-3 shrink-0"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: T.sub }}>Producción</span>
            <span style={{ color: T.border }}>›</span>
            <span className="text-[13px] font-semibold" style={{ color: T.text }}>Actividades</span>
          </div>
          {(['pendiente', 'en_curso', 'completado'] as ActivityStatus[]).map(s => {
            const cfg = STATUS_CFG[s]; const active = filterStatus === s
            return (
              <button key={s} onClick={() => setFilterStatus(active ? 'all' : s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all"
                style={{
                  background: active ? (isDark ? cfg.darkBg : cfg.bg) : 'transparent',
                  color: active ? cfg.color : T.sub,
                  borderColor: active ? cfg.dot + '60' : T.border,
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                {cfg.label} · {counts[s]}
              </button>
            )
          })}
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={14} /> Nueva
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* ── Lista ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">

            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <FolderKanban size={12} style={{ color: T.sub }} />
                <div className="relative">
                  <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-[12px] border outline-none"
                    style={{ background: T.card, color: T.text, borderColor: T.border }}>
                    <option value="all">Todos los proyectos</option>
                    <option value="none">Sin proyecto</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.sub }} />
                </div>
              </div>
              <div className="relative">
                <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-[12px] border outline-none"
                  style={{ background: T.card, color: T.text, borderColor: T.border }}>
                  <option value="all">Todos los responsables</option>
                  {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.sub }} />
              </div>
              <span className="ml-auto text-[12px]" style={{ color: T.sub }}>
                {filtered.length} actividad{filtered.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {loading && <div className="text-center py-12 text-[13px]" style={{ color: T.sub }}>Cargando…</div>}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px]"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>📋</div>
                <p className="text-[14px] font-semibold" style={{ color: T.sub }}>Sin actividades</p>
                <button onClick={openNew}
                  className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors">
                  <Plus size={13} /> Nueva actividad
                </button>
              </div>
            )}

            {/* Grupos por proyecto */}
            {activeProyectos.map(p => {
              const pActs = filtered.filter(a => a.proyectoId === p.id)
              const done  = pActs.filter(a => a.status === 'completado').length
              const pct   = pActs.length ? Math.round(done / pActs.length * 100) : 0
              return (
                <div key={p.id} className="rounded-2xl border overflow-hidden"
                  style={{ borderColor: isDark ? 'rgba(124,58,237,0.25)' : '#ddd6fe' }}>
                  <div className="flex items-center gap-2.5 px-4 py-2.5"
                    style={{ background: isDark ? 'rgba(124,58,237,0.08)' : '#f5f3ff', borderBottom: `1px solid ${isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe'}` }}>
                    <FolderKanban size={13} style={{ color: '#7c3aed' }} />
                    <span className="text-[12px] font-bold" style={{ color: '#7c3aed' }}>{p.nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: isDark ? 'rgba(124,58,237,0.2)' : '#ede9fe', color: '#7c3aed' }}>
                      {done}/{pActs.length}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden mx-2"
                      style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#ddd6fe' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: '#7c3aed' }}>{pct}%</span>
                  </div>
                  <div className="px-2 pt-1 pb-2" style={{ background: T.groupBg }}>
                    <ColHeader tk={T} />
                    <div className="flex flex-col gap-1">
                      {pActs.map(a => (
                        <ActivityRow key={a.id} a={a} tk={T} isDark={isDark} team={team}
                          onToggle={() => toggleStatus(a)}
                          onDelete={() => remove(a.id)}
                          onUpdate={patch => patchActivity(a.id, patch)}
                          onOpen={() => setSelected(a)} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Independientes */}
            {independent.length > 0 && (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2 px-4 py-2.5"
                  style={{ background: T.groupBg, borderBottom: `1px solid ${T.border}` }}>
                  <Unlink size={12} style={{ color: T.sub }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.sub }}>
                    Independientes
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: T.sub }}>
                    {independent.length}
                  </span>
                </div>
                <div className="px-2 pt-1 pb-2" style={{ background: T.groupBg }}>
                  <ColHeader tk={T} />
                  <div className="flex flex-col gap-1">
                    {independent.map(a => (
                      <ActivityRow key={a.id} a={a} tk={T} isDark={isDark} team={team}
                        onToggle={() => toggleStatus(a)}
                        onDelete={() => remove(a.id)}
                        onUpdate={patch => patchActivity(a.id, patch)}
                        onOpen={() => setSelected(a)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

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
                    <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>FECHA</label>
                    <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                      className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>RESPONSABLE</label>
                  <select value={fAssignee} onChange={e => setFAssignee(e.target.value)}
                    className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                    <option value="">Sin asignar</option>
                    {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: T.sub }}>CATEGORÍA</label>
                  <select value={fCategory} onChange={e => setFCategory(e.target.value)}
                    className={inputCls} style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                    <option value="">Sin categoría</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold mb-1.5 block" style={{ color: T.sub }}>PROYECTO</label>
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: T.inputBorder }}>
                    <button type="button" onClick={() => { setFLinked(false); setFProyecto('') }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors"
                      style={{ background: !fLinked ? '#7c3aed' : T.input, color: !fLinked ? '#fff' : T.sub }}>
                      <Unlink size={10} /> Independiente
                    </button>
                    <button type="button" onClick={() => setFLinked(true)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors"
                      style={{ background: fLinked ? '#7c3aed' : T.input, color: fLinked ? '#fff' : T.sub }}>
                      <Link2 size={10} /> Vincular
                    </button>
                  </div>
                  {fLinked && (
                    <select value={fProyecto} onChange={e => setFProyecto(e.target.value)}
                      className={inputCls + ' mt-2'}
                      style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                      <option value="">Seleccionar proyecto…</option>
                      {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  )}
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
        </div>
      </div>
    </>
  )
}
