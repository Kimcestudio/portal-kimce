interface TimeSlotsProps {
  slots: string[];
}

export default function TimeSlots({ slots }: TimeSlotsProps) {
  return (
    <div className="flex flex-col gap-8 text-xs font-semibold text-muted">
      {slots.map((slot) => (
        <span key={slot}>{slot}</span>
      ))}
    </div>
  );
}
