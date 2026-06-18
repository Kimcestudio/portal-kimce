import { Pencil, Trash2 } from "lucide-react";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import type { Expense, FinanceStatus } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/finance/utils";

interface ExpensesTableProps {
  expenses: Expense[];
  total: number;
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onReimbursementStatusChange?: (expense: Expense, status: "pending" | "reimbursed") => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  variant?: "default" | "reimbursements";
}

export default function ExpensesTable({
  expenses,
  total,
  isSubmitting,
  onStatusChange,
  onReimbursementStatusChange,
  onEdit,
  onDelete,
  variant = "default",
}: ExpensesTableProps) {
  const isReimbursements = variant === "reimbursements";
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <table className="w-full text-left text-sm">
        <thead
          className={`text-xs uppercase tracking-[0.2em] ${
            isReimbursements
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-50 text-slate-400"
          }`}
        >
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Descripción</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">{isReimbursements ? "Desembolso" : "Estado"}</th>
            {isReimbursements ? <th className="px-4 py-3">Reembolso</th> : null}
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              className={`border-t ${isReimbursements ? "border-emerald-100" : "border-slate-100"}`}
            >
              <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(expense.fechaGasto)}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{expense.descripcion}</p>
                <p className="text-xs text-slate-500">{expense.referencia ?? "-"}</p>
                {expense.requiereDevolucion ? (
                  <div className={`mt-2 space-y-1 rounded-xl px-3 py-2 text-xs ${isReimbursements ? "bg-emerald-50/70" : ""}`}>
                    <p className="text-slate-500">
                      Cliente:{" "}
                      <span className="font-medium text-slate-700">{expense.clienteReembolso ?? "Sin definir"}</span>
                    </p>
                    <p className="text-slate-500">
                      A recuperar:{" "}
                      <span className="font-medium text-slate-700">
                        {formatCurrency(expense.devolucionMonto ?? 0)}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Reembolso:{" "}
                      <span
                        className={
                          expense.estadoReembolso === "reimbursed"
                            ? "font-medium text-emerald-600"
                            : "font-medium text-amber-600"
                        }
                      >
                        {expense.estadoReembolso === "reimbursed" ? "Reembolsado" : "Pendiente"}
                      </span>
                    </p>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{expense.categoria}</td>
              <td className="px-4 py-3">
                <FinanceStatusSelect
                  status={expense.status}
                  onChange={(status) => onStatusChange(expense.id, status)}
                  disabled={isSubmitting}
                />
              </td>
              {isReimbursements ? (
                <td className="px-4 py-3">
                  <select
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-emerald-400"
                    value={expense.estadoReembolso ?? "pending"}
                    onChange={(event) =>
                      onReimbursementStatusChange?.(
                        expense,
                        event.target.value as "pending" | "reimbursed",
                      )
                    }
                    disabled={isSubmitting}
                  >
                    <option value="pending">Pendiente</option>
                    <option value="reimbursed">Reembolsado</option>
                  </select>
                </td>
              ) : null}
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
              <td colSpan={isReimbursements ? 7 : 6} className="px-4 py-6 text-center text-xs text-slate-400">
                {isReimbursements ? "Sin reembolsos registrados en este mes." : "Sin gastos registrados en este mes."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
