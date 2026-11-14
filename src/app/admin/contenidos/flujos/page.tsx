'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHubTheme } from '@/cmhub/theme'
import { useHub } from '@/cmhub/context'
import { COL_FLUJOS } from '@/cmhub/flujos'
import type { HubFlujo } from '@/cmhub/types'
import { Check, CheckCircle2, Circle, Loader2, Plus, Workflow } from 'lucide-react'
import IniciarFlujoModal from '@/components/cmhub/IniciarFlujoModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

const PLANTILLA_LABELS: Record<string, string> = {
  contenido_completo: 'Flujo Contenido',
  revision_interna:   'Revisión Interna',
  custom:             'Personalizado',
}

// ── FlujoCard ─────────────────────────────────────────────────────────────────

function FlujoCard({ flujo, tk, isDark }: { flujo: HubFlujo; tk: Record<string, string>; isDark: boolean }) {
  const pct = flujo.pasos.length > 0
    ? Math.round((flujo.pasoActual / flujo.pasos.length) * 100)
    : 0
  const isComplete = flujo.estado === 'completado'
  const currentPaso = flujo.pasos[flujo.pasoActual] ?? null
  const assignees = currentPaso?.assigneeNames ?? []
  const dueDate = currentPaso?.dueDate ?? null

  const accentColor = isComplete ? '#10b981' : '#7c3aed'
  const badgeBg = isComplete
    ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5')
    : (isDark ? 'rgba(124,58,237,0.15)' : '#ede9fe')
  const badgeColor = isComplete ? '#059669' : '#7c3aed'

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md"
      style={{ background: tk.card, borderColor: tk.border, borderLeft: `3px solid ${accentColor}` }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold truncate" style={{ color: tk.text }}>{flujo.nombre}</h3>
          {flujo.descripcion && (
            <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: tk.sub }}>{flujo.descripcion}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {flujo.plantillaId && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: tk.sub }}>
              {PLANTILLA_LABELS[flujo.plantillaId] ?? flujo.plantillaId}
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: badgeBg, color: badgeColor }}>
            {isComplete ? 'Completado' : 'Activo'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold" style={{ color: tk.sub }}>
            {isComplete ? 'Completado' : `Paso ${flujo.pasoActual + 1} de ${flujo.pasos.length}`}
          </span>
          <span className="text-[11px] font-bold" style={{ color: accentColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: accentColor }} />
        </div>
      </div>

      {/* Steps list */}
      <div className="flex flex-col gap-1.5">
        {flujo.pasos.map((paso, i) => {
          const done    = i < flujo.pasoActual || isComplete
          const current = i === flujo.pasoActual && !isComplete
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className="shrink-0" style={{ color: done ? '#10b981' : current ? '#7c3aed' : tk.muted }}>
                {done    ? <Check size={13} strokeWidth={3} />
                 : current ? <Circle size={12} strokeWidth={2.5} style={{ fill: '#7c3aed', color: '#7c3aed' }} />
                 : <Circle size={12} strokeWidth={1.5} />}
              </span>
              <span className="text-[12px] truncate"
                style={{
                  color: done ? tk.sub : current ? tk.text : tk.sub,
                  fontWeight: current ? 600 : 400,
                  textDecoration: done ? 'line-through' : 'none',
                  opacity: done ? 0.6 : 1,
                }}>
                {paso.titulo}
                {paso.category && (
                  <span className="ml-1.5 text-[10px]" style={{ color: tk.muted }}>· {paso.category}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer: assignees + dueDate */}
      {!isComplete && (assignees.length > 0 || dueDate) && (
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: tk.border }}>
          {assignees.length > 0 && (
            <div className="flex items-center gap-1">
              {assignees.slice(0, 3).map((name, i) => (
                <div key={i}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: ['#7c3aed','#2563eb','#d97706','#059669'][i % 4] }}
                  title={name}>
                  {initials(name)}
                </div>
              ))}
              {assignees.length > 3 && (
                <span className="text-[10px]" style={{ color: tk.sub }}>+{assignees.length - 3}</span>
              )}
            </div>
          )}
          {dueDate && (
            <span className="ml-auto text-[10px] font-semibold" style={{ color: tk.sub }}>
              📅 {fmtDate(dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlujosPage() {
  const { isDark } = useHubTheme()
  const { team } = useHub()
  const [flujos, setFlujos] = useState<HubFlujo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<'activo' | 'completado'>('activo')
  const [showModal, setShowModal] = useState(false)

  const activeTeam = team.filter(m => m.status === 'active').map(m => ({ id: m.id, name: m.name, color: m.color }))

  const tk: Record<string, string> = isDark ? {
    page:    '#0d0f12',
    card:    '#161820',
    border:  'rgba(255,255,255,0.07)',
    text:    '#f1f5f9',
    sub:     '#94a3b8',
    muted:   '#4b5563',
  } : {
    page:    '#f8fafc',
    card:    '#ffffff',
    border:  '#e5e7eb',
    text:    '#111827',
    sub:     '#6b7280',
    muted:   '#d1d5db',
  }

  useEffect(() => {
    const q = query(collection(db, COL_FLUJOS), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFlujos(snap.docs.map(d => ({ id: d.id, ...d.data() } as HubFlujo)))
      setLoading(false)
    }, (err) => {
      console.error('[flujos] onSnapshot error', err?.code, err?.message)
      setLoadError(true)
      setLoading(false)
    })
    return unsub
  }, [])

  const activos     = flujos.filter(f => f.estado === 'activo')
  const completados = flujos.filter(f => f.estado === 'completado')
  const visible     = tab === 'activo' ? activos : completados

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: tk.page }}>

      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-3 shrink-0"
        style={{ background: tk.card, borderBottom: `1px solid ${tk.border}`, minHeight: 52 }}>
        <div className="flex items-center gap-1.5 mr-auto">
          <span className="text-[13px]" style={{ color: tk.sub }}>Producción</span>
          <span style={{ color: tk.border }}>›</span>
          <span className="text-[13px] font-semibold" style={{ color: tk.text }}>Flujos</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
          {(['activo', 'completado'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: tab === t ? (isDark ? '#1e2028' : '#fff') : 'transparent',
                color:      tab === t ? tk.text : tk.sub,
                boxShadow:  tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {t === 'activo' ? `Activos (${activos.length})` : `Completados (${completados.length})`}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-white transition-opacity hover:opacity-80"
          style={{ background: '#7c3aed' }}>
          <Plus size={13} />
          Nuevo flujo
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2" style={{ color: tk.sub }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Cargando flujos…</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 rounded-2xl border border-dashed"
            style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fff5f5' }}>
            <p className="text-[13px] font-semibold">No se pudieron cargar los flujos.</p>
            <p className="text-[11px]">Sin permisos o sin conexión — contacta al administrador.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: tk.sub }}>
            <CheckCircle2 size={32} strokeWidth={1.5} />
            <p className="text-[13px] font-medium">
              {tab === 'activo' ? 'No hay flujos activos' : 'No hay flujos completados'}
            </p>
            {tab === 'activo' && (
              <button
                onClick={() => setShowModal(true)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white"
                style={{ background: '#7c3aed' }}>
                Crear primer flujo
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(flujo => (
              <FlujoCard key={flujo.id} flujo={flujo} tk={tk} isDark={isDark} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <IniciarFlujoModal
          team={activeTeam}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
