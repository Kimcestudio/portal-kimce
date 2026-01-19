interface CalendarHeaderProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function CalendarHeader({ label, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Calendario</h1>
        <p className="text-sm text-muted">Feriados, eventos internos y ausencias aprobadas.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted"
          onClick={onPrev}
          type="button"
        >
          Mes anterior
        </button>
        <button
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted"
          onClick={onToday}
          type="button"
        >
          Hoy
        </button>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft">
          {label}
        </div>
        <button
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted"
          onClick={onNext}
          type="button"
        >
          Mes siguiente
        </button>
      </div>
    </div>
  );
}
