'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { X, Sparkles, Loader2, AlertCircle, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import type { Network, Format, ContentStatus, Priority } from '@/cmhub/types'

type Step = 'idle' | 'loading' | 'review' | 'saving' | 'done' | 'error'

interface Draft {
  title: string
  brandName: string
  channel: Network
  format: Format
  date: string
  dueDate: string
  time: string
  responsible: string
  responsables: string[]
  priority: Priority
  status: ContentStatus
  copy: string
  hashtags: string
}

const CHANNELS: Network[]     = ['instagram', 'facebook', 'fb_comunidad', 'tiktok', 'linkedin', 'youtube', 'whatsapp', 'blog', 'email', 'web', 'stories']
const FORMATS: Format[]       = ['Reel', 'Post', 'Historia', 'Carrusel', 'Video', 'Email', 'Story', 'Short', 'Mensaje']
const STATUSES: ContentStatus[] = ['idea', 'produccion', 'revision', 'aprobado', 'programado', 'publicado']
const PRIORITIES: Priority[]  = ['baja', 'media', 'alta', 'urgente']

export default function AiQuickAddModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useHubTheme()
  const { brands, team, addContent } = useHub()

  const [step, setStep]       = useState<Step>('idle')
  const [text, setText]       = useState('')
  const [draft, setDraft]     = useState<Draft | null>(null)
  const [brandId, setBrandId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const T = isDark ? {
    bg: '#161820', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', sub: '#94a3b8',
    card: 'rgba(255,255,255,0.04)', divider: 'rgba(255,255,255,0.08)', inputBg: 'rgba(255,255,255,0.05)',
  } : {
    bg: '#ffffff', border: '#e5e7eb', text: '#111827', sub: '#6b7280',
    card: '#f9fafb', divider: '#f3f4f6', inputBg: '#ffffff',
  }
  const inputStyle = { background: T.inputBg, color: T.text, border: `1px solid ${T.border}` }

  async function generate() {
    if (!text.trim()) return
    setStep('loading')
    setErrorMsg('')
    try {
      const r = await fetch('/api/ai/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, brands: brands.map(b => b.name), team: team.map(m => m.name) }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${r.status}`)
      }
      const data = await r.json()
      const d = (data.draft ?? {}) as Partial<Draft>

      const normalized: Draft = {
        title:        d.title || '',
        brandName:    d.brandName || '',
        channel:      (CHANNELS.includes(d.channel as Network) ? d.channel : 'instagram') as Network,
        format:       (FORMATS.includes(d.format as Format) ? d.format : 'Post') as Format,
        date:         d.date || '',
        dueDate:      d.dueDate || '',
        time:         d.time || '',
        responsible:  d.responsible || '',
        responsables: Array.isArray(d.responsables) ? d.responsables : [],
        priority:     (PRIORITIES.includes(d.priority as Priority) ? d.priority : 'media') as Priority,
        status:       (STATUSES.includes(d.status as ContentStatus) ? d.status : 'idea') as ContentStatus,
        copy:         d.copy || '',
        hashtags:     d.hashtags || '',
      }
      setDraft(normalized)

      const matched = brands.find(b => b.name.toLowerCase() === normalized.brandName.toLowerCase())
        ?? brands.find(b => !!normalized.brandName && b.name.toLowerCase().includes(normalized.brandName.toLowerCase()))
      setBrandId(matched?.id ?? (brands[0]?.id ?? ''))

      setStep('review')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  async function confirm() {
    if (!draft || !brandId) return
    setStep('saving')
    try {
      await addContent({
        brandId,
        title:        draft.title,
        channel:      draft.channel,
        channels:     [draft.channel],
        format:       draft.format,
        date:         draft.date || null,
        dueDate:      draft.dueDate || null,
        time:         draft.time || null,
        status:       draft.status,
        priority:     draft.priority,
        responsible:  draft.responsible || draft.responsables[0] || '',
        responsables: draft.responsables.length ? draft.responsables : undefined,
        tags:         [],
        copy:         draft.copy,
        hashtags:     draft.hashtags || undefined,
        approvalStatus: 'pending',
      })
      setStep('done')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function reset() {
    setStep('idle'); setText(''); setDraft(null); setBrandId(''); setErrorMsg('')
  }

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
              <Sparkles size={16} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-[15px] font-bold" style={{ color: T.text }}>Ingreso rápido con IA</p>
              <p className="text-[11px]" style={{ color: T.sub }}>Describe la actividad y la IA la estructura</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/10 transition-colors" style={{ color: T.sub }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 min-h-0">

          {step === 'idle' && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed" style={{ color: T.sub }}>
                Escribe en lenguaje natural y la IA la convierte en un contenido estructurado. Ej: <em>&quot;Reel para KZC el viernes, responsable Ana, prioridad alta&quot;</em>
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Describe la actividad o contenido…"
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none"
                style={inputStyle}
                autoFocus
              />
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: '#7c3aed' }} />
              <p className="text-[13px] font-medium" style={{ color: T.text }}>Analizando con Claude…</p>
            </div>
          )}

          {step === 'review' && draft && (
            <div className="flex flex-col gap-3">
              <Field label="Título">
                <input value={draft.title} onChange={e => updateDraft('title', e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle} />
              </Field>

              <Field label="Marca">
                <select value={brandId} onChange={e => setBrandId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                  <option value="">— Selecciona una marca —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Canal">
                  <select value={draft.channel} onChange={e => updateDraft('channel', e.target.value as Network)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Formato">
                  <select value={draft.format} onChange={e => updateDraft('format', e.target.value as Format)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de publicación">
                  <input type="date" value={draft.date} onChange={e => updateDraft('date', e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle} />
                </Field>
                <Field label="Hora">
                  <input type="time" value={draft.time} onChange={e => updateDraft('time', e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle} />
                </Field>
              </div>

              <Field label="Responsable">
                <select value={draft.responsible} onChange={e => updateDraft('responsible', e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                  <option value="">— Sin asignar —</option>
                  {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prioridad">
                  <select value={draft.priority} onChange={e => updateDraft('priority', e.target.value as Priority)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Estado">
                  <select value={draft.status} onChange={e => updateDraft('status', e.target.value as ContentStatus)} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none" style={inputStyle}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {draft.copy && (
                <Field label="Copy">
                  <textarea value={draft.copy} onChange={e => updateDraft('copy', e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none" style={inputStyle} />
                </Field>
              )}
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: '#7c3aed' }} />
              <p className="text-[13px] font-medium" style={{ color: T.text }}>Guardando en Firebase…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle2 size={28} style={{ color: '#16a34a' }} />
              </div>
              <p className="text-[15px] font-bold" style={{ color: T.text }}>¡Contenido creado!</p>
            </div>
          )}

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
                onClick={reset}
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
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors" style={{ background: '#7c3aed', color: '#fff' }}>
              Cerrar
            </button>
          ) : step === 'idle' ? (
            <>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-colors hover:bg-black/5" style={{ color: T.sub }}>
                Cancelar
              </button>
              <button
                onClick={generate}
                disabled={!text.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-40"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                Generar <ChevronRight size={14} />
              </button>
            </>
          ) : step === 'review' ? (
            <>
              <button onClick={reset} className="px-4 py-2.5 rounded-xl text-[13px] font-medium hover:bg-black/5 transition-colors" style={{ color: T.sub }}>
                Atrás
              </button>
              <button
                onClick={confirm}
                disabled={!draft?.title || !brandId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-40"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                Crear contenido
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { isDark } = useHubTheme()
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>{label}</label>
      {children}
    </div>
  )
}
