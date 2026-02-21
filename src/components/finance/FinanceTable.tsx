import { Pencil, Trash2 } from "lucide-react";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/finance/utils";

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
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Cuenta</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">
                {formatShortDate(movement.incomeDate)}
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{movement.clientName}</p>
                <p className="text-xs text-slate-500">{movement.projectService || "—"}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{movement.accountDestination}</td>
              <td className="px-4 py-3">
                <FinanceStatusSelect
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
