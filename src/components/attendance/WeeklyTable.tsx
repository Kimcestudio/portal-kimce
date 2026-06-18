import type { AttendanceRecord } from "@/lib/storage/attendanceStorage";
import {
  buildWeeklyAttendanceRows,
  formatTime,
  minutesToHHMM,
  type AttendanceCreditDetail,
} from "@/lib/attendanceUtils";

interface WeeklyTableProps {
  weekDates: Date[];
  records: AttendanceRecord[];
  credits?: AttendanceCreditDetail[];
  onRequestCorrection: (dateISO: string, attendanceId: string) => void;
}

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function WeeklyTable({ weekDates, records, credits = [], onRequestCorrection }: WeeklyTableProps) {
  const rows = buildWeeklyAttendanceRows({ weekDates, records, credits });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <span>Día</span>
        <span>Registro</span>
        <span>Resumen</span>
        <span>Estado</span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const isSunday = row.date.getDay() === 0;
          const primaryRecord = row.records[0] ?? null;
          const status = isSunday
            ? "No laborable"
            : primaryRecord?.status === "CLOSED"
            ? "Completado"
            : row.hasRecord
            ? "En curso"
            : row.hasCredits
            ? "Con ajuste"
            : "Sin registro";
          const badgeClass = isSunday
            ? "bg-slate-100 text-slate-400"
            : status === "Completado"
            ? "bg-[#dcfce7] text-[#15803d]"
            : status === "En curso"
            ? "bg-[#eef0ff] text-primary"
            : status === "Con ajuste"
            ? "bg-cyan-100 text-cyan-700"
            : "bg-[#fef3c7] text-[#b45309]";
          return (
            <div
              key={row.dateISO}
              className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr] gap-2 px-4 py-3 text-sm text-slate-900 transition hover:bg-slate-50"
            >
              <div>
                <div className="text-xs text-slate-400">{dayLabels[row.date.getDay()]}</div>
                <div className="font-semibold">{row.date.getDate()}</div>
              </div>
              <div className="space-y-2">
                {primaryRecord ? (
                  <>
                    <p className="text-sm">
                      Entrada {formatTime(primaryRecord.checkInAt ?? null)} · Salida{" "}
                      {formatTime(primaryRecord.checkOutAt ?? null)}
                    </p>
                    {primaryRecord.breaks.length > 0 ? (
                      <div className="flex flex-wrap gap-1 text-[11px] text-slate-500">
                        {primaryRecord.breaks.map((breakItem, index) => (
                          <span
                            key={`${primaryRecord.id}-break-${index}`}
                            className="rounded-full bg-slate-100 px-2 py-0.5"
                          >
                            Descanso {index + 1}: {formatTime(breakItem.startAt)} -{" "}
                            {formatTime(breakItem.endAt ?? null)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Sin descansos registrados</p>
                    )}
                  </>
                ) : row.hasCredits ? (
                  <p className="text-xs text-slate-500">Sin fichaje, con ajuste aprobado</p>
                ) : (
                  <p className="text-xs text-slate-400">Sin movimiento del día</p>
                )}
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <p>Horas {minutesToHHMM(row.totalWorkedMinutes)}</p>
                <p>Descanso {minutesToHHMM(row.totalBreakMinutes)}</p>
                {row.totalCreditMinutes > 0 ? (
                  <p className="font-semibold text-cyan-700">
                    Ajustes {minutesToHHMM(row.totalCreditMinutes)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    {status}
                  </span>
                  {primaryRecord && !isSunday ? (
                    <button
                      className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                      onClick={() => onRequestCorrection(row.dateISO, primaryRecord.id)}
                      type="button"
                    >
                      Solicitar corrección
                    </button>
                  ) : null}
                </div>
                {row.credits.length > 0 ? (
                  <div className="space-y-1">
                    {row.credits.map((credit, index) => (
                      <span
                        key={`${row.dateISO}-${credit.source}-${credit.type}-${index}`}
                        className={`block rounded-lg px-3 py-2 text-xs ${
                          credit.source === "REQUEST"
                            ? "bg-cyan-50 text-cyan-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {credit.source === "REQUEST" ? "Solicitud" : "Actividad"}: {credit.type} ·{" "}
                        {minutesToHHMM(credit.minutes)}
                        {credit.note ? ` · ${credit.note}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
