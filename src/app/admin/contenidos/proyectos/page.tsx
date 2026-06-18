'use client'
import { useState, useEffect } from 'react'
import {
  Plus, X, Pencil, Trash2,
  PlayCircle, PauseCircle, CheckCircle2,
  Calendar, TrendingUp, FolderKanban, ChevronDown,
  ClipboardList, CheckCheck, Target, Check,
  Clock, Circle, ArrowRight,
  User, FolderOpen,
} from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { getActividadAssignees } from '@/cmhub/activities'
import type { Proyecto, ProyectoObjetivo } from '@/cmhub/types'

type EstadoP = 'activo' | 'pausado' | 'completado'

const EMPTY: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'> = {
  nombre: '', brandId: '', estado: 'activo', avance: 0,
  descripcion: '', fechaInicio: '', fechaFin: '', responsable: '',
}

const ESTADO_CFG = {
  activo:     { label: 'Activo',     Icon: PlayCircle,   color: '#16a34a', light: '#dcfce7', dark: 'rgba(22,163,74,0.15)'   },
  pausado:    { label: 'Pausado',    Icon: PauseCircle,  color: '#d97706', light: '#fef3c7', dark: 'rgba(217,119,6,0.15)'   },
  completado: { label: 'Completado', Icon: CheckCircle2, color: '#7c3aed', light: '#ede9fe', dark: 'rgba(124,58,237,0.15)'  },
}

