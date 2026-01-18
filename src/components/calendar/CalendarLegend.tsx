const legendItems = [
  { label: "Feriado", color: "bg-[#6c63ff]" },
  { label: "Vacaciones aprobadas", color: "bg-[#22c55e]" },
  { label: "Permiso aprobado", color: "bg-[#f59e0b]" },
  { label: "Evento interno", color: "bg-[#3b82f6]" },
];

export default function CalendarLegend() {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <h3 className="text-sm font-semibold text-ink">Leyenda</h3>
      <div className="mt-3 grid gap-2 text-sm text-muted">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
