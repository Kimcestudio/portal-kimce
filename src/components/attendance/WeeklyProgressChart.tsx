"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { minutesToHHMM } from "@/lib/attendanceUtils";

interface WeeklyProgressChartProps {
  data: { label: string; hours: number; target: number }[];
  totalMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  completedDays: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white">
      <div className="font-semibold">{payload[0].payload.label}</div>
      <div className="text-white/70">{payload[0].value}h</div>
    </div>
  );
};

export default function WeeklyProgressChart({
  data,
  totalMinutes,
  expectedMinutes,
  diffMinutes,
  completedDays,
}: WeeklyProgressChartProps) {
  const hasData = data.some((item) => item.hours > 0);
  const diffLabel = diffMinutes < 0 ? "Debes" : "A favor";
  const diffValue = minutesToHHMM(Math.abs(diffMinutes));
  const targetLabel = minutesToHHMM(expectedMinutes);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Progreso semanal</h2>
          <p className="text-xs text-slate-400">Horas registradas vs objetivo ({targetLabel}).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-600">
            Objetivo {targetLabel}
          </span>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-slate-900">
              {minutesToHHMM(totalMinutes)} / {minutesToHHMM(expectedMinutes)}
            </span>
            <span className="text-xs text-slate-400">
              {diffLabel} {diffValue} · {completedDays}/6 días
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 h-56">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8f5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#c7caf2" }} />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#a5abf5"
                strokeDasharray="6 6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#4f56d3"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                activeDot={{ r: 6, fill: "#4f56d3", stroke: "#ffffff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            Aún no registras horas esta semana.
          </div>
        )}
      </div>
    </div>
  );
}