const ACT_CFG = {
  pendiente:  { label: 'Pendiente',  Icon: Circle,        color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  en_curso:   { label: 'En curso',   Icon: Clock,         color: '#2563eb', bg: 'rgba(37,99,235,0.1)'    },
  completado: { label: 'Completado', Icon: CheckCircle2,  color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Modal de detalle ────────────────────────────────────────────────────────
function ProyectoModal({
  proyecto, onClose, onEdit,
  isDark, T, actividades, brands, updateProyecto,
}: {
  proyecto: Proyecto
  onClose: () => void
  onEdit: () => void
  isDark: boolean
  T: Record<string, string>
  actividades: ReturnType<typeof useHub>['actividades']
  brands: ReturnType<typeof useHub>['brands']
  updateProyecto: ReturnType<typeof useHub>['updateProyecto']
}) {
  const brand = brands.find(b => b.id === proyecto.brandId)
  const es = ESTADO_CFG[proyecto.estado] ?? ESTADO_CFG.activo
  const EstadoIcon = es.Icon
  const estadoBg = isDark ? es.dark : es.light
  const accentColor = brand?.color ?? '#7c3aed'

  const pActs  = actividades.filter(a => a.proyectoId && String(a.proyectoId).trim() === String(proyecto.id).trim())
  const pDone  = pActs.filter(a => a.status === 'completado').length
  const pCurso = pActs.filter(a => a.status === 'en_curso').length
  const pPend  = pActs.filter(a => a.status === 'pendiente').length
  const actPct = pActs.length ? Math.round(pDone / pActs.length * 100) : 0

  const [localObjGen, setLocalObjGen] = useState(proyecto.objetivoGeneral ?? '')
  const [localObjs, setLocalObjs]     = useState<ProyectoObjetivo[]>(proyecto.objetivos ?? [])
  const [newObj, setNewObj]           = useState('')

  // Sync if project updates from Firestore while modal is open
  useEffect(() => {
    setLocalObjGen(proyecto.objetivoGeneral ?? '')
    setLocalObjs(proyecto.objetivos ?? [])
  }, [proyecto.objetivoGeneral, proyecto.objetivos])

  function saveObjGen() {
    updateProyecto(proyecto.id, { objetivoGeneral: localObjGen.trim() || '' })
  }

  function toggleObj(idx: number) {
    const updated = localObjs.map((o, i) => i === idx ? { ...o, done: !o.done } : o)
    setLocalObjs(updated)
    updateProyecto(proyecto.id, { objetivos: updated })
  }

  function addObj() {
    if (!newObj.trim()) return
    const updated = [...localObjs, { texto: newObj.trim(), done: false }]
    setLocalObjs(updated)
    setNewObj('')
    updateProyecto(proyecto.id, { objetivos: updated })
  }

  function removeObj(idx: number) {
    const updated = localObjs.filter((_, i) => i !== idx)
    setLocalObjs(updated)
    updateProyecto(proyecto.id, { objetivos: updated })
  }

  const doneObjs = localObjs.filter(o => o.done).length
  const objPct   = localObjs.length ? Math.round(doneObjs / localObjs.length * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }} />
      <div
        className="relative w-[600px] h-full flex flex-col overflow-hidden shadow-2xl"
        style={{ background: T.card }}
        onClick={e => e.stopPropagation()}
      >
        {/* color top bar */}
        <div className="h-1.5 shrink-0" style={{ background: accentColor }} />

        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-5 shrink-0"
          style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[14px] font-bold text-white shrink-0"
            style={{ background: accentColor }}>
            {brand?.initials ?? proyecto.nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold leading-tight" style={{ color: T.text }}>{proyecto.nombre}</h2>
            {brand && <p className="text-[12px] mt-0.5" style={{ color: T.sub }}>{brand.name}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: estadoBg, color: es.color }}>
                <EstadoIcon size={9} /> {es.label}
              </span>
              {proyecto.responsable && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: T.muted }}><User size={11} /> {proyecto.responsable}</span>
              )}
              <span className="flex items-center gap-1 text-[11px]" style={{ color: T.muted }}>
                <Calendar size={10} />
                {fmt(proyecto.fechaInicio)}
                {proyecto.fechaFin && <><ArrowRight size={9} className="inline mx-0.5" />{fmt(proyecto.fechaFin)}</>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-xl border transition-all"
              style={{ borderColor: T.border, color: T.sub }}
              onMouseEnter={e => (e.currentTarget.style.background = T.divider)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Pencil size={11} /> Editar
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ color: T.sub }}
              onMouseEnter={e => (e.currentTarget.style.background = T.divider)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: T.divider }}>

          {/* Descripción */}
          {proyecto.descripcion && (
            <div className="px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.muted }}>Descripción</p>
              <p className="text-[13px] leading-relaxed" style={{ color: T.sub }}>{proyecto.descripcion}</p>
            </div>
          )}

          {/* Objetivos */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: T.muted }}>
              <Target size={11} /> Objetivos
            </p>

            {/* Objetivo general */}
            <div className="mb-4">
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: T.sub }}>Objetivo general</label>
              <textarea
                value={localObjGen}
                onChange={e => setLocalObjGen(e.target.value)}
                onBlur={saveObjGen}
                placeholder="Describe el objetivo principal del proyecto…"
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none border resize-none transition-colors"
                style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}
              />
            </div>

            {/* Objetivos específicos */}
            <div>
              <label className="text-[11px] font-medium mb-2 block" style={{ color: T.sub }}>
                Objetivos específicos
                {localObjs.length > 0 && (
                  <span className="ml-2 font-normal" style={{ color: T.muted }}>
                    {doneObjs}/{localObjs.length} completados
                  </span>
                )}
              </label>
              <div className="flex flex-col gap-1.5 mb-3">
                {localObjs.map((o, i) => (
                  <div key={i} className="flex items-center gap-2.5 group px-2 py-1 rounded-lg transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = T.divider)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <button onClick={() => toggleObj(i)}
                      className="shrink-0 rounded border-2 flex items-center justify-center transition-all"
                      style={{
                        width: 18, height: 18,
                        borderColor: o.done ? '#16a34a' : T.inputBorder,
                        background: o.done ? '#16a34a' : 'transparent',
                      }}>
                      {o.done && <Check size={10} color="white" strokeWidth={3} />}
                    </button>
                    <span className="flex-1 text-[13px]" style={{
                      color: o.done ? T.muted : T.text,
                      textDecoration: o.done ? 'line-through' : 'none',
                    }}>
                      {o.texto}
                    </span>
                    <button onClick={() => removeObj(i)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center transition-all"
                      style={{ color: T.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newObj}
                  onChange={e => setNewObj(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObj() } }}
                  placeholder="Agregar objetivo específico…"
                  className="flex-1 text-[12px] px-3 py-2 rounded-xl border outline-none transition-colors"
                  style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}
                />
                <button onClick={addObj}
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#7c3aed] text-white transition-all hover:bg-[#6d28d9] shrink-0"
                  style={{ opacity: newObj.trim() ? 1 : 0.4, cursor: newObj.trim() ? 'pointer' : 'not-allowed' }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Progreso */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: T.muted }}>
              <TrendingUp size={11} /> Progreso
            </p>

            {pActs.length > 0 && (
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[12px]" style={{ color: T.sub }}>Avance por actividades</span>
                  <span className="text-[13px] font-bold" style={{ color: '#16a34a' }}>{actPct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: T.divider }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${actPct}%`, background: '#22c55e' }} />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {pDone > 0  && <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#16a34a' }}><CheckCheck size={11}/>{pDone} completadas</span>}
                  {pCurso > 0 && <span className="text-[11px] font-medium" style={{ color: '#2563eb' }}>· {pCurso} en curso</span>}
                  {pPend > 0  && <span className="text-[11px]" style={{ color: T.muted }}>· {pPend} pendiente{pPend !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            )}

            {localObjs.length > 0 && (
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[12px]" style={{ color: T.sub }}>Objetivos completados</span>
                  <span className="text-[13px] font-bold" style={{ color: '#7c3aed' }}>{objPct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: T.divider }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${objPct}%`, background: '#7c3aed' }} />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[12px]" style={{ color: T.sub }}>Avance general (manual)</span>
                <span className="text-[13px] font-bold" style={{ color: accentColor }}>{proyecto.avance}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: T.divider }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${proyecto.avance}%`, background: accentColor }} />
              </div>
            </div>
          </div>

          {/* Actividades vinculadas */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: T.muted }}>
              <ClipboardList size={11} /> Actividades vinculadas
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: T.divider, color: T.sub }}>{pActs.length}</span>
            </p>
            {pActs.length === 0 ? (
              <p className="text-[12px] italic" style={{ color: T.muted }}>
                Sin actividades vinculadas. Vincúlalas desde la sección Actividades.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {pActs.map(a => {
                  const cfg = ACT_CFG[a.status as keyof typeof ACT_CFG] ?? ACT_CFG.pendiente
                  const AIcon = cfg.Icon
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${T.divider}` }}>
                      <AIcon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                      <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: T.text }}>{a.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      {(() => {
                        const names = getActividadAssignees(a)
                        if (names.length === 0) return null
                        const label = names.length === 1 ? names[0].split(' ')[0] : `${names.length} personas`
                        return (
                          <span className="text-[11px] shrink-0" style={{ color: T.muted }}>
                            {label}
                          </span>
                        )
                      })()}
                      {a.dueDate && (
                        <span className="text-[10px] shrink-0" style={{ color: T.muted }}>{fmt(a.dueDate)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
export default function ProyectosPage() {
  const { isDark } = useHubTheme()
  const { proyectos, addProyecto, updateProyecto, deleteProyecto, brands, team, actividades } = useHub()
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [form,         setForm]         = useState(EMPTY)
  const [filterEstado, setFilterEstado] = useState<EstadoP | 'all'>('all')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)

  const T = isDark ? {
    page: '#0d0f12', card: '#161820', border: 'rgba(255,255,255,0.07)',
    text: '#f1f5f9', sub: '#94a3b8', muted: '#64748b',
    input: '#1e2028', inputBorder: 'rgba(255,255,255,0.12)',
    divider: 'rgba(255,255,255,0.05)',
  } : {
    page: '#f8fafc', card: '#ffffff', border: '#e5e7eb',
    text: '#111827', sub: '#6b7280', muted: '#9ca3af',
    input: '#f9fafb', inputBorder: '#e5e7eb',
    divider: '#f3f4f6',
  }

  const inputCls = 'w-full rounded-xl px-3 py-2.5 text-[13px] outline-none border transition-colors'

  const selected = selectedId ? proyectos.find(p => p.id === selectedId) ?? null : null

  function abrir(id?: string) {
    if (id) {
      const p = proyectos.find(x => x.id === id)
      if (!p) return
      setEditId(id)
      setForm({
        nombre: p.nombre, brandId: p.brandId, estado: p.estado,
        avance: p.avance, descripcion: p.descripcion ?? '',
        fechaInicio: p.fechaInicio, fechaFin: p.fechaFin ?? '', responsable: p.responsable,
      })
    } else {
      setEditId(null)
      setForm(EMPTY)
    }
    setShowForm(true)
    setSelectedId(null)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (editId) updateProyecto(editId, { ...form })
    else await addProyecto({ ...form })
    setShowForm(false)
  }

  const counts = {
    total:      proyectos.length,
    activo:     proyectos.filter(p => p.estado === 'activo').length,
    pausado:    proyectos.filter(p => p.estado === 'pausado').length,
    completado: proyectos.filter(p => p.estado === 'completado').length,
  }

  const visible = filterEstado === 'all' ? proyectos : proyectos.filter(p => p.estado === filterEstado)

  return (
    <div className="flex h-full overflow-hidden" style={{ background: T.page }}>

      {/* Modal detalle */}
      {selected && (
        <ProyectoModal
          proyecto={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => abrir(selected.id)}
          isDark={isDark}
          T={T}
          actividades={actividades}
          brands={brands}
          updateProyecto={updateProyecto}
        />
      )}

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 h-14 flex items-center gap-3 shrink-0"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: T.sub }}>Producción</span>
            <span style={{ color: T.border }}>›</span>
            <span className="text-[13px] font-semibold" style={{ color: T.text }}>Proyectos</span>
          </div>
          <button onClick={() => abrir()}
            className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={14} /> Nuevo proyecto
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {([
              { key: 'all',        label: 'Total',       val: counts.total,      color: T.text,    bg: T.card,  icon: FolderKanban },
              { key: 'activo',     label: 'Activos',     val: counts.activo,     color: '#16a34a', bg: isDark ? 'rgba(22,163,74,0.08)'  : '#f0fdf4', icon: PlayCircle   },
              { key: 'pausado',    label: 'Pausados',    val: counts.pausado,    color: '#d97706', bg: isDark ? 'rgba(217,119,6,0.08)'  : '#fffbeb', icon: PauseCircle  },
              { key: 'completado', label: 'Completados', val: counts.completado, color: '#7c3aed', bg: isDark ? 'rgba(124,58,237,0.08)' : '#faf5ff', icon: CheckCircle2 },
            ] as const).map(s => {
              const Icon = s.icon
              const active = filterEstado === s.key
              return (
                <button key={s.key}
                  onClick={() => setFilterEstado(active ? 'all' : s.key as typeof filterEstado)}
                  className="flex items-center gap-3 p-4 rounded-2xl border transition-all text-left"
                  style={{
                    background: active ? s.bg : T.card,
                    borderColor: active ? s.color + '60' : T.border,
                    boxShadow: active ? `0 0 0 1px ${s.color}30` : 'none',
                  }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: s.bg, color: s.color }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-[22px] font-bold leading-none" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: T.sub }}>{s.label}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Lista de proyectos */}
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border"
              style={{ background: T.card, borderColor: T.border }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center "
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}><FolderOpen size={28} /></div>
              <p className="text-[14px] font-semibold" style={{ color: T.text }}>Sin proyectos</p>
              <p className="text-[12px]" style={{ color: T.sub }}>Crea el primer proyecto del equipo</p>
              <button onClick={() => abrir()}
                className="mt-1 flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors">
                <Plus size={13} /> Nuevo proyecto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {visible.map(p => {
                const brand = brands.find(b => b.id === p.brandId)
                const es = ESTADO_CFG[p.estado] ?? ESTADO_CFG.activo
                const EstadoIcon = es.Icon
                const accentColor = brand?.color ?? '#7c3aed'
                const estadoBg = isDark ? es.dark : es.light

                const pActs  = actividades.filter(a => a.proyectoId && String(a.proyectoId).trim() === String(p.id).trim())
                const pDone  = pActs.filter(a => a.status === 'completado').length
                const actPct = pActs.length ? Math.round(pDone / pActs.length * 100) : null

                // Avance general: derivado de actividades si existen, manual si no
                const displayAvance = pActs.length > 0 ? actPct! : p.avance
                const displayColor  = pActs.length > 0 ? '#22c55e' : accentColor

                const pCurso = pActs.filter(a => a.status === 'en_curso').length
                const pPend  = pActs.filter(a => a.status === 'pendiente').length

                return (
                  <div key={p.id}
                    className="rounded-2xl border overflow-hidden transition-all group hover:shadow-md cursor-pointer"
                    style={{ background: T.card, borderColor: T.border }}
                    onClick={() => setSelectedId(p.id)}>

                    <div className="h-1" style={{ background: accentColor }} />

                    <div className="p-5">
                      {/* Cabecera */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                          style={{ background: accentColor }}>
                          {brand?.initials ?? p.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold truncate leading-tight" style={{ color: T.text }}>{p.nombre}</p>
                          {brand && <p className="text-[12px] mt-0.5" style={{ color: T.sub }}>{brand.name}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
                            style={{ background: estadoBg, color: es.color }}>
                            <EstadoIcon size={9} /> {es.label}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); abrir(p.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                            style={{ color: T.muted }}
                            onMouseEnter={e => (e.currentTarget.style.background = T.divider)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar proyecto?')) deleteProyecto(p.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                            style={{ color: T.muted }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.muted }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {p.descripcion && (
                        <p className="text-[12px] mb-4 line-clamp-2" style={{ color: T.sub }}>{p.descripcion}</p>
                      )}

                      {/* Avance general */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: T.muted }}>
                            <TrendingUp size={10} />
                            Avance general
                            {pActs.length > 0 && <span className="font-normal italic">(por actividades)</span>}
                          </span>
                          <span className="text-[12px] font-bold" style={{ color: displayColor }}>{displayAvance}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.divider }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${displayAvance}%`, background: displayColor }} />
                        </div>
                      </div>

                      {/* Actividades vinculadas */}
                      {pActs.length > 0 ? (
                        <div className="rounded-xl p-3 mb-3"
                          style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${T.divider}` }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                              style={{ color: T.muted }}>
                              <ClipboardList size={9} /> Actividades
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: '#16a34a' }}>{actPct}%</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {pDone > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: '#16a34a' }}>
                                <CheckCheck size={10} /> {pDone} listas
                              </span>
                            )}
                            {pCurso > 0 && (
                              <span className="text-[10px] font-semibold" style={{ color: '#2563eb' }}>· {pCurso} en curso</span>
                            )}
                            {pPend > 0 && (
                              <span className="text-[10px]" style={{ color: T.muted }}>· {pPend} pendiente{pPend !== 1 ? 's' : ''}</span>
                            )}
                            <span className="ml-auto text-[10px] font-medium" style={{ color: T.muted }}>{pActs.length} total</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                          style={{ border: `1px dashed ${T.divider}` }}>
                          <ClipboardList size={11} style={{ color: T.muted }} />
                          <span className="text-[11px] italic" style={{ color: T.muted }}>Sin actividades vinculadas</span>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 pt-3" style={{ borderTop: `1px solid ${T.divider}` }}>
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: T.sub }}>
                          <Calendar size={10} />
                          {fmt(p.fechaInicio)}
                          {p.fechaFin && <> → {fmt(p.fechaFin)}</>}
                        </span>
                        {p.responsable && (
                          <span className="ml-auto text-[11px] flex items-center gap-1" style={{ color: T.sub }}><User size={11} /> {p.responsable}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel formulario ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="w-80 shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: `1px solid ${T.border}`, background: T.card }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: `1px solid ${T.border}` }}>
            <p className="text-[14px] font-bold" style={{ color: T.text }}>
              {editId ? 'Editar proyecto' : 'Nuevo proyecto'}
            </p>
            <button onClick={() => setShowForm(false)}
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ color: T.sub }}><X size={14} /></button>
          </div>

          <form onSubmit={guardar} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>NOMBRE *</label>
              <input required placeholder="Nombre del proyecto"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className={inputCls}
                style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>CLIENTE *</label>
              <div className="relative">
                <select required value={form.brandId} onChange={e => setForm({ ...form, brandId: e.target.value })}
                  className={inputCls + ' appearance-none pr-8'}
                  style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                  <option value="">Seleccionar cliente…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.sub }} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>DESCRIPCIÓN</label>
              <textarea placeholder="Descripción opcional…" rows={3}
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className={inputCls + ' resize-none'}
                style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>ESTADO</label>
                <div className="relative">
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as EstadoP })}
                    className={inputCls + ' appearance-none pr-8'}
                    style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="completado">Completado</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.sub }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>AVANCE % (manual)</label>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
                  style={{ background: T.input, borderColor: T.inputBorder }}>
                  <input type="range" min={0} max={100} value={form.avance}
                    onChange={e => setForm({ ...form, avance: Number(e.target.value) })}
                    className="flex-1 accent-[#7c3aed]" />
                  <span className="text-[12px] font-bold w-8 text-right" style={{ color: '#7c3aed' }}>{form.avance}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>INICIO</label>
                <input type="date" value={form.fechaInicio}
                  onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
                  className={inputCls}
                  style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>FIN</label>
                <input type="date" value={form.fechaFin}
                  onChange={e => setForm({ ...form, fechaFin: e.target.value })}
                  className={inputCls}
                  style={{ background: T.input, color: T.text, borderColor: T.inputBorder }} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: T.sub }}>RESPONSABLE</label>
              <div className="relative">
                <select value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })}
                  className={inputCls + ' appearance-none pr-8'}
                  style={{ background: T.input, color: T.text, borderColor: T.inputBorder }}>
                  <option value="">Sin asignar</option>
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
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.sub }} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-[13px] font-medium rounded-xl border transition-colors"
                style={{ borderColor: T.border, color: T.sub }}>
                Cancelar
              </button>
              <button type="submit"
                className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] rounded-xl transition-colors">
                {editId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
