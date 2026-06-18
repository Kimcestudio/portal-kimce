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
  pendingCount?: number;
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
  pendingCount,
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
  const computedPendingCount = unified.filter((item) => item.status === "PENDING").length;
  const totalPendingCount = pendingCount ?? computedPendingCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <button
          className="group flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-100"
          onClick={onOpenExtra}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white">
              <PlusCircle size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Registrar actividad extra</p>
              <p className="text-xs text-slate-400">Agregar horas adicionales o eventos urgentes.</p>
            </div>
          </div>
          <ChevronRight className="text-indigo-500 transition group-hover:translate-x-0.5" size={16} />
        </button>
        <button
          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
          onClick={onOpenRequest}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CalendarPlus size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Pedir libre / permiso</p>
              <p className="text-xs text-slate-400">Vacaciones, permisos por horas o médico.</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 transition group-hover:translate-x-0.5" size={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        <span>
          {totalPendingCount > 0
            ? `Tienes ${totalPendingCount} solicitudes pendientes.`
            : "No tienes solicitudes pendientes por revisar."}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Filter size={14} />
          Filtrar
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === option.value ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => onFilterChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
        {filtered.slice(0, 6).map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.type}</p>
              <p className="text-xs text-slate-400">
                {item.date} · {item.detail}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mapStatus(item.status)}`}>
                {item.status}
              </span>
              <button className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                {item.actionLabel}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Aún no tienes solicitudes. Registra una actividad extra o pide un permiso.
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
