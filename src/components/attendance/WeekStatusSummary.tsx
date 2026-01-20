import type { AttendanceRecord } from "@/lib/storage/attendanceStorage";

interface WeekStatusSummaryProps {
  weekDates: Date[];
  records: AttendanceRecord[];
}

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function WeekStatusSummary({ weekDates, records }: WeekStatusSummaryProps) {
  const days = weekDates.filter((date) => date.getDay() !== 0);

  return (
    <div className="flex flex-wrap gap-3">
      {days.map((date) => {
        const dateISO = date.toISOString().slice(0, 10);
        const record = records.find((item) => item.date === dateISO);
        const label = dayLabels[date.getDay()];
        const status = record?.status === "CLOSED" ? "Completo" : record ? "Incompleto" : "Sin registro";
        const dotClass = record?.status === "CLOSED" ? "bg-green-500" : record ? "bg-amber-400" : "bg-line";
        return (
          <div
            key={dateISO}
            className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted"
            title={`${label}: ${status}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            {label}
          </div>
        );
      })}
    </div>
  );
}
