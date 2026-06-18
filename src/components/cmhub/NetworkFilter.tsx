'use client'
import { useHubMeta } from '@/cmhub/theme'
import { NETWORK_META } from '@/cmhub/data'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Network } from '@/cmhub/types'

function getNetworks(c: { channel: string; channels?: string[] }): string[] {
  return c.channels?.length ? c.channels : [c.channel]
}

interface Props {
  contents: { channel: string; channels?: string[] }[]
  countContents?: { channel: string; channels?: string[] }[]  // para conteo por mes
  value: string
  onChange: (v: string) => void
  className?: string
}

export default function NetworkFilter({ contents, countContents, value, onChange, className = '' }: Props) {
  const { NETWORK_META } = useHubMeta()
  const usedNetworks = Array.from(new Set(contents.flatMap(getNetworks))) as Network[]

  if (usedNetworks.length === 0) return null

  const countData = countContents ?? contents
  const totalCount = countData.length

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {/* Todos — siempre muestra texto */}
      <button
        onClick={() => onChange('all')}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold transition-all duration-200 ${
          value === 'all'
            ? 'bg-[#111827] text-white shadow-sm'
            : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
        }`}
      >
        Todos
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          value === 'all' ? 'bg-white/20' : 'bg-white text-[#6b7280]'
        }`}>{totalCount}</span>
      </button>

      {/* Redes: colapsado (solo icono) → expandido al hover o cuando está activo */}
      {usedNetworks.map(net => {
        const meta = NETWORK_META[net]
        if (!meta) return null
        const count = countData.filter(c => getNetworks(c).includes(net)).length
        const active = value === net

        return (
          <button
            key={net}
            onClick={() => onChange(active ? 'all' : net)}
            title={meta.label}
            className={`group flex items-center h-7 rounded-full overflow-hidden transition-all duration-200 ${
              active
                ? 'px-2.5 gap-1.5 shadow-sm'
                : 'px-1.5 gap-0 hover:px-2.5 hover:gap-1.5'
            }`}
            style={active
              ? { background: meta.dot, color: '#fff' }
              : { background: meta.bg, color: meta.text }
            }
          >
            <span className="shrink-0 flex items-center justify-center">
              <NetworkIcon network={net} size={12} />
            </span>
            {/* Label: oculto por defecto, visible en hover y cuando activo */}
            <span className={`text-[11px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${
              active
                ? 'max-w-[80px] opacity-100'
                : 'max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100'
            }`}>
              {meta.label}
            </span>
            <span className={`text-[10px] font-bold shrink-0 transition-all duration-200 ${
              active ? 'ml-0' : 'ml-0 group-hover:ml-0'
            }`}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
