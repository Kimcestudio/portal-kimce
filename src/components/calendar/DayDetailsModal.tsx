import type { Absence, CalendarEvent, Holiday } from "@/data/calendar";

interface DayDetailsModalProps {
  open: boolean;
  dateLabel: string;
  holidays: Holiday[];
  events: CalendarEvent[];
  absences: Absence[];
  onClose: () => void;
}

function mapType(type: string) {
  switch (type) {
    case "VACATION":
      return "Vacaciones";
    case "PERMIT":
      return "Permiso";
    case "EVENT":
      return "Evento";
    default:
      return "Feriado";
  }
}

export default function DayDetailsModal({
  open,
  dateLabel,
  holidays,
  events,
  absences,
  onClose,
}: DayDetailsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Detalles del día</h3>
            <p className="text-sm text-muted">{dateLabel}</p>
          </div>
          <button
            className="rounded-full bg-line px-3 py-1 text-xs font-semibold text-muted"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </div>
        <div className="space-y-3">
          {holidays.map((holiday) => (
            <div key={holiday.name} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Feriado</p>
              <p className="text-xs text-muted">{holiday.name}</p>
            </div>
          ))}
          {events.map((event) => (
            <div key={event.title} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Evento interno</p>
              <p className="text-xs text-muted">{event.title}</p>
            </div>
          ))}
          {absences.map((absence) => (
            <div key={`${absence.personName}-${absence.dateStart}`} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">{mapType(absence.type)}</p>
              <p className="text-xs text-muted">Persona: {absence.personName}</p>
            </div>
          ))}
          {holidays.length + events.length + absences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No hay eventos para este día.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
