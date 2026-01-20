interface DateChip {
  day: number;
  label: string;
  active?: boolean;
}

interface DateChipsProps {
  dates: DateChip[];
}

export default function DateChips({ dates }: DateChipsProps) {
  return (
    <div className="flex gap-2">
      {dates.map((date) => (
        <button
          key={`${date.day}-${date.label}`}
          className={`flex flex-col items-center rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
            date.active
              ? "border-primary bg-primary text-white"
              : "border-line bg-white text-ink"
          }`}
        >
          <span className="text-sm font-semibold">{date.day}</span>
          <span className={date.active ? "text-white/80" : "text-muted"}>
            {date.label}
          </span>
        </button>
      ))}
    </div>
  );
}
