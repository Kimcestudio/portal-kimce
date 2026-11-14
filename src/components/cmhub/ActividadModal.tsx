'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, Check, ExternalLink, ChevronDown, Trash2, Calendar, ImagePlus, Loader2 } from 'lucide-react'
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/services/firebase/client'
import { compressImage } from '@/services/firebase/imageCompress'
import { useHub } from '@/cmhub/context'
import { getActividadAssignees, ACTIV_CATEGORIES } from '@/cmhub/activities'
import { useAutoSave, SaveBadge } from '@/cmhub/useAutoSave'
import type { HubActividad, ActividadAdjunto } from '@/cmhub/types'

interface Props {
  initial: HubActividad
  onClose: () => void
  mode?: 'modal' | 'drawer'
}

const STATUS_META: Record<HubActividad['status'], { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#92400e', bg: '#fef3c7' },
  en_curso:   { label: 'En curso',   color: '#1d4ed8', bg: '#dbeafe' },
  completado: { label: 'Completado', color: '#065f46', bg: '#d1fae5' },
}

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return { open, setOpen, ref }
}

function getDrivePreviewUrl(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`
  return null
}

export default function ActividadModal({ initial, onClose, mode = 'modal' }: Props) {
  const { team } = useHub()
  const activeTeam = team.filter(m => m.status === 'active')

  const [title, setTitle]           = useState(initial.title)
  const [status, setStatus]         = useState(initial.status)
  const [completedAt, setCompletedAt] = useState<string | null>(initial.completedAt ?? null)
  const [assignees, setAssignees]   = useState<string[]>(getActividadAssignees(initial))
  const [category, setCategory]     = useState(initial.category ?? '')
  const [dueDate, setDueDate]       = useState(initial.dueDate ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [linkEntrega, setLinkEntrega] = useState(initial.linkEntrega ?? '')
  const [adjuntos, setAdjuntos]     = useState<ActividadAdjunto[]>(initial.adjuntos ?? [])
  const [uploading, setUploading]   = useState(false)
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Autosave ──────────────────────────────────────────────────────────────
  const [saveTick, setSaveTick]     = useState(0)
  const tick = () => setSaveTick(t => t + 1)
  const saveState = useAutoSave(saveTick, async () => {
    if (!title.trim()) return
    await updateDoc(doc(db, 'hubActividades', initial.id), {
      title:       title.trim(),
      status,
      completedAt,
      assignee:    assignees[0] || null,
      assignees,
      category:    category || null,
      dueDate:     dueDate   || null,
      description: description || null,
      linkEntrega: linkEntrega || null,
    })
  })

  const statusDd   = useDropdown()
  const assigneeDd = useDropdown()
  const categoryDd = useDropdown()

  const sm = STATUS_META[status]

  function addAssignee(name: string) {
    if (!assignees.some(a => a.trim().toLowerCase() === name.trim().toLowerCase())) {
      setAssignees(prev => [...prev, name]); tick()
    }
  }
  function removeAssignee(name: string) {
    setAssignees(prev => prev.filter(a => a.trim().toLowerCase() !== name.trim().toLowerCase())); tick()
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const isImage    = file.type.startsWith('image/')
        const compressed = isImage ? await compressImage(file) : file
        const ext     = compressed.name.split('.').pop() ?? 'bin'
        const path    = `hubActividades/${initial.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const storRef = ref(storage, path)
        await uploadBytes(storRef, compressed)
        const url     = await getDownloadURL(storRef)
        const adjunto: ActividadAdjunto = {
          url, nombre: file.name,
          tipo: isImage ? 'imagen' : 'archivo',
          storagePath: path,
        }
        await updateDoc(doc(db, 'hubActividades', initial.id), { adjuntos: arrayUnion(adjunto) })
        setAdjuntos(prev => [...prev, adjunto])
      }
    } catch (e) {
      console.error('Error subiendo adjunto:', e)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAdjunto(adjunto: ActividadAdjunto) {
    try {
      await deleteObject(ref(storage, adjunto.storagePath))
    } catch {
      // si ya no existe en Storage, seguimos
    }
    await updateDoc(doc(db, 'hubActividades', initial.id), { adjuntos: arrayRemove(adjunto) })
    setAdjuntos(prev => prev.filter(a => a.storagePath !== adjunto.storagePath))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleUpload(e.dataTransfer.files)
  }


  async function handleDelete() {
    await deleteDoc(doc(db, 'hubActividades', initial.id))
    onClose()
  }

  const inner = (
    <>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[#f3f4f6] shrink-0">
        <div className="flex items-start gap-3">
          {/* Badge estado */}
          <div ref={statusDd.ref} className="relative shrink-0 mt-0.5">
            <button onClick={() => statusDd.setOpen(o => !o)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: sm.bg, color: sm.color }}>
              {sm.label}
              <ChevronDown size={11} />
            </button>
            {statusDd.open && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-[150px]">
                {(Object.keys(STATUS_META) as HubActividad['status'][]).map(s => (
                  <button key={s} onClick={() => {
                    setStatus(s)
                    setCompletedAt(s === 'completado' ? (completedAt ?? new Date().toISOString()) : null)
                    statusDd.setOpen(false)
                    tick()
                  }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer transition-colors">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-1 text-left"
                      style={{ background: STATUS_META[s].bg, color: STATUS_META[s].color }}>
                      {STATUS_META[s].label}
                    </span>
                    {s === status && <Check size={11} className="text-[#7c3aed] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Título editable */}
          <div className="flex-1 min-w-0">
            <textarea
              value={title}
              onChange={e => { setTitle(e.target.value); tick() }}
              rows={1}
              className="w-full text-[18px] font-bold text-[#111827] resize-none outline-none bg-transparent leading-snug"
              style={{ field_sizing: 'content' } as React.CSSProperties}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = t.scrollHeight + 'px'
              }}
            />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 shrink-0">
            <SaveBadge state={saveState} />
            <button onClick={() => setConfirmDelete(true)}
              className="p-2 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose}
              className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-xl transition-colors cursor-pointer">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-0 divide-y divide-[#f3f4f6]">

        {/* Responsables */}
        <div className="py-3 flex items-center gap-4">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest w-28 shrink-0">Responsables</span>
          <div className="flex-1 flex items-center gap-1.5 flex-wrap">
            {assignees.map(name => {
              const member = activeTeam.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase())
              return (
                <button key={name} type="button" onClick={() => removeAssignee(name)}
                  title={`${name} — clic para quitar`}
                  className="group relative w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ background: member?.color ?? '#6366f1' }}>
                  {member ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : name.slice(0, 2).toUpperCase()}
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] hidden group-hover:flex items-center justify-center">×</span>
                </button>
              )
            })}

            <div ref={assigneeDd.ref} className="relative">
              <button onClick={() => assigneeDd.setOpen(o => !o)}
                className="w-7 h-7 rounded-full border border-dashed border-[#d1d5db] flex items-center justify-center text-[14px] text-[#9ca3af] hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors cursor-pointer leading-none">
                +
              </button>
              {assigneeDd.open && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-[180px] max-h-52 overflow-y-auto">
                  {activeTeam.filter(m => !assignees.some(a => a.trim().toLowerCase() === m.name.trim().toLowerCase())).map(m => (
                    <button key={m.id} onClick={() => { addAssignee(m.name); assigneeDd.setOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer transition-colors">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                        style={{ background: m.color ?? '#6366f1' }}>
                        {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[12px] text-[#111827] truncate">{m.name}</span>
                    </button>
                  ))}
                  {activeTeam.filter(m => !assignees.some(a => a.trim().toLowerCase() === m.name.trim().toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-[#9ca3af]">Todos ya están asignados</p>
                  )}
                </div>
              )}
            </div>

            {assignees.length === 0 && (
              <span className="text-[12px] text-[#9ca3af]">Sin asignar…</span>
            )}
          </div>
        </div>

        {/* Categoría */}
        <div className="py-3 flex items-center gap-4">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest w-28 shrink-0">Categoría</span>
          <div ref={categoryDd.ref} className="relative flex-1">
            <button onClick={() => categoryDd.setOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] hover:border-[#7c3aed] transition-colors w-full cursor-pointer">
              <span className="flex-1 text-left text-[12px] font-semibold text-[#111827]">{category || '—'}</span>
              <ChevronDown size={13} className="text-[#9ca3af] shrink-0" />
            </button>
            {categoryDd.open && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-full">
                <button onClick={() => { setCategory(''); categoryDd.setOpen(false); tick() }}
                  className="w-full flex items-center px-3 py-2 hover:bg-[#f9fafb] text-[12px] text-[#9ca3af] cursor-pointer transition-colors">
                  Sin categoría
                </button>
                {ACTIV_CATEGORIES.map(c => (
                  <button key={c} onClick={() => { setCategory(c); categoryDd.setOpen(false); tick() }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer transition-colors">
                    <span className="text-[12px] text-[#111827] flex-1 text-left">{c}</span>
                    {c === category && <Check size={11} className="text-[#7c3aed] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fecha límite */}
        <div className="py-3 flex items-center gap-4">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest w-28 shrink-0">Fecha límite</span>
          <div className="flex items-center gap-2 flex-1">
            <Calendar size={13} className="text-[#9ca3af] shrink-0" />
            <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); tick() }}
              className="flex-1 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed] cursor-pointer" />
          </div>
        </div>

        {/* Descripción */}
        <div className="py-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">Descripción</span>
          <textarea value={description} onChange={e => { setDescription(e.target.value); tick() }} rows={3}
            placeholder="Agrega una descripción…"
            className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 text-[13px] text-[#111827] placeholder-[#c8cdd6] resize-none focus:outline-none focus:border-[#7c3aed] transition-colors" />
        </div>

        {/* Link de entrega */}
        <div className="py-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">Link de entrega</span>
          <div className="relative">
            <input type="url" value={linkEntrega} onChange={e => { setLinkEntrega(e.target.value); tick() }}
              placeholder="https://drive.google.com/…"
              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 pr-9 text-[12px] text-[#111827] placeholder-[#c8cdd6] focus:outline-none focus:border-[#7c3aed] transition-colors" />
            {linkEntrega && (
              <a href={linkEntrega} target="_blank" rel="noreferrer"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#7c3aed] transition-colors">
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {linkEntrega && (() => {
            const preview = getDrivePreviewUrl(linkEntrega)
            return preview ? (
              <iframe src={preview} className="w-full rounded-xl border border-[#e5e7eb] mt-1"
                style={{ height: 200 }} allow="autoplay" title="Drive preview" />
            ) : null
          })()}
        </div>

        {/* Capturas / Adjuntos */}
        <div className="py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">
              Capturas y adjuntos
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#7c3aed] hover:opacity-70 transition-opacity disabled:opacity-40 cursor-pointer">
              {uploading
                ? <><Loader2 size={11} className="animate-spin" /> Subiendo…</>
                : <><ImagePlus size={11} /> Adjuntar</>}
            </button>
          </div>

          {/* Zona drag & drop */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#e5e7eb] rounded-xl px-4 py-3 flex flex-col items-center gap-1 cursor-pointer hover:border-[#7c3aed] hover:bg-[#faf8ff] transition-all"
            style={{ display: adjuntos.length > 0 ? 'none' : 'flex' }}>
            <ImagePlus size={18} className="text-[#d1d5db]" />
            <span className="text-[11px] text-[#9ca3af]">Arrastra capturas aquí o haz clic</span>
            <span className="text-[10px] text-[#c8cdd6]">PNG, JPG, GIF, PDF…</span>
          </div>

          {/* Grid de adjuntos */}
          {adjuntos.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Imágenes en grid */}
              {adjuntos.filter(a => a.tipo === 'imagen').length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {adjuntos.filter(a => a.tipo === 'imagen').map((adj, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-[#e5e7eb]"
                      style={{ aspectRatio: '4/3' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={adj.url} alt={adj.nombre}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setLightbox(adj.url)} />
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveAdjunto(adj) }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  {/* Botón + más dentro del grid */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-xl border-2 border-dashed border-[#e5e7eb] flex items-center justify-center hover:border-[#7c3aed] hover:bg-[#faf8ff] transition-all cursor-pointer disabled:opacity-40"
                    style={{ aspectRatio: '4/3' }}>
                    <ImagePlus size={16} className="text-[#d1d5db]" />
                  </button>
                </div>
              )}
              {/* Archivos no-imagen */}
              {adjuntos.filter(a => a.tipo === 'archivo').map((adj, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] group">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase bg-[#e5e7eb] px-1.5 py-0.5 rounded">
                    {adj.nombre.split('.').pop()?.toUpperCase()}
                  </span>
                  <a href={adj.url} target="_blank" rel="noreferrer"
                    className="flex-1 text-[11px] text-[#374151] truncate hover:text-[#7c3aed] transition-colors">
                    {adj.nombre}
                  </a>
                  <button
                    onClick={() => handleRemoveAdjunto(adj)}
                    className="text-[#d1d5db] hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {/* Botón añadir más si hay imágenes */}
              {adjuntos.filter(a => a.tipo === 'imagen').length === 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-[11px] text-[#7c3aed] font-semibold hover:opacity-70 transition-opacity disabled:opacity-40 text-left cursor-pointer">
                  + Añadir más
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>

      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Vista completa"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#f3f4f6] flex items-center justify-end shrink-0">
        <button onClick={onClose}
          className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors cursor-pointer">
          Cerrar
        </button>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 w-[360px] shadow-2xl">
            <div className="text-[16px] font-bold text-[#111827] mb-1.5">¿Eliminar actividad?</div>
            <div className="text-[13px] text-[#9ca3af] mb-5">Esta acción no se puede deshacer.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-[#e5e7eb] text-[#6b7280] text-[13px] py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (mode === 'drawer') return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-end z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white h-full w-full max-w-[520px] flex flex-col overflow-hidden shadow-2xl rounded-l-2xl">
        {inner}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[92vh] flex flex-col overflow-hidden">
        {inner}
      </div>
    </div>
  )
}
