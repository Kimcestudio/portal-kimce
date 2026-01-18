import {
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  PlayCircle,
  Save,
} from "lucide-react";
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
  IN_SHIFT: "bg-indigo-100 text-indigo-700",
  ON_BREAK: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
} as const;

const cardStyles = {
  OFF: "bg-white",
  IN_SHIFT: "bg-gradient-to-br from-[#4F56D3] to-[#3F46C6] text-white",
  ON_BREAK: "bg-gradient-to-br from-amber-400/90 to-orange-400/90 text-white",
  CLOSED: "bg-[#eef0ff] text-ink",
} as const;

const badgeStyles = {
  OFF: "bg-teal-100 text-teal-700",
  IN_SHIFT: "bg-white/15 text-white",
  ON_BREAK: "bg-white/20 text-white",
  CLOSED: "bg-green-100 text-green-700",
} as const;

const statusIcons = {
  OFF: PlayCircle,
  IN_SHIFT: PlayCircle,
  ON_BREAK: Clock,
  CLOSED: CheckCircle2,
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
  const StatusIcon = statusIcons[status];

  const isColored = status === "IN_SHIFT" || status === "ON_BREAK";
  const headingText = isColored ? "text-white/90" : "text-ink";
  const mutedText = isColored ? "text-white/70" : "text-muted";

  return (
    <div className={`rounded-2xl border border-transparent p-6 shadow-soft ${cardStyles[status]}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingText}`}>Hoy</h2>
          <p className={`text-xs ${mutedText}`}>Gestiona tu jornada en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status]}`}>
            <span className={`${status === "IN_SHIFT" ? "relative flex" : ""}`}>
              {status === "IN_SHIFT" ? (
                <span className="absolute -left-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              ) : null}
              <StatusIcon size={14} />
            </span>
            {statusLabels[status]}
          </span>
          {message ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isColored ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
              {message}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <p className={`text-xs ${mutedText}`}>Entrada</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-ink"}`}>
            {formatTime(record?.checkInAt ?? null)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Descanso acumulado</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-ink"}`}>
            {minutesToHHMM(breakMinutes)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Salida</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-ink"}`}>
            {formatTime(record?.checkOutAt ?? null)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Total hoy</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-ink"}`}>
            {minutesToHHMM(totalMinutes)}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${
            status === "OFF" ? "bg-primary text-white" : "bg-white/70 text-ink"
          }`}
          onClick={onCheckIn}
          type="button"
          disabled={status !== "OFF"}
        >
          <LogIn size={16} />
          Marcar entrada
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${
            status === "IN_SHIFT" ? "bg-primary text-white" : "bg-white/70 text-ink"
          }`}
          onClick={onStartBreak}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          <Coffee size={16} />
          Iniciar descanso
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${
            status === "ON_BREAK" ? "bg-amber-500 text-white" : "bg-white/70 text-ink"
          }`}
          onClick={onEndBreak}
          type="button"
          disabled={status !== "ON_BREAK"}
        >
          <Clock size={16} />
          Finalizar descanso
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${
            status === "IN_SHIFT" ? "bg-ink text-white" : "bg-white/70 text-ink"
          }`}
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
          <label className={`text-xs font-semibold ${mutedText}`}>Nota del día</label>
          <textarea
            className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${
              isColored ? "border-white/30 bg-white/90 text-ink" : "border-line text-ink"
            }`}
            maxLength={120}
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
        <button
          className={`flex h-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-card ${
            isColored ? "bg-white/90 text-ink" : "bg-white text-ink"
          }`}
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
