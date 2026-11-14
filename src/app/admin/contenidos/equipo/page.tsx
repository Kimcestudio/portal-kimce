'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import EquipoCategoryPage from './_EquipoCategoryPage'
import type { TeamCategory } from '@/cmhub/types'

const TABS: { key: string; label: string; category: TeamCategory; color: string }[] = [
  { key: 'diseno',      label: 'Diseño',      category: 'Diseño',      color: '#ec4899' },
  { key: 'audiovisual', label: 'Audiovisual',  category: 'Audiovisual', color: '#f97316' },
  { key: 'estrategia',  label: 'Estrategia',  category: 'Estrategia',  color: '#6366f1' },
  { key: 'cm',          label: 'CM',           category: 'CM',          color: '#10b981' },
  { key: 'agencia',     label: 'Agencia',      category: 'Agencia',     color: '#0844ef' },
]

function EquipoInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabKey = searchParams.get('tab') ?? 'diseno'
  const active = TABS.find(t => t.key === tabKey) ?? TABS[0]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white border-b border-[#e5e7eb] px-5 h-12 flex items-center gap-1 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => router.replace(`?tab=${tab.key}`)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={tabKey === tab.key
              ? { background: tab.color + '18', color: tab.color }
              : { color: '#6b7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <EquipoCategoryPage category={active.category} />
      </div>
    </div>
  )
}

export default function EquipoPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#f8fafc]" />}>
      <EquipoInner />
    </Suspense>
  )
}
