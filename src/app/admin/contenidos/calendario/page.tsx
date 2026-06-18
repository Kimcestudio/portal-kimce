'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronDown, Copy, Edit2, Plus, Trash2, Check, LayoutGrid } from 'lucide-react'
import ContentViewSwitcher from '@/components/cmhub/ContentViewSwitcher'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import { ALL_STATUSES } from '@/cmhub/data'
import ContentModal from '@/components/cmhub/ContentModal'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus, Network } from '@/cmhub/types'

type CtxMenu = {
  x: number; bottom: number; maxH: number; content: Content
  cardRect: { top: number; left: number; width: number; height: number }
  subLeft: boolean
}
type DayPopover = {
  dateISO: string; contents: Content[]
  top: number; left: number; width: number; flipUp: boolean
}


const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first offset: Sun=0 → offset=6, Mon=1 → offset=0 …
  const startOffset = (firstDay.getDay() + 6) % 7
  const prevMonthDays = new Date(year, month, 0).getDate()
  const today = new Date()

  const cells: { day: number; thisMonth: boolean; isToday: boolean; dateISO: string }[] = []

  for (let i = 0; i < startOffset; i++) {
    const d = prevMonthDays - startOffset + 1 + i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear  = month === 0 ? year - 1 : year
    cells.push({ day: d, thisMonth: false, isToday: false, dateISO: `${prevYear}-${String(prevMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
    cells.push({ day: d, thisMonth: true, isToday, dateISO: `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }

  const remaining = (7 - (cells.length % 7)) % 7
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear  = month === 11 ? year + 1 : year
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, thisMonth: false, isToday: false, dateISO: `${nextYear}-${String(nextMonth + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}` })
  }

  return cells
}

