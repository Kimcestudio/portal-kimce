import { Clock, Coffee, LogIn, LogOut, Save } from "lucide-react";
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

const statusLabels = {
  OFF: "Sin registro",
  IN_SHIFT: "En turno",
  ON_BREAK: "En descanso",
  CLOSED: "Cerrado",
} as const;

const statusStyles = {
  OFF: "bg-teal-100 text-teal-700",
  IN_SHIFT: "bg-teal-100 text-teal-700",
  ON_BREAK: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
} as const;

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
    <div className="rounded-2xl border border-transparent bg-gradient-to-br from-[#eef0ff] via-[#f7f7ff] to-white p-6 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Hoy</h2>
          <p className="text-xs text-muted">Gestiona tu jornada en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
            {statusLabels[status]}
          </span>
          {message ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {message}
            </span>
          ) : null}
        </div>
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
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onCheckIn}
          type="button"
          disabled={status !== "OFF"}
        >
          <LogIn size={16} />
          Marcar entrada
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onStartBreak}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          <Coffee size={16} />
          Iniciar descanso
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onEndBreak}
          type="button"
          disabled={status !== "ON_BREAK"}
        >
          <Clock size={16} />
          Finalizar descanso
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          onClick={onCheckOut}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          <LogOut size={16} />
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
          className="flex h-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:shadow-card"
          onClick={onSaveNote}
          type="button"
        >
          <Save size={16} />
          Guardar nota
        </button>
      </div>
    </div>
  );
}
