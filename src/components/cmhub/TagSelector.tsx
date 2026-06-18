'use client'
import { useState } from 'react'
import { X, Plus, Check } from 'lucide-react'
import { useHub } from '@/cmhub/context'

const TAG_PALETTE = [
  { color: '#7c3aed', bg: '#ede9fe' },
  { color: '#16a34a', bg: '#dcfce7' },
  { color: '#d97706', bg: '#fef3c7' },
  { color: '#dc2626', bg: '#fee2e2' },
  { color: '#0369a1', bg: '#e0f2fe' },
  { color: '#be185d', bg: '#fce7f3' },
  { color: '#0f766e', bg: '#ccfbf1' },
  { color: '#4338ca', bg: '#e0e7ff' },
]

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
}

export default function TagSelector({ selected, onChange }: Props) {
  const { tags, addTag } = useHub()
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPalette, setNewPalette] = useState(0)

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  function handleCreate() {
    if (!newLabel.trim()) return
    const pal = TAG_PALETTE[newPalette]
    const tag = addTag({ label: newLabel.trim(), color: pal.color, bg: pal.bg })
    onChange([...selected, tag.id])
    setNewLabel('')
    setCreating(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => {
          const on = selected.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all"
              style={{
                background: on ? tag.bg : '#f9fafb',
                color: on ? tag.color : '#6b7280',
                borderColor: on ? tag.color + '40' : '#e5e7eb',
              }}
            >
              {on && <Check size={10} />}
              {tag.label}
            </button>
          )
        })}

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-dashed border-[#d1d5db] text-[#9ca3af] hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors"
          >
            <Plus size={10} /> Nueva etiqueta
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-2.5">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Nombre de etiqueta..."
            className="flex-1 bg-transparent text-[12px] outline-none text-[#111827] placeholder-[#9ca3af]"
          />
          <div className="flex gap-1">
            {TAG_PALETTE.map((pal, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setNewPalette(i)}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{ background: pal.bg, borderColor: newPalette === i ? pal.color : 'transparent' }}
              />
            ))}
          </div>
          <button type="button" onClick={handleCreate} className="text-[11px] font-semibold text-[#7c3aed] hover:text-[#5b21b6]">Crear</button>
          <button type="button" onClick={() => setCreating(false)} className="text-[#9ca3af] hover:text-[#6b7280]"><X size={13} /></button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const tag = tags.find(t => t.id === id)
            if (!tag) return null
            return (
              <span key={id} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.color }}>
                {tag.label}
                <button type="button" onClick={() => toggle(id)} className="opacity-60 hover:opacity-100"><X size={9} /></button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
