"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/finance/utils";

type FinanceComparisonDatum = {
  label: string;
  real: number;
  projected: number;
};

interface FinanceComparisonBarChartProps {
  data: FinanceComparisonDatum[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const real = payload.find((entry: any) => entry.dataKey === "real")?.value ?? 0;
  const projected = payload.find((entry: any) => entry.dataKey === "projected")?.value ?? 0;
  const percent = projected > 0 ? (real / projected) * 100 : 0;
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="text-xs font-semibold">{label}</p>
      <div className="mt-1 space-y-1 text-[11px]">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="text-white/70">{entry.name}</span>
            <span className="font-semibold">{formatCurrency(entry.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-1">
          <span className="text-white/70">Cumplimiento</span>
          <span className="font-semibold">{percent.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function FinanceComparisonBarChart({ data }: FinanceComparisonBarChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
          <Legend verticalAlign="top" height={24} />
          <Bar dataKey="real" name="Real" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          <Bar dataKey="projected" name="Proyectado" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
