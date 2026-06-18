'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Download, FileText, ExternalLink, Loader2, Presentation, BarChart2, Columns3, TrendingUp, Link2, Radio, MessageSquare, CheckCircle2, Lightbulb, Globe } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubMeta } from '@/cmhub/theme'
import { NETWORK_META, STATUS_META, PRIORITY_META } from '@/cmhub/data'
import { generateInsights, generateRecommendations } from '@/cmhub/insights'
import ContentModal from '@/components/cmhub/ContentModal'
import BrandModal from '@/components/cmhub/BrandModal'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus, Network } from '@/cmhub/types'

const KANBAN_COLS: { key: ContentStatus; color: string; bg: string }[] = [
  { key: 'idea',       color: '#94a3b8', bg: '#f1f5f9' },
  { key: 'produccion', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'revision',   color: '#f59e0b', bg: '#fef3c7' },
  { key: 'aprobado',   color: '#10b981', bg: '#d1fae5' },
  { key: 'programado', color: '#16a34a', bg: '#f0fdf4' },
  { key: 'publicado',  color: '#8b5cf6', bg: '#ede9fe' },
]

function StatusDot({ status }: { status: string }) {
  const s = STATUS_META[status]
  return <div className="w-2 h-2 rounded-full inline-block" style={{ background: s?.dot }} />
}

type Tab = 'resumen' | 'kanban' | 'metricas' | 'informes' | 'recursos'
const TABS: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: 'resumen',   label: 'Resumen',  Icon: BarChart2 },
  { key: 'kanban',    label: 'Kanban',   Icon: Columns3 },
  { key: 'metricas',  label: 'Métricas', Icon: TrendingUp },
  { key: 'informes',  label: 'Informes', Icon: FileText },
  { key: 'recursos',  label: 'Recursos', Icon: Link2 },
]

