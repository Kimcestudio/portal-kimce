'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trash2 } from 'lucide-react'
import { useAutoSave, SaveBadge } from '@/cmhub/useAutoSave'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { NETWORK_META, ALL_NETWORKS } from '@/cmhub/data'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Brand, Network } from '@/cmhub/types'

interface Props {
  initial?: Brand
  onClose: () => void
  onSaved?: (b: Brand) => void
}

const COLORS = ['#3b82f6','#ec4899','#8b5cf6','#22c55e','#f59e0b','#ef4444','#14b8a6','#0f172a','#6366f1','#f97316']

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function BrandModal({ initial, onClose, onSaved }: Props) {
  const { addBrand, updateBrand, deleteBrand, getContentsByBrand, team } = useHub()
  const router = useRouter()
  const base = useHubBase()
  const isEdit = !!initial
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? '#3b82f6')
  const [industry, setIndustry] = useState(initial?.industry ?? '')
  const [country, setCountry] = useState(initial?.country ?? 'España')
  const [responsible, setResponsible] = useState(initial?.responsible ?? '')
  const [responsibleId, setResponsibleId] = useState(initial?.responsibleId ?? '')
  const [status, setStatus] = useState<Brand['status']>(initial?.status ?? 'active')
  const [channels, setChannels] = useState<Network[]>(initial?.channels ?? ['instagram'])
  const [observations, setObservations] = useState(initial?.observations ?? '')
  const [links, setLinks] = useState(initial?.links ?? {})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Autosave (solo en edición) ───────────────────────────────────────────
  const [saveTick, setSaveTick] = useState(0)
  const isFirstBrandRender      = useRef(true)
  const allFields               = JSON.stringify({ name, color, industry, country, responsible, responsibleId, status, channels, observations, links })
  useEffect(() => {
    if (isFirstBrandRender.current) { isFirstBrandRender.current = false; return }
    if (!isEdit) return
    setSaveTick(t => t + 1)
  }, [allFields]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoSaveState = useAutoSave(saveTick, async () => {
    if (!name.trim() || !isEdit || !initial) return
    updateBrand(initial.id, {
      name: name.trim(), initials: initials(name),
      color, industry, country, responsible, responsibleId: responsibleId || undefined,
      status, channels, observations: observations || undefined, links,
    })
  })

  const toggleChannel = (n: Network) =>
    setChannels(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])

  const setLink = (key: keyof Brand['links'], val: string) =>
    setLinks(prev => ({ ...prev, [key]: val || undefined }))

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = {
      name: name.trim(),
      initials: initials(name),
      color, industry, country, responsible, responsibleId: responsibleId || undefined,
      status, channels, observations: observations || undefined, links,
    }
    if (isEdit && initial) {
      onClose()
    } else {
      setSaving(true)
      setSaveError('')
      try {
        const saved = await addBrand(payload)
        onSaved?.(saved)
        onClose()
      } catch (err) {
        console.error('[BrandModal] addBrand error:', err)
        setSaveError('No se pudo crear la marca. Intenta de nuevo.')
      } finally {
        setSaving(false)
      }
    }
  }

  const associatedContents = isEdit && initial ? getContentsByBrand(initial.id) : []

  function handleDelete() {
    if (!initial) return
    setDeleting(true)
    deleteBrand(initial.id)
    onClose()
    router.push(`${base}/clientes`)
  }

  const iLabel = 'text-[11px] font-bold text-[#6b7280] uppercase tracking-wide'
  const iClass = 'border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-[13px] w-full focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 transition-all'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-[#f3f4f6] shrink-0">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-[13px] font-extrabold text-white mr-3" style={{ background: color }}>{initials(name) || '?'}</div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-[#111827]">{isEdit ? `Editar: ${initial?.name}` : 'Nueva marca'}</div>
            <div className="text-[12px] text-[#9ca3af] mt-0.5">Perfil y configuración de la marca</div>
          </div>
          <button onClick={onClose} className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-xl transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Identidad */}
          <div>
            <div className="text-[13px] font-bold text-[#111827] mb-3">Identidad</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={iLabel}>Nombre de la marca <span className="text-red-500">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Acme Corp" className={iClass} />
                {errors.name && <span className="text-[11px] text-red-500">{errors.name}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={iLabel}>Rubro / Industria</label>
                  <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Ej: Tecnología" className={iClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={iLabel}>País</label>
                  <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Ej: España" className={iClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={iLabel}>Responsable interno</label>
                  <select
                    value={responsibleId}
                    onChange={e => {
                      const m = team.find(t => t.id === e.target.value)
                      setResponsibleId(e.target.value)
                      setResponsible(m?.name ?? '')
                    }}
                    className={iClass}
                  >
                    <option value="">Sin asignar</option>
                    {team.filter(m => m.status === 'active').map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.category ? ` · ${m.category}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={iLabel}>Estado</label>
                  <select value={status} onChange={e => setStatus(e.target.value as Brand['status'])} className={iClass}>
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={iLabel}>Color de marca</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ background: c, borderColor: color === c ? '#111827' : 'transparent' }}
                    />
                  ))}
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-7 h-7 rounded-full border border-[#e5e7eb] cursor-pointer overflow-hidden"
                    title="Color personalizado"
                  />
                  <span className="text-[11px] font-mono text-[#9ca3af]">{color}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Canales */}
          <div>
            <div className="text-[13px] font-bold text-[#111827] mb-3">Canales activos</div>
            <div className="flex flex-wrap gap-2">
              {ALL_NETWORKS.map(n => {
                const net = NETWORK_META[n]
                const on = channels.includes(n)
                return (
                  <button key={n} type="button" onClick={() => toggleChannel(n)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl border-2 transition-all"
                    style={{
                      background: on ? net.bg : '#f9fafb',
                      color: on ? net.text : '#9ca3af',
                      borderColor: on ? net.dot + '40' : '#e5e7eb',
                    }}
                  >
                    <NetworkIcon network={n} size={11} /> {net.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="text-[13px] font-bold text-[#111827] mb-3">Links importantes</div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'instagram', label: 'Instagram URL' },
                { key: 'facebook', label: 'Facebook URL' },
                { key: 'tiktok', label: 'TikTok URL' },
                { key: 'linkedin', label: 'LinkedIn URL' },
                { key: 'web', label: 'Sitio web' },
                { key: 'drive', label: 'Carpeta Drive' },
                { key: 'designs', label: 'Carpeta diseños' },
                { key: 'reports', label: 'Carpeta reportes' },
              ] as { key: keyof Brand['links']; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className={iLabel}>{label}</label>
                  <input type="url" value={links[key] ?? ''} onChange={e => setLink(key, e.target.value)} placeholder="https://..." className={iClass + ' text-[12px]'} />
                </div>
              ))}
            </div>
          </div>

          {/* Observations */}
          <div className="flex flex-col gap-1.5">
            <label className={iLabel}>Observaciones estratégicas</label>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} placeholder="Notas sobre la estrategia, tono, objetivos del cliente..." className={iClass + ' resize-none'} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f3f4f6] flex items-center justify-between shrink-0 bg-[#fafafa]">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-[13px] text-[#9ca3af] hover:text-[#6b7280] transition-colors">Cancelar</button>
            {isEdit && (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Eliminar cliente
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isEdit && <SaveBadge state={autoSaveState} />}
            {saveError && <span className="text-[11px] text-red-500">{saveError}</span>}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6] disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
              {saving ? 'Creando…' : isEdit ? 'Cerrar' : 'Crear marca'}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={e => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl">
            <div className="text-[16px] font-bold text-[#111827] mb-1.5">¿Eliminar a {initial?.name}?</div>
            <div className="text-[13px] text-[#6b7280] mb-2">Esta acción no se puede deshacer.</div>
            {associatedContents.length > 0 && (
              <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                Este cliente tiene {associatedContents.length} contenido{associatedContents.length === 1 ? '' : 's'} asociado{associatedContents.length === 1 ? '' : 's'}. Se eliminará{associatedContents.length === 1 ? '' : 'n'} también, junto con la marca.
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-[#e5e7eb] text-[#6b7280] text-[13px] py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors">
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
