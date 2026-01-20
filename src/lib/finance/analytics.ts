import type {
  FinanceAccount,
  FinanceFilters,
  FinanceMovement,
  FinanceMovementStatus,
} from "@/lib/finance/types";
import { getMonthKey } from "@/lib/finance/utils";

const EXPENSE_TYPES = ["PagoColaborador", "GastoFijo", "GastoVariable"] as const;

export function filterMovements(movements: FinanceMovement[], filters: FinanceFilters) {
  return movements.filter((movement) => {
    if (movement.monthKey !== filters.monthKey) return false;
    if (filters.status !== "all" && movement.status !== filters.status) return false;
    if (filters.account !== "all") {
      const accountMatch = movement.accountFrom === filters.account || movement.accountTo === filters.account;
      if (!accountMatch) return false;
    }
    if (filters.responsible !== "all" && movement.responsible !== filters.responsible) return false;
    if (filters.category !== "all" && movement.category !== filters.category) return false;
    if (filters.type !== "all" && movement.type !== filters.type) return false;
    return true;
  });
}

export function calcKpis(movements: FinanceMovement[], monthKey: string) {
  const monthMovements = movements.filter((movement) => movement.monthKey === monthKey);
  const incomePaid = sumBy(monthMovements, (item) =>
    item.type === "Ingreso" && item.status === "Cancelado" ? item.amount : 0
  );
  const incomePending = sumBy(monthMovements, (item) =>
    item.type === "Ingreso" && item.status === "Pendiente" ? item.amount : 0
  );
  const expensesPaid = sumBy(monthMovements, (item) =>
    EXPENSE_TYPES.includes(item.type) && item.status === "Cancelado" ? item.amount : 0
  );
  const expensesPending = sumBy(monthMovements, (item) =>
    EXPENSE_TYPES.includes(item.type) && item.status === "Pendiente" ? item.amount : 0
  );
  const sunatPaid = sumBy(monthMovements, (item) =>
    item.category === "SUNAT" && item.status === "Cancelado" ? item.amount : 0
  );
  const sunatPending = sumBy(monthMovements, (item) =>
    item.category === "SUNAT" && item.status === "Pendiente" ? item.amount : 0
  );
  const netIncome = incomePaid - expensesPaid;
  const margin = incomePaid > 0 ? (netIncome / incomePaid) * 100 : 0;

  return {
    incomePaid,
    incomePending,
    expensesPaid,
    expensesPending,
    netIncome,
    margin,
    sunatPaid,
    sunatPending,
  };
}

export function calculateAccountBalances(
  movements: FinanceMovement[],
  accounts: FinanceAccount[],
  monthKey: string
) {
  const paidMovements = movements.filter(
    (item) => item.status === "Cancelado" && item.monthKey <= monthKey
  );
  const balances = accounts.map((account) => ({
    ...account,
    balance: account.initialBalance,
  }));

  paidMovements.forEach((movement) => {
    if (movement.type === "Transferencia") {
      if (movement.accountFrom) {
        const account = balances.find((item) => item.id === movement.accountFrom);
        if (account) account.balance -= movement.amount;
      }
      if (movement.accountTo) {
        const account = balances.find((item) => item.id === movement.accountTo);
        if (account) account.balance += movement.amount;
      }
      return;
    }

    if (movement.accountFrom) {
      const account = balances.find((item) => item.id === movement.accountFrom);
      if (account) account.balance -= movement.amount;
    }
    if (movement.accountTo) {
      const account = balances.find((item) => item.id === movement.accountTo);
      if (account) account.balance += movement.amount;
    }
  });

  return balances;
}

export function getPendingItems(movements: FinanceMovement[], monthKey: string) {
  const pending = movements.filter((item) => item.monthKey === monthKey && item.status === "Pendiente");
  const pendingIncome = pending.filter((item) => item.type === "Ingreso");
  const pendingExpenses = pending.filter((item) => EXPENSE_TYPES.includes(item.type));
  return {
    pendingIncome: pendingIncome.slice(0, 5),
    pendingExpenses: pendingExpenses.slice(0, 5),
  };
}

export function calculateProjections(
  movements: FinanceMovement[],
  monthKey: string,
  totalCash: number
) {
  const base = calcKpis(movements, monthKey);
  const incomeProjection = base.incomePaid + base.incomePending;
  const expenseProjection = base.expensesPaid + base.expensesPending;
  const projectedProfit = incomeProjection - expenseProjection;
  const projectedCash = totalCash + base.incomePending - base.expensesPending;

  return {
    incomeProjection,
    expenseProjection,
    projectedProfit,
    projectedCash,
  };
}

export function getMonthlyRunway(movements: FinanceMovement[], monthKey: string, totalCash: number) {
  const twoMonthsAgo = new Date();
  const [year, month] = monthKey.split("-").map(Number);
  twoMonthsAgo.setFullYear(year, month - 3, 1);
  const cutoff = getMonthKey(twoMonthsAgo);

  const expenses = movements.filter(
    (item) =>
      item.status === "Cancelado" &&
      EXPENSE_TYPES.includes(item.type) &&
      item.monthKey >= cutoff &&
      item.monthKey <= monthKey
  );

  if (expenses.length === 0) return null;

  const averageWeekly = sumBy(expenses, (item) => item.amount) / 8;
  if (averageWeekly <= 0) return null;

  return totalCash / averageWeekly;
}

export function getMonthComparison(current: { incomePaid: number; expensesPaid: number; netIncome: number }, previous?: { incomePaid: number; expensesPaid: number; netIncome: number }) {
  if (!previous) return null;
  const variation = (value: number, prev: number) => (prev === 0 ? 0 : ((value - prev) / prev) * 100);
  return {
    income: variation(current.incomePaid, previous.incomePaid),
    expenses: variation(current.expensesPaid, previous.expensesPaid),
    net: variation(current.netIncome, previous.netIncome),
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function getStatusLabel(status: FinanceMovementStatus) {
  return status === "Cancelado" ? "Cancelado" : "Pendiente";
}
