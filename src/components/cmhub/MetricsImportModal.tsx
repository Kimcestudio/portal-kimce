'use client'
import { useState, useCallback, useRef } from 'react'
import { X, Upload, CheckCircle2, AlertCircle, ArrowRight, BarChart2, RotateCcw } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import NetworkIcon from './NetworkIcon'
import {
  parsePlatformCsv, matchRows,
  PLATFORM_INSTRUCTIONS, PLATFORM_NETWORK,
} from '@/cmhub/csvMetrics'
import type { CsvPlatform, MatchedRow } from '@/cmhub/csvMetrics'
import { NETWORK_META } from '@/cmhub/data'
import type { ContentMetrics } from '@/cmhub/types'

const PLATFORMS: { id: CsvPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'linkedin',  label: 'LinkedIn' },
]

const METRIC_LABELS: Partial<Record<keyof ContentMetrics, string>> = {
  reach:          'Alcance',
  impressions:    'Impresiones',
  likes:          'Likes',
  comments:       'Comentarios',
  shares:         'Compartidos',
  saves:          'Guardados',
  views:          'Vistas',
  clicks:         'Clics',
  interactions:   'Interacciones',
  engagementRate: 'Engagement %',
}

function MetricPills({ metrics }: { metrics: ContentMetrics }) {
  const entries = (Object.entries(METRIC_LABELS) as [keyof ContentMetrics, string][])
    .filter(([k]) => metrics[k] !== undefined)

  if (!entries.length) return <span className="text-[11px] text-[#d1d5db]">Sin métricas</span>

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {entries.map(([k, label]) => (
        <span key={k} className="text-[10px] text-[#6b7280]">
          <span className="font-semibold text-[#374151]">
            {k === 'engagementRate'
              ? `${(metrics[k] as number).toFixed(2)}%`
              : (metrics[k] as number).toLocaleString()}
          </span>
          {' '}{label}
        </span>
      ))}
    </div>
  )
}

