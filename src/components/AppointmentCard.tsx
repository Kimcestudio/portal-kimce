import { Play } from "lucide-react";

interface AppointmentCardProps {
  name: string;
  time: string;
  selected?: boolean;
}

export default function AppointmentCard({
  name,
  time,
  selected,
}: AppointmentCardProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-soft transition ${
        selected
          ? "border-primary bg-[#f2f3ff] text-primary"
          : "border-line bg-white text-ink"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            selected ? "bg-primary text-white" : "bg-line text-muted"
          }`}
        >
          <Play size={12} />
        </span>
        <span className="font-medium">{name}</span>
      </div>
      <span className="text-xs text-muted">{time}</span>
    </div>
  );
}
