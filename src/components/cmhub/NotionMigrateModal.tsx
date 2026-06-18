'use client'
import { useState } from 'react'
import { X, Download, CheckCircle2, AlertCircle, Loader2, ChevronRight, Database, FileText, RefreshCw } from 'lucide-react'
import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import type { Brand, Content } from '@/cmhub/types'

type Step = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'

interface NotionData {
  brands: Brand[]
  contents: Content[]
  total: number
}

interface MigrateResult {
  brandsNew: number
  brandsUpdated: number
  contentsNew: number
  contentsUpdated: number
}

function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}

export default function NotionMigrateModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useHubTheme()
  const { brands: existingBrands, contents: existingContents } = useHub()

  const [step, setStep]           = useState<Step>('idle')
  const [notionData, setNotionData] = useState<NotionData | null>(null)
  const [progress, setProgress]   = useState(0)
  const [result, setResult]       = useState<MigrateResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [overwrite, setOverwrite] = useState(true)

  const T = isDark ? {
    bg:      '#161820',
    border:  'rgba(255,255,255,0.08)',
    text:    '#e2e8f0',
    sub:     '#94a3b8',
    card:    'rgba(255,255,255,0.04)',
    divider: 'rgba(255,255,255,0.08)',
  } : {
    bg:      '#ffffff',
    border:  '#e5e7eb',
    text:    '#111827',
    sub:     '#6b7280',
    card:    '#f9fafb',
    divider: '#f3f4f6',
  }

  // ── Análisis de diferencias ─────────────────────────────────────────────────

  function analyze(data: NotionData) {
    const existingBrandNames = new Set(existingBrands.map(b => b.name.toLowerCase()))
    const existingContentIds = new Set(existingContents.map(c => c.id))

    const brandsNew     = data.brands.filter(b => !existingBrandNames.has(b.name.toLowerCase()))
    const brandsExist   = data.brands.filter(b => existingBrandNames.has(b.name.toLowerCase()))
    const contentsNew   = data.contents.filter(c => !existingContentIds.has(c.id))
    const contentsExist = data.contents.filter(c => existingContentIds.has(c.id))

    return { brandsNew, brandsExist, contentsNew, contentsExist }
  }

  // ── Fetch desde Notion ──────────────────────────────────────────────────────

  async function fetchNotion() {
    setStep('fetching')
    setErrorMsg('')
    try {
      const r = await fetch('/api/notion/migrate')
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error ?? `Error ${r.status}`)
      }
      const data: NotionData = await r.json()
      setNotionData(data)
      setStep('preview')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  // ── Escritura a Firestore ───────────────────────────────────────────────────

  async function runImport() {
    if (!notionData) return
    setStep('importing')
    setProgress(0)

    try {
      // Mapa nombre → ID de Firebase para reasignar brandId en contenidos
      const nameToId: Record<string, string> = {}
      for (const b of existingBrands) nameToId[b.name.toLowerCase()] = b.id
      for (const b of notionData.brands) {
        if (!nameToId[b.name.toLowerCase()]) nameToId[b.name.toLowerCase()] = b.id
      }

      const existingBrandNames = new Set(existingBrands.map(b => b.name.toLowerCase()))
      const existingContentIds = new Set(existingContents.map(c => c.id))

      let brandsNew = 0, brandsUpdated = 0, contentsNew = 0, contentsUpdated = 0
      const total = notionData.brands.length + notionData.contents.length
      let done = 0

      // ── Marcas en batches de 500 ───────────────────────────────────────────
      const chunkSize = 499
      for (let i = 0; i < notionData.brands.length; i += chunkSize) {
        const batch = writeBatch(db)
        const chunk = notionData.brands.slice(i, i + chunkSize)
        for (const brand of chunk) {
          const isExisting = existingBrandNames.has(brand.name.toLowerCase())
          if (isExisting && !overwrite) { done++; continue }
          const ref = doc(collection(db, 'cmhub_brands'), brand.id)
          batch.set(ref, clean(brand), { merge: true })
          if (isExisting) brandsUpdated++; else brandsNew++
          done++
        }
        await batch.commit()
        setProgress(Math.round((done / total) * 100))
      }

      // ── Contenidos en batches de 500 ──────────────────────────────────────
      for (let i = 0; i < notionData.contents.length; i += chunkSize) {
        const batch = writeBatch(db)
        const chunk = notionData.contents.slice(i, i + chunkSize)
        for (const content of chunk) {
          const isExisting = existingContentIds.has(content.id)
          if (isExisting && !overwrite) { done++; continue }

          // Reasignar brandId al ID correcto de Firebase
          const brandObj = notionData.brands.find(b => b.id === content.brandId)
          const mappedBrandId = brandObj
            ? (nameToId[brandObj.name.toLowerCase()] ?? content.brandId)
            : content.brandId

          const ref = doc(collection(db, 'cmhub_contents'), content.id)
          batch.set(ref, clean({ ...content, brandId: mappedBrandId }), { merge: true })
          if (isExisting) contentsUpdated++; else contentsNew++
          done++
        }
        await batch.commit()
        setProgress(Math.round((done / total) * 100))
      }

      setResult({ brandsNew, brandsUpdated, contentsNew, contentsUpdated })
      setStep('done')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  const diff = notionData ? analyze(notionData) : null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: T.bg, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${T.divider}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
              <Download size={16} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-[15px] font-bold" style={{ color: T.text }}>Importar desde Notion</p>
              <p className="text-[11px]" style={{ color: T.sub }}>Migración única · todo queda en Firebase</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/10 transition-colors" style={{ color: T.sub }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 min-h-0">

          {/* ── IDLE ── */}
          {step === 'idle' && (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed" style={{ color: T.sub }}>
                Este proceso carga todo el contenido de tu base de datos de Notion y lo importa a Firebase.
                A partir de ese momento el equipo trabaja exclusivamente en el portal.
              </p>
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <Row icon={<Database size={13}/>} label="Base de datos" value="Calendario de contenidos (Notion)" color="#7c3aed" />
                <Row icon={<FileText size={13}/>} label="Destino"       value="cmhub_contents + cmhub_brands (Firebase)" color="#0ea5e9" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertCircle size={14} className="shrink-0" style={{ color: '#f59e0b' }} />
                <p className="text-[12px]" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>
                  Usa "setDoc con merge" — los contenidos existentes se actualizan, no se duplican.
                </p>
              </div>
            </div>
          )}

          {/* ── FETCHING ── */}
          {step === 'fetching' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: '#7c3aed' }} />
              <p className="text-[13px] font-medium" style={{ color: T.text }}>Conectando con Notion…</p>
              <p className="text-[11px]" style={{ color: T.sub }}>Esto puede tardar unos segundos si hay mucho contenido</p>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === 'preview' && notionData && diff && (
            <div className="flex flex-col gap-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Contenidos" value={notionData.total} sub={`${diff.contentsNew.length} nuevos · ${diff.contentsExist.length} actualización`} color="#7c3aed" />
                <StatCard label="Marcas" value={notionData.brands.length} sub={`${diff.brandsNew.length} nuevas · ${diff.brandsExist.length} ya existen`} color="#0ea5e9" />
              </div>

              {/* Marcas */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.sub }}>Marcas detectadas</p>
                <div className="flex flex-col gap-1">
                  {notionData.brands.map(b => {
                    const exists = existingBrands.some(e => e.name.toLowerCase() === b.name.toLowerCase())
                    return (
                      <div key={b.id} className="flex items-center gap-2 py-1.5 px-3 rounded-xl" style={{ background: T.card }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ background: b.color }}>{b.initials}</div>
                        <span className="text-[12px] flex-1" style={{ color: T.text }}>{b.name}</span>
                        {exists
                          ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(99,102,241,0.15)' : '#ede9fe', color: '#7c3aed' }}>ya existe</span>
                          : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4', color: '#16a34a' }}>nueva</span>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Opción overwrite */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl" style={{ background: T.card }}>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded accent-violet-600"
                />
                <div>
                  <p className="text-[12px] font-medium" style={{ color: T.text }}>Actualizar contenidos existentes</p>
                  <p className="text-[11px]" style={{ color: T.sub }}>Si está desmarcado, solo se importan los nuevos</p>
                </div>
              </label>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: T.card }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)' }}
                />
              </div>
              <p className="text-[14px] font-semibold" style={{ color: T.text }}>{progress}% completado</p>
              <p className="text-[12px]" style={{ color: T.sub }}>Escribiendo a Firebase…</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle2 size={28} style={{ color: '#16a34a' }} />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-bold" style={{ color: T.text }}>¡Migración completada!</p>
                <p className="text-[12px] mt-1" style={{ color: T.sub }}>Los datos ya están en Firebase</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-3">
                <ResultCard label="Marcas nuevas"    value={result.brandsNew}      color="#7c3aed" />
                <ResultCard label="Marcas actualizadas" value={result.brandsUpdated} color="#0ea5e9" />
                <ResultCard label="Contenidos nuevos"   value={result.contentsNew}   color="#16a34a" />
                <ResultCard label="Contenidos actualizados" value={result.contentsUpdated} color="#f59e0b" />
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertCircle size={24} style={{ color: '#ef4444' }} />
              </div>
              <p className="text-[14px] font-semibold" style={{ color: T.text }}>Ocurrió un error</p>
              <p className="text-[11px] font-mono px-4 py-3 rounded-xl w-full text-center break-all" style={{ background: T.card, color: '#ef4444' }}>
                {errorMsg}
              </p>
              <button
                onClick={fetchNotion}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}
              >
                <RefreshCw size={13} /> Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: `1px solid ${T.divider}` }}>
          {step === 'done' ? (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={{ background: '#7c3aed', color: '#fff' }}
            >
              Cerrar
            </button>
          ) : step === 'idle' ? (
            <>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-colors hover:bg-black/5" style={{ color: T.sub }}>
                Cancelar
              </button>
              <button
                onClick={fetchNotion}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                Vista previa <ChevronRight size={14} />
              </button>
            </>
          ) : step === 'preview' ? (
            <>
              <button onClick={() => setStep('idle')} className="px-4 py-2.5 rounded-xl text-[13px] font-medium hover:bg-black/5 transition-colors" style={{ color: T.sub }}>
                Atrás
              </button>
              <button
                onClick={runImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                <Download size={14} /> Importar todo
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const { isDark } = useHubTheme()
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>{label}</p>
        <p className="text-[12px] font-semibold truncate" style={{ color: isDark ? '#e2e8f0' : '#111827' }}>{value}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  const { isDark } = useHubTheme()
  return (
    <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
      <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
      <p className="text-[12px] font-semibold mt-0.5" style={{ color: isDark ? '#e2e8f0' : '#111827' }}>{label}</p>
      <p className="text-[10px] mt-1" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>{sub}</p>
    </div>
  )
}

function ResultCard({ label, value, color }: { label: string; value: number; color: string }) {
  const { isDark } = useHubTheme()
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
      <p className="text-[24px] font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: isDark ? '#e2e8f0' : '#374151' }}>{label}</p>
    </div>
  )
}
