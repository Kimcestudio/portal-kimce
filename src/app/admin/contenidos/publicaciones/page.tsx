'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Plus, Copy, Trash2, MoreHorizontal, Check, ExternalLink, BarChart2, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import ContentViewSwitcher from '@/components/cmhub/ContentViewSwitcher'
import { useHub } from '@/cmhub/context'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { NETWORK_META, STATUS_META, PRIORITY_META, ALL_NETWORKS, ALL_FORMATS, ALL_STATUSES, PRODUCTION_STATUSES, READY_TO_PUBLISH_STATUSES } from '@/cmhub/data'
import dynamic from 'next/dynamic'
const ContentModal = dynamic(() => import('@/components/cmhub/ContentModal'), { ssr: false })
import MetricsImportModal from '@/components/cmhub/MetricsImportModal'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus, Network, Format } from '@/cmhub/types'

// ── Inline cell: editable title ────────────────────────────────────────────────
function InlineTitleCell({ content, onSave }: { content: Content; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content.title)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(content.title) }, [content.title])

  function commit() {
    const v = draft.trim()
    if (v && v !== content.title) onSave(v)
    else setDraft(content.title)
    setEditing(false)
  }
  function cancel() { setDraft(content.title); setEditing(false) }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        className="w-full text-[13px] font-semibold text-[#111827] bg-transparent border-b-2 border-[#7c3aed] outline-none pb-0.5"
      />
    )
  }
  return (
    <div
      onClick={() => setEditing(true)}
      className="font-semibold text-[#111827] cursor-text hover:text-[#7c3aed] transition-colors truncate"
      title="Clic para editar"
    >
      {content.title}
    </div>
  )
}

