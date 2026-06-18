type CalendarModalHoliday = {
  id?: string;
  date: string;
  name: string;
  kind?: "HOLIDAY" | "DAY_OFF";
};

type CalendarModalEvent = {
  id?: string;
  date: string;
  title: string;
  description?: string;
};

type CalendarModalAbsence = {
  id?: string;
  personName: string;
  dateStart: string;
  dateEnd: string;
  type: "VACATION" | "PERMIT";
  status: "APPROVED" | "PENDING";
  reason?: string;
};

interface DayDetailsModalProps {
  open: boolean;
  dateLabel: string;
  holidays: CalendarModalHoliday[];
  events: CalendarModalEvent[];
  absences: CalendarModalAbsence[];
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

function mapHolidayKind(kind?: "HOLIDAY" | "DAY_OFF") {
  return kind === "DAY_OFF" ? "Día libre global" : "Feriado";
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
            <div key={holiday.id ?? `${holiday.date}-${holiday.name}`} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">{mapHolidayKind(holiday.kind)}</p>
              <p className="text-xs text-muted">{holiday.name}</p>
            </div>
          ))}
          {events.map((event) => (
            <div key={event.id ?? `${event.date}-${event.title}`} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Evento interno</p>
              <p className="text-xs text-muted">{event.title}</p>
              {event.description ? <p className="mt-2 text-xs text-slate-500">{event.description}</p> : null}
            </div>
          ))}
          {absences.map((absence) => (
            <div key={absence.id ?? `${absence.personName}-${absence.dateStart}`} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">{mapType(absence.type)}</p>
              <p className="text-xs text-muted">Persona: {absence.personName}</p>
              <p className="text-xs text-slate-500">
                {absence.dateStart === absence.dateEnd
                  ? `Fecha: ${absence.dateStart}`
                  : `Rango: ${absence.dateStart} al ${absence.dateEnd}`}
              </p>
              {absence.reason ? <p className="mt-2 text-xs text-slate-500">{absence.reason}</p> : null}
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
