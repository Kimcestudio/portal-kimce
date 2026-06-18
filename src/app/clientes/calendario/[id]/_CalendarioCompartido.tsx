'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, X, ExternalLink, Calendar, CalendarDays, Loader2 } from 'lucide-react'
import { db } from '@/services/firebase/client'
import { HubThemeProvider, useHubMeta } from '@/cmhub/theme'
import { ALL_STATUSES } from '@/cmhub/data'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Brand, Content } from '@/cmhub/types'

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function mondayOf(d: Date) {
  const off = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - off)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getContentNetworks(c: Content) {
  return c.channels?.length ? c.channels : [c.channel]
}

function getDriveEmbedUrl(url?: string | null): string | null {
  if (!url) return null
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  const fileId = fileMatch?.[1] ?? idMatch?.[1]
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null
}

function CalendarioCompartidoInner() {
  const params = useParams<{ id: string }>()
  const { NETWORK_META, STATUS_META } = useHubMeta()

  // Con output:export + Firebase Hosting rewrite, useParams puede quedarse con '_'
  // (el shell pre-renderizado). Leemos el ID real de window.location en el cliente.
  const [brandId, setBrandId] = useState<string>(params?.id ?? '_')

  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const urlId = segments[segments.length - 1]
    if (urlId && urlId !== '_') setBrandId(urlId)
  }, [])

  const [brand, setBrand] = useState<Brand | null | undefined>(undefined)
  const [contents, setContents] = useState<Content[]>([])
  const [loadingContents, setLoadingContents] = useState(true)
  const [view, setView] = useState<'mes' | 'semana'>('mes')
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)

  useEffect(() => {
    if (!brandId || brandId === '_') return
    const unsub = onSnapshot(
      doc(db, 'cmhub_brands', brandId),
      (snap) => setBrand(snap.exists() ? ({ id: snap.id, ...snap.data() } as Brand) : null),
      () => setBrand(null),
    )
    return () => unsub()
  }, [brandId])

  useEffect(() => {
    if (!brandId || brandId === '_' || !brand?.calendarShareEnabled) {
      setLoadingContents(false)
      return
    }
    const q = query(collection(db, 'cmhub_contents'), where('brandId', '==', brandId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setContents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Content)))
        setLoadingContents(false)
      },
      () => setLoadingContents(false),
    )
    return () => unsub()
  }, [brandId, brand?.calendarShareEnabled])

  const todayISO = toISO(new Date())

  const monthDays = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const start = mondayOf(first)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { date: d, dateISO: toISO(d), thisMonth: d.getMonth() === anchor.getMonth() }
    })
  }, [anchor])

  const weekDays = useMemo(() => {
    const start = mondayOf(anchor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { date: d, dateISO: toISO(d), thisMonth: true }
    })
  }, [anchor])

  const visibleDays = view === 'mes' ? monthDays : weekDays

  const filteredContents = useMemo(() => {
    return contents.filter((c) => {
      if (filterNetwork === 'all') return true
      const nets = c.channels?.length ? c.channels : [c.channel]
      return nets.includes(filterNetwork as never)
    })
  }, [contents, filterNetwork])

  const contentsByDay = useMemo(() => {
    const map = new Map<string, Content[]>()
    filteredContents.forEach((c) => {
      if (!c.date) return
      const list = map.get(c.date) ?? []
      list.push(c)
      map.set(c.date, list)
    })
    return map
  }, [filteredContents])

  const periodLabel = useMemo(() => {
    if (view === 'mes') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    const start = weekDays[0]?.date
    const end = weekDays[6]?.date
    if (!start || !end) return ''
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
  }, [view, anchor, weekDays])

  function shift(dir: 1 | -1) {
    setAnchor((d) => {
      const nd = new Date(d)
      if (view === 'mes') nd.setMonth(d.getMonth() + dir)
      else nd.setDate(d.getDate() + dir * 7)
      return nd
    })
  }

  function goToday() {
    setAnchor(mondayOf(new Date()))
  }

  function openDay(dateISO: string) {
    setSelectedDay(dateISO)
    setSelectedContentId(null)
  }

  function closePanel() {
    setSelectedDay(null)
    setSelectedContentId(null)
  }

  if (brandId === '_' || brand === undefined || (brand?.calendarShareEnabled && loadingContents)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  if (!brand || !brand.calendarShareEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-8 max-w-md text-center">
          <div className="text-[16px] font-bold text-[#111827] mb-2">Calendario no disponible</div>
          <div className="text-[13px] text-[#6b7280]">
            Este enlace no existe o el calendario fue desactivado por el administrador.
          </div>
        </div>
      </div>
    )
  }

  const selectedContents = selectedDay ? contentsByDay.get(selectedDay) ?? [] : []
  const activeContent = selectedContentId
    ? selectedContents.find((c) => c.id === selectedContentId) ?? null
    : selectedContents.length === 1
      ? selectedContents[0]
      : null
  const showSummaryList = selectedContents.length > 1 && !activeContent

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[14px] font-extrabold text-white shadow-md shrink-0" style={{ background: brand.color }}>
            {brand.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-[#111827] truncate">{brand.name}</h1>
            <div className="text-[12px] text-[#9ca3af]">Calendario de contenidos · solo lectura</div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#f0fdf4] text-[#16a34a] shrink-0">
            En vivo
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="w-8 h-8 rounded-xl border border-[#e5e7eb] flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={goToday} className="text-[12px] font-semibold text-[#6b7280] hover:text-[#111827] px-2">
              Hoy
            </button>
            <button onClick={() => shift(1)} className="w-8 h-8 rounded-xl border border-[#e5e7eb] flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
              <ChevronRight size={15} />
            </button>
            <span className="text-[14px] font-bold text-[#111827] ml-1 capitalize">{periodLabel}</span>
          </div>

          <div className="flex border border-[#e5e7eb] rounded-xl overflow-hidden shrink-0">
            <button
              onClick={() => setView('mes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${view === 'mes' ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#6b7280] hover:bg-[#f9fafb]'}`}
            >
              <Calendar size={12} /> Mes
            </button>
            <button
              onClick={() => setView('semana')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${view === 'semana' ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#6b7280] hover:bg-[#f9fafb]'}`}
            >
              <CalendarDays size={12} /> Semana
            </button>
          </div>
        </div>

        <NetworkFilter contents={contents} value={filterNetwork} onChange={setFilterNetwork} />

        <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#f3f4f6]">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] text-center py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 ${view === 'mes' ? '' : 'min-h-[420px]'}`}>
            {visibleDays.map((cell) => {
              const dayContents = contentsByDay.get(cell.dateISO) ?? []
              const isToday = cell.dateISO === todayISO
              const visible = view === 'mes' ? dayContents.slice(0, 3) : dayContents
              const extra = view === 'mes' ? dayContents.length - visible.length : 0
              const isClickable = view === 'semana' || dayContents.length > 0
              return (
                <button
                  key={cell.dateISO}
                  onClick={() => isClickable && openDay(cell.dateISO)}
                  className={`border-b border-r border-[#f3f4f6] p-2 text-left flex flex-col gap-1 transition-colors ${
                    cell.thisMonth ? 'bg-white' : 'bg-[#fafafa]'
                  } ${isClickable ? 'hover:bg-[#f9fafb] cursor-pointer' : 'cursor-default'} ${view === 'mes' ? 'min-h-[92px]' : 'min-h-[420px] align-top'}`}
                >
                  <span
                    className={`text-[12px] font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-[#7c3aed] text-white' : cell.thisMonth ? 'text-[#374151]' : 'text-[#d1d5db]'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {visible.map((c) => {
                      const statusMeta = STATUS_META[c.status]
                      const isHighlighted = c.status === 'programado' || c.status === 'publicado'
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[10px] font-semibold truncate ${
                            isHighlighted ? '' : 'border border-[#e2e8f0]'
                          }`}
                          style={
                            isHighlighted
                              ? { background: statusMeta?.bg ?? '#f3f4f6', color: statusMeta?.text ?? '#374151' }
                              : { background: '#eef1f4', color: '#475569' }
                          }
                        >
                          {!isHighlighted && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: statusMeta?.dot ?? '#9ca3af' }} />
                          )}
                          <span
                            className="shrink-0 flex items-center gap-0.5"
                            style={{ color: isHighlighted ? statusMeta?.dot ?? '#6b7280' : '#6b7280' }}
                          >
                            {getContentNetworks(c).map((net) => (
                              <span key={net} className="w-3 h-3 flex items-center justify-center">
                                <NetworkIcon network={net} size={9} />
                              </span>
                            ))}
                          </span>
                          <span className="truncate">{c.title || c.format}</span>
                        </div>
                      )
                    })}
                    {extra > 0 && (
                      <span className="text-[10px] font-semibold text-[#9ca3af] px-1.5">+{extra} más</span>
                    )}
                    {view === 'semana' && dayContents.length === 0 && (
                      <span className="text-[10px] text-[#cbd5e1] px-1.5">Sin contenido</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6b7280]">
          <span className="font-semibold text-[#9ca3af] uppercase tracking-wide text-[10px]">Estado:</span>
          {ALL_STATUSES.map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_META[status]?.dot }} />
              {STATUS_META[status]?.label}
            </span>
          ))}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={closePanel}>
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {activeContent && selectedContents.length > 1 && (
                  <button
                    onClick={() => setSelectedContentId(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] transition-colors shrink-0"
                  >
                    <ChevronLeft size={15} />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[#111827] capitalize truncate">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {selectedContents.length} publicación{selectedContents.length === 1 ? '' : 'es'}
                  </div>
                </div>
              </div>
              <button onClick={closePanel} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {selectedContents.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 text-[#9ca3af]">
                  <Calendar size={28} className="mb-2 text-[#cbd5e1]" />
                  <div className="text-[13px] font-semibold text-[#6b7280]">Sin contenido programado</div>
                  <div className="text-[11px] mt-1">Aún no hay publicaciones cargadas para este día.</div>
                </div>
              )}

              {showSummaryList &&
                selectedContents.map((c) => {
                  const statusMeta = STATUS_META[c.status]
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedContentId(c.id)}
                      className="flex items-center gap-3 rounded-2xl border border-[#dde2e7] p-3 text-left transition-colors hover:bg-[#e7ebee]"
                      style={{ background: '#eef1f4' }}
                    >
                      <span className="flex items-center gap-1 shrink-0">
                        {getContentNetworks(c).map((net) => {
                          const meta = NETWORK_META[net]
                          return (
                            <span
                              key={net}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: meta?.bg ?? '#e2e8f0', color: meta?.dot ?? '#64748b' }}
                            >
                              <NetworkIcon network={net} size={12} />
                            </span>
                          )
                        })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827] truncate">{c.title || c.format}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                          {c.time && <span>{c.time}</span>}
                          <span
                            className="font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: statusMeta?.bg ?? '#e2e8f0', color: statusMeta?.text ?? '#64748b' }}
                          >
                            {statusMeta?.label ?? c.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}

              {activeContent && (() => {
                const c = activeContent
                const statusMeta = STATUS_META[c.status]
                const designLink = c.driveUrl || c.designUrl || null
                const embedUrl = getDriveEmbedUrl(c.driveUrl) ?? getDriveEmbedUrl(c.designUrl)
                return (
                  <div className="rounded-2xl border border-[#dde2e7] p-4 flex flex-col gap-3" style={{ background: '#eef1f4' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getContentNetworks(c).map((net) => {
                          const meta = NETWORK_META[net]
                          return (
                            <span key={net} className="flex items-center gap-1">
                              <span
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ background: meta?.bg ?? '#e2e8f0', color: meta?.dot ?? '#64748b' }}
                              >
                                <NetworkIcon network={net} size={12} />
                              </span>
                              <span className="text-[12px] font-semibold text-[#374151]">{meta?.label ?? net}</span>
                            </span>
                          )
                        })}
                        <span className="text-[11px] text-[#64748b]">· {c.format}</span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: statusMeta?.bg ?? '#e2e8f0', color: statusMeta?.text ?? '#64748b' }}
                      >
                        {statusMeta?.label ?? c.status}
                      </span>
                    </div>

                    <div className="text-[14px] font-bold text-[#111827]">{c.title}</div>

                    <div className="text-[11px] text-[#64748b]">
                      Fecha: {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {c.time && ` · Hora: ${c.time}`}
                    </div>

                    <div
                      className={`text-[13px] whitespace-pre-wrap rounded-xl p-3 bg-white ${
                        c.copy ? 'text-[#374151]' : 'text-[#9ca3af] italic'
                      }`}
                    >
                      {c.copy || 'Sin copy redactado.'}
                    </div>

                    {embedUrl ? (
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-[#dde2e7] overflow-hidden bg-white">
                          <iframe
                            src={embedUrl}
                            className="w-full h-64"
                            allow="autoplay"
                            title={`Diseño – ${c.title}`}
                          />
                        </div>
                        <a
                          href={designLink ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#7c3aed] hover:underline"
                        >
                          <ExternalLink size={12} /> Abrir en Drive
                        </a>
                      </div>
                    ) : designLink ? (
                      <a
                        href={designLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#7c3aed] border border-[#dde2e7] rounded-xl px-3 py-2 bg-white hover:bg-[#f5f3ff] transition-colors"
                      >
                        <ExternalLink size={13} /> Ver diseño
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#9ca3af] border border-dashed border-[#dde2e7] rounded-xl px-3 py-2 bg-white">
                        Sin diseño cargado
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CalendarioCompartidoPage() {
  return (
    <HubThemeProvider>
      <CalendarioCompartidoInner />
    </HubThemeProvider>
  )
}
