import { useMemo } from "react";
import ExpensesTable from "@/modules/finanzas/expenses/ExpensesTable";
import FinanceKpiRow from "@/modules/finanzas/shared/FinanceKpiRow";
import { calculateExpenseKpis } from "@/modules/finanzas/expenses/expenses.selectors";
import type { Expense, FinanceStatus } from "@/lib/finance/types";

interface ReimbursementsTabProps {
  expenses: Expense[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onReimbursementStatusChange: (expense: Expense, status: "pending" | "reimbursed") => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ReimbursementsTab({
  expenses,
  isSubmitting,
  onStatusChange,
  onReimbursementStatusChange,
  onEdit,
  onDelete,
}: ReimbursementsTabProps) {
  const kpis = useMemo(() => calculateExpenseKpis(expenses), [expenses]);
  const disbursed = useMemo(() => expenses.reduce((sum, expense) => sum + expense.monto, 0), [expenses]);

  return (
    <>
      <FinanceKpiRow
        items={[
          { title: "Desembolsado", value: disbursed, tone: "slate" },
          { title: "Por recuperar", value: kpis.reimbursablePending, tone: "blue" },
          { title: "Recuperado", value: kpis.reimbursed, tone: "green" },
          { title: "Pendiente", value: kpis.pending, tone: "amber" },
        ]}
      />
      <ExpensesTable
        expenses={expenses}
        total={disbursed}
        isSubmitting={isSubmitting}
        onStatusChange={onStatusChange}
        onReimbursementStatusChange={onReimbursementStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
        variant="reimbursements"
      />
    </>
  );
}
