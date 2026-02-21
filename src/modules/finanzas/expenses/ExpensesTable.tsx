import { Pencil, Trash2 } from "lucide-react";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import type { Expense, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/finance/utils";

interface ExpensesTableProps {
  expenses: Expense[];
  total: number;
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpensesTable({
  expenses,
  total,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: ExpensesTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Descripción</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(expense.fechaGasto)}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{expense.descripcion}</p>
                <p className="text-xs text-slate-500">{expense.referencia ?? "-"}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{expense.categoria}</td>
              <td className="px-4 py-3">
                <FinanceStatusSelect
                  status={expense.status}
                  onChange={(status) => onStatusChange(expense.id, status)}
                  disabled={isSubmitting}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(expense.monto)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onEdit(expense)}
                    disabled={isSubmitting}
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => onDelete(expense.id)}
                    disabled={isSubmitting}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                Sin gastos registrados en este mes.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
