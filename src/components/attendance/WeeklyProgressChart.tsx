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
    <div className="rounded-xl bg-[#10163d] px-3 py-2 text-xs text-white shadow-soft">
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

  return (
    <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-[#eef0ff] via-[#f7f7ff] to-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Progreso semanal</h2>
          <p className="text-xs text-muted">Horas registradas vs objetivo (44h).</p>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-soft">
          Objetivo 44h
        </span>
        <div className="flex flex-col gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm text-ink shadow-soft">
          <div className="text-xs text-muted">Total semana</div>
          <div className="font-semibold">
            {minutesToHHMM(totalMinutes)} / {minutesToHHMM(expectedMinutes)}
          </div>
          <div className="text-xs text-muted">
            {diffLabel} {diffValue} · Días completados {completedDays}/6
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
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-line bg-white text-sm text-muted">
            Aún no registras horas esta semana.
          </div>
        )}
      </div>
    </div>
  );
}
