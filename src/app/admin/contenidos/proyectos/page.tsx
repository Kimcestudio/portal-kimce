'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AvatarGroup } from '@/components/cmhub/projects/Avatar'
import { useRouter } from 'next/navigation'
import {
  Plus, ArrowRight, FolderOpen, X,
  MoreHorizontal, Archive, RotateCcw, ChevronRight, Trash2,
  AlertTriangle, ShieldAlert, Clock, CheckCircle2, ChevronDown,
  ArrowUpDown, Calendar, TrendingUp, LayoutList, LayoutGrid,
} from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { useAuth } from '@/components/auth/AuthProvider'
import { projectTasks, projectProgress, today, validDate } from '@/cmhub/projects/domain'
import '@/components/cmhub/projects/projects.css'
import type { Proyecto } from '@/cmhub/types'

const TIPO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  campaña:            { label: 'Campaña',       color: '#7c3aed', bg: '#f5f3ff' },
  lanzamiento:        { label: 'Lanzamiento',    color: '#ea580c', bg: '#fff7ed' },
  estrategia:         { label: 'Estrategia',     color: '#2563eb', bg: '#eff6ff' },
  web:                { label: 'Web',            color: '#0891b2', bg: '#ecfeff' },
  contenido_especial: { label: 'Cont. especial', color: '#db2777', bg: '#fdf2f8' },
  interno:            { label: 'Interno',        color: '#64748b', bg: '#f8fafc' },
  propuesta:          { label: 'Propuesta',      color: '#16a34a', bg: '#f0fdf4' },
}

const ESTADOS: Array<[Proyecto['estado'], string]> = [
  ['activo', 'Activo'],
  ['pausado', 'Pausado'],
  ['completado', 'Completado'],
  ['prospecto', 'Próximamente'],
]

const STATE_FILTERS: Array<[string, string]> = [
  ['activo',    'Activos'],
  ['prospecto', 'Próximos'],
  ['pausado',   'Pausados'],
  ['completado','Completados'],
  ['all',       'Todos'],
  ['archivado', 'Archivados'],
]

type CtxState = { pid: string; x: number; y: number; subOpen: boolean }
type SortKey  = 'deadline' | 'name' | 'progress'

function closeMenu(set: (v: CtxState | null) => void) { set(null) }

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function formatRelDate(iso: string): { label: string; color: string } {
  const d = Math.ceil((Date.parse(iso) - Date.now()) / 86400000)
  const dt = new Date(iso + 'T12:00:00')
  const abs = `${dt.getDate()} ${MONTHS[dt.getMonth()]}`
  if (d < 0)   return { label: `${abs} (vencida)`, color: '#b91c1c' }
  if (d === 0) return { label: 'vence hoy',          color: '#b45309' }
  if (d <= 3)  return { label: `en ${d}d`,            color: '#b45309' }
  if (d <= 7)  return { label: `en ${d}d`,            color: '#7c3aed' }
  return { label: abs, color: 'var(--pw-muted)' }
}

