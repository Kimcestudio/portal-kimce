const baseItems = [
  { label: "Feriado", color: "bg-violet-400" },
  { label: "Día libre global", color: "bg-pink-400" },
  { label: "Evento interno", color: "bg-sky-400" },
  { label: "Google Calendar (KIMCE)", color: "bg-cyan-400" },
  { label: "Ausencia aprobada", color: "bg-amber-400" },
];

const personalItem = { label: "Mi calendario", color: "bg-indigo-400" };

interface CalendarLegendProps {
  showPersonal?: boolean;
}

export default function CalendarLegend({ showPersonal = false }: CalendarLegendProps) {
  const items = showPersonal ? [...baseItems, personalItem] : baseItems;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <h3 className="text-sm font-semibold text-ink">Leyenda</h3>
      <div className="mt-3 grid gap-2 text-sm text-muted">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} aria-hidden="true" />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
