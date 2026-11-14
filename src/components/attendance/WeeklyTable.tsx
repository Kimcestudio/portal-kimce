import type { AttendanceRecord } from "@/lib/storage/attendanceStorage";
import {
  buildWeeklyAttendanceRows,
  formatTime,
  minutesToHHMM,
  type AttendanceCreditDetail,
} from "@/lib/attendanceUtils";
import Badge from "@/components/ui/Badge";

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
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr] gap-2 border-b border-line bg-canvas px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>Día</span>
        <span>Registro</span>
        <span>Resumen</span>
        <span>Estado</span>
      </div>
      <div className="divide-y divide-line">
        {rows.map((row) => {
          const isSunday      = row.date.getDay() === 0;
          const primaryRecord = row.records[0] ?? null;
          const status = isSunday
            ? "No laborable"
            : primaryRecord?.status === "CLOSED" ? "Completado"
            : row.hasRecord   ? "En curso"
            : row.hasCredits  ? "Con ajuste"
            : "Sin registro";

          const badgeTone = isSunday || status === "Sin registro"
            ? "neutral"
            : status === "Completado" ? "success"
            : status === "En curso"   ? "info"
            : status === "Con ajuste" ? "info"
            : "warning";

          return (
            <div
              key={row.dateISO}
              className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr] gap-2 px-4 py-3 text-sm text-ink transition hover:bg-canvas"
            >
              <div>
                <div className="text-xs text-muted">{dayLabels[row.date.getDay()]}</div>
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
                      <div className="flex flex-wrap gap-1 text-[11px] text-muted">
                        {primaryRecord.breaks.map((breakItem, index) => (
                          <span
                            key={`${primaryRecord.id}-break-${index}`}
                            className="rounded-full bg-canvas px-2 py-0.5"
                          >
                            Descanso {index + 1}: {formatTime(breakItem.startAt)} -{" "}
                            {formatTime(breakItem.endAt ?? null)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">Sin descansos registrados</p>
                    )}
                  </>
                ) : row.hasCredits ? (
                  <p className="text-xs text-muted">Sin fichaje, con ajuste aprobado</p>
                ) : (
                  <p className="text-xs text-muted">Sin movimiento del día</p>
                )}
              </div>
              <div className="space-y-1 text-xs text-muted">
                <p>Horas {minutesToHHMM(row.totalWorkedMinutes)}</p>
                <p>Descanso {minutesToHHMM(row.totalBreakMinutes)}</p>
                {row.totalCreditMinutes > 0 ? (
                  <p className="font-semibold text-primary">
                    Ajustes {minutesToHHMM(row.totalCreditMinutes)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={badgeTone} label={status} />
                  {primaryRecord && !isSunday ? (
                    <button
                      className="rounded-full border border-line px-2 py-1 text-[11px] font-semibold text-muted hover:bg-canvas"
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
                        className="block rounded-lg bg-canvas px-3 py-2 text-xs text-primary"
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