export default function ProyectosPage() {
  const { isDark } = useHubTheme()
  const {
    proyectos, archivedProyectos, projectActivities: actividades, brands, team,
    loadingProyectos, proyectosError,
    addProyecto, updateProyecto, deleteProyecto,
  } = useHub()
  const { profile, authUser } = useAuth()
  const base = useHubBase()
  const router = useRouter()
  const admin = profile?.role?.toLowerCase() === 'admin'

  const [search,  setSearch]  = useState('')
  const [state,   setState]   = useState('activo')
  const [brand,   setBrand]   = useState('')
  const [mine,    setMine]    = useState(!admin)
  const [sortBy,    setSortBy]    = useState<SortKey>('deadline')
  const [showSort,  setShowSort]  = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [viewMode,  setViewMode]  = useState<'lista' | 'tarjetas'>('lista')

  const [show, setShow] = useState(false)
  const [showBrandId, setShowBrandId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: '', brandId: '', descripcion: '',
    fechaInicio: today(), fechaFin: '',
    ownerIds: [] as string[], tipo: '' as string, criterioExito: '',
  })

  const [ctx, setCtx] = useState<CtxState | null>(null)
  const [actionError, setActionError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const rows = useMemo(() => {
    const pool = state === 'archivado' ? archivedProyectos : proyectos
    return pool
      .map(p => {
        const tasks = projectTasks(p, actividades)
        const leaves = tasks.filter(t => !t.isGroup)
        const remaining = leaves.filter(t => t.estado !== 'completado')
        const next = remaining
          .filter(t => t.fechaFin)
          .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin))[0]
        return {
          p, tasks, next,
          progress: projectProgress(tasks),
          overdue: remaining.filter(t => t.fechaFin && t.fechaFin < today()).length,
          blocked: remaining.filter(t => t.blockedReason).length,
        }
      })
      .filter(({ p, tasks }) =>
        (state !== 'archivado' && state !== 'all' ? p.estado === state : true) &&
        (!brand || p.brandId === brand) &&
        (!search || `${p.nombre} ${brands.find(b => b.id === p.brandId)?.name ?? ''}`
          .toLowerCase().includes(search.toLowerCase())) &&
        (!mine ||
          p.ownerIds?.includes(authUser?.uid ?? '') ||
          p.responsables?.includes(profile?.displayName ?? '') ||
          p.responsable === profile?.displayName ||
          tasks.some(t =>
            t.assigneeIds?.includes(authUser?.uid ?? '') ||
            t.responsable === profile?.displayName
          ))
      )
      .sort((a, b) => {
        if (sortBy === 'name')     return a.p.nombre.localeCompare(b.p.nombre)
        if (sortBy === 'progress') return b.progress - a.progress
        return b.overdue - a.overdue ||
          (a.next?.fechaFin ?? '9999').localeCompare(b.next?.fechaFin ?? '9999')
      })
  }, [proyectos, archivedProyectos, actividades, state, brand, search, mine, sortBy, authUser?.uid, profile?.displayName, brands])

  const kpi = useMemo(() => ({
    total:    rows.length,
    overdue:  rows.filter(r => r.overdue > 0).length,
    blocked:  rows.filter(r => r.blocked > 0 && r.overdue === 0).length,
    thisWeek: rows.filter(r => {
      if (!r.next?.fechaFin) return false
      const d = Math.ceil((Date.parse(r.next.fechaFin) - Date.now()) / 86400000)
      return d >= 0 && d <= 7
    }).length,
  }), [rows])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>()
    rows.forEach(row => {
      if (!map.has(row.p.brandId)) map.set(row.p.brandId, [])
      map.get(row.p.brandId)!.push(row)
    })
    return [...map.entries()].map(([brandId, items]) => ({
      brand: brands.find(b => b.id === brandId),
      items,
      totalOverdue: items.reduce((s, r) => s + r.overdue, 0),
      totalBlocked: items.reduce((s, r) => s + r.blocked, 0),
    }))
  }, [rows, brands])

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openCtx(e: React.MouseEvent, pid: string) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCtx({ pid, x: rect.right, y: rect.bottom, subOpen: false })
  }

  async function handleStatus(p: Proyecto, estado: Proyecto['estado']) {
    closeMenu(setCtx)
    try { await updateProyecto(p.id, { estado }) }
    catch { setActionError('No se pudo cambiar el estado.') }
  }

  async function handleArchive(p: Proyecto) {
    closeMenu(setCtx)
    try { await updateProyecto(p.id, { archived: !p.archived }) }
    catch { setActionError('No se pudo archivar el proyecto.') }
  }

  async function handleDelete(id: string) {
    setDeleteConfirm(null)
    try { await deleteProyecto(id) }
    catch { setActionError('No se pudo eliminar el proyecto.') }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.brandId) return
    if (
      !validDate(form.fechaInicio) ||
      (form.fechaFin && (!validDate(form.fechaFin) || form.fechaFin < form.fechaInicio))
    ) {
      setError('Revisa las fechas del proyecto.')
      return
    }
    setBusy(true); setError('')
    try {
      const names = team.filter(m => form.ownerIds.includes(m.id)).map(m => m.name)
      const { tipo: _t, criterioExito: _c, ...formBase } = form
      const p = await addProyecto({
        ...formBase,
        nombre: form.nombre.trim(),
        responsable: names[0] ?? '',
        responsables: names,
        estado: 'activo',
        avance: 0,
        tasksMigrated: true,
        ...(form.tipo ? { tipo: form.tipo as Proyecto['tipo'] } : {}),
        ...(form.criterioExito.trim() ? { criterioExito: form.criterioExito.trim() } : {}),
      })
      router.push(`${base}/proyectos/${p.id}`)
    } catch {
      setError('No se pudo crear el proyecto.')
    } finally {
      setBusy(false)
    }
  }

  function daysUntil(date: string) {
    const diff = Date.parse(date) - Date.now()
    return isNaN(diff) ? null : Math.ceil(diff / 86400000)
  }

  const ctxProject = ctx ? [...proyectos, ...archivedProyectos].find(p => p.id === ctx.pid) : null

  function openForm(brandId?: string) {
    setForm(f => ({ ...f, brandId: brandId ?? '' }))
    setShow(true)
  }
  function dismissForm() { setShow(false); setError(''); setShowBrandId('') }

  const SORT_LABELS: Record<SortKey, string> = {
    deadline: 'Vencimiento',
    name:     'Nombre',
    progress: 'Progreso',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{
      background: isDark
        ? 'linear-gradient(160deg, #0f111a 0%, #111422 60%, #12102a 100%)'
        : 'linear-gradient(160deg, #f8fafc 0%, #f0f4ff 60%, #f5f3ff 100%)',
    }}>

      {/* ── Glass header ─────────────────────────────── */}
      <div className="px-6 flex items-center gap-3 shrink-0" style={{
        height: 52,
        background: isDark ? 'rgba(13,15,18,0.97)' : 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        boxShadow: isDark ? 'none' : '0 1px 0 rgba(255,255,255,1), 0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, letterSpacing: '-.015em' }}>Proyectos</span>
        {(proyectosError || actionError) && (
          <span style={{ fontSize: 12, color: '#b91c1c', flex: 1 }}>{proyectosError || actionError}</span>
        )}
        {admin && (
          <button onClick={() => openForm()} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: 'white', border: 'none', borderRadius: 10,
            padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(109,40,217,0.3)',
          }}>
            <Plus size={14} /> Nuevo proyecto
          </button>
        )}
      </div>

      {/* ── Scrollable content ───────────────────────── */}
      <main
        className="project-work pw-shell" data-dark={isDark}
        style={{ flex: 1, height: 0, overflowY: 'auto', paddingTop: 16 }}
      >

        {/* KPI strip — only when there's data */}
        {!loadingProyectos && rows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            <div className="pw-kpi-card" data-v="violet" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className="pw-kpi-icon pw-kpi-violet" style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <FolderOpen size={14} />
                </div>
                <span className="pw-kpi-label" style={{ marginBottom: 0 }}>Proyectos</span>
              </div>
              <div className="pw-kpi-value" style={{ fontSize: 22 }}>{kpi.total}</div>
            </div>

            <div className="pw-kpi-card" data-v={kpi.overdue > 0 ? 'red' : 'green'} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className={`pw-kpi-icon ${kpi.overdue > 0 ? 'pw-kpi-red' : 'pw-kpi-green'}`} style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <AlertTriangle size={14} />
                </div>
                <span className="pw-kpi-label" style={{ marginBottom: 0 }}>Vencidas</span>
              </div>
              <div className="pw-kpi-value" style={{ fontSize: 22 }}>{kpi.overdue}</div>
            </div>

            <div className="pw-kpi-card" data-v={kpi.thisWeek > 0 ? 'amber' : 'teal'} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className={`pw-kpi-icon ${kpi.thisWeek > 0 ? 'pw-kpi-amber' : 'pw-kpi-teal'}`} style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <Calendar size={14} />
                </div>
                <span className="pw-kpi-label" style={{ marginBottom: 0 }}>Esta semana</span>
              </div>
              <div className="pw-kpi-value" style={{ fontSize: 22 }}>{kpi.thisWeek}</div>
            </div>

            <div className="pw-kpi-card" data-v={kpi.blocked > 0 ? 'amber' : 'blue'} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className={`pw-kpi-icon ${kpi.blocked > 0 ? 'pw-kpi-amber' : 'pw-kpi-blue'}`} style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <ShieldAlert size={14} />
                </div>
                <span className="pw-kpi-label" style={{ marginBottom: 0 }}>Bloqueados</span>
              </div>
              <div className="pw-kpi-value" style={{ fontSize: 22 }}>{kpi.blocked}</div>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {/* Search */}
          <input
            type="search" aria-label="Buscar proyectos"
            placeholder="Buscar proyecto o cliente…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 320 }}
          />

          {/* Mine/All toggle */}
          <div className="pw-segment" style={{ flexShrink: 0 }}>
            <button aria-pressed={mine}  onClick={() => setMine(true)}>Míos</button>
            <button aria-pressed={!mine} onClick={() => setMine(false)}>Todos</button>
          </div>

          {/* Brand filter */}
          <select
            aria-label="Cliente" value={brand} onChange={e => setBrand(e.target.value)}
            style={{ flexShrink: 0, maxWidth: 180 }}
          >
            <option value="">Todos los clientes</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, flexShrink: 0 }}>
            <button onClick={() => setViewMode('lista')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', cursor: 'pointer', background: viewMode === 'lista' ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(109,40,217,0.1)') : 'transparent', color: viewMode === 'lista' ? '#7c3aed' : 'var(--pw-muted)', transition: 'background 0.12s' }}>
              <LayoutList size={15} />
            </button>
            <button onClick={() => setViewMode('tarjetas')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', cursor: 'pointer', background: viewMode === 'tarjetas' ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(109,40,217,0.1)') : 'transparent', color: viewMode === 'tarjetas' ? '#7c3aed' : 'var(--pw-muted)', transition: 'background 0.12s' }}>
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* Sort control */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="pw-button"
              onClick={() => setShowSort(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12, minHeight: 40 }}
            >
              <ArrowUpDown size={13} />
              {SORT_LABELS[sortBy]}
            </button>
            {showSort && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowSort(false)} />
                <div className="pw-ctx-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 51, minWidth: 160 }}>
                  {(['deadline', 'name', 'progress'] as SortKey[]).map(k => (
                    <button key={k} onClick={() => { setSortBy(k); setShowSort(false) }}
                      style={sortBy === k ? { fontWeight: 700, color: 'var(--pw-accent)' } : {}}>
                      {k === 'deadline' && <Calendar size={14} />}
                      {k === 'name'     && <TrendingUp size={14} />}
                      {k === 'progress' && <TrendingUp size={14} />}
                      {SORT_LABELS[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* State filter pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {STATE_FILTERS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setState(v)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: state === v
                  ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                color: state === v ? 'white' : 'var(--pw-muted)',
                transition: 'background 0.12s, color 0.12s',
                boxShadow: state === v ? '0 2px 8px rgba(109,40,217,0.25)' : 'none',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {loadingProyectos ? (
          <div className="pw-empty" role="status">Cargando proyectos…</div>
        ) : !rows.length ? (
          <div className="pw-empty">
            <FolderOpen size={30} style={{ margin: '0 auto 12px' }} />
            <h2>No hay proyectos en esta vista</h2>
            <p>Prueba otros filtros o crea un proyecto nuevo.</p>
            <button className="pw-button" onClick={() => { setState('all'); setMine(false); setSearch(''); setBrand('') }}>
              Ver todos los proyectos
            </button>
          </div>
        ) : viewMode === 'tarjetas' ? (
          /* ── CARD GRID VIEW (inspired by references) ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {grouped.map(({ brand, items, totalOverdue, totalBlocked }) => {
              const gid = brand?.id ?? 'none'
              const isCollapsed = collapsed.has(gid)
              const brandColor = brand?.color ?? '#7c3aed'
              return (
                <div key={gid}>
                  {/* Brand header */}
                  <div onClick={() => toggleCollapse(gid)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 12px', cursor: 'pointer', userSelect: 'none' }}>
                    <ChevronDown size={14} style={{ color: 'var(--pw-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: brandColor, boxShadow: `0 0 0 2px color-mix(in srgb, ${brandColor} 20%, transparent)` }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{brand?.name ?? 'Sin cliente'}</span>
                    <span className="pw-muted" style={{ fontSize: 12 }}>· {items.length} proyecto{items.length !== 1 ? 's' : ''}</span>
                    {totalOverdue > 0 && <span className="pw-chip pw-chip-red" style={{ gap: 3, padding: '2px 7px' }}><AlertTriangle size={10} />{totalOverdue} vencida{totalOverdue !== 1 ? 's' : ''}</span>}
                    {totalBlocked > 0 && <span className="pw-chip pw-chip-amber" style={{ gap: 3, padding: '2px 7px' }}><ShieldAlert size={10} />{totalBlocked} bloqueada{totalBlocked !== 1 ? 's' : ''}</span>}
                    {admin && <button onClick={e => { e.stopPropagation(); openForm(brand?.id) }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pw-muted)', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6 }}><Plus size={12} /> Agregar</button>}
                  </div>

                  {/* Card grid */}
                  {!isCollapsed && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
                      {items.map(({ p, tasks, next, overdue, blocked, progress }) => {
                        const leaves = tasks.filter(t => !t.isGroup)
                        const completedCount = leaves.filter(t => t.estado === 'completado').length
                        const d = p.fechaFin ? daysUntil(p.fechaFin) : null

                        // Priority strip (ref 4 pattern)
                        const priority = overdue > 0
                          ? { label: 'VENCIDO',   strip: '#ef4444', bg: isDark ? 'rgba(127,29,29,0.3)'  : '#fff5f5', textColor: '#ef4444' }
                          : blocked > 0
                          ? { label: 'BLOQUEADO', strip: '#f59e0b', bg: isDark ? 'rgba(120,53,15,0.25)' : '#fffbeb', textColor: '#b45309' }
                          : d !== null && d <= 7 && d >= 0 && p.estado === 'activo'
                          ? { label: 'EN RIESGO', strip: '#7c3aed', bg: isDark ? 'rgba(109,40,217,0.15)': '#f5f3ff', textColor: '#7c3aed' }
                          : p.estado === 'completado'
                          ? { label: 'COMPLETADO',strip: '#22c55e', bg: isDark ? 'rgba(21,128,61,0.15)' : '#f0fdf4', textColor: '#16a34a' }
                          : p.estado === 'pausado'
                          ? { label: 'PAUSADO',   strip: '#94a3b8', bg: isDark ? 'rgba(100,116,139,0.15)':'#f8fafc',  textColor: '#64748b' }
                          : { label: 'AL DÍA',    strip: brandColor,bg: isDark ? `color-mix(in srgb, ${brandColor} 15%, #161820)` : `color-mix(in srgb, ${brandColor} 7%, white)`, textColor: brandColor }

                        return (
                          <div key={p.id} style={{
                            borderRadius: 18, overflow: 'hidden',
                            background: priority.bg,
                            border: `1px solid color-mix(in srgb, ${priority.strip} 25%, ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'})`,
                            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
                            display: 'flex', flexDirection: 'column',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)' }}
                          >
                            {/* Priority strip top bar */}
                            <div style={{ height: 4, background: priority.strip, flexShrink: 0 }} />

                            {/* Card body */}
                            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>

                              {/* Top row: brand + priority label + date */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: brandColor, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {brand?.name ?? 'Sin cliente'}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: priority.textColor, letterSpacing: '.04em', flexShrink: 0 }}>
                                  {priority.label}
                                </span>
                              </div>

                              {/* Project name */}
                              <div>
                                <Link href={`${base}/proyectos/${p.id}`} style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-.01em', lineHeight: 1.3, display: 'block', textDecoration: 'none', color: 'inherit' }}>
                                  {p.nombre}
                                </Link>
                                {p.tipo && TIPO_CFG[p.tipo] && (
                                  <span style={{ marginTop: 5, display: 'inline-flex', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: TIPO_CFG[p.tipo].bg, color: TIPO_CFG[p.tipo].color }}>
                                    {TIPO_CFG[p.tipo].label}
                                  </span>
                                )}
                              </div>

                              {/* Progress */}
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                  <span style={{ fontSize: 11, color: 'var(--pw-muted)', fontWeight: 600 }}>Avance</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: priority.strip }}>{progress}%</span>
                                </div>
                                <div style={{ height: 6, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 4, width: `${progress}%`, background: `linear-gradient(90deg, ${priority.strip}, color-mix(in srgb, ${priority.strip} 70%, white))`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                                </div>
                              </div>

                              {/* Next delivery */}
                              {next ? (() => {
                                const rel = formatRelDate(next.fechaFin)
                                return (
                                  <div style={{ padding: '8px 10px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderLeft: `3px solid ${priority.strip}` }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 2 }}>Próx. entrega</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.nombre}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: rel.color, fontVariantNumeric: 'tabular-nums' }}>{rel.label}</span>
                                  </div>
                                )
                              })() : (
                                <div style={{ padding: '8px 10px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                  <span style={{ fontSize: 11, color: 'var(--pw-muted)', fontStyle: 'italic' }}>Sin entregas pendientes</span>
                                </div>
                              )}

                              {/* Footer: avatars + task count + CTA */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                                <AvatarGroup team={team} ids={p.ownerIds} names={p.responsables ?? [p.responsable]} />
                                {leaves.length > 0 && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <CheckCircle2 size={11} /> {completedCount}/{leaves.length}
                                  </span>
                                )}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                                  {admin && (
                                    <button className="pw-button pw-icon" style={{ width: 32, height: 32, minHeight: 32, borderRadius: 8 }} onClick={e => openCtx(e, p.id)}>
                                      <MoreHorizontal size={14} />
                                    </button>
                                  )}
                                  <Link href={`${base}/proyectos/${p.id}`} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '6px 14px', borderRadius: 20, textDecoration: 'none',
                                    background: isDark ? 'rgba(255,255,255,0.12)' : '#1a1a2e',
                                    color: 'white', fontSize: 12, fontWeight: 700,
                                  }}>
                                    Abrir <ArrowRight size={12} />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {grouped.map(({ brand, items, totalOverdue, totalBlocked }) => {
              const gid = brand?.id ?? 'none'
              const isCollapsed = collapsed.has(gid)
              return (
                <div key={gid}>
                  {/* ── Brand group header ── */}
                  <div
                    onClick={() => toggleCollapse(gid)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 10px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <ChevronDown size={14} style={{ color: 'var(--pw-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: brand?.color ?? '#7c3aed', boxShadow: `0 0 0 2px color-mix(in srgb, ${brand?.color ?? '#7c3aed'} 20%, transparent)` }} />
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.01em' }}>{brand?.name ?? 'Sin cliente'}</span>
                    <span className="pw-muted" style={{ fontSize: 12 }}>· {items.length} proyecto{items.length !== 1 ? 's' : ''}</span>
                    {totalOverdue > 0 && <span className="pw-chip pw-chip-red" style={{ gap: 3, padding: '2px 7px' }}><AlertTriangle size={10} />{totalOverdue} vencida{totalOverdue !== 1 ? 's' : ''}</span>}
                    {totalBlocked > 0 && <span className="pw-chip pw-chip-amber" style={{ gap: 3, padding: '2px 7px' }}><ShieldAlert size={10} />{totalBlocked} bloqueada{totalBlocked !== 1 ? 's' : ''}</span>}
                    {admin && <button onClick={e => { e.stopPropagation(); openForm(brand?.id) }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pw-muted)', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6 }}><Plus size={12} /> Agregar</button>}
                  </div>

                  {/* ── Projects list ── */}
                  {!isCollapsed && (
                    <div className="pw-list">
                      {items.map(({ p, tasks, next, overdue, blocked, progress }) => {
                        const brandColor = brand?.color ?? '#7c3aed'
                        const leaves = tasks.filter(t => !t.isGroup)
                        const completedCount = leaves.filter(t => t.estado === 'completado').length
                        const d = p.fechaFin ? daysUntil(p.fechaFin) : null
                        const nearDeadline = d !== null && d >= 0 && d <= 7 && p.estado === 'activo'

                        const health = overdue > 0
                          ? { color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', label: 'Vencido' }
                          : blocked > 0
                          ? { color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7', label: 'Bloqueado' }
                          : p.estado === 'completado'
                          ? { color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7', label: 'Completado' }
                          : p.estado === 'pausado'
                          ? { color: '#94a3b8', bg: isDark ? 'rgba(148,163,184,0.15)' : '#f1f5f9', label: 'Pausado' }
                          : { color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7', label: 'Al día' }

                        return (
                          <article
                            className="pw-list-row pw-project-row" key={p.id}
                            style={{ '--brand-color': brandColor } as React.CSSProperties}
                            data-overdue={overdue > 0 || undefined}
                            data-blocked={blocked > 0 && overdue === 0 || undefined}
                          >
                            <div className="pw-name" style={{ minWidth: 0 }}>
                              <Link href={`${base}/proyectos/${p.id}`} style={{ fontWeight: 650, fontSize: 15 }}>{p.nombre}</Link>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                                {p.tipo && TIPO_CFG[p.tipo] && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: TIPO_CFG[p.tipo].bg, color: TIPO_CFG[p.tipo].color, whiteSpace: 'nowrap' }}>{TIPO_CFG[p.tipo].label}</span>}
                                {overdue > 0 && <span className="pw-chip pw-chip-red" style={{ gap: 3, padding: '1px 6px', fontSize: 10 }}><AlertTriangle size={9} />{overdue} vencida{overdue !== 1 ? 's' : ''}</span>}
                                {blocked > 0 && <span className="pw-chip pw-chip-amber" style={{ gap: 3, padding: '1px 6px', fontSize: 10 }}><ShieldAlert size={9} />{blocked} bloqueada{blocked !== 1 ? 's' : ''}</span>}
                                {nearDeadline && <span className="pw-chip pw-chip-violet" style={{ gap: 3, padding: '1px 6px', fontSize: 10 }}><Clock size={9} />{d === 0 ? 'vence hoy' : `${d}d`}</span>}
                                {leaves.length > 0 && <span className="pw-chip pw-chip-muted" style={{ gap: 3, padding: '1px 6px', fontSize: 10 }}><CheckCircle2 size={9} />{completedCount}/{leaves.length}</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                <div style={{ flex: 1, height: 5, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 3, width: `${progress}%`, background: isDark ? `linear-gradient(90deg, ${brandColor}, color-mix(in srgb, ${brandColor} 40%, #1e2335))` : `linear-gradient(90deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, white))`, transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: brandColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                              </div>
                            </div>

                            <AvatarGroup team={team} ids={p.ownerIds} names={p.responsables ?? [p.responsable]} />

                            <div className="pw-delivery" style={{ minWidth: 130 }}>
                              {next ? (() => {
                                const rel = formatRelDate(next.fechaFin)
                                return (<><span className="pw-delivery-next">{next.nombre}</span><p style={{ fontSize: 11, margin: '3px 0 0', color: rel.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{rel.label}</p></>)
                              })() : <p className="pw-muted" style={{ fontSize: 12 }}>Sin entregas</p>}
                            </div>

                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 20, flexShrink: 0, fontSize: 11, fontWeight: 600, background: health.bg, color: health.color }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: health.color, flexShrink: 0 }} />
                              {health.label}
                            </span>

                            {admin && <button className="pw-button pw-icon" aria-label={`Opciones de ${p.nombre}`} onClick={e => openCtx(e, p.id)}><MoreHorizontal size={16} /></button>}
                            <Link className="pw-button pw-icon" aria-label={`Abrir ${p.nombre}`} href={`${base}/proyectos/${p.id}`}><ArrowRight size={16} /></Link>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── New project modal ─────────────────────────── */}
      {show && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(15,33,60,0.25)', zIndex: 60 }} onClick={dismissForm} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 61, width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', overflowY: 'auto',
            borderRadius: 20, padding: 28,
            background: isDark ? 'rgba(25,29,43,0.96)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            boxShadow: '0 20px 64px rgba(16,21,43,.22), 0 0 0 1px rgba(0,0,0,0.08)',
          }}>
            <form className="pw-form" onSubmit={create}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--pw-line)' }}>
                <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Nuevo proyecto</h2>
                <button type="button" onClick={dismissForm} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--pw-line)', background: 'transparent', cursor: 'pointer', color: 'var(--pw-muted)' }}>
                  <X size={15} />
                </button>
              </div>
              {error && <p className="pw-error" role="alert">{error}</p>}
              <label>
                Nombre
                <input required autoFocus value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>
                Cliente
                <select required value={form.brandId} onChange={e => setForm({ ...form, brandId: e.target.value })}>
                  <option value="">Selecciona un cliente</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label>
                Resultado esperado
                <textarea rows={2} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </label>
              <div className="pw-two">
                <label>
                  Tipo de proyecto
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="">Sin definir</option>
                    <option value="campaña">Campaña</option>
                    <option value="lanzamiento">Lanzamiento</option>
                    <option value="estrategia">Estrategia</option>
                    <option value="web">Web</option>
                    <option value="contenido_especial">Contenido especial</option>
                    <option value="interno">Interno</option>
                    <option value="propuesta">Propuesta</option>
                  </select>
                </label>
                <label>
                  Criterio de éxito
                  <input value={form.criterioExito} onChange={e => setForm({ ...form, criterioExito: e.target.value })} placeholder="¿Cómo saben que está bien?" />
                </label>
              </div>
              <div className="pw-two">
                <label>
                  Inicio
                  <input type="date" required value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} />
                </label>
                <label>
                  Entrega
                  <input type="date" min={form.fechaInicio} value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} />
                </label>
              </div>
              <fieldset>
                <legend>Responsables de planificación</legend>
                <div className="pw-toolbar">
                  {team.map(m => (
                    <label className="pw-check" key={m.id}>
                      <input type="checkbox" checked={form.ownerIds.includes(m.id)}
                        onChange={e => setForm({ ...form, ownerIds: e.target.checked ? [...form.ownerIds, m.id] : form.ownerIds.filter(id => id !== m.id) })} />
                      {m.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="pw-button" type="button" onClick={dismissForm}>Cancelar</button>
                <button disabled={busy} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: 'white', border: 'none', borderRadius: 10,
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                }}>
                  {busy ? 'Creando…' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Context menu ─────────────────────────────── */}
      {ctx && ctxProject && (
        <>
          <div className="pw-ctx-backdrop" onClick={() => closeMenu(setCtx)} />
          <div className="pw-ctx-menu" style={{ left: ctx.x, top: ctx.y + 4, transform: 'translateX(-100%)' }}>
            <button onClick={() => { closeMenu(setCtx); router.push(`${base}/proyectos/${ctxProject.id}`) }}>
              <ArrowRight size={15} /> Abrir proyecto
            </button>
            <div className="pw-ctx-sep" />
            <div className="pw-ctx-sub">
              <button onClick={e => { e.stopPropagation(); setCtx(c => c ? { ...c, subOpen: !c.subOpen } : c) }}>
                <span>Cambiar estado</span><ChevronRight size={14} />
              </button>
              {ctx.subOpen && (
                <div className="pw-ctx-submenu">
                  {ESTADOS.map(([v, l]) => (
                    <button key={v} onClick={() => handleStatus(ctxProject, v)} style={ctxProject.estado === v ? { fontWeight: 700 } : {}}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleArchive(ctxProject)}>
              {ctxProject.archived ? <><RotateCcw size={15} /> Restaurar proyecto</> : <><Archive size={15} /> Archivar proyecto</>}
            </button>
            <div className="pw-ctx-sep" />
            <button className="pw-ctx-danger" onClick={() => { closeMenu(setCtx); setDeleteConfirm(ctxProject.id) }}>
              <Trash2 size={15} /> Eliminar proyecto
            </button>
          </div>
        </>
      )}

      {deleteConfirm && (() => {
        const p = [...proyectos, ...archivedProyectos].find(x => x.id === deleteConfirm)
        return (
          <>
            <div className="pw-ctx-backdrop" onClick={() => setDeleteConfirm(null)} />
            <div className="pw-ctx-menu" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', minWidth: 280, padding: '18px 16px', zIndex: 10001 }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Eliminar proyecto</p>
              <p style={{ fontSize: 13, color: 'var(--pw-muted)', marginBottom: 16 }}>
                ¿Eliminar <strong>{p?.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="pw-button" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                <button className="pw-button pw-ctx-danger" style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
