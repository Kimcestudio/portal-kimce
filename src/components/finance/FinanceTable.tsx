import { useState } from "react";
import Badge from "@/components/ui/Badge";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/finance/utils";

interface FinanceTableProps {
  movements: FinanceMovement[];
  onStatusChange?: (id: string, status: FinanceStatus) => void;
  onDelete?: (id: string) => void;
  disabled?: boolean;
}

export default function FinanceTable({ movements, onStatusChange, onDelete, disabled }: FinanceTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
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
                {new Date(movement.incomeDate).toLocaleDateString("es-PE")}
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
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  onClick={() => onDelete?.(movement.id)}
                  disabled={disabled || !onDelete}
                >
                  Borrar
                </button>
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
        <div className="absolute left-0 top-9 z-20 min-w-[160px] rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
            onClick={() => {
              onChange?.("CANCELADO");
              setOpen(false);
            }}
          >
            Cambiar a Cancelado
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
            onClick={() => {
              onChange?.("PENDIENTE");
              setOpen(false);
            }}
          >
            Cambiar a Pendiente
          </button>
        </div>
      ) : null}
    </div>
  );
}
