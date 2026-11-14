'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, ChevronRight, Workflow, ImagePlus, Loader2 } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/services/firebase/client'
import { compressImage } from '@/services/firebase/imageCompress'
import { createFlujo, FLUJO_PLANTILLAS } from '@/cmhub/flujos'
import { ACTIV_CATEGORIES } from '@/cmhub/activities'
import type { FlujoStep } from '@/cmhub/types'

interface TeamMemberMin {
  id: string
  name: string
  color: string
}

interface Props {
  team: TeamMemberMin[]
  onClose: () => void
  onCreated?: (flujoId: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  Entrega: '#0d9488', Revisión: '#a78bfa', Diseño: '#ec4899', Edición: '#f97316',
  Estrategia: '#6366f1', Investigación: '#0ea5e9', Otro: '#64748b',
}

export default function IniciarFlujoModal({ team, onClose, onCreated }: Props) {
  const [step, setStep] = useState<'plantilla' | 'config'>('plantilla')
  const [selectedPlantilla, setSelectedPlantilla] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [pasos, setPasos] = useState<FlujoStep[]>([])
  const [saving, setSaving] = useState(false)

  const [capturaFiles, setCapturaFiles] = useState<File[]>([])
  const [capturaPreviews, setCapturaPreviews] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Revocar object URLs al desmontar
  useEffect(() => {
    return () => { capturaPreviews.forEach(u => URL.revokeObjectURL(u)) }
  }, [capturaPreviews])

  function seleccionarPlantilla(id: string) {
    const p = FLUJO_PLANTILLAS.find(t => t.id === id)!
    setSelectedPlantilla(id)
    setNombre(p.nombre)
    setPasos(p.pasos.map(s => ({ ...s, dueDate: undefined })))
    setStep('config')
  }

  function updatePaso(idx: number, patch: Partial<FlujoStep>) {
    setPasos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function addPaso() {
    setPasos(prev => [...prev, { titulo: `Paso ${prev.length + 1}`, assigneeNames: [], category: 'Otro', descripcion: '' }])
  }

  function removePaso(idx: number) {
    if (pasos.length <= 2) return
    setPasos(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleAssignee(pasoIdx: number, name: string) {
    const paso = pasos[pasoIdx]
    const ya = paso.assigneeNames.includes(name)
    updatePaso(pasoIdx, {
      assigneeNames: ya
        ? paso.assigneeNames.filter(n => n !== name)
        : [...paso.assigneeNames, name],
    })
  }

  function addCapturas(files: FileList | null) {
    if (!files) return
    const nuevos = Array.from(files).filter(f => f.type.startsWith('image/'))
    const previews = nuevos.map(f => URL.createObjectURL(f))
    setCapturaFiles(prev => [...prev, ...nuevos])
    setCapturaPreviews(prev => [...prev, ...previews])
  }

  function removeCapturaAt(idx: number) {
    URL.revokeObjectURL(capturaPreviews[idx])
    setCapturaFiles(prev => prev.filter((_, i) => i !== idx))
    setCapturaPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    addCapturas(e.dataTransfer.files)
  }

  async function handleStart() {
    if (!nombre.trim() || pasos.some(p => !p.titulo.trim())) return
    setSaving(true)
    setErrorMsg('')
    try {
      // Subir capturas del brief a Storage
      const capturaUrls: string[] = []
      for (const file of capturaFiles) {
        const compressed = await compressImage(file)
        const ext     = compressed.name.split('.').pop() ?? 'jpg'
        const path    = `hubFlujosCapturas/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const storRef = ref(storage, path)
        await uploadBytes(storRef, compressed)
        capturaUrls.push(await getDownloadURL(storRef))
      }

      const id = await createFlujo(
        nombre.trim(),
        descripcion.trim(),
        pasos,
        selectedPlantilla ?? undefined,
        capturaUrls.length ? capturaUrls : undefined,
      )
      onCreated?.(id)
      onClose()
    } catch (e) {
      const err = e as { code?: string; message?: string }
      console.error('[flujo] createFlujo error', err?.code, err?.message, e)
      setErrorMsg(err?.code === 'permission-denied'
        ? 'Sin permisos para crear flujos. Contacta al administrador.'
        : `Error al crear el flujo: ${err?.message ?? 'intenta de nuevo'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const canStart = nombre.trim() && pasos.every(p => p.titulo.trim())

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-[#f3f4f6] shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#f5f3ff] flex items-center justify-center">
            <Workflow size={16} className="text-[#7c3aed]" />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold text-[#111827]">
              {step === 'plantilla' ? 'Iniciar flujo' : 'Configurar flujo'}
            </h2>
            <p className="text-[11px] text-[#9ca3af]">
              {step === 'plantilla'
                ? 'Elige una plantilla de flujo de trabajo'
                : 'Ajusta los pasos, asigna responsables y define fechas'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-xl transition-colors cursor-pointer">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Paso 1: elegir plantilla ─────────────────────────── */}
          {step === 'plantilla' && (
            <div className="p-6 flex flex-col gap-3">
              {FLUJO_PLANTILLAS.map(t => (
                <button key={t.id} onClick={() => seleccionarPlantilla(t.id)}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-xl border border-[#e5e7eb] hover:border-[#7c3aed] hover:bg-[#faf8ff] transition-all group cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] flex items-center justify-center shrink-0">
                    <Workflow size={18} className="text-[#7c3aed]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#111827] group-hover:text-[#7c3aed] transition-colors">
                      {t.nombre}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5">{t.descripcion}</div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {t.pasos.map((p, i) => (
                        <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${CATEGORY_COLORS[p.category ?? 'Otro'] ?? '#64748b'}18`, color: CATEGORY_COLORS[p.category ?? 'Otro'] ?? '#64748b' }}>
                          {i + 1}. {p.titulo}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#d1d5db] group-hover:text-[#7c3aed] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Paso 2: configurar ──────────────────────────────── */}
          {step === 'config' && (
            <div className="p-6 flex flex-col gap-5">

              {/* Nombre + Brief */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1">
                    Nombre del flujo
                  </label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Contenido semana 32"
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#c8cdd6] outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">
                      Brief / Descripción general
                    </label>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1 text-[10px] font-semibold text-[#7c3aed] hover:opacity-70 transition-opacity cursor-pointer">
                      <ImagePlus size={11} /> Adjuntar capturas
                    </button>
                  </div>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                    rows={2} placeholder="Contexto o idea que se pasa a todos los pasos…"
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#c8cdd6] outline-none focus:border-[#7c3aed] transition-colors resize-none" />

                  {/* Zona drag & drop + previews */}
                  {capturaPreviews.length === 0 ? (
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      className="mt-2 border-2 border-dashed border-[#e5e7eb] rounded-xl px-4 py-4 flex flex-col items-center gap-1 cursor-pointer hover:border-[#7c3aed] hover:bg-[#faf8ff] transition-all">
                      <ImagePlus size={18} className="text-[#d1d5db]" />
                      <span className="text-[11px] text-[#9ca3af]">Arrastra capturas o haz clic para adjuntar</span>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                      className="mt-2 grid grid-cols-4 gap-1.5">
                      {capturaPreviews.map((src, i) => (
                        <div key={i} className="relative group rounded-xl overflow-hidden border border-[#e5e7eb]"
                          style={{ aspectRatio: '1' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightbox(src)} />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeCapturaAt(i) }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500">
                            <X size={8} />
                          </button>
                        </div>
                      ))}
                      {/* celda + para agregar más */}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-xl border-2 border-dashed border-[#e5e7eb] flex items-center justify-center hover:border-[#7c3aed] hover:bg-[#faf8ff] transition-all cursor-pointer"
                        style={{ aspectRatio: '1' }}>
                        <ImagePlus size={14} className="text-[#d1d5db]" />
                      </button>
                    </div>
                  )}

                  <input ref={fileRef} type="file" multiple accept="image/*"
                    className="hidden" onChange={e => addCapturas(e.target.files)} />
                </div>
              </div>

              {/* Pasos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">
                    Pasos del flujo ({pasos.length})
                  </span>
                  <button onClick={addPaso}
                    className="text-[11px] text-[#7c3aed] font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer">
                    <Plus size={12} /> Añadir paso
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {pasos.map((paso, idx) => (
                    <div key={idx} className="border border-[#e5e7eb] rounded-xl overflow-hidden">
                      {/* Cabecera del paso */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#fafafa] border-b border-[#f3f4f6]">
                        <span className="w-5 h-5 rounded-full bg-[#7c3aed] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input value={paso.titulo} onChange={e => updatePaso(idx, { titulo: e.target.value })}
                          className="flex-1 text-[12px] font-semibold text-[#111827] bg-transparent outline-none"
                          placeholder={`Nombre del paso ${idx + 1}`} />
                        {pasos.length > 2 && (
                          <button onClick={() => removePaso(idx)}
                            className="text-[#d1d5db] hover:text-red-500 transition-colors cursor-pointer">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {/* Cuerpo del paso */}
                      <div className="p-3 flex flex-col gap-2.5">
                        {/* Responsables */}
                        <div>
                          <span className="text-[9px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1.5">
                            Responsable(s)
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {team.map(m => {
                              const active = paso.assigneeNames.includes(m.name)
                              return (
                                <button key={m.id} onClick={() => toggleAssignee(idx, m.name)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer"
                                  style={{
                                    background: active ? `${m.color}18` : 'transparent',
                                    color: active ? m.color : '#9ca3af',
                                    borderColor: active ? m.color : '#e5e7eb',
                                  }}>
                                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                    style={{ background: m.color }}>
                                    {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                  {m.name.split(' ')[0]}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Categoría + Fecha */}
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1">
                              Categoría
                            </span>
                            <select value={paso.category ?? ''}
                              onChange={e => updatePaso(idx, { category: e.target.value || undefined })}
                              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-[11px] text-[#374151] outline-none focus:border-[#7c3aed] transition-colors appearance-none">
                              <option value="">Sin categoría</option>
                              {ACTIV_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1">
                              Fecha límite
                            </span>
                            <input type="date" value={paso.dueDate ?? ''}
                              onChange={e => updatePaso(idx, { dueDate: e.target.value || undefined })}
                              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-[11px] text-[#374151] outline-none focus:border-[#7c3aed] transition-colors" />
                          </div>
                        </div>

                        {/* Descripción del paso */}
                        <div>
                          <span className="text-[9px] font-bold text-[#b0b7c3] uppercase tracking-widest block mb-1">
                            Instrucciones para este paso
                          </span>
                          <textarea value={paso.descripcion ?? ''} rows={1}
                            onChange={e => updatePaso(idx, { descripcion: e.target.value })}
                            placeholder="Qué debe hacer la persona en este paso…"
                            className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-[11px] text-[#374151] placeholder-[#c8cdd6] outline-none focus:border-[#7c3aed] transition-colors resize-none" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f3f4f6] flex flex-col gap-2 shrink-0">
          {errorMsg && (
            <p className="rounded-xl bg-[#fee2e2] border border-[#fca5a5] px-3 py-2 text-[12px] font-semibold text-[#dc2626]">
              {errorMsg}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button onClick={step === 'config' ? () => setStep('plantilla') : onClose}
              className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors cursor-pointer">
              {step === 'config' ? '← Volver' : 'Cancelar'}
            </button>

            {step === 'config' && (
              <button onClick={handleStart} disabled={saving || !canStart}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7c3aed] text-white text-[13px] font-semibold disabled:opacity-40 cursor-pointer hover:bg-[#5b21b6] transition-colors">
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> {capturaFiles.length > 0 ? 'Subiendo capturas…' : 'Iniciando…'}</>
                  : <><Workflow size={14} /> Iniciar flujo</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Vista completa"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
