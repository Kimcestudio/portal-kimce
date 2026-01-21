import DateChips from "./DateChips";
import TimeSlots from "./TimeSlots";
import AppointmentCard from "./AppointmentCard";

interface SchedulePanelProps {
  dates: { day: number; label: string; active?: boolean }[];
  slots: string[];
  appointments: { id: number; name: string; time: string; selected?: boolean }[];
}

export default function SchedulePanel({
  dates,
  slots,
  appointments,
}: SchedulePanelProps) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Upcoming Visits</h2>
          <p className="text-xs text-muted">9 appointments left today</p>
        </div>
        <button className="text-xs font-semibold text-primary">+ Create Visit</button>
      </div>
      <DateChips dates={dates} />
      <div className="flex gap-4">
        <TimeSlots slots={slots} />
        <div className="flex flex-1 flex-col gap-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              name={appointment.name}
              time={appointment.time}
              selected={appointment.selected}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
