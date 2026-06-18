"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/finance/utils";

type FinancePieChartDatum = {
  name: string;
  value: number;
};

interface FinancePieChartProps {
  data: FinancePieChartDatum[];
  colors?: string[];
  emptyLabel?: string;
}

const DEFAULT_COLORS = ["#4f46e5", "#f97316", "#10b981", "#0ea5e9", "#f43f5e", "#a855f7", "#eab308"];

export default function FinancePieChart({ data, colors = DEFAULT_COLORS, emptyLabel }: FinancePieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
        {emptyLabel ?? "Sin datos para mostrar."}
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const percent = total > 0 ? (entry.value / total) * 100 : 0;
    return (
      <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
        <p className="text-xs font-semibold">{entry.name}</p>
        <p className="mt-1 text-[11px] text-white/80">
          {formatCurrency(entry.value)} · {percent.toFixed(1)}%
        </p>
      </div>
    );
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={48}
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value, entry: any) => {
              const percent = total > 0 ? (entry.payload.value / total) * 100 : 0;
              return `${value} (${percent.toFixed(0)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