export default function BrandWorkspace() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const BASE = useHubBase()
  const { NETWORK_META, STATUS_META, PRIORITY_META } = useHubMeta()
  const { brands, getBrandById, getContentsByBrand, updateContent, loading } = useHub()

  // Con output:export + Firebase Hosting rewrite, useParams puede quedarse con '_'
  // (el shell pre-renderizado). Leemos el ID real de window.location en el cliente.
  const [id, setId] = useState<string>(params?.id ?? '_')

  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const urlId = segments[segments.length - 1]
    if (urlId && urlId !== '_') setId(urlId)
  }, [])

  const brand = getBrandById(id)
  const contents = getContentsByBrand(id)

  // Mostrar spinner mientras: carga Firestore, ID aún es el shell '_', o brands vacío
  const stillLoading = loading || id === '_' || (!brand && brands.length === 0)

  const [tab, setTab] = useState<Tab>('resumen')
  const [showContentModal, setShowContentModal] = useState(false)
  const [editingContent, setEditingContent] = useState<Content | undefined>()
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<ContentStatus | null>(null)
  const [pptLoading, setPptLoading] = useState(false)
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  async function handleExportCSV() {
    if (!brand) return
    const { exportCSV } = await import('@/cmhub/export')
    exportCSV(contents, brand)
  }

  async function handleExportExcel() {
    if (!brand) return
    const { exportExcel } = await import('@/cmhub/export')
    exportExcel(contents, brand)
  }

  async function handlePrintReport() {
    if (!brand) return
    const { openPrintReport } = await import('@/cmhub/export')
    openPrintReport(brand, contents)
  }

  const availableMonths = useMemo(() => {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const months = [...new Set(
      contents.map(c => c.date?.substring(0, 7)).filter((m): m is string => Boolean(m))
    )].sort((a, b) => b.localeCompare(a))
    return months.map(ym => {
      const [y, m] = ym.split('-')
      return { key: ym, label: `${MESES[parseInt(m) - 1]} ${y}`, count: contents.filter(c => c.date?.startsWith(ym)).length }
    })
  }, [contents])

  async function doExportWebReport(monthFilter: string | null) {
    if (!brand) return
    setShowMonthPicker(false)
    const filtered = monthFilter ? contents.filter(c => c.date?.startsWith(monthFilter)) : contents
    const { exportWebReport } = await import('@/cmhub/export')
    exportWebReport(brand, filtered)
  }

  async function handleExportPPT() {
    if (!brand) return
    setPptLoading(true)
    try {
      const { exportPPT } = await import('@/cmhub/pptExport')
      await exportPPT(brand, contents)
    } catch (err) {
      console.error('PPT export error:', err)
      alert('Error generando el PPT: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPptLoading(false)
    }
  }

  if (stillLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#f8fafc] gap-3">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
        <p className="text-[13px] text-[#9ca3af]">Cargando workspace…</p>
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#f8fafc]">
        <div className="text-[16px] font-semibold text-[#111827] mb-2">Marca no encontrada</div>
        <button onClick={() => router.push(`${BASE}/clientes`)} className="text-[#7c3aed] text-[13px] hover:underline">← Volver a clientes</button>
      </div>
    )
  }

  const published = contents.filter(c => c.status === 'publicado')
  const approved  = contents.filter(c => c.status === 'aprobado')
  const pending   = contents.filter(c => ['revision'].includes(c.status))
  const ideas     = contents.filter(c => c.status === 'idea')
  const insights  = generateInsights(contents, brand)
  const recs      = generateRecommendations(contents, brand)

  function onDrop(status: ContentStatus) {
    if (!dragging) return
    updateContent(dragging, { status })
    setDragging(null)
    setOver(null)
  }

  function openEdit(c: Content) {
    setEditingContent(c)
    setShowContentModal(true)
  }

  function openNew() {
    setEditingContent(undefined)
    setShowContentModal(true)
  }

  const totalReach = published.reduce((a, c) => a + (c.metrics?.reach ?? 0), 0)
  const avgEng = (() => {
    const rates = published.flatMap(c => c.metrics?.engagementRate ? [c.metrics.engagementRate] : [])
    return rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : '—'
  })()

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push(`${BASE}/clientes`)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold text-white" style={{ background: brand.color }}>{brand.initials}</div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-[#9ca3af]">Clientes</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">{brand.name}</span>
        </div>
        <button onClick={() => setShowBrandModal(true)} className="flex items-center gap-1.5 border border-[#e5e7eb] text-[#6b7280] text-[12px] px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
          <Edit2 size={12} /> Editar marca
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={14} /> Nueva publicación
        </button>
      </div>

      {/* Brand header */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-extrabold text-white shadow-md" style={{ background: brand.color }}>{brand.initials}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold text-[#111827]">{brand.name}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${brand.status === 'active' ? 'bg-[#dcfce7] text-[#16a34a]' : brand.status === 'paused' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                {brand.status === 'active' ? 'ACTIVO' : brand.status === 'paused' ? 'PAUSADO' : 'CERRADO'}
              </span>
            </div>
            <div className="text-[12px] text-[#9ca3af] mt-0.5">{brand.industry} · {brand.country} · Responsable: {brand.responsible}</div>
            <div className="flex gap-1 mt-2">
              {brand.channels.map(n => (
                <div key={n} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: NETWORK_META[n]?.bg ?? '#f3f4f6', color: NETWORK_META[n]?.dot ?? '#9ca3af' }} title={NETWORK_META[n]?.label}>
                  <NetworkIcon network={n} size={12} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 text-center">
            {[
              { val: contents.length, label: 'Total' },
              { val: published.length, label: 'Publicados' },
              { val: approved.length, label: 'Aprobados' },
              { val: pending.length, label: 'Pendientes' },
            ].map(({ val, label }) => (
              <div key={label}>
                <div className="text-[22px] font-bold text-[#111827]">{val}</div>
                <div className="text-[10px] text-[#9ca3af]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e7eb] bg-white px-6 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors ${tab === t.key ? 'text-[#7c3aed] border-[#7c3aed]' : 'text-[#9ca3af] border-transparent hover:text-[#6b7280]'}`}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { val: totalReach > 0 ? (totalReach > 1000 ? (totalReach / 1000).toFixed(1) + 'K' : totalReach) : '—', label: 'Alcance total', Icon: Radio, bg: '#f5f3ff', color: '#7c3aed' },
                { val: avgEng !== '—' ? avgEng + '%' : '—', label: 'Engagement prom.', Icon: MessageSquare, bg: '#eff6ff', color: '#3b82f6' },
                { val: published.length, label: 'Publicados', Icon: CheckCircle2, bg: '#f0fdf4', color: '#16a34a' },
                { val: ideas.length, label: 'Ideas en cartera', Icon: Lightbulb, bg: '#fef3c7', color: '#d97706' },
              ].map(({ val, label, Icon, bg, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#e5e7eb] p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}><Icon size={16} style={{ color }} /></div>
                  <div className="text-[24px] font-bold text-[#111827]">{val}</div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]">
                <span className="text-[15px] font-bold text-[#111827]">Estado del pipeline</span>
              </div>
              <div className="p-5 flex flex-col gap-2.5">
                {KANBAN_COLS.map(col => {
                  const count = contents.filter(c => c.status === col.key).length
                  const pct = contents.length ? Math.round((count / contents.length) * 100) : 0
                  const meta = STATUS_META[col.key]
                  return (
                    <div key={col.key} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full w-28 text-center shrink-0" style={{ background: meta.bg, color: meta.text }}>{meta.label}</span>
                      <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col.color }} />
                      </div>
                      <span className="text-[12px] font-semibold text-[#111827] w-6 text-right shrink-0">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#111827]">Contenidos recientes</span>
                <button onClick={() => setTab('kanban')} className="text-[12px] text-[#7c3aed] hover:underline">Ver todos →</button>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {contents.slice(0, 5).map(c => {
                  const net = NETWORK_META[c.channel]
                  const st = STATUS_META[c.status]
                  const pr = PRIORITY_META[c.priority]
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] cursor-pointer transition-colors" onClick={() => openEdit(c)}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: net?.bg, color: net?.dot }}><NetworkIcon network={c.channel} size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827] truncate">{c.title}</div>
                        <div className="text-[11px] text-[#9ca3af]">{c.format} · {c.date ?? 'Sin fecha'}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* KANBAN */}
        {tab === 'kanban' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-6 pt-3 pb-1 shrink-0">
              <NetworkFilter contents={contents} value={filterNetwork} onChange={setFilterNetwork} />
            </div>
            <div className="flex-1 overflow-x-auto px-6 pb-6 pt-3 flex gap-3">
              {KANBAN_COLS.map(col => {
                const cards = contents.filter(c =>
                  c.status === col.key &&
                  (filterNetwork === 'all' || c.channel === filterNetwork)
                )
                const meta = STATUS_META[col.key]
                const isOver = over === col.key
                return (
                  <div key={col.key} className="w-[240px] shrink-0 flex flex-col"
                    onDragOver={e => { e.preventDefault(); setOver(col.key) }}
                    onDragLeave={() => setOver(null)}
                    onDrop={() => onDrop(col.key)}
                  >
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                      <span className="text-[12px] font-bold text-[#111827]">{meta.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: col.bg, color: col.color }}>{cards.length}</span>
                    </div>
                    <div className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-2xl p-2 transition-colors ${isOver ? 'bg-[#f5f3ff] ring-2 ring-[#7c3aed]/20' : 'bg-transparent'}`}>
                      {cards.map(c => {
                        const net = NETWORK_META[c.channel]
                        const pr = PRIORITY_META[c.priority]
                        return (
                          <div key={c.id} draggable onDragStart={() => setDragging(c.id)}
                            onClick={() => openEdit(c)}
                            className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all active:scale-95 active:opacity-75"
                          >
                            <div className="h-1 w-full" style={{ background: net?.dot }} />
                            <div className="p-3">
                              <div className="flex items-start justify-between mb-1.5 gap-1">
                                <div className="flex gap-1 flex-wrap">
                                  {(c.channels?.length ? c.channels : [c.channel]).map(ch => {
                                    const m = NETWORK_META[ch]
                                    return (
                                      <span key={ch} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: m?.dot ?? '#94a3b8', color: '#fff' }} title={m?.label}>
                                        <NetworkIcon network={ch as Network} size={11} />
                                      </span>
                                    )
                                  })}
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                              </div>
                              <p className="text-[12px] font-semibold text-[#111827] line-clamp-2 mb-2">{c.title}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] bg-[#f3f4f6] text-[#6b7280] px-1.5 py-0.5 rounded-lg">{c.format}</span>
                                <span className="text-[10px] font-mono text-[#9ca3af]">{c.date ? c.date.replace('2026-', '') : '—'}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={openNew}
                        className="flex items-center justify-center gap-1 mt-1 py-2 text-[11px] text-[#9ca3af] hover:text-[#7c3aed] rounded-xl hover:bg-white transition-colors border border-dashed border-[#e5e7eb] hover:border-[#7c3aed]">
                        + Añadir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MÉTRICAS */}
        {tab === 'metricas' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { val: published.length, label: 'Publicados', sub: 'este mes' },
                { val: totalReach > 0 ? totalReach.toLocaleString('es-ES') : '—', label: 'Alcance total', sub: 'suma acumulada' },
                { val: avgEng !== '—' ? avgEng + '%' : '—', label: 'Engagement prom.', sub: 'publicados con métricas' },
                { val: published.reduce((a, c) => a + (c.metrics?.likes ?? 0), 0).toLocaleString('es-ES') || '—', label: 'Likes totales', sub: 'suma acumulada' },
              ].map(({ val, label, sub }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                  <div className="text-[24px] font-bold text-[#111827]">{val}</div>
                  <div className="text-[12px] font-semibold text-[#4b5563] mt-1">{label}</div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]">
                <div className="text-[15px] font-bold text-[#111827]">Métricas por publicación</div>
                <div className="text-[12px] text-[#9ca3af] mt-0.5">Haz clic en una publicación para editar sus métricas</div>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#f9fafb]">
                    {['Publicación', 'Canal', 'Fecha', 'Alcance', 'Impresiones', 'Engagement', 'Likes', 'Guardados'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide border-b border-[#f3f4f6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contents.filter(c => c.status === 'publicado' || c.metrics).map(c => {
                    const net = NETWORK_META[c.channel]
                    return (
                      <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa] cursor-pointer transition-colors" onClick={() => openEdit(c)}>
                        <td className="px-4 py-3 font-semibold text-[#111827] max-w-[160px]"><div className="truncate">{c.title}</div></td>
                        <td className="px-4 py-3"><span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: net?.bg, color: net?.text }}><NetworkIcon network={c.channel} size={10} /> {net?.label}</span></td>
                        <td className="px-4 py-3 font-mono text-[#9ca3af]">{c.date ?? '—'}</td>
                        <td className="px-4 py-3">{c.metrics?.reach?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.impressions?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3 font-semibold">{c.metrics?.engagementRate ? c.metrics.engagementRate + '%' : <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.likes?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.saves?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                      </tr>
                    )
                  })}
                  {contents.filter(c => c.status === 'publicado' || c.metrics).length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[#9ca3af] text-[13px]">Aún no hay publicaciones con métricas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INFORMES */}
        {tab === 'informes' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
              <div className="text-[15px] font-bold text-[#111827] mb-1">Exportar informe</div>
              <div className="text-[12px] text-[#9ca3af] mb-4">Genera y descarga el informe de {brand.name}</div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleExportCSV} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><Download size={14} /> Exportar CSV</button>
                <button onClick={handleExportExcel} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><FileText size={14} /> Exportar Excel</button>
                <button onClick={handlePrintReport} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><FileText size={14} /> Generar PDF</button>
                <button onClick={() => setShowMonthPicker(true)} className="flex items-center gap-2 border border-[#7c3aed] text-[#7c3aed] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f5f3ff] transition-colors"><Globe size={14} /> Web interactiva</button>
                <button onClick={handleExportPPT} disabled={pptLoading} className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#5b21b6] disabled:opacity-60 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"><Presentation size={14} /> {pptLoading ? 'Generando PPT…' : 'Exportar PPT'}</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Insights automáticos</div><div className="text-[12px] text-[#9ca3af] mt-0.5">Generados a partir de los datos registrados</div></div>
              <div className="p-5 flex flex-col gap-2">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#f3f4f6] last:border-0">
                    <div className="w-5 h-5 rounded-full bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-[13px] text-[#374151]">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Recomendaciones estratégicas</div></div>
              <div className="p-5 flex flex-col gap-2">
                {recs.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#f3f4f6] last:border-0">
                    <div className="w-5 h-5 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">→</div>
                    <p className="text-[13px] text-[#374151]">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RECURSOS */}
        {tab === 'recursos' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Links importantes</div></div>
                <div className="p-5 flex flex-col gap-3">
                  {Object.entries(brand.links).filter(([, url]) => url).length === 0 && (
                    <div className="text-[13px] text-[#9ca3af] text-center py-4">No hay links configurados. <button onClick={() => setShowBrandModal(true)} className="text-[#7c3aed] hover:underline">Editar marca →</button></div>
                  )}
                  {([
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'linkedin', label: 'LinkedIn' },
                    { key: 'web', label: 'Sitio web' },
                    { key: 'drive', label: 'Google Drive' },
                    { key: 'designs', label: 'Carpeta diseños' },
                    { key: 'reports', label: 'Reportes' },
                  ] as { key: keyof typeof brand.links; label: string }[]).filter(({ key }) => brand.links[key]).map(({ key, label }) => (
                    <a key={key} href={brand.links[key]} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-xl hover:bg-[#f9fafb] transition-colors group border border-[#f3f4f6]">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: NETWORK_META[key]?.bg ?? '#f3f4f6', color: NETWORK_META[key]?.dot ?? '#9ca3af' }}>
                        {NETWORK_META[key] ? <NetworkIcon network={key as never} size={13} /> : <ExternalLink size={13} />}
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] font-semibold text-[#111827]">{label}</div>
                        <div className="text-[10px] text-[#9ca3af] truncate max-w-[200px]">{brand.links[key]}</div>
                      </div>
                      <ExternalLink size={12} className="text-[#9ca3af] group-hover:text-[#7c3aed]" />
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                  <div className="text-[14px] font-bold text-[#111827] mb-3">Información de la marca</div>
                  <div className="flex flex-col gap-3 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Industria</span><span className="font-medium text-[#111827]">{brand.industry}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">País</span><span className="font-medium text-[#111827]">{brand.country}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Responsable</span><span className="font-medium text-[#111827]">{brand.responsible}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Estado</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${brand.status === 'active' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fef3c7] text-[#d97706]'}`}>
                        {brand.status === 'active' ? 'Activo' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                </div>
                {brand.observations && (
                  <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                    <div className="text-[14px] font-bold text-[#111827] mb-2">Observaciones estratégicas</div>
                    <p className="text-[13px] text-[#4b5563] leading-relaxed">{brand.observations}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showContentModal && (
        <ContentModal
          initial={editingContent}
          defaultBrandId={brand.id}
          onClose={() => { setShowContentModal(false); setEditingContent(undefined) }}
        />
      )}
      {showBrandModal && (
        <BrandModal initial={brand} onClose={() => setShowBrandModal(false)} />
      )}

      {showMonthPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] p-6 w-[340px] max-w-[92vw]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#ede9fe] flex items-center justify-center">
                <Globe size={15} className="text-[#7c3aed]" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#111827]">Seleccionar mes</div>
                <div className="text-[11px] text-[#9ca3af]">Elige el período a incluir en el informe</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {availableMonths.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => doExportWebReport(key)}
                  className="flex items-center justify-between text-left px-4 py-2.5 rounded-xl border border-[#e5e7eb] hover:border-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#7c3aed] text-[#374151] transition-colors group"
                >
                  <span className="text-[13px] font-semibold">{label}</span>
                  <span className="text-[11px] text-[#9ca3af] group-hover:text-[#a78bfa]">{count} contenidos</span>
                </button>
              ))}
              {availableMonths.length > 0 && (
                <div className="border-t border-[#f3f4f6] my-1" />
              )}
              <button
                onClick={() => doExportWebReport(null)}
                className="flex items-center justify-between text-left px-4 py-2.5 rounded-xl border border-[#e5e7eb] hover:bg-[#f9fafb] text-[#6b7280] transition-colors"
              >
                <span className="text-[13px] font-semibold">Todos los contenidos</span>
                <span className="text-[11px] text-[#9ca3af]">{contents.length} totales</span>
              </button>
            </div>

            <button
              onClick={() => setShowMonthPicker(false)}
              className="mt-4 w-full text-[12px] text-[#9ca3af] hover:text-[#374151] transition-colors py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
