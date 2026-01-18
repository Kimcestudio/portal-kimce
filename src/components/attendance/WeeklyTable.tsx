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
          const status = record?.status === "CLOSED" ? "Completado" : record ? "En curso" : "Sin registro";
          return (
            <div key={dateISO} className="grid grid-cols-5 gap-2 px-4 py-3 text-sm text-ink">
              <div>
                <div className="text-xs text-muted">{dayLabels[date.getDay()]}</div>
                <div className="font-semibold">{date.getDate()}</div>
              </div>
              <div className="text-sm">{formatTime(record?.checkInAt ?? null)}</div>
              <div className="text-sm">{formatTime(record?.checkOutAt ?? null)}</div>
              <div className="text-sm">{minutesToHHMM(record?.totalMinutes ?? 0)}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{status}</span>
                {record ? (
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
