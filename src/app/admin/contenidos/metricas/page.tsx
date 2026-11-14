'use client'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const MetricsCharts = dynamic(() => import('@/components/cmhub/MetricsCharts'), { ssr: false })
import {
  BarChart2, Upload, Eye, TrendingUp, Heart, MessageCircle,
  AlertCircle, ChevronDown, ChevronUp, Check,
} from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import { NETWORK_META } from '@/cmhub/data'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import MetricsImportModal from '@/components/cmhub/MetricsImportModal'
import type { Content, ContentMetrics, Network } from '@/cmhub/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | undefined) {
  if (n === undefined) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('es-PE')
}

function sumMetric(list: Content[], key: keyof ContentMetrics): number {
  return list.reduce((acc, c) => acc + ((c.metrics?.[key] as number) ?? 0), 0)
}

function avgMetric(list: Content[], key: keyof ContentMetrics): number | undefined {
  const vals = list
    .filter(c => c.metrics?.[key] !== undefined)
    .map(c => c.metrics![key] as number)
  if (!vals.length) return undefined
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: import("lucide-react").LucideIcon; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color + '20' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-[12px] text-[#9ca3af] font-medium">{label}</p>
        <p className="text-[22px] font-bold text-[#111827] leading-none mt-1">{value}</p>
      </div>
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function BarTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold text-[#111827]">{label}</p>
      <p className="text-[#7c3aed]">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── Inline editable metric cell ───────────────────────────────────────────────
function InlineMetricCell({ value, isPercent = false, onSave }: {
  value: number | undefined
  isPercent?: boolean
  onSave: (v: number | undefined) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function start() {
    setDraft(value !== undefined ? String(value) : '')
    setEditing(true)
  }

  function commit() {
    const v = draft.trim()
    if (v === '') onSave(undefined)
    else {
      const n = parseFloat(v)
      if (!isNaN(n)) onSave(n)
    }
    setEditing(false)
  }

  function cancel() { setEditing(false) }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step={isPercent ? '0.01' : '1'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
        onClick={e => e.stopPropagation()}
        className="w-20 text-right text-[12px] border-2 border-[#7c3aed] rounded-lg px-2 py-0.5 focus:outline-none tabular-nums bg-[#f5f3ff]"
      />
    )
  }

  if (value === undefined) {
    return (
      <span
        onClick={e => { e.stopPropagation(); start() }}
        className="cursor-pointer text-[#d1d5db] border-b border-dashed border-[#e5e7eb] hover:text-[#7c3aed] hover:border-[#7c3aed] transition-colors select-none"
        title="Clic para ingresar"
      >
        —
      </span>
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); start() }}
      className="cursor-pointer hover:text-[#7c3aed] transition-colors tabular-nums select-none"
      title="Clic para editar"
    >
      {isPercent ? `${value.toFixed(2)}%` : fmt(value)}
    </span>
  )
}

// ── Post row ──────────────────────────────────────────────────────────────────
function PostRow({
  c, brand, saved, onSave,
}: {
  c: Content
  brand?: { name: string; color: string; initials: string }
  saved: boolean
  onSave: (key: keyof ContentMetrics, value: number | undefined) => void
}) {
  const net = NETWORK_META[c.channel]
  const hasMetrics = !!c.metrics && Object.keys(c.metrics).some(
    k => k !== 'performanceNotes' && c.metrics![k as keyof ContentMetrics] !== undefined
  )

  return (
    <tr className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa] transition-colors group">
      {/* Publicación */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-extrabold text-white shrink-0"
            style={{ background: brand?.color ?? '#94a3b8' }}>
            {brand?.initials ?? '?'}
          </div>
          <div className="min-w-0">
            <span className="text-[12px] text-[#374151] font-medium truncate block max-w-[200px]">
              {c.title}
            </span>
            {saved && (
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                <Check size={9} /> Guardado
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Red */}
      <td className="px-4 py-3">
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
          style={{ background: net?.bg, color: net?.text }}>
          <NetworkIcon network={c.channel} size={9} /> {net?.label}
        </span>
      </td>

      {/* Fecha */}
      <td className="px-4 py-3 text-[12px] text-[#9ca3af] font-mono whitespace-nowrap">
        {c.date ?? '—'}
      </td>

      {/* Alcance */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.reach}
          onSave={v => onSave('reach', v)}
        />
      </td>

      {/* Impresiones */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.impressions}
          onSave={v => onSave('impressions', v)}
        />
      </td>

      {/* Likes */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.likes}
          onSave={v => onSave('likes', v)}
        />
      </td>

      {/* Comentarios */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.comments}
          onSave={v => onSave('comments', v)}
        />
      </td>

      {/* Compartidos */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.shares}
          onSave={v => onSave('shares', v)}
        />
      </td>

      {/* Engagement */}
      <td className="px-4 py-3 text-right">
        <InlineMetricCell
          value={c.metrics?.engagementRate}
          isPercent
          onSave={v => onSave('engagementRate', v)}
        />
      </td>

      {/* Estado */}
      <td className="px-4 py-3 text-right">
        {hasMetrics
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Con datos</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#9ca3af]">Sin datos</span>
        }
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MetricasPage() {
  const { isDark } = useHubTheme()
  const { NETWORK_META } = useHubMeta()
  const { contents, brands, updateContent } = useHub()
  const tickColor = isDark ? '#64748b' : '#9ca3af'
  const labelColor = isDark ? '#cbd5e1' : '#374151'
  const [showImport, setShowImport] = useState(false)
  const [filterBrand, setFilterBrand] = useState('all')
  const [sortBy, setSortBy] = useState<keyof ContentMetrics>('reach')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const published = useMemo(() =>
    contents.filter(c => c.status === 'publicado' || c.status === 'reportado'),
  [contents])

  const filtered = useMemo(() =>
    filterBrand === 'all' ? published : published.filter(c => c.brandId === filterBrand),
  [published, filterBrand])

  const withMetrics = filtered.filter(c =>
    c.metrics && Object.keys(c.metrics).some(
      k => k !== 'performanceNotes' && c.metrics![k as keyof ContentMetrics] !== undefined
    )
  )

  const handleSaveMetric = useCallback((id: string, key: keyof ContentMetrics, value: number | undefined) => {
    const existing = contents.find(c => c.id === id)
    updateContent(id, {
      metrics: { ...(existing?.metrics ?? {}), [key]: value },
    })
    setSavedIds(prev => new Set([...prev, id]))
    setTimeout(() => setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s }), 2000)
  }, [contents, updateContent])

  // KPIs
  const totalReach       = sumMetric(withMetrics, 'reach')
  const totalImpressions = sumMetric(withMetrics, 'impressions')
  const totalLikes       = sumMetric(withMetrics, 'likes')
  const avgEngagement    = avgMetric(withMetrics, 'engagementRate')

  // By network
  const byNetwork = useMemo(() => {
    const map: Record<string, number> = {}
    withMetrics.forEach(c => {
      const nets = c.channels?.length ? c.channels : [c.channel]
      nets.forEach((n: Network) => {
        map[n] = (map[n] ?? 0) + (c.metrics?.reach ?? 0)
      })
    })
    return Object.entries(map)
      .map(([network, reach]) => ({ network, reach, label: NETWORK_META[network]?.label ?? network }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 6)
  }, [withMetrics])

  // By brand
  const byBrand = useMemo(() => {
    const map: Record<string, number> = {}
    withMetrics.forEach(c => {
      map[c.brandId] = (map[c.brandId] ?? 0) + (c.metrics?.reach ?? 0)
    })
    return Object.entries(map)
      .map(([brandId, reach]) => {
        const b = brands.find(x => x.id === brandId)
        return { brandId, reach, label: b?.name ?? brandId, color: b?.color ?? '#94a3b8' }
      })
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 6)
  }, [withMetrics, brands])

  // Sorted table
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = (a.metrics?.[sortBy] as number) ?? -1
      const vb = (b.metrics?.[sortBy] as number) ?? -1
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [filtered, sortBy, sortDir])

  function toggleSort(col: keyof ContentMetrics) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: keyof ContentMetrics }) {
    if (sortBy !== col) return null
    return sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
  }

  const missingCount = filtered.length - withMetrics.length

  const COLS: { key: keyof ContentMetrics; label: string }[] = [
    { key: 'reach',         label: 'Alcance' },
    { key: 'impressions',   label: 'Impresiones' },
    { key: 'likes',         label: 'Likes' },
    { key: 'comments',      label: 'Comentarios' },
    { key: 'shares',        label: 'Compartidos' },
    { key: 'engagementRate',label: 'Engagement' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">

      {/* Topbar */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Analytics</span>
        </div>
        <select
          value={filterBrand}
          onChange={e => setFilterBrand(e.target.value)}
          className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-1.5 text-[12px] text-[#6b7280] focus:outline-none focus:border-[#7c3aed]"
        >
          <option value="all">Todas las marcas</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-1.5 rounded-xl transition-colors"
        >
          <Upload size={13} /> Importar métricas
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* Alert */}
        {missingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
            <p className="text-[13px] text-amber-800">
              <span className="font-semibold">{missingCount} publicaciones</span> sin métricas.{' '}
              Impórtalas con CSV o ingresa los datos directamente en la tabla.
              {' '}<button onClick={() => setShowImport(true)} className="underline font-semibold hover:no-underline">Importar CSV →</button>
            </p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Alcance total"      value={fmt(totalReach)}       icon={Eye}      color="#7c3aed" />
          <KpiCard label="Impresiones"        value={fmt(totalImpressions)} icon={BarChart2} color="#3b82f6" />
          <KpiCard label="Likes acumulados"   value={fmt(totalLikes)}       icon={Heart}    color="#ec4899" />
          <KpiCard
            label="Engagement promedio"
            value={avgEngagement !== undefined ? `${avgEngagement.toFixed(2)}%` : '—'}
            icon={TrendingUp}
            color="#10b981"
          />
        </div>

        {/* Charts */}
        {(byNetwork.length > 0 || byBrand.length > 0) && (
          <MetricsCharts
            byNetwork={byNetwork}
            byBrand={byBrand}
            tickColor={tickColor}
            labelColor={labelColor}
          />
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-[#111827]">Publicaciones</p>
              <p className="text-[12px] text-[#9ca3af] mt-0.5">
                {withMetrics.length} con métricas · {filtered.length} total · haz clic en cualquier celda para editar
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[11px] text-[#9ca3af]">Con datos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e5e7eb]" />
                <span className="text-[11px] text-[#9ca3af]">Sin datos</span>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <BarChart2 size={32} className="mx-auto text-[#e5e7eb] mb-3" />
              <p className="text-[13px] text-[#9ca3af]">No hay publicaciones con estado "Publicado" aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Publicación</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Red</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Fecha</th>
                    {COLS.map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className="px-4 py-2.5 text-right text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide cursor-pointer hover:text-[#7c3aed] transition-colors select-none"
                      >
                        <span className="flex items-center justify-end gap-1">
                          {label}
                          <SortIcon col={key} />
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <PostRow
                      key={c.id}
                      c={c}
                      brand={brands.find(b => b.id === c.brandId)}
                      saved={savedIds.has(c.id)}
                      onSave={(key, value) => handleSaveMetric(c.id, key, value)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Empty state */}
        {filtered.length > 0 && withMetrics.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e5e7eb] px-6 py-10 text-center">
            <Upload size={28} className="mx-auto text-[#d1d5db] mb-3" />
            <p className="text-[14px] font-semibold text-[#374151] mb-1">Sin métricas todavía</p>
            <p className="text-[13px] text-[#9ca3af] mb-4">
              Importa un CSV desde Instagram, TikTok, Facebook o LinkedIn, o ingresa los números directamente en la tabla de arriba.
            </p>
            <button
              onClick={() => setShowImport(true)}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              Importar métricas
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-[#d1d5db] pb-2">
          <MessageCircle size={12} />
          <span className="text-[11px]">Analytics · CM Hub</span>
        </div>
      </div>

      {showImport && <MetricsImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
