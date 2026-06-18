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
  IN_SHIFT: "Abierto",
  ON_BREAK: "En descanso",
  CLOSED: "Cerrado",
} as const;

const cardStyles = {
  OFF: "border-slate-200 bg-white",
  IN_SHIFT: "border-transparent bg-gradient-to-br from-[#4F56D3] to-[#3F46C6] text-white",
  ON_BREAK: "border-transparent bg-gradient-to-br from-amber-400/90 to-orange-400/90 text-white",
  CLOSED: "border-indigo-100 bg-indigo-50 text-slate-900",
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
  const headingText = isColored ? "text-white/90" : "text-slate-900";
  const mutedText = isColored ? "text-white/70" : "text-slate-400";
  const secondaryButton = isColored ? "bg-white/15 text-white hover:bg-white/20" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  const primaryButton = isColored ? "bg-white text-[#3F46C6]" : "bg-indigo-600 text-white hover:bg-indigo-700";

  return (
    <div className={`rounded-xl border p-5 ${cardStyles[status]}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingText}`}>Hoy</h2>
          <p className={`text-xs ${mutedText}`}>Gestiona tu jornada en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status]}`}>
            <span className={`${status === "IN_SHIFT" ? "relative flex" : ""}`}>
              {status === "IN_SHIFT" ? (
                <span className="absolute -left-1 top-1 h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
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
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-slate-900"}`}>
            {formatTime(record?.checkInAt ?? null)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Descanso acumulado</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-slate-900"}`}>
            {minutesToHHMM(breakMinutes)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Salida</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-slate-900"}`}>
            {formatTime(record?.checkOutAt ?? null)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${mutedText}`}>Total hoy</p>
          <p className={`text-sm font-semibold ${isColored ? "text-white" : "text-slate-900"}`}>
            {minutesToHHMM(totalMinutes)}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "OFF" ? primaryButton : secondaryButton
          }`}
          onClick={onCheckIn}
          type="button"
          disabled={status !== "OFF"}
        >
          <LogIn size={16} />
          Marcar entrada
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "IN_SHIFT" ? primaryButton : secondaryButton
          }`}
          onClick={onStartBreak}
          type="button"
          disabled={status !== "IN_SHIFT"}
        >
          <Coffee size={16} />
          Iniciar descanso
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "ON_BREAK" ? "bg-white text-[#9a3412]" : secondaryButton
          }`}
          onClick={onEndBreak}
          type="button"
          disabled={status !== "ON_BREAK"}
        >
          <Clock size={16} />
          Finalizar descanso
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "IN_SHIFT" ? primaryButton : secondaryButton
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
              isColored ? "border-white/30 bg-white/90 text-slate-800" : "border-slate-200 text-slate-900"
            }`}
            maxLength={120}
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
        <button
          className={`flex h-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            isColored ? "bg-white/90 text-slate-800" : "border border-slate-200 bg-white text-slate-700"
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
