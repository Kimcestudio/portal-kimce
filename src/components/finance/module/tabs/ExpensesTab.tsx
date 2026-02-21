import { useMemo } from "react";
import ExpensesTable from "@/components/finance/module/ExpensesTable";
import FinanceKpisRow from "@/components/finance/module/FinanceKpisRow";
import type { Expense, FinanceStatus } from "@/lib/finance/types";

interface ExpensesTabProps {
  expenses: Expense[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpensesTab({
  expenses,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: ExpensesTabProps) {
  const visibleExpensesTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.monto, 0),
    [expenses],
  );

  const expenseTableKpis = useMemo(() => {
    const total = visibleExpensesTotal;
    const paid = expenses.reduce(
      (sum, expense) => sum + (expense.status !== "pending" ? expense.monto : 0),
      0,
    );
    const pending = expenses.reduce(
      (sum, expense) => sum + (expense.status === "pending" ? expense.monto : 0),
      0,
    );
    const fixed = expenses.reduce(
      (sum, expense) => sum + (expense.tipoGasto === "FIJO" ? expense.monto : 0),
      0,
    );
    const variable = expenses.reduce(
      (sum, expense) => sum + (expense.tipoGasto === "VARIABLE" ? expense.monto : 0),
      0,
    );
    return { total, paid, pending, fixed, variable };
  }, [expenses, visibleExpensesTotal]);

  return (
    <>
      <FinanceKpisRow
        items={[
          { title: "Total", value: expenseTableKpis.total, tone: "slate" },
          { title: "Pagado", value: expenseTableKpis.paid, tone: "green" },
          { title: "Pendiente", value: expenseTableKpis.pending, tone: "amber" },
          { title: "Fijos", value: expenseTableKpis.fixed, tone: "blue" },
          { title: "Variables", value: expenseTableKpis.variable, tone: "rose" },
        ]}
      />
      <ExpensesTable
        expenses={expenses}
        total={visibleExpensesTotal}
        isSubmitting={isSubmitting}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
}
