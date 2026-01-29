import type { FinanceFilters, FinanceMovement } from "@/lib/finance/types";

export function filterMovements(movements: FinanceMovement[], filters: FinanceFilters) {
  return movements.filter((movement) => {
    if (movement.monthKey !== filters.monthKey) return false;
    if (!filters.includeCancelled && movement.status === "cancelled") return false;
    if (filters.status !== "all" && movement.status !== filters.status) return false;
    if (filters.account !== "all" && movement.accountDestination !== filters.account) return false;
    return true;
  });
}

export function calcKpis(movements: FinanceMovement[], monthKey: string, includeCancelled = false) {
  const monthMovementsAll = movements.filter((movement) => movement.monthKey === monthKey);
  const monthMovements = includeCancelled
    ? monthMovementsAll
    : monthMovementsAll.filter((movement) => movement.status !== "cancelled");
  const incomePaid = 0;
  const incomePending = sumBy(
    monthMovements,
    (item) => (item.status === "pending" ? item.tax?.total ?? item.amount : 0),
  );
  const incomeCancelled = sumBy(
    monthMovementsAll,
    (item) => (item.status === "cancelled" ? item.tax?.total ?? item.amount : 0),
  );
  const netIncome = incomePending;
  const margin = netIncome > 0 ? 100 : 0;

  return {
    incomePending,
    incomeCancelled,
    expensesPaid: 0,
    expensesPending: 0,
    netIncome,
    margin,
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}
