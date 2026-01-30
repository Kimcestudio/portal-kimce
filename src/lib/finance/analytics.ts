import type { Expense, FinanceFilters, FinanceMovement, FinanceStatus } from "@/lib/finance/types";
import { getMonthKeyFromDate } from "@/lib/finance/utils";

export function filterMovements(movements: FinanceMovement[], filters: FinanceFilters) {
  return movements.filter((movement) => {
    if (movement.monthKey !== filters.monthKey) return false;
    if (!filters.includeCancelled && movement.status === "cancelled") return false;
    if (filters.status !== "all" && movement.status !== filters.status) return false;
    if (filters.account !== "all" && movement.accountDestination !== filters.account) return false;
    return true;
  });
}

export function calcKpis(
  movements: FinanceMovement[],
  expenses: Expense[],
  monthKey: string,
  includeCancelled = false,
  account: FinanceFilters["account"] = "all",
) {
  const monthMovementsAll = movements.filter(
    (movement) =>
      movement.monthKey === monthKey &&
      (account === "all" || movement.accountDestination === account),
  );
  const monthMovements = includeCancelled
    ? monthMovementsAll
    : monthMovementsAll.filter((movement) => movement.status !== "cancelled");
  const incomePaid = sumBy(monthMovements, (item) =>
    isPaid(item.status) ? item.tax?.total ?? item.amount : 0,
  );
  const incomePending = sumBy(monthMovements, (item) =>
    item.status === "pending" ? item.tax?.total ?? item.amount : 0,
  );
  const incomeCancelled = sumBy(
    monthMovementsAll,
    (item) => (item.status === "cancelled" ? item.tax?.total ?? item.amount : 0),
  );
  const monthExpensesAll = expenses.filter((expense) => {
    const expenseMonthKey = expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto);
    return expenseMonthKey === monthKey && (account === "all" || expense.cuentaOrigen === account);
  });
  const monthExpenses = includeCancelled
    ? monthExpensesAll
    : monthExpensesAll.filter((expense) => expense.status !== "cancelled");
  const expensesPaid = sumBy(monthExpenses, (expense) =>
    isPaid(expense.status) ? expense.monto : 0,
  );
  const expensesPending = sumBy(monthExpenses, (expense) =>
    expense.status === "pending" ? expense.monto : 0,
  );
  const expensesCancelled = sumBy(monthExpensesAll, (expense) =>
    expense.status === "cancelled" ? expense.monto : 0,
  );
  const netIncome = incomePaid - expensesPaid;
  const margin = incomePaid > 0 ? (netIncome / incomePaid) * 100 : 0;

  return {
    incomePaid,
    incomePending,
    incomeCancelled,
    expensesPaid,
    expensesPending,
    expensesCancelled,
    netIncome,
    margin,
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function computeMonthProjection(
  movements: FinanceMovement[],
  expenses: Expense[],
  monthKey: string,
  account: FinanceFilters["account"] = "all",
) {
  const monthMovements = movements.filter(
    (movement) =>
      movement.monthKey === monthKey &&
      movement.status !== "cancelled" &&
      (account === "all" || movement.accountDestination === account),
  );
  const monthExpenses = expenses.filter((expense) => {
    const expenseMonthKey = expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto);
    return (
      expenseMonthKey === monthKey &&
      expense.status !== "cancelled" &&
      (account === "all" || expense.cuentaOrigen === account)
    );
  });
  const incomePaid = sumBy(monthMovements, (item) =>
    isPaid(item.status) ? item.tax?.total ?? item.amount : 0,
  );
  const incomePending = sumBy(monthMovements, (item) =>
    item.status === "pending" ? item.tax?.total ?? item.amount : 0,
  );
  const expensesPaid = sumBy(monthExpenses, (expense) =>
    isPaid(expense.status) ? expense.monto : 0,
  );
  const expensesPending = sumBy(monthExpenses, (expense) =>
    expense.status === "pending" ? expense.monto : 0,
  );
  const incomeProjected = incomePaid + incomePending;
  const expensesProjected = expensesPaid + expensesPending;
  const projectedNet = incomeProjected - expensesProjected;
  const projectedMargin = incomeProjected > 0 ? (projectedNet / incomeProjected) * 100 : 0;
  return {
    incomePaid,
    incomePending,
    incomeProjected,
    expensesPaid,
    expensesPending,
    expensesProjected,
    projectedNet,
    projectedMargin,
  };
}

