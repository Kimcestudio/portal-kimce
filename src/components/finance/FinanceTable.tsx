import Badge from "@/components/ui/Badge";
import type { FinanceTransaction } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/finance/utils";

interface FinanceTableProps {
  transactions: FinanceTransaction[];
}

export default function FinanceTable({ transactions }: FinanceTableProps) {
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
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(transaction.date).toLocaleDateString("es-PE")}
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{transaction.category}</p>
                <p className="text-xs text-slate-500">{transaction.referenceId}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {transaction.accountFrom ?? transaction.accountTo ?? "-"}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{transaction.responsible}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={transaction.status === "paid" ? "success" : "warning"}
                  label={transaction.status === "paid" ? "Cancelado" : "Pendiente"}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(transaction.finalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
