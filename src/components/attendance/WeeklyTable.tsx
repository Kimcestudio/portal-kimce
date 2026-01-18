import type { AttendanceRecord } from "@/lib/storage/attendanceStorage";
import { formatTime, minutesToHHMM } from "@/lib/attendanceUtils";

interface WeeklyTableProps {
  weekDates: Date[];
  records: AttendanceRecord[];
  onRequestCorrection: (dateISO: string, attendanceId: string) => void;
}

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function WeeklyTable({ weekDates, records, onRequestCorrection }: WeeklyTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="grid grid-cols-5 gap-2 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold text-muted">
        <span>Día</span>
        <span>Entrada</span>
        <span>Salida</span>
        <span>Horas</span>
        <span>Estado</span>
      </div>
      <div className="divide-y divide-line">
        {weekDates.map((date) => {
          const dateISO = date.toISOString().slice(0, 10);
          const record = records.find((item) => item.date === dateISO);
          const isSunday = date.getDay() === 0;
          const status = isSunday
            ? "No laborable"
            : record?.status === "CLOSED"
            ? "Completado"
            : record
            ? "En curso"
            : "Sin registro";
          const badgeClass = isSunday
            ? "bg-line text-muted"
            : status === "Completado"
            ? "bg-[#dcfce7] text-[#15803d]"
            : status === "En curso"
            ? "bg-[#eef0ff] text-primary"
            : "bg-[#fef3c7] text-[#b45309]";
          return (
            <div key={dateISO} className="grid grid-cols-5 gap-2 px-4 py-3 text-sm text-ink transition hover:bg-canvas/40">
              <div>
                <div className="text-xs text-muted">{dayLabels[date.getDay()]}</div>
                <div className="font-semibold">{date.getDate()}</div>
              </div>
              <div className="text-sm">{formatTime(record?.checkInAt ?? null)}</div>
              <div className="text-sm">{formatTime(record?.checkOutAt ?? null)}</div>
              <div className="text-sm">{minutesToHHMM(record?.totalMinutes ?? 0)}</div>
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                  {status}
                </span>
                {record && !isSunday ? (
                  <button
                    className="rounded-full border border-line px-2 py-1 text-[11px] font-semibold text-muted"
                    onClick={() => onRequestCorrection(dateISO, record.id)}
                    type="button"
                  >
                    Solicitar corrección
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
