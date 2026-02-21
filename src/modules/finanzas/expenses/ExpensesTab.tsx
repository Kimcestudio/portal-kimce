import { useMemo } from "react";
import ExpensesTable from "@/modules/finanzas/expenses/ExpensesTable";
import FinanceKpiRow from "@/modules/finanzas/shared/FinanceKpiRow";
import { calculateExpenseKpis, calculateVisibleExpensesTotal } from "@/modules/finanzas/expenses/expenses.selectors";
import type { Expense, FinanceStatus } from "@/lib/finance/types";

interface ExpensesTabProps {
  expenses: Expense[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpensesTab({ expenses, isSubmitting, onStatusChange, onEdit, onDelete }: ExpensesTabProps) {
  const visibleExpensesTotal = useMemo(() => calculateVisibleExpensesTotal(expenses), [expenses]);
  const expenseTableKpis = useMemo(() => calculateExpenseKpis(expenses), [expenses]);

  return (
    <>
      <FinanceKpiRow
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
