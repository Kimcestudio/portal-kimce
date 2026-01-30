"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/finance/utils";

type FinanceMonthlyChartDatum = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

interface FinanceMonthlyChartProps {
  data: FinanceMonthlyChartDatum[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null;
  }

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
      </div>
    </div>
  );
};

export default function FinanceMonthlyChart({ data }: FinanceMonthlyChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
          <Legend verticalAlign="top" height={24} />
          <Bar dataKey="income" name="Ingresos" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name="Egresos" fill="#f97316" radius={[6, 6, 0, 0]} />
          <Bar dataKey="net" name="Utilidad" fill="#10b981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
