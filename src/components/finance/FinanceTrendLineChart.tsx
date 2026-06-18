"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/finance/utils";

type FinanceTrendLineChartDatum = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

interface FinanceTrendLineChartProps {
  data: FinanceTrendLineChartDatum[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null;
  }

  const income = payload.find((entry: any) => entry.dataKey === "income")?.value ?? 0;
  const net = payload.find((entry: any) => entry.dataKey === "net")?.value ?? 0;
  const margin = income > 0 ? (net / income) * 100 : 0;

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
          <span className="text-white/70">Margen</span>
          <span className="font-semibold">{margin.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function FinanceTrendLineChart({ data }: FinanceTrendLineChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={24} />
          <Line
            type="monotone"
            dataKey="income"
            name="Ingresos"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name="Egresos"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Utilidad"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
