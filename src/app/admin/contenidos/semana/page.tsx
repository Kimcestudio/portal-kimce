'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Maximize2, Minimize2, Check, Users, X, ExternalLink } from 'lucide-react'
import ContentViewSwitcher from '@/components/cmhub/ContentViewSwitcher'
import { useHub } from '@/cmhub/context'
import { useHubMeta } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { ALL_STATUSES, ALL_NETWORKS } from '@/cmhub/data'
import dynamic from 'next/dynamic'
const ContentModal = dynamic(() => import('@/components/cmhub/ContentModal'), { ssr: false })
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus, Network } from '@/cmhub/types'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function getWeekDates(offset = 0) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

// ── Dropdown de estado inline ─────────────────────────────────────────────────
function StatusSelect({
  value, onChange, smeta, size = 'sm',
}: {
  value: ContentStatus
  onChange: (s: ContentStatus) => void
  smeta: Record<string, { label: string; bg: string; text: string; dot: string }>
  size?: 'sm' | 'xs'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const st = smeta[value]

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`flex items-center gap-1 font-semibold rounded-full hover:opacity-80 cursor-pointer transition-opacity ${
          size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2.5 py-1'
        }`}
        style={{ background: st?.bg, color: st?.text }}
      >
        {st?.label ?? value}
        <ChevronDown size={size === 'xs' ? 8 : 10} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-[60] py-1 min-w-[160px]">
          {ALL_STATUSES.map(s => {
            const m = smeta[s]
            return (
              <button key={s} onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[#f9fafb] transition-colors text-left">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m?.dot }} />
                <span style={{ color: m?.text }} className="font-medium flex-1">{m?.label ?? s}</span>
                {s === value && <Check size={10} className="shrink-0 text-[#7c3aed]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Header de columna con filtro desplegable ───────────────────────────────────
function FilterHeader({
  label, options, value, onChange,
}: {
  label: string
  options: { value: string; label: string; color?: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLTableCellElement>(null)
  const active = value !== 'all'

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <th ref={ref} className="px-5 py-3 text-left border-b border-[#f3f4f6] relative bg-[#f9fafb]">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
          active ? 'text-[#7c3aed]' : 'text-[#6b7280] hover:text-[#374151]'
        }`}
      >
        {label}
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-[60] py-1 min-w-[180px]">
          <button
            onClick={() => { onChange('all'); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#f9fafb] transition-colors text-left ${value === 'all' ? 'font-bold text-[#7c3aed]' : 'text-[#6b7280]'}`}
          >
            Todos
            {value === 'all' && <Check size={10} className="ml-auto shrink-0 text-[#7c3aed]" />}
          </button>
          <div className="h-px bg-[#f3f4f6] my-0.5" />
          {options.map(opt => (
            <button key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#f9fafb] transition-colors text-left ${value === opt.value ? 'font-bold text-[#7c3aed]' : 'text-[#374151]'}`}
            >
              {opt.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />}
              <span className="flex-1">{opt.label}</span>
              {value === opt.value && <Check size={10} className="shrink-0 text-[#7c3aed]" />}
            </button>
          ))}
        </div>
      )}
    </th>
  )
}

// ── Cabecera de tabla simple (no filtrable) ────────────────────────────────────
function PlainHeader({ label }: { label: string }) {
  return (
    <th className="px-5 py-3 text-left text-[11px] font-bold text-[#6b7280] uppercase tracking-wide border-b border-[#f3f4f6] bg-[#f9fafb]">
      {label}
    </th>
  )
}

// ── Dropdown filtro de cliente ────────────────────────────────────────────────
function BrandDropdown({
  brands, value, onChange,
}: {
  brands: import('@/cmhub/types').Brand[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = brands.find(b => b.id === value)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
          value !== 'all'
            ? 'border-[#c4b5fd] bg-[#f5f3ff] text-[#7c3aed]'
            : 'border-[#e5e7eb] bg-white text-[#374151] hover:border-[#9ca3af]'
        }`}
      >
        {selected ? (
          <>
            <span className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white"
              style={{ background: selected.color }}>{selected.initials}</span>
            <span className="max-w-[120px] truncate">{selected.name}</span>
          </>
        ) : (
          <span>Cliente</span>
        )}
        <ChevronDown size={11} className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-[60] py-1 min-w-[200px]">
          <button
            onClick={() => { onChange('all'); setOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[#f9fafb] transition-colors text-left ${
              value === 'all' ? 'font-bold text-[#7c3aed]' : 'text-[#6b7280]'
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-[#f3f4f6] flex items-center justify-center shrink-0"><Users size={10} className="text-[#6b7280]" /></span>
            Todos los clientes
            {value === 'all' && <Check size={10} className="ml-auto shrink-0 text-[#7c3aed]" />}
          </button>
          <div className="h-px bg-[#f3f4f6] my-0.5" />
          {brands.map(b => (
            <button
              key={b.id}
              onClick={() => { onChange(b.id); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[#f9fafb] transition-colors text-left ${
                value === b.id ? 'font-bold text-[#7c3aed]' : 'text-[#374151]'
              }`}
            >
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{ background: b.color }}>{b.initials}</span>
              <span className="flex-1 truncate">{b.name}</span>
              {value === b.id && <Check size={10} className="shrink-0 text-[#7c3aed]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Selected =
  | { kind: 'content'; data: Content }

function getDrivePreviewUrl(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`
  return null
}

export default function SemanaPage() {
  const { contents, brands, getBrandById, updateContent, team } = useHub()
  const { NETWORK_META, STATUS_META } = useHubMeta()
  const auth = useOptionalAuth()
  const currentUserName = (auth?.profile as { displayName?: string } | null)?.displayName ?? null
  const [offset, setOffset] = useState(0)

  // Filtros tabla
  const [filterBrand,   setFilterBrand]   = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')

  // Tabla expandida
  const [tableExpanded, setTableExpanded] = useState(false)

  // Scroll-triggered reveal
  const scrollRef    = useRef<HTMLDivElement>(null)
  const tableRef     = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  const revealedFlag = useRef(false)

  const handleScroll = useCallback(() => {
    if (revealedFlag.current) return
    const c = scrollRef.current
    const t = tableRef.current
    if (!c || !t) return
    if (t.getBoundingClientRect().top < c.getBoundingClientRect().bottom - 40) {
      revealedFlag.current = true
      setRevealed(true)
    }
  }, [])

  useEffect(() => { handleScroll() }, [handleScroll])


  // Drag & drop en grid
  const [dragging, setDragging] = useState<string | null>(null)
  const [overDay,  setOverDay]  = useState<string | null>(null)

  // Panel lateral derecho
  const [selected,  setSelected]  = useState<Selected | null>(null)

  // Modal completo (para edición)
  const [editing,   setEditing]   = useState<Content | undefined>()
  const [showModal, setShowModal] = useState(false)

  const dias = getWeekDates(offset)
  const label = `${dias[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${dias[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const smeta = STATUS_META as Record<string, { label: string; bg: string; text: string; dot: string }>

  const contentsDelDia = (d: Date) =>
    contents.filter(c => {
      if (!c.date) return false
      if (filterBrand !== 'all' && c.brandId !== filterBrand) return false
      return new Date(c.date + 'T00:00:00').toDateString() === d.toDateString()
    })

  const semanaContents = dias.flatMap(d => contentsDelDia(d))

  // Filtros: todas las opciones globales (no solo las de la semana)
  const brandOpts = brands
    .map(b => ({ value: b.id, label: b.name, color: b.color }))

  const channelOpts = ALL_NETWORKS
    .map(ch => ({ value: ch, label: NETWORK_META[ch]?.label ?? ch, color: NETWORK_META[ch]?.dot }))

  const statusOpts = ALL_STATUSES
    .map(s => ({ value: s, label: smeta[s]?.label ?? s, color: smeta[s]?.dot }))

  const getChannels = (c: Content): Network[] =>
    (c.channels?.length ? c.channels : [c.channel]) as Network[]

  const filtrados = semanaContents.filter(c =>
    (filterBrand   === 'all' || c.brandId === filterBrand) &&
    (filterChannel === 'all' || getChannels(c).includes(filterChannel as Network)) &&
    (filterStatus  === 'all' || c.status  === filterStatus)
  )

  function getAssignees(c: Content) {
    return team.filter(m => {
      const name = m.name.trim().toLowerCase()
      const matches = (s: string | null | undefined) => !!s && s.trim().toLowerCase() === name
      return matches(c.dueAssignee) || matches(c.responsible) || c.responsables?.some(r => matches(r))
    })
  }

  function changeStatus(id: string, status: ContentStatus) {
    updateContent(id, { status })
  }

  function handleDrop(dateISO: string) {
    if (!dragging) return
    const byWho = currentUserName ? { updatedBy: currentUserName } : {}
    updateContent(dragging, { date: dateISO, ...byWho })
    setDragging(null)
    setOverDay(null)
  }

  function openModal(c: Content) {
    setEditing(c)
    setShowModal(true)
  }

  function openPanel(c: Content) {
    setSelected({ kind: 'content', data: c })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0 rounded-t-2xl">
        <div className="shrink-0">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Semana</span>
        </div>
        <div className="flex-1" />
        <ContentViewSwitcher />
        <div className="w-px h-5 bg-[#e5e7eb]" />
        {/* ── Filtro de clientes ── */}
        <BrandDropdown
          brands={brands.filter(b => b.status === 'active')}
          value={filterBrand}
          onChange={setFilterBrand}
        />
        <div className="w-px h-5 bg-[#e5e7eb]" />
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(o => o - 1)}
            className="w-8 h-8 rounded-xl border border-[#e5e7eb] flex items-center justify-center hover:bg-[#f3f4f6] transition-colors cursor-pointer">
            <ChevronLeft size={14} className="text-[#6b7280]" />
          </button>
          <span className="text-[12px] font-semibold text-[#4b5563] bg-[#f3f4f6] px-3 py-1.5 rounded-lg min-w-[200px] text-center">
            {label}
          </span>
          <button onClick={() => setOffset(o => o + 1)}
            className="w-8 h-8 rounded-xl border border-[#e5e7eb] flex items-center justify-center hover:bg-[#f3f4f6] transition-colors cursor-pointer">
            <ChevronRight size={14} className="text-[#6b7280]" />
          </button>
          <button onClick={() => setOffset(0)}
            className="text-[12px] font-semibold text-[#7c3aed] bg-[#f5f3ff] px-3 py-1.5 rounded-lg hover:bg-[#ede9fe] transition-colors cursor-pointer">
            Hoy
          </button>
        </div>
      </div>

      {/* Layout: contenido + panel derecho */}
      <div className="flex-1 flex overflow-hidden">

      {/* Contenido scrolleable */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">

        {/* ── Grid semanal — se oculta cuando la tabla está expandida ─── */}
        {!tableExpanded && <div className="grid grid-cols-7 gap-2">
          {DIAS.map((d, i) => {
            const fecha   = dias[i]
            const dateISO = toISO(fecha)
            const esHoy   = fecha.toDateString() === new Date().toDateString()
            const items   = contentsDelDia(fecha)
            const isOver  = overDay === dateISO

            return (
              <div key={d}
                onDragOver={e => { e.preventDefault(); setOverDay(dateISO) }}
                onDragLeave={() => setOverDay(null)}
                onDrop={() => handleDrop(dateISO)}
              >
                {/* Cabecera del día */}
                <div className={`text-center mb-2 py-2 rounded-xl transition-colors ${
                  isOver ? 'bg-[#f5f3ff] ring-2 ring-[#7c3aed]/30' : esHoy ? 'bg-[#7c3aed]' : ''
                }`}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${esHoy && !isOver ? 'text-white/80' : 'text-[#9ca3af]'}`}>{d.slice(0, 3)}</p>
                  <p className={`text-[15px] font-bold ${esHoy && !isOver ? 'text-white' : 'text-[#111827]'}`}>{fecha.getDate()}</p>
                  {items.length > 0 && (
                    <p className={`text-[9px] font-semibold ${esHoy && !isOver ? 'text-white/70' : 'text-[#9ca3af]'}`}>{items.length} pub.</p>
                  )}
                </div>

                {/* Cards */}
                <div className={`flex flex-col gap-1.5 min-h-[140px] rounded-xl p-1 transition-colors ${isOver ? 'bg-[#f5f3ff]/50' : ''}`}>
                  {items.length === 0 && (
                    <div className={`flex-1 rounded-xl border border-dashed flex items-center justify-center min-h-[60px] transition-colors ${
                      isOver ? 'border-[#7c3aed]/40' : 'border-[#e5e7eb]'
                    }`}>
                      <span className="text-[10px] text-[#d1d5db]">—</span>
                    </div>
                  )}
                  {items.map(c => {
                    const brand = getBrandById(c.brandId)
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragging(c.id)}
                        onDragEnd={() => { setDragging(null); setOverDay(null) }}
                        onClick={() => openPanel(c)}
                        className={`bg-white rounded-xl border border-[#e5e7eb] p-2 hover:border-[#c4b5fd] hover:shadow-sm transition-all cursor-pointer select-none ${
                          dragging === c.id ? 'opacity-40 scale-95' : ''
                        } ${selected?.kind === 'content' && selected.data.id === c.id ? 'border-[#7c3aed] shadow-sm' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                            style={{ background: brand?.color ?? '#7c3aed' }}>
                            {brand?.initials ?? '?'}
                          </div>
                          <span className="text-[10px] text-[#9ca3af] truncate flex-1">{brand?.name}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-[#111827] leading-tight line-clamp-2 mb-1.5">{c.title}</p>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {getChannels(c).map(ch => {
                              const m = NETWORK_META[ch]
                              return (
                                <span key={ch} title={m?.label ?? ch}
                                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                  style={{ background: m?.bg, color: m?.dot }}>
                                  <NetworkIcon network={ch} size={10} />
                                </span>
                              )
                            })}
                          </div>
                          <StatusSelect
                            value={c.status as ContentStatus}
                            onChange={s => changeStatus(c.id, s)}
                            smeta={smeta}
                            size="xs"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>}

        {/* ── Tabla: publicaciones de la semana ────────────────────────── */}
        <style>{`
          @keyframes tableReveal {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rowReveal {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div
          ref={tableRef}
          className={`bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden flex flex-col shrink-0 ${tableExpanded ? 'flex-1 min-h-0' : ''}`}
          style={revealed ? { animation: 'tableReveal 0.6s ease both' } : { opacity: 0 }}
        >
          <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between shrink-0">
            <span className="text-[15px] font-bold text-[#111827]">Publicaciones de la semana</span>
            <div className="flex items-center gap-2">
              {(filterBrand !== 'all' || filterChannel !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => { setFilterBrand('all'); setFilterChannel('all'); setFilterStatus('all') }}
                  className="text-[11px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">
                  Limpiar filtros
                </button>
              )}
              <span className="text-[12px] bg-[#f3f4f6] text-[#6b7280] px-2.5 py-1 rounded-full font-medium">
                {filtrados.length}{filtrados.length !== semanaContents.length ? ` de ${semanaContents.length}` : ''} publicaciones
              </span>
              {/* Botón expandir/contraer tabla */}
              <button
                onClick={() => setTableExpanded(e => !e)}
                title={tableExpanded ? 'Contraer tabla' : 'Ver tabla completa'}
                className="w-7 h-7 rounded-lg border border-[#e5e7eb] flex items-center justify-center text-[#6b7280] hover:text-[#7c3aed] hover:border-[#c4b5fd] hover:bg-[#f5f3ff] transition-colors cursor-pointer shrink-0"
              >
                {tableExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          </div>

          {/* Tabla body */}
          <div className={tableExpanded ? 'overflow-auto flex-1 min-h-0' : ''}>
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f9fafb]">
                  <PlainHeader label="Fecha" />
                  <FilterHeader
                    label="Cliente"
                    options={brandOpts}
                    value={filterBrand}
                    onChange={setFilterBrand}
                  />
                  <PlainHeader label="Título" />
                  <FilterHeader
                    label="Canal"
                    options={channelOpts}
                    value={filterChannel}
                    onChange={setFilterChannel}
                  />
                  <FilterHeader
                    label="Estado"
                    options={statusOpts}
                    value={filterStatus}
                    onChange={setFilterStatus}
                  />
                  <PlainHeader label="Responsable" />
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-[13px] text-[#9ca3af]">
                      {semanaContents.length === 0
                        ? 'Sin publicaciones programadas esta semana'
                        : 'Sin resultados con los filtros aplicados'}
                    </td>
                  </tr>
                )}
                {filtrados.map((c, idx) => {
                  const brand = getBrandById(c.brandId)
                  const delay = `${Math.min(idx * 0.045, 0.5)}s`
                  return (
                    <tr key={c.id}
                      onClick={() => openPanel(c)}
                      className={`border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa] transition-colors cursor-pointer ${selected?.kind === 'content' && selected.data.id === c.id ? 'bg-[#f5f3ff]' : ''}`}
                      style={revealed ? { animation: `rowReveal 0.35s ease ${delay} both` } : {}}
                    >
                      <td className="px-5 py-3 text-[#6b7280] font-mono text-[12px] whitespace-nowrap">{c.date}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ background: brand?.color ?? '#7c3aed' }}>{brand?.initials}</div>
                          <span className="text-[#4b5563]">{brand?.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-[#111827] max-w-[200px] truncate">{c.title}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {getChannels(c).map(ch => {
                            const m = NETWORK_META[ch]
                            return (
                              <span key={ch} title={m?.label ?? ch}
                                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                style={{ background: m?.bg, color: m?.dot }}>
                                <NetworkIcon network={ch} size={12} />
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <StatusSelect
                          value={c.status as ContentStatus}
                          onChange={s => changeStatus(c.id, s)}
                          smeta={smeta}
                          size="sm"
                        />
                      </td>
                      <td className="px-5 py-3">
                        {(() => {
                          const assignees = getAssignees(c)
                          if (assignees.length === 0) return <span className="text-[#9ca3af]">{c.responsible || '—'}</span>
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-1">
                                {assignees.slice(0, 3).map(m => (
                                  <div key={m.id} title={m.name}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white shrink-0"
                                    style={{ background: m.color }}>{m.initials}</div>
                                ))}
                              </div>
                              {assignees.length === 1 && (
                                <span className="text-[12px] text-[#6b7280] truncate max-w-[100px]">{assignees[0].name}</span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Panel lateral derecho ─────────────────────────────────────── */}
      {selected && (() => {
        const c = selected.data
        const brand = getBrandById(c.brandId)
        const channels = (c.channels?.length ? c.channels : [c.channel]) as Network[]
        const st = smeta[c.status]
        const drivePreview = c.driveUrl ? getDrivePreviewUrl(c.driveUrl) : null

        return (
          <div className="w-80 border-l border-[#e5e7eb] bg-white flex flex-col shrink-0 overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wide">Publicación</p>
              </div>
              <button
                onClick={() => { setEditing(c); setShowModal(true) }}
                className="text-[11px] font-semibold text-[#7c3aed] bg-[#f5f3ff] hover:bg-[#ede9fe] px-2.5 py-1 rounded-lg transition-colors shrink-0"
              >
                Editar
              </button>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Brand + title */}
              <div>
                {brand && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: brand.color }}>{brand.initials}</div>
                    <span className="text-[11px] font-semibold text-[#9ca3af]">{brand.name}</span>
                  </div>
                )}
                <p className="text-[15px] font-bold text-[#111827] leading-snug">{c.title}</p>
              </div>

              {/* Channels + status */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {channels.map(ch => {
                    const nm = NETWORK_META[ch]
                    return (
                      <span key={ch} title={nm?.label ?? ch}
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: nm?.bg, color: nm?.dot }}>
                        <NetworkIcon network={ch} size={12} />
                      </span>
                    )
                  })}
                </div>
                {st && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: st.bg, color: st.text }}>{st.label}</span>
                )}
              </div>

              {/* Fechas */}
              <div className="flex flex-col gap-1.5">
                {c.date && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#9ca3af]">Publicación</span>
                    <span className="font-semibold text-[#374151]">{c.date}</span>
                  </div>
                )}
                {c.dueDate && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#9ca3af]">Entrega</span>
                    <span className="font-semibold text-[#d97706]">{c.dueDate}</span>
                  </div>
                )}
                {(() => {
                  const assignees = getAssignees(c)
                  const names = assignees.length > 0
                    ? assignees.map(m => m.name)
                    : c.responsables?.length ? c.responsables : c.responsible ? [c.responsible] : []
                  if (!names.length) return null
                  return (
                    <div className="flex items-start justify-between text-[12px] gap-2">
                      <span className="text-[#9ca3af] shrink-0">
                        {names.length > 1 ? 'Responsables' : 'Responsable'}
                      </span>
                      {assignees.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {assignees.map(m => (
                            <div key={m.id} title={m.name} className="flex items-center gap-1">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                style={{ background: m.color }}>{m.initials}</div>
                              <span className="font-semibold text-[#374151] text-[11px]">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="font-semibold text-[#374151] text-right">{names.join(', ')}</span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Copy snippet */}
              <div className="bg-[#f9fafb] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide mb-1.5">Copy</p>
                <p className={`text-[12px] leading-relaxed line-clamp-4 ${c.copy ? 'text-[#374151]' : 'text-[#9ca3af] italic'}`}>
                  {c.copy || 'Sin copy redactado.'}
                </p>
              </div>

              {/* Drive link + preview */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wide">Drive</p>
                {c.driveUrl ? (
                  <>
                    <div className="flex items-center justify-end">
                      <a href={c.driveUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#7c3aed] hover:underline">
                        Abrir <ExternalLink size={10} />
                      </a>
                    </div>
                    {drivePreview ? (
                      <iframe
                        src={drivePreview}
                        className="w-full rounded-xl border border-[#e5e7eb]"
                        style={{ height: '200px' }}
                        allow="autoplay"
                        title="Drive preview"
                      />
                    ) : (
                      <a href={c.driveUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-[#f9fafb] rounded-xl p-3 hover:bg-[#f3f4f6] transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-[#4285f4]/10 flex items-center justify-center shrink-0">
                          <ExternalLink size={14} className="text-[#4285f4]" />
                        </div>
                        <span className="text-[11px] font-medium text-[#374151] truncate group-hover:text-[#7c3aed]">
                          {c.driveUrl}
                        </span>
                      </a>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#9ca3af] border border-dashed border-[#e5e7eb] rounded-xl p-3">
                    Sin diseño cargado
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      </div>{/* fin flex-1 flex overflow-hidden */}

      {showModal && (
        <ContentModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}