export function computeHistoricalTotals(
  movements: FinanceMovement[],
  expenses: Expense[],
  account: FinanceFilters["account"] = "all",
) {
  const filteredMovements = movements.filter(
    (movement) =>
      movement.status !== "cancelled" &&
      (account === "all" || movement.accountDestination === account),
  );
  const filteredExpenses = expenses.filter(
    (expense) =>
      expense.status !== "cancelled" && (account === "all" || expense.cuentaOrigen === account),
  );
  const totalIncome = sumBy(filteredMovements, (movement) => movement.tax?.total ?? movement.amount);
  const totalExpenses = sumBy(filteredExpenses, (expense) => expense.monto);
  const net = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  return {
    totalIncome,
    totalExpenses,
    net,
    margin,
  };
}

export function computeMonthlySeries(
  movements: FinanceMovement[],
  expenses: Expense[],
  baseMonthKey: string,
  lastN = 12,
  account: FinanceFilters["account"] = "all",
) {
  const monthKeys = buildMonthKeys(baseMonthKey, lastN);
  const rows = monthKeys.map((monthKey) => {
    const monthMovements = movements.filter(
      (movement) =>
        movement.monthKey === monthKey &&
        movement.status !== "cancelled" &&
        (account === "all" || movement.accountDestination === account),
    );
    const monthExpenses = expenses.filter((expense) => {
      const expenseMonthKey = expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto);
      return (
        expenseMonthKey === monthKey &&
        expense.status !== "cancelled" &&
        (account === "all" || expense.cuentaOrigen === account)
      );
    });
    const incomePaid = sumBy(monthMovements, (movement) =>
      isPaid(movement.status) ? movement.tax?.total ?? movement.amount : 0,
    );
    const incomePending = sumBy(monthMovements, (movement) =>
      movement.status === "pending" ? movement.tax?.total ?? movement.amount : 0,
    );
    const expensesPaid = sumBy(monthExpenses, (expense) =>
      isPaid(expense.status) ? expense.monto : 0,
    );
    const expensesPending = sumBy(monthExpenses, (expense) =>
      expense.status === "pending" ? expense.monto : 0,
    );
    const net = incomePaid - expensesPaid;
    return {
      monthKey,
      incomePaid,
      incomePending,
      expensesPaid,
      expensesPending,
      net,
    };
  });
  return rows;
}

export function computeAlerts(
  {
    projectedIncome,
    projectedExpenses,
    projectedNet,
    projectedMargin,
    incomePending,
  }: {
    projectedIncome: number;
    projectedExpenses: number;
    projectedNet: number;
    projectedMargin: number;
    incomePending: number;
  },
  options?: {
    marginThreshold?: number;
    pendingThreshold?: number;
    bestMonthLabel?: string | null;
  },
) {
  const marginThreshold = options?.marginThreshold ?? 20;
  const pendingThreshold = options?.pendingThreshold ?? 0.3;
  const alerts: { tone: "info" | "warning" | "danger"; message: string }[] = [];

  if (projectedMargin < marginThreshold) {
    alerts.push({
      tone: "warning",
      message: `Margen neto proyectado menor a ${marginThreshold}%.`,
    });
  }
  if (projectedExpenses > projectedIncome) {
    alerts.push({
      tone: "danger",
      message: "Gastos proyectados superan ingresos proyectados.",
    });
  }
  if (projectedIncome > 0 && incomePending / projectedIncome > pendingThreshold) {
    alerts.push({
      tone: "warning",
      message: "Pendientes por cobrar superan el 30% de los ingresos proyectados.",
    });
  }
  if (options?.bestMonthLabel) {
    alerts.push({
      tone: "info",
      message: `Mejor mes del año: ${options.bestMonthLabel}.`,
    });
  }
  return alerts;
}

function isPaid(status: FinanceStatus) {
  return status !== "pending" && status !== "cancelled";
}

function buildMonthKeys(baseMonthKey: string, lastN: number) {
  const [yearPart, monthPart] = baseMonthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const start = new Date(year, month - 1, 1);
  return Array.from({ length: lastN }, (_, index) => {
    const current = new Date(start);
    current.setMonth(start.getMonth() - (lastN - 1 - index));
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
}
