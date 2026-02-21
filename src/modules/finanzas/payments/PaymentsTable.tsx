import { Pencil, Trash2 } from "lucide-react";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import type { CollaboratorPayment, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/finance/utils";

interface PaymentsTableProps {
  payments: CollaboratorPayment[];
  collaboratorLookup: Map<string, string>;
  total: number;
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (payment: CollaboratorPayment) => void;
  onDelete: (id: string) => void;
}

export default function PaymentsTable({
  payments,
  collaboratorLookup,
  total,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: PaymentsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Periodo</th>
            <th className="px-4 py-3">Colaborador</th>
            <th className="px-4 py-3">Fecha de pago</th>
            <th className="px-4 py-3">Cuenta</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">{payment.periodo}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador"}</p>
                <p className="text-xs text-slate-500">{payment.referencia ?? "-"}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(payment.fechaPago)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{payment.cuentaOrigen}</td>
              <td className="px-4 py-3">
                <FinanceStatusSelect
                  status={payment.status}
                  onChange={(status) => onStatusChange(payment.id, status)}
                  disabled={isSubmitting}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(payment.montoFinal)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onEdit(payment)}
                    disabled={isSubmitting}
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onDelete(payment.id)}
                    disabled={isSubmitting}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {payments.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                Sin pagos registrados en este mes.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
