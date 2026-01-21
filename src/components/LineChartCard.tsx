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

interface LineChartCardProps {
  data: { day: string; value: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl bg-[#10163d] px-3 py-2 text-xs text-white shadow-soft">
      <div className="font-semibold">{payload[0].value} visits</div>
      <div className="text-white/70">{label}</div>
    </div>
  );
};

export default function LineChartCard({ data }: LineChartCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Average daily number of visit in last 30 days
          </h3>
          <p className="text-xs text-muted">Grand total: 496 visits</p>
        </div>
        <div className="text-xl font-semibold text-primary">~19</div>
      </div>
      <div className="mt-6 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
            <XAxis dataKey="day" tick={false} axisLine={false} />
            <YAxis tick={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d9dcf5" }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#5a60e2"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6, fill: "#5a60e2", stroke: "#ffffff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