export default function MetricsImportModal({ onClose }: { onClose: () => void }) {
  const { contents, updateContent } = useHub()
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')
  const [platform, setPlatform] = useState<CsvPlatform | null>(null)
  const [matched, setMatched] = useState<MatchedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!platform) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parsePlatformCsv(text, platform)
      const network = PLATFORM_NETWORK[platform]
      const platformContents = contents.filter(c =>
        (c.channels?.length ? c.channels : [c.channel]).includes(network)
      )
      const result = matchRows(parsed, platformContents)
      setMatched(result)
      setStep('preview')
    }
    reader.readAsText(file, 'utf-8')
  }, [platform, contents])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function reset() {
    setStep('select')
    setMatched([])
    setFileName('')
  }

  async function confirmImport() {
    setImporting(true)
    let count = 0
    for (const m of matched) {
      if (m.content && m.row.confidence !== 'none') {
        updateContent(m.content.id, {
          metrics: { ...(m.content.metrics ?? {}), ...m.row.metrics },
          status: m.content.status === 'publicado' ? 'publicado' : m.content.status,
        })
        count++
      }
    }
    setImportedCount(count)
    setImporting(false)
    setStep('done')
  }

  const matchedOk   = matched.filter(m => m.content && m.row.confidence !== 'none')
  const matchedNone = matched.filter(m => !m.content || m.row.confidence === 'none')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e5e7eb] shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#f5f3ff] flex items-center justify-center shrink-0">
            <BarChart2 size={15} className="text-[#7c3aed]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#111827]">Importar métricas</h2>
            <p className="text-[12px] text-[#9ca3af]">
              {step === 'select' && 'Sube un CSV exportado desde la plataforma'}
              {step === 'preview' && `${matched.length} filas procesadas · ${fileName}`}
              {step === 'done' && 'Importación completada'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Step 1: Select platform + upload ─────────────────── */}
        {step === 'select' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div>
              <p className="text-[12px] font-semibold text-[#374151] uppercase tracking-wide mb-3">1. Plataforma</p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(p => {
                  const network = PLATFORM_NETWORK[p.id]
                  const net = NETWORK_META[network]
                  const isSelected = platform === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-[#7c3aed] bg-[#f5f3ff]'
                          : 'border-[#e5e7eb] hover:border-[#c4b5fd] hover:bg-[#fafafa]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: net.bg, color: net.dot }}>
                        <NetworkIcon network={network} size={18} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827]">{p.label}</p>
                        <p className="text-[11px] text-[#9ca3af] leading-snug mt-0.5">
                          {PLATFORM_INSTRUCTIONS[p.id]}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={`transition-opacity ${platform ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <p className="text-[12px] font-semibold text-[#374151] uppercase tracking-wide mb-3">2. Archivo CSV</p>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#7c3aed] bg-[#f5f3ff]'
                    : 'border-[#e5e7eb] hover:border-[#c4b5fd] hover:bg-[#fafafa]'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#f3f4f6] flex items-center justify-center">
                  <Upload size={20} className="text-[#9ca3af]" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-[#374151]">Arrastra el CSV aquí</p>
                  <p className="text-[12px] text-[#9ca3af] mt-0.5">o haz clic para seleccionar archivo (.csv)</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              <div className="mt-3 p-3 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
                <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                  <span className="font-semibold text-[#6b7280]">Tip de cruce:</span> Si las publicaciones tienen URL guardada, el cruce es exacto. Si no, se cruzan por fecha. Agrega la URL de cada post en la ficha para mejores resultados.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview matches ───────────────────────────── */}
        {step === 'preview' && (
          <>
            {/* Stats bar */}
            <div className="px-6 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb] flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" />
                <span className="text-[12px] font-semibold text-green-700">{matchedOk.length} cruzadas</span>
              </div>
              {matchedNone.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-amber-500" />
                  <span className="text-[12px] font-semibold text-amber-700">{matchedNone.length} sin coincidencia</span>
                </div>
              )}
              <span className="text-[11px] text-[#9ca3af] ml-auto">{matched.length} filas en el CSV</span>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#f3f4f6]">
              {matched.map((m, i) => {
                const ok = m.content && m.row.confidence !== 'none'
                return (
                  <div key={i} className={`px-6 py-3 flex items-start gap-3 ${ok ? '' : 'opacity-40'}`}>
                    <div className="mt-0.5 shrink-0">
                      {ok
                        ? <CheckCircle2 size={14} className="text-green-500" />
                        : <AlertCircle size={14} className="text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#111827] truncate">
                        {m.content?.title ?? m.row.rawTitle ?? m.row.rawDate ?? '—'}
                      </p>
                      <MetricPills metrics={m.row.metrics} />
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.row.confidence === 'url'  ? 'bg-green-100 text-green-700' :
                      m.row.confidence === 'date' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-[#f3f4f6] text-[#9ca3af]'
                    }`}>
                      {m.row.confidence === 'url'  ? 'URL' :
                       m.row.confidence === 'date' ? 'Fecha' : 'Sin match'}
                    </span>
                  </div>
                )
              })}

              {matched.length === 0 && (
                <div className="px-6 py-12 text-center text-[#9ca3af] text-[13px]">
                  No se encontraron filas válidas en el archivo.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e5e7eb] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] hover:text-[#374151] transition-colors"
              >
                <RotateCcw size={12} /> Volver
              </button>
              <button
                onClick={confirmImport}
                disabled={matchedOk.length === 0 || importing}
                className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white text-[13px] font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {importing ? 'Importando…' : `Importar ${matchedOk.length} publicaciones`}
                <ArrowRight size={13} />
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Done ─────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-[#111827]">
                {importedCount} publicaciones actualizadas
              </p>
              <p className="text-[13px] text-[#9ca3af] mt-1.5">
                Las métricas han sido guardadas. Puedes verlas en la ficha de cada publicación.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={reset}
                className="text-[13px] border border-[#e5e7eb] text-[#6b7280] px-4 py-2 rounded-xl hover:bg-[#f9fafb] transition-colors"
              >
                Importar otro
              </button>
              <button
                onClick={onClose}
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