// ── Inline dropdown for badge fields ──────────────────────────────────────────
function InlineBadgeSelect<T extends string>({
  value,
  options,
  style,
  label,
  onSelect,
  stopPropagation = true,
}: {
  value: T
  options: T[]
  style: (v: T) => { bg: string; text: string }
  label: (v: T) => string
  onSelect: (v: T) => void
  stopPropagation?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const s = style(value)
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={e => { if (stopPropagation) e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-80"
        style={{ background: s.bg, color: s.text }}
      >
        {label(value)}
        <span className="ml-0.5 opacity-50">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-[150px]">
          {options.map(opt => {
            const os = style(opt)
            return (
              <button
                key={opt}
                onClick={e => { e.stopPropagation(); onSelect(opt); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[#f9fafb] transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: os.text }} />
                <span style={{ color: os.text }} className="font-medium">{label(opt)}</span>
                {opt === value && <Check size={10} className="ml-auto text-[#7c3aed]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inline channel selector ────────────────────────────────────────────────────
function InlineChannelSelect({ value, onSelect }: { value: Network; onSelect: (v: Network) => void }) {
  const { NETWORK_META } = useHubMeta()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const net = NETWORK_META[value]
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-80"
        style={{ background: net?.bg, color: net?.text }}
      >
        <NetworkIcon network={value} size={9} />
        {net?.label}
        <span className="opacity-50">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-[150px]">
          {ALL_NETWORKS.map(n => {
            const m = NETWORK_META[n]
            return (
              <button
                key={n}
                onClick={e => { e.stopPropagation(); onSelect(n); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[#f9fafb] transition-colors"
              >
                <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: m.bg, color: m.dot }}>
                  <NetworkIcon network={n} size={10} />
                </span>
                <span className="text-[#374151] font-medium">{m.label}</span>
                {n === value && <Check size={10} className="ml-auto text-[#7c3aed]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inline date cell ──────────────────────────────────────────────────────────
function InlineDateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function commit() {
    onSave(draft || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="date"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
        className="font-mono text-[11px] text-[#6b7280] border border-[#e5e7eb] rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#7c3aed] w-32"
      />
    )
  }
  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true) }}
      className="font-mono text-[11px] text-[#9ca3af] cursor-pointer hover:text-[#7c3aed] transition-colors"
      title="Clic para editar"
    >
      {value ? value.replace('2026-', '') : '—'}
    </span>
  )
}

// ── Row actions menu (3 dots) ─────────────────────────────────────────────────
function RowActionsMenu({
  content,
  onOpenFull,
  onDuplicate,
  onDelete,
}: {
  content: Content
  onOpenFull: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmDel(false) }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); setConfirmDel(false) }}
        className="w-7 h-7 flex items-center justify-center text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-lg transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && !confirmDel && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 w-48">
          <button
            onClick={e => { e.stopPropagation(); onOpenFull(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            <ExternalLink size={13} className="text-[#9ca3af]" />
            Abrir ficha completa
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDuplicate(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            <Copy size={13} className="text-[#9ca3af]" />
            Duplicar
          </button>
          <div className="h-px bg-[#f3f4f6] my-1" />
          <button
            onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Eliminar
          </button>
        </div>
      )}

      {open && confirmDel && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 p-3 w-52">
          <p className="text-[12px] font-semibold text-[#111827] mb-1">¿Eliminar publicación?</p>
          <p className="text-[11px] text-[#9ca3af] mb-3">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={e => { e.stopPropagation(); setConfirmDel(false); setOpen(false) }}
              className="flex-1 text-[11px] border border-[#e5e7eb] text-[#6b7280] py-1.5 rounded-lg hover:bg-[#f9fafb] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); setOpen(false) }}
              className="flex-1 text-[11px] bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg transition-colors font-semibold"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Save indicator ────────────────────────────────────────────────────────────
function SavedBadge({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold animate-fade-in">
      <Check size={10} /> Guardado
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Publicaciones() {
  const { isDark } = useHubTheme()
  const { NETWORK_META, STATUS_META, PRIORITY_META } = useHubMeta()
  const { contents, brands, updateContent, deleteContent, duplicateContent } = useHub()
  const base = useHubBase()
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const monthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [filterBrand, setFilterBrand] = useState('all')
  const [filterResponsible, setFilterResponsible] = useState('all')
  const [filterView, setFilterView] = useState<'all' | 'produccion' | 'listos' | 'publicados'>('all')
  const [showModal, setShowModal] = useState(false)
  const [showMetricsImport, setShowMetricsImport] = useState(false)
  const [editing, setEditing] = useState<Content | undefined>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  // Unique responsibles for filter
  const responsibles = Array.from(new Set(contents.map(c => c.responsible).filter(Boolean))).sort()

  const filtered = contents.filter(c => {
    if (c.date && !c.date.startsWith(monthStr)) return false
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.copy.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterNetwork !== 'all' && !(c.channels?.length ? c.channels : [c.channel]).includes(filterNetwork as never)) return false
    if (filterBrand !== 'all' && c.brandId !== filterBrand) return false
    if (filterResponsible !== 'all' && c.responsible !== filterResponsible) return false
    if (filterView === 'produccion') {
      if (!(PRODUCTION_STATUSES as readonly string[]).includes(c.status)) return false
    }
    if (filterView === 'listos') {
      if (!(READY_TO_PUBLISH_STATUSES as readonly string[]).includes(c.status)) return false
    }
    if (filterView === 'publicados') {
      if (c.status !== 'publicado') return false
    }
    return true
  })

  function openEdit(c: Content) { setEditing(c); setShowModal(true) }
  function openNew() { setEditing(undefined); setShowModal(true) }

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function deleteSelected() {
    selected.forEach(id => deleteContent(id))
    setSelected(new Set())
  }

  // Save a field inline and show brief confirmation
  const saveField = useCallback((id: string, changes: Partial<Content>) => {
    updateContent(id, changes)
    setSavedIds(prev => new Set([...prev, id]))
    setTimeout(() => setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s }), 1800)
  }, [updateContent])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      {/* ── Topbar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Publicaciones</span>
        </div>
        <ContentViewSwitcher />
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthOffset(o => o - 1)} className="w-8 h-8 border border-[#e5e7eb] rounded-xl flex items-center justify-center text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-semibold text-[#111827] min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)} className="w-8 h-8 border border-[#e5e7eb] rounded-xl flex items-center justify-center text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={() => setMonthOffset(0)} className="border border-[#e5e7eb] bg-white text-[#6b7280] text-[12px] font-medium px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">Hoy</button>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 flex flex-col gap-3 shrink-0">
        {/* Quick view filters */}
        <div className="flex items-center gap-2">
          {([
            { id: 'all',       label: 'Todas' },
            { id: 'produccion',label: 'En producción' },
            { id: 'listos',    label: 'Listos para publicar' },
            { id: 'publicados',label: 'Publicados' },
          ] as { id: typeof filterView; label: string }[]).map(v => (
            <button
              key={v.id}
              onClick={() => setFilterView(v.id)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                filterView === v.id
                  ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                  : 'border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]'
              }`}
            >
              {v.label}
            </button>
          ))}
          <span className="text-[12px] text-[#9ca3af] ml-1">{filtered.length} resultados</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <>
                <button onClick={() => { selected.forEach(id => duplicateContent(id)); setSelected(new Set()) }}
                  className="flex items-center gap-1.5 border border-[#e5e7eb] text-[#4b5563] text-[12px] px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
                  <Copy size={12} /> Duplicar ({selected.size})
                </button>
                <button onClick={deleteSelected}
                  className="flex items-center gap-1.5 border border-red-200 text-red-500 text-[12px] px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                  <Trash2 size={12} /> Eliminar ({selected.size})
                </button>
              </>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl pl-8 pr-3 py-1.5 text-[12px] w-40 focus:outline-none focus:border-[#7c3aed]" />
            </div>
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
              className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-1.5 text-[12px] text-[#6b7280] focus:outline-none focus:border-[#7c3aed]">
              <option value="all">Todas las marcas</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-1.5 text-[12px] text-[#6b7280] focus:outline-none focus:border-[#7c3aed]">
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_META).filter(([k]) => ['idea','produccion','revision','aprobado','programado','publicado'].includes(k)).map(([k, v]) =>
                <option key={k} value={k}>{v.label}</option>
              )}
            </select>
            {responsibles.length > 0 && (
              <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}
                className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-1.5 text-[12px] text-[#6b7280] focus:outline-none focus:border-[#7c3aed]">
                <option value="all">Todos los responsables</option>
                {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={openNew}
              className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-1.5 rounded-xl transition-colors">
              <Plus size={14} /> Nueva
            </button>
          </div>
        </div>

        <NetworkFilter
          contents={filterBrand === 'all' ? contents : contents.filter(c => c.brandId === filterBrand)}
          value={filterNetwork}
          onChange={setFilterNetwork}
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto mx-6 mb-6 bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#f9fafb] border-b border-[#e5e7eb]">
            <tr>
              <th className="w-9 px-4 py-2.5">
                <input type="checkbox" className="w-3.5 h-3.5 accent-[#7c3aed]"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)))} />
              </th>
              {['Marca', 'Título', 'Canal', 'Formato', 'Estado', 'Prioridad', 'Pub.', 'Entrega', 'Links', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const net  = NETWORK_META[c.channel]
              const st   = STATUS_META[c.status]
              const pr   = PRIORITY_META[c.priority]
              const brand = brands.find(b => b.id === c.brandId)
              const isSel = selected.has(c.id)
              const isSaved = savedIds.has(c.id)

              return (
                <tr
                  key={c.id}
                  className={`border-b border-[#f3f4f6] last:border-0 transition-colors group ${
                    isSel ? 'bg-[#f5f3ff]' : i % 2 === 0 ? 'hover:bg-[#fafafa]' : 'bg-[#fafafa]/40 hover:bg-[#fafafa]'
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id)}
                      className="w-3.5 h-3.5 accent-[#7c3aed]" />
                  </td>

                  {/* Marca */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-extrabold text-white shrink-0"
                        style={{ background: brand?.color ?? '#94a3b8' }}>{brand?.initials}</div>
                      <span className="text-[11px] text-[#4b5563] font-medium whitespace-nowrap">{brand?.name ?? '—'}</span>
                    </div>
                  </td>

                  {/* Título — inline edit */}
                  <td className="px-3 py-2.5 max-w-[220px]" onClick={e => e.stopPropagation()}>
                    <InlineTitleCell
                      content={c}
                      onSave={v => saveField(c.id, { title: v })}
                    />
                    {c.campaign && <div className="text-[10px] text-[#9ca3af] truncate mt-0.5">{c.campaign}</div>}
                    <SavedBadge visible={isSaved} />
                  </td>

                  {/* Canal — inline dropdown */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineChannelSelect
                      value={c.channel}
                      onSelect={v => saveField(c.id, { channel: v, channels: [v] })}
                    />
                  </td>

                  {/* Formato — inline dropdown */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineBadgeSelect
                      value={c.format}
                      options={[...ALL_FORMATS]}
                      style={() => ({ bg: '#f3f4f6', text: '#6b7280' })}
                      label={v => v}
                      onSelect={v => saveField(c.id, { format: v as Format })}
                    />
                  </td>

                  {/* Estado — inline dropdown */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineBadgeSelect
                      value={c.status}
                      options={ALL_STATUSES as unknown as ContentStatus[]}
                      style={v => ({ bg: STATUS_META[v]?.bg ?? '#f3f4f6', text: STATUS_META[v]?.text ?? '#6b7280' })}
                      label={v => STATUS_META[v]?.label ?? v}
                      onSelect={v => saveField(c.id, { status: v })}
                    />
                  </td>

                  {/* Prioridad — inline dropdown */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineBadgeSelect
                      value={c.priority}
                      options={['baja', 'media', 'alta', 'urgente'] as const as unknown as typeof c.priority[]}
                      style={v => ({ bg: PRIORITY_META[v]?.bg ?? '#f3f4f6', text: PRIORITY_META[v]?.text ?? '#6b7280' })}
                      label={v => PRIORITY_META[v]?.label ?? v}
                      onSelect={v => saveField(c.id, { priority: v })}
                    />
                  </td>

                  {/* Fecha publicación */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineDateCell
                      value={c.date}
                      onSave={v => saveField(c.id, { date: v })}
                    />
                  </td>

                  {/* Fecha entrega (dueDate) */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <InlineDateCell
                      value={c.dueDate ?? null}
                      onSave={v => saveField(c.id, { dueDate: v })}
                    />
                  </td>

                  {/* Links: Drive + por canal */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {c.driveUrl
                        ? <a href={c.driveUrl} target="_blank" rel="noopener noreferrer" title="Pieza en Drive"
                            className="w-5 h-5 rounded-md bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors">
                            <FolderOpen size={10} className="text-green-700" />
                          </a>
                        : <div className="w-5 h-5 rounded-md bg-[#f3f4f6] flex items-center justify-center" title="Sin Drive">
                            <FolderOpen size={10} className="text-[#d1d5db]" />
                          </div>
                      }
                      {(c.channels?.length ? c.channels : [c.channel]).map(ch => {
                        const url = c.channelUrls?.[ch] ?? (ch === c.channel ? c.postUrl : undefined)
                        const m = NETWORK_META[ch]
                        if (url) {
                          return (
                            <a key={ch} href={url} target="_blank" rel="noopener noreferrer"
                              title={`Ver en ${m?.label ?? ch}`}
                              className="w-5 h-5 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ background: m?.bg ?? '#f3f4f6', color: m?.dot ?? '#9ca3af' }}>
                              <NetworkIcon network={ch as import('@/cmhub/types').Network} size={10} />
                            </a>
                          )
                        }
                        return (
                          <div key={ch} className="w-5 h-5 rounded-md flex items-center justify-center"
                            title={`Sin link de ${m?.label ?? ch}`}
                            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: isDark ? 'rgba(255,255,255,0.18)' : '#d1d5db' }}>
                            <NetworkIcon network={ch as import('@/cmhub/types').Network} size={10} />
                          </div>
                        )
                      })}
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-2 py-2.5">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <RowActionsMenu
                        content={c}
                        onOpenFull={() => openEdit(c)}
                        onDuplicate={() => duplicateContent(c.id)}
                        onDelete={() => deleteContent(c.id)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#9ca3af] text-[13px]">
                  No se encontraron publicaciones.{' '}
                  <button onClick={openNew} className="text-[#7c3aed] hover:underline">Crear una nueva →</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-[#e5e7eb] px-6 py-2.5 flex items-center shrink-0">
        <span className="text-[12px] text-[#9ca3af]">Mostrando {filtered.length} de {contents.length} publicaciones</span>
      </div>

      {showModal && (
        <ContentModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
        />
      )}

      {showMetricsImport && (
        <MetricsImportModal onClose={() => setShowMetricsImport(false)} />
      )}
    </div>
  )
}
