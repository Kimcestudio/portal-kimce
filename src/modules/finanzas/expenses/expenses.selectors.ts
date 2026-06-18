import type { Expense } from "@/lib/finance/types";

const getReimbursementAmount = (expense: Expense) => {
  const configuredAmount = expense.devolucionMonto ?? 0;
  return configuredAmount > 0 ? configuredAmount : expense.monto;
};

export const calculateVisibleExpensesTotal = (expenses: Expense[]) =>
  expenses.reduce((sum, expense) => sum + expense.monto, 0);

export const calculateExpenseKpis = (expenses: Expense[]) => {
  const total = calculateVisibleExpensesTotal(expenses);
  const paid = expenses.reduce((sum, expense) => sum + (expense.status !== "pending" ? expense.monto : 0), 0);
  const pending = expenses.reduce((sum, expense) => sum + (expense.status === "pending" ? expense.monto : 0), 0);
  const fixed = expenses.reduce((sum, expense) => sum + (expense.tipoGasto === "FIJO" ? expense.monto : 0), 0);
  const variable = expenses.reduce(
    (sum, expense) => sum + (expense.tipoGasto === "VARIABLE" ? expense.monto : 0),
    0,
  );
  const reimbursablePending = expenses.reduce(
    (sum, expense) =>
      sum +
      (expense.requiereDevolucion && expense.estadoReembolso !== "reimbursed"
        ? getReimbursementAmount(expense)
        : 0),
    0,
  );
  const reimbursed = expenses.reduce(
    (sum, expense) =>
      sum +
      (expense.requiereDevolucion && expense.estadoReembolso === "reimbursed"
        ? getReimbursementAmount(expense)
        : 0),
    0,
  );
  return { total, paid, pending, fixed, variable, reimbursablePending, reimbursed };
};
