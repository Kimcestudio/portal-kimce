import type { AttendanceRecord } from "@/lib/storage/attendanceStorage";
import { formatTime, minutesToHHMM } from "@/lib/attendanceUtils";

interface TodayAttendanceCardProps {
  status: "OFF" | "IN_SHIFT" | "ON_BREAK" | "CLOSED";
  record: AttendanceRecord | null;
  breakMinutes: number;
  totalMinutes: number;
  note: string;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
  onCheckIn: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onCheckOut: () => void;
  message: string | null;
}

export default function TodayAttendanceCard({
  status,
  record,
  breakMinutes,
  totalMinutes,
  note,
  onNoteChange,
  onSaveNote,
  onCheckIn,
  onStartBreak,
  onEndBreak,
  onCheckOut,
  message,
}: TodayAttendanceCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Hoy</h2>
          <p className="text-xs text-muted">Estado actual: {status}</p>
        </div>
        {message ? (
          <span className="rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#b45309]">
            {message}
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted">Entrada</p>
          <p className="text-sm font-semibold text-ink">{formatTime(record?.checkInAt ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Descanso acumulado</p>
          <p className="text-sm font-semibold text-ink">{minutesToHHMM(breakMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Salida</p>
          <p className="text-sm font-semibold text-ink">{formatTime(record?.checkOutAt ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Total hoy</p>
          <p className="text-sm font-semibold text-ink">{minutesToHHMM(totalMinutes)}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onCheckIn}
          type="button"
          disabled={status !== "OFF"}
        >
          Marcar entrada
        </button>
        <button
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onStartBreak}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          Iniciar descanso
        </button>
        <button
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onEndBreak}
          type="button"
          disabled={status !== "ON_BREAK"}
        >
          Finalizar descanso
        </button>
        <button
          className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onCheckOut}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          Marcar salida
        </button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className="text-xs font-semibold text-muted">Nota del día</label>
          <textarea
            className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
            maxLength={120}
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
        <button
          className="h-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft"
          onClick={onSaveNote}
          type="button"
        >
          Guardar nota
        </button>
      </div>
    </div>
  );
}
