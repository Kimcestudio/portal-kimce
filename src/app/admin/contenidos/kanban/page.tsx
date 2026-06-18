'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import ContentViewSwitcher from '@/components/cmhub/ContentViewSwitcher'
import { useHub } from '@/cmhub/context'
import { useHubTheme, useHubMeta } from '@/cmhub/theme'
import { STATUS_META, PRIORITY_META, NETWORK_META } from '@/cmhub/data'
import ContentModal from '@/components/cmhub/ContentModal'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus } from '@/cmhub/types'

const COLUMNS_LIGHT: { key: ContentStatus; color: string; bg: string }[] = [
  { key: 'idea',       color: '#94a3b8', bg: '#f1f5f9' },
  { key: 'produccion', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'revision',   color: '#f59e0b', bg: '#fef3c7' },
  { key: 'aprobado',   color: '#10b981', bg: '#d1fae5' },
  { key: 'programado', color: '#16a34a', bg: '#f0fdf4' },
  { key: 'publicado',  color: '#8b5cf6', bg: '#ede9fe' },
]

const COLUMNS_DARK: { key: ContentStatus; color: string; bg: string }[] = [
  { key: 'idea',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { key: 'produccion', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  { key: 'revision',   color: '#fbbf24', bg: 'rgba(245,158,11,0.12)'  },
  { key: 'aprobado',   color: '#34d399', bg: 'rgba(16,185,129,0.12)'  },
  { key: 'programado', color: '#4ade80', bg: 'rgba(22,163,74,0.12)'   },
  { key: 'publicado',  color: '#a78bfa', bg: 'rgba(139,92,246,0.12)'  },
]

export default function Kanban() {
  const { isDark } = useHubTheme()
  const { STATUS_META, PRIORITY_META, NETWORK_META } = useHubMeta()
  const COLUMNS = isDark ? COLUMNS_DARK : COLUMNS_LIGHT
  const { contents, brands, updateContent } = useHub()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<ContentStatus | null>(null)
  const [filterBrand, setFilterBrand] = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Content | undefined>()

  const filtered = contents.filter(c => {
    if (filterBrand !== 'all' && c.brandId !== filterBrand) return false
    if (filterChannel !== 'all' && !(c.channels?.length ? c.channels : [c.channel]).includes(filterChannel as never)) return false
    return true
  })

  function onDrop(status: ContentStatus) {
    if (!dragging) return
    updateContent(dragging, { status })
    setDragging(null)
    setOver(null)
  }

  function openEdit(c: Content) {
    setEditing(c)
    setShowModal(true)
  }

  function openNew() {
    setEditing(undefined)
    setShowModal(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Kanban</span>
        </div>
        <ContentViewSwitcher />
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
          className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-1.5 text-[12px] text-[#6b7280] focus:outline-none focus:border-[#7c3aed]">
          <option value="all">Todos los clientes</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={14} /> Nueva
        </button>
      </div>

      <div className="px-6 pt-4 pb-2 shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold text-[#111827]">Board de Contenido</h1>
            <p className="text-[13px] text-[#9ca3af] mt-0.5">Arrastra las tarjetas para cambiar su estado · {filtered.length} contenidos</p>
          </div>
        </div>
        <div className="mt-3">
          <NetworkFilter
            contents={filterBrand === 'all' ? contents : contents.filter(c => c.brandId === filterBrand)}
            value={filterChannel}
            onChange={setFilterChannel}
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto px-6 pb-6 flex gap-3">
        {COLUMNS.map(({ key, color, bg }) => {
          const cards = filtered.filter(c => c.status === key)
          const meta = STATUS_META[key]
          const isOver = over === key
          return (
            <div key={key} className="w-[230px] shrink-0 flex flex-col"
              onDragOver={e => { e.preventDefault(); setOver(key) }}
              onDragLeave={() => setOver(null)}
              onDrop={() => onDrop(key)}
            >
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[12px] font-bold text-[#111827]">{meta.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: bg, color }}>{cards.length}</span>
              </div>

              <div className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-2xl p-2 transition-colors ${isOver ? 'bg-[#f5f3ff] ring-2 ring-[#7c3aed]/20' : 'bg-transparent'}`}>
                {cards.map(c => {
                  const net = NETWORK_META[c.channel]
                  const pr = PRIORITY_META[c.priority]
                  const brand = brands.find(b => b.id === c.brandId)
                  return (
                    <div key={c.id} draggable onDragStart={() => setDragging(c.id)}
                      onClick={() => openEdit(c)}
                      className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all active:scale-95 active:opacity-75"
                    >
                      <div className="h-[3px] w-full" style={{ background: net?.dot }} />
                      <div className="p-3">
                        <div className="flex items-start gap-1 mb-2">
                          <div className="w-4 h-4 rounded-md shrink-0 flex items-center justify-center text-[8px] font-extrabold text-white mt-0.5" style={{ background: brand?.color ?? '#94a3b8' }}>{brand?.initials}</div>
                          <p className="text-[12px] font-semibold text-[#111827] line-clamp-2 flex-1">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mb-1.5">
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: net?.bg, color: net?.text }}
                          >
                            <NetworkIcon network={c.channel} size={10} />
                            {net?.label}
                          </span>
                          <span className="text-[10px] font-semibold bg-[#f3f4f6] text-[#6b7280] px-1.5 py-0.5 rounded-full">{c.format}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                          <span className="text-[10px] font-mono text-[#9ca3af]">{c.date ? c.date.replace('2026-0', '').replace('2026-', '') : '—'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button onClick={openNew}
                  className="flex items-center justify-center gap-1 mt-1 py-2 text-[11px] text-[#9ca3af] hover:text-[#7c3aed] rounded-xl hover:bg-white transition-colors border border-dashed border-[#e5e7eb] hover:border-[#7c3aed]">
                  <Plus size={11} /> Añadir
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <ContentModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}
