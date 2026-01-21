import type { ReactNode } from "react";

interface DayCellProps {
  isToday: boolean;
  isOutside: boolean;
  isHoliday: boolean;
  dayNumber: number;
  onClick: () => void;
  children?: ReactNode;
}

export default function DayCell({
  isToday,
  isOutside,
  isHoliday,
  dayNumber,
  onClick,
  children,
}: DayCellProps) {
  return (
    <button
      className={`flex h-24 flex-col items-start gap-2 rounded-2xl border px-3 py-2 text-left transition hover:border-primary/40 ${
        isOutside ? "border-transparent bg-canvas/40 text-muted" : "border-line bg-white"
      } ${isHoliday ? "bg-[#f4f2ff]" : ""} ${isToday ? "border-primary/60" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="text-xs font-semibold text-ink">{dayNumber}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </button>
  );
}
