import { Pencil, Trash2 } from "lucide-react";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import type { FinanceStatus, TransferMovement } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/finance/utils";

interface TransfersTableProps {
  transfers: TransferMovement[];
  totals: { in: number; out: number };
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (transfer: TransferMovement) => void;
  onDelete: (id: string) => void;
}

export default function TransfersTable({
  transfers,
  totals,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: TransfersTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Cuenta origen</th>
            <th className="px-4 py-3">Cuenta destino</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={transfer.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(transfer.fecha)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{transfer.tipoMovimiento}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaOrigen ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaDestino ?? "—"}</td>
              <td className="px-4 py-3">
                <FinanceStatusSelect
                  status={transfer.status}
                  onChange={(status) => onStatusChange(transfer.id, status)}
                  disabled={isSubmitting}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(transfer.monto)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onEdit(transfer)}
                    disabled={isSubmitting}
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onDelete(transfer.id)}
                    disabled={isSubmitting}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {transfers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                Sin transferencias registradas en este mes.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
