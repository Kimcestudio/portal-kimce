"use client";

type FilterOption = {
  id: string;
  label: string;
  activeClass: string;
  inactiveClass: string;
};

const BASE_FILTERS: FilterOption[] = [
  {
    id: "holiday",
    label: "Feriados",
    activeClass: "bg-violet-100 text-violet-700 border-violet-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-violet-50 hover:border-violet-200",
  },
  {
    id: "dayoff",
    label: "Días libres",
    activeClass: "bg-pink-100 text-pink-700 border-pink-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-pink-50 hover:border-pink-200",
  },
  {
    id: "event",
    label: "Eventos",
    activeClass: "bg-sky-100 text-sky-700 border-sky-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-sky-50 hover:border-sky-200",
  },
  {
    id: "gcal",
    label: "Google Cal",
    activeClass: "bg-cyan-100 text-cyan-700 border-cyan-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-cyan-50 hover:border-cyan-200",
  },
  {
    id: "absence",
    label: "Ausencias",
    activeClass: "bg-amber-100 text-amber-700 border-amber-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-amber-50 hover:border-amber-200",
  },
  {
    id: "meeting",
    label: "Grabaciones",
    activeClass: "bg-purple-100 text-purple-700 border-purple-300",
    inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-purple-50 hover:border-purple-200",
  },
];

const PERSONAL_FILTER: FilterOption = {
  id: "personal",
  label: "Mi calendario",
  activeClass: "bg-indigo-100 text-indigo-700 border-indigo-300",
  inactiveClass: "bg-white text-slate-500 border-slate-200/80 hover:bg-indigo-50 hover:border-indigo-200",
};

interface CalendarFiltersProps {
  activeFilters: string[];
  onChange: (filters: string[]) => void;
  showPersonal?: boolean;
  showGcal?: boolean;
  showMeeting?: boolean;
}

export default function CalendarFilters({
  activeFilters,
  onChange,
  showPersonal = false,
  showGcal = true,
  showMeeting = false,
}: CalendarFiltersProps) {
  let baseFilters = showGcal ? BASE_FILTERS : BASE_FILTERS.filter((f) => f.id !== "gcal");
  if (!showMeeting) baseFilters = baseFilters.filter((f) => f.id !== "meeting");
  const filters = showPersonal ? [...baseFilters, PERSONAL_FILTER] : baseFilters;

  function toggle(id: string) {
    if (activeFilters.includes(id)) {
      onChange(activeFilters.filter((f) => f !== id));
    } else {
      onChange([...activeFilters, id]);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {activeFilters.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-200"
        >
          Todos
        </button>
      )}
      {filters.map((f) => {
        const isActive = activeFilters.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => toggle(f.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${isActive ? f.activeClass : f.inactiveClass}`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
