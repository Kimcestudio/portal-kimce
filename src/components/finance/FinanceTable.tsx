import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/finance/utils";

interface FinanceTableProps {
  movements: FinanceMovement[];
  onStatusChange?: (id: string, status: FinanceStatus) => void;
  onDelete?: (id: string) => void;
  onEdit?: (movement: FinanceMovement) => void;
  disabled?: boolean;
}

export default function FinanceTable({
  movements,
  onStatusChange,
  onDelete,
  onEdit,
  disabled,
}: FinanceTableProps) {
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
      }),
    []
  );

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Concepto</th>
            <th className="px-4 py-3">Cuenta</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">
                {dateFormatter.format(new Date(movement.incomeDate))}
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{movement.clientName}</p>
                <p className="text-xs text-slate-500">{movement.reference ?? movement.projectService ?? "-"}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{movement.accountDestination}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{movement.responsible}</td>
              <td className="px-4 py-3">
                <StatusChip
                  status={movement.status}
                  onChange={(status) => onStatusChange?.(movement.id, status)}
                  disabled={disabled || !onStatusChange}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(movement.amount)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onEdit?.(movement)}
                    disabled={disabled || !onEdit}
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onDelete?.(movement.id)}
                    disabled={disabled || !onDelete}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({
  status,
  onChange,
  disabled,
}: {
  status: FinanceStatus;
  onChange?: (status: FinanceStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = status === "CANCELADO" ? "success" : "warning";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="rounded-full"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <Badge tone={tone} label={status === "CANCELADO" ? "Cancelado" : "Pendiente"} />
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-30 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
          {status === "PENDIENTE" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
              onClick={() => {
                onChange?.("CANCELADO");
                setOpen(false);
              }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Cancelado
            </button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
              onClick={() => {
                onChange?.("PENDIENTE");
                setOpen(false);
              }}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Pendiente
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
