import { ArrowUpRight } from "lucide-react";
import ProgressBar from "./ProgressBar";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  badge?: string;
  variant?: "primary" | "default";
}

export default function MetricCard({
  title,
  value,
  subtitle,
  progress,
  badge,
  variant = "default",
}: MetricCardProps) {
  const isPrimary = variant === "primary";

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 shadow-soft ${
        isPrimary
          ? "border-transparent bg-primary text-white"
          : "border-line bg-white"
      }`}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <span className={isPrimary ? "text-white/90" : "text-muted"}>
          {title}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            isPrimary ? "bg-white/20" : "bg-line"
          }`}
        >
          <ArrowUpRight size={14} className={isPrimary ? "text-white" : "text-muted"} />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-semibold">{value}</span>
        <span className={isPrimary ? "text-white/70" : "text-muted"}>
          {subtitle}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar
          value={progress}
          className={isPrimary ? "bg-white/20" : ""}
        />
        {badge ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              isPrimary
                ? "bg-white/20 text-white"
                : "bg-primary/10 text-primary"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}
