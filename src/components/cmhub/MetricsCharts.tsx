'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { NETWORK_META } from '@/cmhub/data'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function BarTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold text-[#111827]">{label}</p>
      <p className="text-[#7c3aed]">{fmt(payload[0].value)}</p>
    </div>
  )
}

interface ByNetwork { network: string; reach: number; label: string }
interface ByBrand   { brandId: string; reach: number; label: string; color: string }

interface Props {
  byNetwork:  ByNetwork[]
  byBrand:    ByBrand[]
  tickColor:  string
  labelColor: string
}

export default function MetricsCharts({ byNetwork, byBrand, tickColor, labelColor }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {byNetwork.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
          <p className="text-[13px] font-bold text-[#111827] mb-4">Alcance por red social</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byNetwork} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} tickFormatter={v => fmt(v as number)} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: labelColor }} width={80} />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="reach" radius={[0, 6, 6, 0]}>
                {byNetwork.map(e => <Cell key={e.network} fill={NETWORK_META[e.network as keyof typeof NETWORK_META]?.dot ?? '#7c3aed'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {byBrand.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
          <p className="text-[13px] font-bold text-[#111827] mb-4">Alcance por cliente</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byBrand} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} tickFormatter={v => fmt(v as number)} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: labelColor }} width={80} />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="reach" radius={[0, 6, 6, 0]}>
                {byBrand.map(e => <Cell key={e.brandId} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
