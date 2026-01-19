import { ArrowUpRight } from "lucide-react";

interface PrimaryMetricCardProps {
  title: string;
  value: string;
  target: string;
  progress: number;
  pill: string;
}

export default function PrimaryMetricCard({
  title,
  value,
  target,
  progress,
  pill,
}: PrimaryMetricCardProps) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#4F56D3] to-[#3F46C6] p-5 text-white shadow-soft">
      <div className="flex items-center justify-between text-sm font-semibold text-white/80">
        <span>{title}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
          <ArrowUpRight size={14} />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-semibold">{value}</span>
        <span className="text-sm text-white/70">/ {target}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 w-full rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/60" style={{ width: `${progress}%` }} />
        </div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
          {pill}
        </span>
      </div>
    </div>
  );
}
