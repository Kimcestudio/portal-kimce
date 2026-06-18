'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Settings } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubMeta } from '@/cmhub/theme'
import { useHubBase } from '@/cmhub/useHubBase'
import { NETWORK_META } from '@/cmhub/data'
import BrandModal from '@/components/cmhub/BrandModal'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Brand } from '@/cmhub/types'

export default function Clientes() {
  const { NETWORK_META } = useHubMeta()
  const { brands, contents } = useHub()
  const BASE = useHubBase()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Brand | undefined>()

  const filtered = brands.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    return true
  })

  function openEdit(b: Brand) { setEditing(b); setShowModal(true) }
  function openNew() { setEditing(undefined); setShowModal(true) }

  function getStats(brandId: string) {
    const bc = contents.filter(c => c.brandId === brandId)
    const published = bc.filter(c => c.status === 'publicado')
    const pending = bc.filter(c => ['revision'].includes(c.status))
    const rates = published.flatMap(c => c.metrics?.engagementRate ? [c.metrics.engagementRate] : [])
    const eng = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    const health = Math.min(100, Math.round(60 + eng * 5))
    return { total: bc.length, published: published.length, pending: pending.length, eng, health }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Clientes</span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl pl-8 pr-3 py-2 text-[12px] w-48 focus:outline-none focus:border-[#7c3aed]" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2 text-[12px] text-[#6b7280] focus:outline-none">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="paused">Pausados</option>
          <option value="closed">Cerrados</option>
        </select>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={14} /> Nueva marca
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="mb-5">
          <h1 className="text-[20px] font-bold text-[#111827]">Mis Clientes</h1>
          <p className="text-[13px] text-[#9ca3af] mt-0.5">{brands.filter(b => b.status === 'active').length} activos · {brands.length} en total</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filtered.map(b => {
            const stats = getStats(b.id)
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col gap-4 hover:shadow-sm hover:border-[#d1d5db] transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[14px] font-extrabold text-white shrink-0" style={{ background: b.color }}>{b.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] text-[#111827]">{b.name}</div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5">{b.industry} · {b.country}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    b.status === 'active'  ? 'bg-[#dcfce7] text-[#16a34a]' :
                    b.status === 'paused' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#f3f4f6] text-[#6b7280]'
                  }`}>
                    {b.status === 'active' ? 'Activo' : b.status === 'paused' ? 'Pausado' : 'Cerrado'}
                  </span>
                </div>

                {b.status === 'active' && (
                  <div>
                    <div className="flex justify-between text-[11px] text-[#9ca3af] mb-1.5">
                      <span>Rendimiento</span>
                      <span className="font-semibold text-[#111827]">{stats.health}%</span>
                    </div>
                    <div className="h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${stats.health}%`, background: b.color }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5 flex-wrap">
                  {b.channels.map(n => (
                    <div key={n} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: NETWORK_META[n]?.bg ?? '#f3f4f6', color: NETWORK_META[n]?.dot ?? '#9ca3af' }} title={NETWORK_META[n]?.label}>
                      <NetworkIcon network={n} size={14} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 border-t border-[#f3f4f6] pt-3 gap-2">
                  {[
                    { val: stats.total,    label: 'Contenidos' },
                    { val: stats.pending,  label: 'Pendientes' },
                    { val: stats.eng > 0 ? stats.eng.toFixed(1) + '%' : '—', label: 'Engage' },
                  ].map(({ val, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-[17px] font-bold text-[#111827]">{val}</div>
                      <div className="text-[10px] text-[#9ca3af] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-[#f3f4f6] pt-3">
                  <div className="text-[11px] text-[#9ca3af]">Resp.: <span className="text-[#4b5563] font-medium">{b.responsible}</span></div>
                  <div className="flex gap-2">
                    <Link href={`${BASE}/clientes/${b.id}`} className="bg-[#7c3aed] text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl hover:bg-[#6d28d9] transition-colors">Abrir</Link>
                    <button onClick={() => openEdit(b)} className="flex items-center gap-1 bg-[#f3f4f6] text-[#6b7280] text-[11px] px-2.5 py-1.5 rounded-xl hover:bg-[#e5e7eb] transition-colors">
                      <Settings size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          <div onClick={openNew} className="bg-white rounded-2xl border-2 border-dashed border-[#e5e7eb] p-5 flex flex-col items-center justify-center gap-3 min-h-[240px] cursor-pointer hover:border-[#7c3aed] hover:bg-[#f5f3ff] transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-[#f3f4f6] group-hover:bg-[#ede9fe] flex items-center justify-center transition-colors">
              <Plus size={18} className="text-[#9ca3af] group-hover:text-[#7c3aed] transition-colors" />
            </div>
            <span className="text-[13px] font-semibold text-[#9ca3af] group-hover:text-[#7c3aed] transition-colors">Agregar nueva marca</span>
          </div>
        </div>
      </div>

      {showModal && (
        <BrandModal initial={editing} onClose={() => { setShowModal(false); setEditing(undefined) }} />
      )}
    </div>
  )
}
