import type {
  FinanceAccount,
  FinanceExpensePlan,
  FinanceFilters,
  FinanceTransaction,
} from "@/lib/finance/types";
import { formatCurrency, getMonthKey, getWeekIndex } from "@/lib/finance/utils";

const EXPENSE_TYPES = ["expense", "collaborator_payment", "tax"] as const;

export function filterTransactions(transactions: FinanceTransaction[], filters: FinanceFilters) {
  return transactions.filter((transaction) => {
    if (transaction.monthKey !== filters.monthKey) return false;
    if (filters.status !== "all" && transaction.status !== filters.status) return false;
    if (filters.account !== "all") {
      const accountMatch =
        transaction.accountFrom === filters.account || transaction.accountTo === filters.account;
      if (!accountMatch) return false;
    }
    if (filters.responsible !== "all" && transaction.responsible !== filters.responsible) return false;
    if (filters.category !== "all" && transaction.category !== filters.category) return false;
    return true;
  });
}

export function calculateKPIs(transactions: FinanceTransaction[], monthKey: string) {
  const monthTransactions = transactions.filter((transaction) => transaction.monthKey === monthKey);
  const incomePaid = sumBy(monthTransactions, (item) =>
    item.type === "income" && item.status === "paid" ? item.finalAmount : 0
  );
  const incomePending = sumBy(monthTransactions, (item) =>
    item.type === "income" && item.status === "pending" ? item.finalAmount : 0
  );
  const expensesPaid = sumBy(monthTransactions, (item) =>
    EXPENSE_TYPES.includes(item.type) && item.status === "paid" ? item.finalAmount : 0
  );
  const expensesPending = sumBy(monthTransactions, (item) =>
    EXPENSE_TYPES.includes(item.type) && item.status === "pending" ? item.finalAmount : 0
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
  };
}

export function calculateProjections(
  transactions: FinanceTransaction[],
  expensePlans: FinanceExpensePlan[],
  monthKey: string,
  totalCash: number
) {
  const base = calculateKPIs(transactions, monthKey);
  const plannedExpenses = expensePlans
    .filter((plan) => plan.status === "pending")
    .reduce((total, plan) => total + plan.amount, 0);
  const incomeProjection = base.incomePaid + base.incomePending;
  const expenseProjection = base.expensesPaid + base.expensesPending + plannedExpenses;
  const projectedProfit = incomeProjection - expenseProjection;
  const projectedCash = totalCash + base.incomePending - base.expensesPending - plannedExpenses;

  return {
    incomeProjection,
    expenseProjection,
    projectedProfit,
    projectedCash,
    plannedExpenses,
  };
}

export function groupWeeklyTotals(transactions: FinanceTransaction[], monthKey: string) {
  const base = transactions.filter((item) => item.monthKey === monthKey && item.status === "paid");
  const totals: Record<number, { income: number; expenses: number }> = {};
  base.forEach((item) => {
    const week = getWeekIndex(new Date(item.date));
    if (!totals[week]) totals[week] = { income: 0, expenses: 0 };
    if (item.type === "income") {
      totals[week].income += item.finalAmount;
    } else if (EXPENSE_TYPES.includes(item.type)) {
      totals[week].expenses += item.finalAmount;
    }
  });

  return Object.keys(totals)
    .map((week) => ({
      name: `Semana ${week}`,
      ingresos: Math.round(totals[Number(week)].income),
      gastos: Math.round(totals[Number(week)].expenses),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupExpenseCategories(transactions: FinanceTransaction[], monthKey: string) {
  const expenses = transactions.filter(
    (item) => item.monthKey === monthKey && EXPENSE_TYPES.includes(item.type) && item.status === "paid"
  );
  const totals: Record<string, number> = {};
  expenses.forEach((item) => {
    totals[item.category] = (totals[item.category] ?? 0) + item.finalAmount;
  });
  return Object.entries(totals).map(([name, value]) => ({ name, value: Math.round(value) }));
}

export function calculateAccountBalances(
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  monthKey: string
) {
  const paidTransactions = transactions.filter(
    (item) => item.status === "paid" && item.monthKey <= monthKey
  );
  const balances = accounts.map((account) => ({
    ...account,
    balance: account.initialBalance,
  }));

  paidTransactions.forEach((transaction) => {
    if (transaction.accountFrom) {
      const account = balances.find((item) => item.id === transaction.accountFrom);
      if (account) account.balance -= transaction.finalAmount;
    }
    if (transaction.accountTo) {
      const account = balances.find((item) => item.id === transaction.accountTo);
      if (account) account.balance += transaction.finalAmount;
    }
  });

  return balances;
}

export function getPendingItems(transactions: FinanceTransaction[], monthKey: string) {
  const pending = transactions.filter((item) => item.monthKey === monthKey && item.status === "pending");
  const pendingIncome = pending.filter((item) => item.type === "income");
  const pendingExpenses = pending.filter((item) => EXPENSE_TYPES.includes(item.type));
  return {
    pendingIncome: pendingIncome.slice(0, 5),
    pendingExpenses: pendingExpenses.slice(0, 5),
  };
}

export function getMonthlyRunway(transactions: FinanceTransaction[], monthKey: string, totalCash: number) {
  const twoMonthsAgo = new Date();
  const [year, month] = monthKey.split("-").map(Number);
  twoMonthsAgo.setFullYear(year, month - 3, 1);
  const cutoff = getMonthKey(twoMonthsAgo);

  const expenses = transactions.filter(
    (item) =>
      item.status === "paid" &&
      EXPENSE_TYPES.includes(item.type) &&
      item.monthKey >= cutoff &&
      item.monthKey <= monthKey
  );

  if (expenses.length === 0) return null;

  const averageWeekly = sumBy(expenses, (item) => item.finalAmount) / 8;
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

export function buildTransactionRow(transaction: FinanceTransaction) {
  const statusLabel = transaction.status === "paid" ? "Cancelado" : "Pendiente";
  return {
    ...transaction,
    statusLabel,
    formattedAmount: formatCurrency(transaction.finalAmount),
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}