function getDayLabel(dateISO: string): string {
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().slice(0, 10)
  if (dateISO === todayISO) return 'Hoy'
  if (dateISO === tomorrowISO) return 'Mañana'
  const d = new Date(dateISO + 'T00:00:00')
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Calendario() {
  const { isDark } = useHubTheme()
  const { NETWORK_META, STATUS_META } = useHubMeta()
  const cardBase = isDark ? '#161820' : '#ffffff'
  const cardText = isDark ? '#e2e8f0' : '#374151'
  const { contents, brands, updateContent, duplicateContent, deleteContent } = useHub()
  const base = useHubBase()

  const now = new Date()

  // startDate = primer lunes visible en la cuadrícula (semana que contiene el 1 del mes)
  const [startDate, setStartDate] = useState(() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const off = (first.getDay() + 6) % 7          // días hasta el lunes anterior
    const monday = new Date(first)
    monday.setDate(first.getDate() - off)
    return monday
  })
  const [filterBrand, setFilterBrand]         = useState('all')
  const [filterNetwork, setFilterNetwork]     = useState('all')
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Partial<Content> | undefined>()
  const [draggingId, setDraggingId]     = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate]   = useState(false)
  const [overDate, setOverDate]         = useState<string | null>(null)
  const [ctxMenu, setCtxMenu]             = useState<CtxMenu | null>(null)
  const [ctxConfirmDel, setCtxConfirmDel] = useState(false)
  const [dayPopover, setDayPopover]       = useState<DayPopover | null>(null)
  const [hoverDay, setHoverDay]           = useState<{ dateISO: string; contents: Content[]; rect: DOMRect } | null>(null)
  const [hoverVisible, setHoverVisible]   = useState(false)
  const ctxRef          = useRef<HTMLDivElement>(null)
  const popRef          = useRef<HTMLDivElement>(null)
  const hoverRef        = useRef<HTMLDivElement>(null)
  const brandDropRef    = useRef<HTMLDivElement>(null)
  const hoverTimer    = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wheelTimer  = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wheelLocked = useRef(false)

  useEffect(() => {
    if (!showBrandDropdown) return
    function close(e: MouseEvent) {
      if (brandDropRef.current && !brandDropRef.current.contains(e.target as Node))
        setShowBrandDropdown(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showBrandDropdown])

  useEffect(() => {
    if (!ctxMenu) return
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null); setCtxConfirmDel(false)
      }
    }
    function closeKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setCtxMenu(null); setCtxConfirmDel(false) }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeKey) }
  }, [ctxMenu])

  useEffect(() => {
    if (!dayPopover) return
    function close(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setDayPopover(null)
    }
    function closeKey(e: KeyboardEvent) { if (e.key === 'Escape') setDayPopover(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeKey) }
  }, [dayPopover])

  // 42 días (6 semanas) desde startDate
  const calDays = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return { day: d.getDate(), dateISO: iso, isToday: iso === todayISO, date: d }
    })
  }, [startDate])

  // Mes dominante (el que tiene más días en la vista actual)
  const monthLabel = useMemo(() => {
    const counts = new Map<string, number>()
    calDays.forEach(c => {
      const key = `${MONTH_NAMES[c.date.getMonth()]} ${c.date.getFullYear()}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }, [calDays])

  const filtered = contents.filter(c => {
    if (filterBrand !== 'all' && c.brandId !== filterBrand) return false
    if (filterNetwork !== 'all' && !(c.channels?.length ? c.channels : [c.channel]).includes(filterNetwork as never)) return false
    return true
  })

  // Contenidos del mes visible (42-day range) para el conteo de filtros
  const calStart = calDays[0]?.dateISO ?? ''
  const calEnd   = calDays[calDays.length - 1]?.dateISO ?? ''
  const filteredForMonth = filtered.filter(c => c.date && c.date >= calStart && c.date <= calEnd)

  const todayISO = now.toISOString().slice(0, 10)
  const upcoming = filtered
    .filter(c => c.date && c.status !== 'publicado' && c.date >= todayISO)
    .sort((a, b) => ((a.date ?? '') + (a.time ?? '')) > ((b.date ?? '') + (b.time ?? '')) ? 1 : -1)

  function shiftWeeks(n: number) {
    setStartDate(d => { const nd = new Date(d); nd.setDate(d.getDate() + n * 7); return nd })
  }
  function prevMonth() { shiftWeeks(-4) }   // botones ‹ › = 4 semanas (~1 mes)
  function nextMonth() { shiftWeeks(4) }
  function goToday() {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const off = (first.getDay() + 6) % 7
    const monday = new Date(first); monday.setDate(first.getDate() - off)
    setStartDate(monday)
  }

  function onDragStart(e: React.DragEvent, c: Content) {
    setDraggingId(c.id)
    setIsDuplicate(e.altKey)
    e.dataTransfer.effectAllowed = e.altKey ? 'copy' : 'move'
    e.dataTransfer.setData('text/plain', c.id)
    e.stopPropagation()
  }

  function onDragEnd() {
    setDraggingId(null)
    setIsDuplicate(false)
    setOverDate(null)
  }

  function onCellDragOver(e: React.DragEvent, dateISO: string) {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = isDuplicate ? 'copy' : 'move'
    setOverDate(dateISO)
  }

  function onCellDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
      setOverDate(null)
  }

  async function onCellDrop(e: React.DragEvent, dateISO: string) {
    e.preventDefault()
    if (!draggingId) return
    if (isDuplicate) {
      const dup = await duplicateContent(draggingId)
      if (dup) updateContent(dup.id, { date: dateISO })
    } else {
      updateContent(draggingId, { date: dateISO })
    }
    setDraggingId(null)
    setIsDuplicate(false)
    setOverDate(null)
  }

  async function handleDuplicateCard(e: React.MouseEvent, c: Content) {
    e.stopPropagation()
    const dup = await duplicateContent(c.id)
    if (dup) updateContent(dup.id, { date: c.date })
  }

  function openCtxMenu(e: React.MouseEvent, c: Content) {
    e.preventDefault()
    e.stopPropagation()
    setCtxConfirmDel(false)
    setDayPopover(null)

    const cardEl = e.currentTarget as HTMLElement
    const rect   = cardEl.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const menuW = 210, subW = 178, gap = 4

    // Horizontal: pega al borde derecho de la tarjeta; si no cabe, al izquierdo
    const fitsRight = rect.right + menuW + gap <= vw - 8
    const x = fitsRight
      ? rect.right + gap
      : Math.max(8, rect.left - menuW - gap)

    // Vertical: ancla el BOTTOM del menú al BOTTOM de la tarjeta → crece hacia arriba
    // maxH = espacio disponible desde el top del viewport hasta el bottom de la tarjeta
    const maxH = Math.max(120, Math.min(440, rect.bottom - 8))
    // "bottom" en CSS fixed = distancia del borde inferior del viewport al borde inferior del menú
    const bottom = vh - rect.bottom

    const subLeft = x + menuW + subW > vw - 8

    setCtxMenu({
      x, bottom, maxH, content: c,
      cardRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      subLeft,
    })
  }

  function ctxEdit() {
    if (!ctxMenu) return
    openEdit(ctxMenu.content)
    setCtxMenu(null)
  }

  async function ctxDuplicate() {
    if (!ctxMenu) return
    const dup = await duplicateContent(ctxMenu.content.id)
    if (dup) updateContent(dup.id, { date: ctxMenu.content.date })
    setCtxMenu(null)
  }

  function ctxChangeStatus(status: ContentStatus) {
    if (!ctxMenu) return
    updateContent(ctxMenu.content.id, { status })
    setCtxMenu(null)
  }

  function ctxDelete() {
    if (!ctxMenu) return
    deleteContent(ctxMenu.content.id)
    setCtxMenu(null)
  }

  function handleCalendarWheel(e: React.WheelEvent) {
    if (wheelLocked.current) return
    e.preventDefault()
    wheelLocked.current = true
    clearTimeout(wheelTimer.current)
    shiftWeeks(e.deltaY > 0 ? 1 : -1)
    wheelTimer.current = setTimeout(() => { wheelLocked.current = false }, 180)
  }

  function scheduleExpand(e: React.MouseEvent, dateISO: string, dayContents: Content[]) {
    if (dayContents.length < 2) return
    clearTimeout(hoverTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    hoverTimer.current = setTimeout(() => {
      setHoverDay({ dateISO, contents: dayContents, rect })
      requestAnimationFrame(() => requestAnimationFrame(() => setHoverVisible(true)))
    }, 220)
  }

  function scheduleCollapse() {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setHoverVisible(false)
      setTimeout(() => setHoverDay(null), 180)
    }, 120)
  }

  function cancelCollapse() { clearTimeout(hoverTimer.current) }

  function openDayPopover(e: React.MouseEvent, dateISO: string, dayContents: Content[]) {
    e.stopPropagation()
    const cellEl = (e.currentTarget as HTMLElement).closest('[data-cell]') as HTMLElement ?? e.currentTarget as HTMLElement
    const rect = cellEl.getBoundingClientRect()
    const vh = window.innerHeight
    const popH = 60 + dayContents.length * 48
    const flipUp = rect.bottom + popH > vh - 8
    setDayPopover({
      dateISO,
      contents: dayContents,
      top: flipUp ? rect.top - popH - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
      flipUp,
    })
  }

  function openEdit(c: Content) { setEditing(c); setShowModal(true) }
  function openNew() { setEditing(undefined); setShowModal(true) }
  function openNewOnDay(dateISO: string) {
    const pre: Partial<Content> = { date: dateISO }
    if (filterBrand !== 'all') pre.brandId = filterBrand
    if (filterNetwork !== 'all') pre.channel = filterNetwork as Network
    setEditing(pre)
    setShowModal(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Calendario</span>
        </div>
        <ContentViewSwitcher />
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-8 h-8 border border-[#e5e7eb] rounded-xl flex items-center justify-center text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-semibold text-[#111827] min-w-[160px] text-center">
            {monthLabel}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 border border-[#e5e7eb] rounded-xl flex items-center justify-center text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={goToday} className="border border-[#e5e7eb] bg-white text-[#6b7280] text-[12px] font-medium px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">Hoy</button>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="px-4 py-2 bg-white border-b border-[#f3f4f6] shrink-0 flex items-center gap-3">

        {/* Filtros de red — expanden al hover; conteo por mes visible */}
        <NetworkFilter
          contents={filterBrand === 'all' ? contents : contents.filter(c => c.brandId === filterBrand)}
          countContents={filteredForMonth}
          value={filterNetwork}
          onChange={setFilterNetwork}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Dropdown selector de clientes (derecha) ── */}
        <div ref={brandDropRef} className="relative shrink-0">
          <button
            onClick={() => setShowBrandDropdown(v => !v)}
            className={`flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-xl border transition-all duration-200 ${
              showBrandDropdown
                ? 'border-[#7c3aed] bg-[#f5f3ff] shadow-sm'
                : 'border-[#e5e7eb] bg-white hover:border-[#c4b5fd] hover:shadow-sm'
            }`}
          >
            {filterBrand === 'all' ? (
              <>
                <div className="w-6 h-6 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0">
                  <LayoutGrid size={12} className="text-[#6b7280]" />
                </div>
                <span className="text-[13px] font-semibold text-[#374151]">Todos los clientes</span>
              </>
            ) : (() => {
              const b = brands.find(br => br.id === filterBrand)
              return b ? (
                <>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: b.color }}>
                    {b.initials}
                  </div>
                  <span className="text-[13px] font-semibold text-[#374151] max-w-[140px] truncate">{b.name}</span>
                </>
              ) : null
            })()}
            <ChevronDown size={13} className={`text-[#9ca3af] transition-transform duration-200 ml-0.5 ${showBrandDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Panel desplegable */}
          {showBrandDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl border border-[#e5e7eb] z-50 overflow-hidden"
              style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)' }}>
              <div className="p-2">
                {/* Todos */}
                <button
                  onClick={() => { setFilterBrand('all'); setShowBrandDropdown(false) }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-colors ${
                    filterBrand === 'all' ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0">
                    <LayoutGrid size={14} className="text-[#6b7280]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[13px] font-semibold ${filterBrand === 'all' ? 'text-[#7c3aed]' : 'text-[#111827]'}`}>
                      Todos los clientes
                    </p>
                    <p className="text-[11px] text-[#9ca3af]">{contents.length} publicaciones</p>
                  </div>
                  {filterBrand === 'all' && <Check size={14} className="text-[#7c3aed] shrink-0" />}
                </button>

                <div className="border-t border-[#f3f4f6] my-1.5" />

                {/* Lista de marcas */}
                <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                  {brands.map(b => {
                    const count = contents.filter(c => c.brandId === b.id).length
                    const active = filterBrand === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => { setFilterBrand(b.id); setShowBrandDropdown(false) }}
                        className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-colors ${
                          active ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ background: b.color }}>
                          {b.initials}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`text-[13px] font-semibold truncate ${active ? 'text-[#7c3aed]' : 'text-[#111827]'}`}>
                            {b.name}
                          </p>
                          <p className="text-[11px] text-[#9ca3af]">{count} publicaciones</p>
                        </div>
                        {active && <Check size={14} className="text-[#7c3aed] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 flex flex-col overflow-hidden" onWheel={handleCalendarWheel}>
          <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-white shrink-0">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="py-2.5 text-center text-[11px] font-bold text-[#9ca3af] uppercase tracking-wide">{d}</div>
            ))}
          </div>

          <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 grid grid-cols-7 border-l border-[#e5e7eb] bg-[#f8fafc] overflow-y-auto"
            style={{ gridAutoRows: 'minmax(148px, 1fr)' }}>
            {calDays.map((cell, i) => {
              const dayContents = filtered.filter(c => c.date === cell.dateISO)
              const isDropTarget = overDate === cell.dateISO && draggingId !== null
              // días del mes dominante = plenos, otros = levemente atenuados
              const isDominant = cell.date.getMonth() === calDays[20].date.getMonth()
              const cellBg = isDropTarget
                ? (isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff')
                : cell.isToday
                  ? (isDark ? 'rgba(99,102,241,0.1)' : '#f5f3ff')
                  : isDominant
                    ? (isDark ? '#0f1115' : '#f5f6f8')
                    : (isDark ? '#0c0e11' : '#eef0f2')
              return (
                <div
                  key={i}
                  data-cell
                  className={`border-r border-b border-[#e5e7eb] p-1.5 flex flex-col gap-1 overflow-hidden transition-colors relative
                    ${isDropTarget ? `ring-2 ring-inset ${isDuplicate ? 'ring-emerald-400' : 'ring-indigo-400'}` : 'cursor-pointer'}`}
                  style={{ background: cellBg }}
                  onClick={() => !draggingId && openNewOnDay(cell.dateISO)}
                  onMouseEnter={e => scheduleExpand(e, cell.dateISO, dayContents)}
                  onMouseLeave={scheduleCollapse}
                  onDragOver={e => onCellDragOver(e, cell.dateISO)}
                  onDragLeave={onCellDragLeave}
                  onDrop={e => onCellDrop(e, cell.dateISO)}
                >
                  {isDropTarget && (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] font-bold ${isDuplicate ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {isDuplicate ? '⊕ Duplicar aquí' : '↓ Mover aquí'}
                    </div>
                  )}
                  <div className={`text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0
                    ${isDominant ? 'text-[#6b7280]' : 'text-[#c8cdd6]'}
                    ${cell.isToday ? '!bg-[#7c3aed] !text-white' : ''}`}>
                    {cell.day}
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayContents.slice(0, 2).map(c => {
                      const channels = c.channels?.length ? c.channels : [c.channel]
                      const brand = brands.find(b => b.id === c.brandId)
                      const isBeingDragged = draggingId === c.id
                      const sm = STATUS_META[c.status]
                      const isFull = c.status === 'programado' || c.status === 'publicado'
                      return (
                        <div key={c.id}
                          draggable
                          onDragStart={e => onDragStart(e, c)}
                          onDragEnd={onDragEnd}
                          onContextMenu={e => openCtxMenu(e, c)}
                          className={`group relative flex flex-col gap-0.5 text-[11px] font-medium px-1.5 py-1 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing ${isBeingDragged ? 'opacity-40' : isDominant ? 'opacity-100' : 'opacity-50'}`}
                          style={{
                            background: isFull ? (sm?.bg ?? '#f3f4f6') : cardBase,
                            color: isFull ? (sm?.text ?? '#374151') : cardText,
                            borderLeft: isFull ? undefined : `3px solid ${sm?.dot ?? '#e5e7eb'}`,
                            filter: isDominant ? undefined : 'grayscale(0.65) brightness(0.92)',
                          }}
                          onClick={e => { e.stopPropagation(); if (!draggingId) openEdit(c) }}
                        >
                          <span className="flex items-center gap-1 truncate">
                            {channels.slice(0, 3).map(ch => {
                              const nm = NETWORK_META[ch]
                              return (
                                <span key={ch} className="shrink-0" style={{ color: nm?.dot ?? '#6b7280' }}>
                                  <NetworkIcon network={ch} size={10} />
                                </span>
                              )
                            })}
                            {channels.length > 3 && (
                              <span className="text-[9px] font-bold opacity-60">+{channels.length - 3}</span>
                            )}
                            <span className="truncate font-semibold">{brand?.name.split(' ')[0]}</span>
                            <button
                              type="button"
                              onClick={e => handleDuplicateCard(e, c)}
                              title="Duplicar"
                              className="ml-auto shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                            >
                              <Copy size={8} />
                            </button>
                          </span>
                          <span className="truncate leading-tight opacity-70">{c.format} · {c.title}</span>
                        </div>
                      )
                    })}
                    {dayContents.length > 2 && (
                      <button
                        type="button"
                        onClick={e => openDayPopover(e, cell.dateISO, dayContents)}
                        className="text-[10px] text-[#9ca3af] px-1 hover:text-[#7c3aed] text-left transition-colors"
                      >
                        + {dayContents.length - 2} más…
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>{/* cierre overflow-hidden wrapper */}
        </div>

        {/* Side panel — upcoming posts from today onwards */}
        <div className="w-72 border-l border-[#e5e7eb] bg-white flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-[#f3f4f6] shrink-0">
            <span className="text-[15px] font-bold text-[#111827]">Próximos posts</span>
            <span className="text-[12px] text-[#9ca3af] ml-2">{monthLabel}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const groups: Record<string, typeof upcoming> = {}
              upcoming.forEach(c => {
                const d = c.date!
                if (!groups[d]) groups[d] = []
                groups[d].push(c)
              })
              return Object.entries(groups).map(([date, posts]) => (
                <div key={date} className="border-b border-[#f3f4f6]">
                  <div className="px-5 py-2 bg-[#f9fafb] text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide capitalize">
                    {getDayLabel(date)}
                  </div>
                  {posts.map(c => {
                    const channels = c.channels?.length ? c.channels : [c.channel]
                    const st = STATUS_META[c.status]
                    const brand = brands.find(b => b.id === c.brandId)
                    return (
                      <div key={c.id} onClick={() => openEdit(c)} className="flex items-start gap-2.5 px-5 py-3 hover:bg-[#fafafa] cursor-pointer transition-colors">
                        <div className="flex gap-0.5 shrink-0 pt-0.5">
                          {channels.slice(0, 3).map(ch => {
                            const m = NETWORK_META[ch]
                            return (
                              <div key={ch} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: m?.bg, color: m?.dot }}>
                                <NetworkIcon network={ch} size={12} />
                              </div>
                            )
                          })}
                          {channels.length > 3 && (
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#f3f4f6] text-[9px] font-bold text-[#6b7280]">
                              +{channels.length - 3}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">{brand?.name}</div>
                          <div className="text-[12px] text-[#111827] truncate mt-0.5">{c.title}</div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] font-mono text-[#9ca3af]">{c.time ?? '—'}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: st?.bg, color: st?.text }}>{st?.label}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
            {upcoming.length === 0 && (
              <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af]">Sin publicaciones próximas</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hover expand — celda que crece con animación ── */}
      {hoverDay && (
        <div
          ref={hoverRef}
          onMouseEnter={cancelCollapse}
          onMouseLeave={scheduleCollapse}
          className="fixed z-[995] bg-white rounded-2xl border border-[#e5e7eb] shadow-2xl overflow-hidden pointer-events-auto"
          style={{
            top: hoverDay.rect.top,
            left: hoverDay.rect.left,
            width: hoverDay.rect.width,
            minHeight: hoverDay.rect.height,
            transformOrigin: 'top left',
            transform: hoverVisible ? 'scale(1.08) translateY(-6px)' : 'scale(1) translateY(0)',
            opacity: hoverVisible ? 1 : 0,
            transition: 'transform 200ms cubic-bezier(.22,.68,0,1.2), opacity 160ms ease',
            boxShadow: hoverVisible ? '0 20px 60px rgba(0,0,0,0.18)' : 'none',
          }}
        >
          {/* Número del día */}
          <div className="px-2 pt-2 pb-1">
            <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${hoverDay.contents[0] && new Date().toISOString().slice(0,10) === hoverDay.dateISO ? 'bg-[#7c3aed] text-white' : 'text-[#6b7280]'}`}>
              {parseInt(hoverDay.dateISO.slice(8))}
            </span>
          </div>
          {/* Todas las tarjetas */}
          <div className="flex flex-col gap-0.5 px-1.5 pb-2">
            {hoverDay.contents.map(c => {
              const channels = c.channels?.length ? c.channels : [c.channel]
              const brand = brands.find(b => b.id === c.brandId)
              const sm = STATUS_META[c.status]
              const isFull = c.status === 'programado' || c.status === 'publicado'
              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => {
                    onDragStart(e, c)
                    setHoverVisible(false)
                    setTimeout(() => setHoverDay(null), 0)
                  }}
                  onDragEnd={onDragEnd}
                  className="flex flex-col gap-0.5 text-[11px] font-medium px-1.5 py-1 rounded-lg cursor-grab active:cursor-grabbing"
                  style={{
                    background: isFull ? (sm?.bg ?? '#f3f4f6') : cardBase,
                    color: isFull ? (sm?.text ?? '#374151') : cardText,
                    borderLeft: isFull ? undefined : `3px solid ${sm?.dot ?? '#e5e7eb'}`,
                  }}
                  onClick={e => { e.stopPropagation(); setHoverDay(null); openEdit(c) }}
                  onContextMenu={e => { setHoverDay(null); openCtxMenu(e, c) }}
                >
                  <span className="flex items-center gap-1">
                    {channels.slice(0, 3).map(ch => {
                      const nm = NETWORK_META[ch]
                      return (
                        <span key={ch} className="shrink-0" style={{ color: nm?.dot ?? '#6b7280' }}>
                          <NetworkIcon network={ch} size={10} />
                        </span>
                      )
                    })}
                    {channels.length > 3 && <span className="text-[9px] opacity-60">+{channels.length - 3}</span>}
                    <span className="truncate font-semibold">{brand?.name.split(' ')[0]}</span>
                  </span>
                  <span className="opacity-70 leading-tight">{c.format} · {c.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Day popover — todos los contenidos del día ── */}
      {dayPopover && (
        <div
          ref={popRef}
          className="fixed z-[996] bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] overflow-hidden"
          style={{ top: dayPopover.top, left: dayPopover.left, width: dayPopover.width, minWidth: 220, maxWidth: 320 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#f3f4f6] bg-[#fafafa]">
            <span className="text-[11px] font-bold text-[#374151] capitalize">{getDayLabel(dayPopover.dateISO)}</span>
            <span className="text-[10px] text-[#9ca3af]">{dayPopover.contents.length} publicaciones</span>
          </div>
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {dayPopover.contents.map(c => {
              const channels = c.channels?.length ? c.channels : [c.channel]
              const primaryNet = NETWORK_META[channels[0]]
              const brand = brands.find(b => b.id === c.brandId)
              const st = STATUS_META[c.status]
              return (
                <button
                  key={c.id}
                  type="button"
                  draggable
                  onDragStart={e => { onDragStart(e, c); setDayPopover(null) }}
                  onDragEnd={onDragEnd}
                  onClick={() => { openEdit(c); setDayPopover(null) }}
                  onContextMenu={e => { setDayPopover(null); openCtxMenu(e, c) }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#f9fafb] transition-colors text-left cursor-grab active:cursor-grabbing"
                >
                  <div className="flex gap-0.5 shrink-0">
                    {channels.slice(0, 2).map(ch => {
                      const m = NETWORK_META[ch]
                      return (
                        <span key={ch} className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: m?.bg, color: m?.dot }}>
                          <NetworkIcon network={ch} size={10} />
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                    <p className="text-[10px] text-[#9ca3af]">{brand?.name} · {c.format}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: st?.bg, color: st?.text }}>{st?.label}</span>
                </button>
              )
            })}
          </div>
          <div className="border-t border-[#f3f4f6] px-3 py-2">
            <button
              type="button"
              onClick={e => { openNewOnDay(dayPopover.dateISO); setDayPopover(null) }}
              className="flex items-center gap-1.5 text-[11px] text-[#7c3aed] font-semibold hover:underline"
            >
              <Plus size={11} /> Nueva publicación este día
            </button>
          </div>
        </div>
      )}

      {/* ── Overlay oscuro + blur cuando hay menú contextual ── */}
      {ctxMenu && (
        <div
          className="fixed inset-0 z-[997] bg-black/40 backdrop-blur-[2px]"
          onClick={() => { setCtxMenu(null); setCtxConfirmDel(false) }}
        />
      )}

      {/* ── Tarjeta spotlight — flota encima del overlay ── */}
      {ctxMenu && (() => {
        const c = ctxMenu.content
        const channels = c.channels?.length ? c.channels : [c.channel]
        const brand = brands.find(b => b.id === c.brandId)
        const sm = STATUS_META[c.status]
        const isFull = c.status === 'programado' || c.status === 'publicado'
        return (
          <div
            className="fixed z-[998] pointer-events-none rounded-lg ring-2 ring-white/80 shadow-2xl overflow-hidden"
            style={{
              top: ctxMenu.cardRect.top,
              left: ctxMenu.cardRect.left,
              width: ctxMenu.cardRect.width,
              minHeight: ctxMenu.cardRect.height,
            }}
          >
            <div
              className="flex flex-col gap-0.5 text-[11px] font-medium px-1.5 py-1"
              style={{
                background: isFull ? (sm?.bg ?? '#f3f4f6') : cardBase,
                color: isFull ? (sm?.text ?? '#374151') : cardText,
                borderLeft: isFull ? undefined : `3px solid ${sm?.dot ?? '#e5e7eb'}`,
              }}
            >
              <span className="flex items-center gap-1 truncate">
                {channels.slice(0, 3).map(ch => {
                  const nm = NETWORK_META[ch]
                  return (
                    <span key={ch} className="shrink-0" style={{ color: nm?.dot ?? '#6b7280' }}>
                      <NetworkIcon network={ch} size={10} />
                    </span>
                  )
                })}
                {channels.length > 3 && <span className="text-[9px] font-bold opacity-60">+{channels.length - 3}</span>}
                <span className="truncate font-semibold">{brand?.name.split(' ')[0]}</span>
              </span>
              <span className="truncate leading-tight opacity-70">{c.format} · {c.title}</span>
            </div>
          </div>
        )
      })()}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[999] bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] text-[13px] flex flex-col"
          style={{
            bottom: ctxMenu.bottom,
            left: ctxMenu.x,
            width: 210,
            maxHeight: ctxMenu.maxH,
          }}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-[#f3f4f6] shrink-0">
            <p className="text-[11px] font-semibold text-[#111827] truncate">{ctxMenu.content.title}</p>
            <p className="text-[10px] text-[#9ca3af]">{ctxMenu.content.date ?? 'Sin fecha'}</p>
          </div>

          {/* Acciones fijas */}
          <div className="shrink-0">
            <button onClick={ctxEdit} className="flex items-center gap-2.5 w-full px-3 py-2 text-[#374151] hover:bg-[#f9fafb] transition-colors">
              <Edit2 size={13} className="text-[#9ca3af]" /> Abrir ficha
            </button>
            <button onClick={ctxDuplicate} className="flex items-center gap-2.5 w-full px-3 py-2 text-[#374151] hover:bg-[#f9fafb] transition-colors">
              <Copy size={13} className="text-[#9ca3af]" /> Duplicar al mismo día
            </button>
          </div>

          {/* Cambiar estado — submenu al hover, con scroll si necesita */}
          <div className="border-t border-[#f3f4f6] mt-1 pt-1 shrink-0 relative group/status">
            <button className="flex items-center justify-between w-full px-3 py-2 text-[#374151] hover:bg-[#f9fafb] transition-colors">
              <span className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_META[ctxMenu.content.status]?.dot ?? '#94a3b8' }} />
                Cambiar estado
              </span>
              <span className="text-[#9ca3af] text-[11px]">›</span>
            </button>
            {/* Submenu — se abre al lado sin cortar */}
            <div
              className={`absolute top-0 w-44 bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] py-1.5 hidden group-hover/status:block z-10 overflow-y-auto ${ctxMenu.subLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
              style={{ maxHeight: ctxMenu.maxH }}
            >
              {ALL_STATUSES.map(s => {
                const meta = STATUS_META[s]
                const isCurrent = ctxMenu.content.status === s
                return (
                  <button
                    key={s}
                    onClick={() => ctxChangeStatus(s)}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 transition-colors ${isCurrent ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]'}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.dot }} />
                    <span className={`text-[12px] ${isCurrent ? 'font-semibold text-[#7c3aed]' : 'text-[#374151]'}`}>{meta?.label ?? s}</span>
                    {isCurrent && <Check size={10} className="ml-auto shrink-0 text-[#7c3aed]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Eliminar */}
          <div className="border-t border-[#f3f4f6] mt-1 pt-1">
            {!ctxConfirmDel ? (
              <button onClick={() => setCtxConfirmDel(true)} className="flex items-center gap-2.5 w-full px-3 py-2 text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={13} /> Eliminar
              </button>
            ) : (
              <div className="px-3 py-2">
                <p className="text-[11px] text-[#374151] mb-2">¿Eliminar esta publicación?</p>
                <div className="flex gap-2">
                  <button onClick={() => setCtxConfirmDel(false)} className="flex-1 text-[11px] border border-[#e5e7eb] rounded-lg py-1 text-[#6b7280] hover:bg-[#f9fafb]">Cancelar</button>
                  <button onClick={ctxDelete} className="flex-1 text-[11px] bg-red-500 rounded-lg py-1 text-white font-semibold hover:bg-red-600">Eliminar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <ContentModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}
