import { useEffect, useState } from "react";
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
  isLoading?: boolean;
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
  OFF:      "Sin registro",
  IN_SHIFT: "Abierto",
  ON_BREAK: "En descanso",
  CLOSED:   "Cerrado",
} as const;

const cardStyles = {
  OFF:      "border-line bg-white",
  IN_SHIFT: "border-transparent bg-gradient-to-br from-[#4F56D3] to-[#3F46C6] text-white",
  ON_BREAK: "border-transparent bg-gradient-to-br from-amber-400/90 to-orange-400/90 text-white",
  CLOSED:   "border-line bg-canvas text-ink",
} as const;

const badgeStyles = {
  OFF:      "bg-canvas text-muted",
  IN_SHIFT: "bg-white/15 text-white",
  ON_BREAK: "bg-white/20 text-white",
  CLOSED:   "bg-green-100 text-green-700",
} as const;

const statusIcons = {
  OFF:      PlayCircle,
  IN_SHIFT: PlayCircle,
  ON_BREAK: Clock,
  CLOSED:   CheckCircle2,
} as const;

export default function TodayAttendanceCard({
  status,
  isLoading = false,
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

  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "IN_SHIFT") return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [status]);

  const elapsedMinutes = record?.checkInAt
    ? (Date.now() - new Date(record.checkInAt).getTime()) / 60000
    : 0;
  const shouldWarnBreak = status === "IN_SHIFT" && elapsedMinutes >= 240 && breakMinutes < 30;

  const isColored = status === "IN_SHIFT" || status === "ON_BREAK";
  const headingText  = isColored ? "text-white/90"  : "text-ink";
  const mutedText    = isColored ? "text-white/70"  : "text-muted";
  const valueText    = isColored ? "text-white"     : "text-ink";
  const secondaryBtn = isColored
    ? "bg-white/15 text-white hover:bg-white/20"
    : "border border-line bg-white text-muted hover:bg-canvas";
  const primaryBtn   = isColored
    ? "bg-white text-primaryDark"
    : "bg-primary text-white hover:bg-primaryDark";

  return (
    <div className={`rounded-2xl border p-5 ${cardStyles[status]}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingText}`}>Hoy</h2>
          <p className={`text-xs ${mutedText}`}>Gestiona tu jornada en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status]}`}>
            <span className={status === "IN_SHIFT" ? "relative flex" : ""}>
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
        {[
          { label: "Entrada",             value: formatTime(record?.checkInAt ?? null)  },
          { label: "Descanso acumulado",  value: minutesToHHMM(breakMinutes)            },
          { label: "Salida",              value: formatTime(record?.checkOutAt ?? null) },
          { label: "Total hoy",           value: minutesToHHMM(totalMinutes)            },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className={`text-xs ${mutedText}`}>{label}</p>
            <p className={`text-sm font-semibold ${valueText}`}>{value}</p>
          </div>
        ))}
      </div>

      {shouldWarnBreak && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-400/20 px-4 py-3 text-sm font-semibold text-white">
          <Coffee size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>Llevas más de 4h sin registrar almuerzo.</p>
            <p className="mt-0.5 text-xs font-normal opacity-80">
              Si cierras el turno sin registrarlo, se asignarán automáticamente 1:15 h de descanso.
            </p>
          </div>
          <button
            className="ml-auto shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30"
            onClick={onStartBreak}
            type="button"
          >
            Registrar ahora
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "OFF" && !isLoading ? primaryBtn : secondaryBtn
          }`}
          onClick={onCheckIn}
          type="button"
          disabled={isLoading || status !== "OFF"}
        >
          <LogIn size={16} />
          {isLoading ? "Cargando…" : "Marcar entrada"}
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            status === "IN_SHIFT" ? primaryBtn : secondaryBtn
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
            status === "ON_BREAK" ? "bg-white text-orange-700" : secondaryBtn
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
            status === "IN_SHIFT" || status === "ON_BREAK" ? primaryBtn : secondaryBtn
          }`}
          onClick={onCheckOut}
          type="button"
          disabled={status !== "IN_SHIFT" && status !== "ON_BREAK"}
        >
          <LogOut size={16} />
          Marcar salida
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className={`text-xs font-semibold ${mutedText}`}>Nota del día</label>
          <textarea
            className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
              isColored ? "border-white/30 bg-white/90 text-ink" : "border-line text-ink"
            }`}
            maxLength={120}
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
        <button
          className={`flex h-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isColored ? "bg-white/90 text-ink" : "border border-line bg-white text-muted hover:bg-canvas"
          }`}
          onClick={onSaveNote}
          type="button"
          disabled={!record}
        >
          <Save size={16} />
          Guardar nota
        </button>
      </div>
    </div>
  );
}
