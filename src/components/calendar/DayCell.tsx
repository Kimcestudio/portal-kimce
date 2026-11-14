interface DayCellProps {
  isToday: boolean;
  isOutside: boolean;
  isHoliday: boolean;
  dayNumber: number;
  ariaLabel: string;
  overflowCount: number;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
}

export default function DayCell({
  isToday,
  isOutside,
  isHoliday,
  dayNumber,
  ariaLabel,
  overflowCount,
  onClick,
  children,
}: DayCellProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "flex min-h-14 w-full flex-col items-start gap-1 rounded-2xl border px-2 py-2 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1",
        isOutside
          ? "border-transparent bg-slate-50/30 text-muted"
          : "border-slate-100/80 bg-white/70 hover:bg-white/95 hover:border-slate-200/80",
        isHoliday && !isOutside ? "bg-violet-100/40 backdrop-blur-sm" : "",
        isToday ? "border-violet-400/60 bg-violet-50/70 backdrop-blur-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={`text-xs font-semibold ${isToday ? "text-violet-700" : "text-ink"}`}>
        {dayNumber}
      </span>
      <div className="flex w-full flex-col gap-0.5 overflow-visible">
        {children}
        {overflowCount > 0 && (
          <div className="px-1 text-[10px] font-medium text-slate-400">
            +{overflowCount} más
          </div>
        )}
      </div>
    </button>
  );
}
