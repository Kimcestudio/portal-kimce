"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/finance/utils";

type FinanceBreakdownDatum = {
  name: string;
  value: number;
};

interface FinanceBreakdownBarChartProps {
  data: FinanceBreakdownDatum[];
  color?: string;
  emptyLabel?: string;
}

export default function FinanceBreakdownBarChart({
  data,
  color = "#4f46e5",
  emptyLabel,
}: FinanceBreakdownBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
        {emptyLabel ?? "Sin datos para mostrar."}
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartHeight = Math.max(64 * 4, data.length * 40);
  const chartData = data.map((item) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    return { ...item, label: `${item.name} (${percent.toFixed(0)}%)` };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const value = payload[0].value;
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-1 text-[11px] text-white/80">
          {formatCurrency(value)} · {percent.toFixed(1)}%
        </p>
      </div>
    );
  };

  return (
    <div style={{ height: chartHeight }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={160}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
