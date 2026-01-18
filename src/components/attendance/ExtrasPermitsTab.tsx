import { minutesToHHMM } from "@/lib/attendanceUtils";
import type { CorrectionRequest, ExtraActivity, Request } from "@/lib/storage/attendanceStorage";

interface ExtrasPermitsTabProps {
  extras: ExtraActivity[];
  requests: Request[];
  corrections: CorrectionRequest[];
  filter: "ALL" | "PENDING";
  onFilterChange: (value: "ALL" | "PENDING") => void;
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
    })),
    ...corrections.map((item) => ({
      id: item.id,
      type: "Corrección",
      date: item.date,
      detail: item.proposedChanges,
      status: item.status,
    })),
  ];

  const filtered = filter === "PENDING" ? unified.filter((item) => item.status === "PENDING") : unified;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={onOpenExtra}
            type="button"
          >
            Registrar actividad extra
          </button>
          <button
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink"
            onClick={onOpenRequest}
            type="button"
          >
            Pedir libre / permiso
          </button>
        </div>
        <div className="flex gap-2">
          <button
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === "ALL" ? "bg-primary text-white" : "bg-white text-muted"
            }`}
            onClick={() => onFilterChange("ALL")}
            type="button"
          >
            Todo
          </button>
          <button
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === "PENDING" ? "bg-primary text-white" : "bg-white text-muted"
            }`}
            onClick={() => onFilterChange("PENDING")}
            type="button"
          >
            Pendiente
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {filtered.slice(0, 6).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 shadow-soft">
            <div>
              <p className="text-sm font-semibold text-ink">{item.type}</p>
              <p className="text-xs text-muted">
                {item.date} · {item.detail}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mapStatus(item.status)}`}>
              {item.status}
            </span>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">
            No hay registros recientes.
          </div>
        ) : null}
      </div>
    </div>
  );
}
