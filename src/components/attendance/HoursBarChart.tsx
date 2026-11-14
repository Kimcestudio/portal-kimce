'use client'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

interface ChartRow {
  name: string
  expectedHours: number
  workedHours: number
  workedLabel: string
  expectedLabel: string
}

function HoursTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload: ChartRow }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{row.name}</p>
      <p className="text-white/70">Trabajadas: {row.workedLabel}</p>
      <p className="text-white/70">Objetivo: {row.expectedLabel}</p>
    </div>
  )
}

interface Props {
  data: ChartRow[]
  height: number
  bottomMargin: number
  gradientId: string
}

export default function HoursBarChart({ data, height, bottomMargin, gradientId }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        Sin datos suficientes esta semana.
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: bottomMargin }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.95} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={bottomMargin + 22}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<HoursTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
        <Bar dataKey="expectedHours" fill="#e0e7ff" radius={[6, 6, 0, 0]} />
        <Bar dataKey="workedHours" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
