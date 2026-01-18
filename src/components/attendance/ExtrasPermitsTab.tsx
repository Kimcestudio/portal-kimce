import { CalendarPlus, ChevronRight, Filter, PlusCircle } from "lucide-react";
import { minutesToHHMM } from "@/lib/attendanceUtils";
import type { CorrectionRequest, ExtraActivity, Request } from "@/lib/storage/attendanceStorage";

interface ExtrasPermitsTabProps {
  extras: ExtraActivity[];
  requests: Request[];
  corrections: CorrectionRequest[];
  filter: "ALL" | "PENDING" | "APPROVED" | "REJECTED";
  onFilterChange: (value: "ALL" | "PENDING" | "APPROVED" | "REJECTED") => void;
  onOpenExtra: () => void;
  onOpenRequest: () => void;
}

function mapStatus(status: "PENDING" | "APPROVED" | "REJECTED") {
  const colors = {
    PENDING: "bg-[#fef3c7] text-[#b45309]",
    APPROVED: "bg-[#dcfce7] text-[#15803d]",
    REJECTED: "bg-[#fee2e2] text-[#b91c1c]",
  };
  return colors[status];
}

const filterOptions = [
  { value: "ALL", label: "Todo" },
  { value: "PENDING", label: "Pendiente" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
] as const;

export default function ExtrasPermitsTab({
  extras,
  requests,
  corrections,
  filter,
  onFilterChange,
  onOpenExtra,
  onOpenRequest,
}: ExtrasPermitsTabProps) {
  const unified = [
    ...extras.map((item) => ({
      id: item.id,
      type: `Extra · ${item.type}`,
      date: item.date,
      detail: `${minutesToHHMM(item.minutes)}${item.project ? ` · ${item.project}` : ""}`,
      status: item.status,
      actionLabel: "Ver detalle",
    })),
    ...requests.map((item) => ({
      id: item.id,
      type: `Permiso · ${
        item.type === "DIA_LIBRE"
          ? "Día libre"
          : item.type === "MEDICO"
          ? "Médico"
          : "Horas"
      }`,
      date: item.date,
      detail: item.hours ? `${item.hours}h` : item.endDate ? `${item.date} → ${item.endDate}` : item.reason,
      status: item.status,
      actionLabel: "Ver detalle",
    })),
    ...corrections.map((item) => ({
      id: item.id,
      type: "Corrección",
      date: item.date,
      detail: item.proposedChanges,
      status: item.status,
      actionLabel: "Ver detalle",
    })),
  ];

  const filtered =
    filter === "ALL" ? unified : unified.filter((item) => item.status === filter);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <button
          className="group flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-primary/15"
          onClick={onOpenExtra}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
              <PlusCircle size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Registrar actividad extra</p>
              <p className="text-xs text-muted">Agregar horas adicionales o eventos urgentes.</p>
            </div>
          </div>
          <ChevronRight className="text-primary transition group-hover:translate-x-0.5" size={18} />
        </button>
        <button
          className="group flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:border-primary/40"
          onClick={onOpenRequest}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef0ff] text-primary">
              <CalendarPlus size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Pedir libre / permiso</p>
              <p className="text-xs text-muted">Vacaciones, permisos por horas o médico.</p>
            </div>
          </div>
          <ChevronRight className="text-muted transition group-hover:translate-x-0.5" size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <Filter size={14} />
          Filtrar
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === option.value ? "bg-primary text-white" : "bg-white text-muted"
              }`}
              onClick={() => onFilterChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {filtered.slice(0, 6).map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft">
            <div>
              <p className="text-sm font-semibold text-ink">{item.type}</p>
              <p className="text-xs text-muted">
                {item.date} · {item.detail}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mapStatus(item.status)}`}>
                {item.status}
              </span>
              <button className="flex items-center gap-1 text-xs font-semibold text-primary">
                {item.actionLabel}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">
            Aún no tienes solicitudes. Registra una actividad extra o pide un permiso.
          </div>
        ) : null}
      </div>
    </div>
  );
}
