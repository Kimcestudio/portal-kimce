'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, Check, ExternalLink, ChevronDown, Trash2, Calendar } from 'lucide-react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import type { HubActividad } from '@/cmhub/types'

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

const ACTIV_CATEGORIES = [
  'Reunión', 'Llamada', 'Entrega', 'Revisión', 'Diseño',
  'Edición', 'Estrategia', 'Investigación', 'Otro',
]

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
  const [assignee, setAssignee]     = useState(initial.assignee ?? '')
  const [category, setCategory]     = useState(initial.category ?? '')
  const [dueDate, setDueDate]       = useState(initial.dueDate ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [linkEntrega, setLinkEntrega] = useState(initial.linkEntrega ?? '')
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const statusDd   = useDropdown()
  const assigneeDd = useDropdown()
  const categoryDd = useDropdown()

  const sm = STATUS_META[status]
  const assigneeMember = activeTeam.find(m => m.name.trim().toLowerCase() === assignee.trim().toLowerCase())

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'hubActividades', initial.id), {
        title:       title.trim(),
        status,
        assignee:    assignee || null,
        category:    category || null,
        dueDate:     dueDate || null,
        description: description || null,
        linkEntrega: linkEntrega || null,
      })
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
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
                  <button key={s} onClick={() => { setStatus(s); statusDd.setOpen(false) }}
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
              onChange={e => setTitle(e.target.value)}
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

        {/* Responsable */}
        <div className="py-3 flex items-center gap-4">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest w-28 shrink-0">Responsable</span>
          <div ref={assigneeDd.ref} className="relative flex-1">
            <button onClick={() => assigneeDd.setOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] hover:border-[#7c3aed] transition-colors w-full cursor-pointer">
              {assigneeMember ? (
                <>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                    style={{ background: assigneeMember.color ?? '#6366f1' }}>
                    {assigneeMember.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left text-[12px] font-semibold text-[#111827] truncate">{assigneeMember.name}</span>
                </>
              ) : (
                <span className="flex-1 text-left text-[12px] text-[#9ca3af]">Sin asignar…</span>
              )}
              <ChevronDown size={13} className="text-[#9ca3af] shrink-0" />
            </button>
            {assigneeDd.open && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 py-1 min-w-full max-h-52 overflow-y-auto">
                <button onClick={() => { setAssignee(''); assigneeDd.setOpen(false) }}
                  className="w-full flex items-center px-3 py-2 hover:bg-[#f9fafb] text-[12px] text-[#9ca3af] cursor-pointer transition-colors">
                  Sin asignar
                </button>
                {activeTeam.map(m => (
                  <button key={m.id} onClick={() => { setAssignee(m.name); assigneeDd.setOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer transition-colors">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: m.color ?? '#6366f1' }}>
                      {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[12px] text-[#111827] truncate">{m.name}</span>
                    {m.name === assignee && <Check size={11} className="ml-auto text-[#7c3aed] shrink-0" />}
                  </button>
                ))}
              </div>
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
                <button onClick={() => { setCategory(''); categoryDd.setOpen(false) }}
                  className="w-full flex items-center px-3 py-2 hover:bg-[#f9fafb] text-[12px] text-[#9ca3af] cursor-pointer transition-colors">
                  Sin categoría
                </button>
                {ACTIV_CATEGORIES.map(c => (
                  <button key={c} onClick={() => { setCategory(c); categoryDd.setOpen(false) }}
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
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="flex-1 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 text-[12px] text-[#111827] focus:outline-none focus:border-[#7c3aed] cursor-pointer" />
          </div>
        </div>

        {/* Descripción */}
        <div className="py-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">Descripción</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            placeholder="Agrega una descripción…"
            className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 text-[13px] text-[#111827] placeholder-[#c8cdd6] resize-none focus:outline-none focus:border-[#7c3aed] transition-colors" />
        </div>

        {/* Link de entrega */}
        <div className="py-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-[#b0b7c3] uppercase tracking-widest">Link de entrega</span>
          <div className="relative">
            <input type="url" value={linkEntrega} onChange={e => setLinkEntrega(e.target.value)}
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

      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#f3f4f6] flex items-center justify-between shrink-0">
        <button onClick={onClose}
          className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors cursor-pointer">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7c3aed] text-white text-[13px] font-semibold disabled:opacity-40 cursor-pointer hover:bg-[#5b21b6] transition-colors">
          {saving ? 'Guardando…' : 'Guardar cambios'}
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
