import type { FinanceFilters, FinanceMovement } from "@/lib/finance/types";

export function filterMovements(movements: FinanceMovement[], filters: FinanceFilters) {
  return movements.filter((movement) => {
    if (movement.monthKey !== filters.monthKey) return false;
    if (filters.status !== "all" && movement.status !== filters.status) return false;
    if (filters.account !== "all" && movement.accountDestination !== filters.account) return false;
    return true;
  });
}

export function calcKpis(movements: FinanceMovement[], monthKey: string) {
  const monthMovements = movements.filter((movement) => movement.monthKey === monthKey);
  const incomePaid = sumBy(
    monthMovements,
    (item) => (item.status === "CANCELADO" ? item.tax?.total ?? item.amount : 0)
  );
  const incomePending = sumBy(
    monthMovements,
    (item) => (item.status === "PENDIENTE" ? item.tax?.total ?? item.amount : 0)
  );
  const netIncome = incomePaid;
  const margin = incomePaid > 0 ? 100 : 0;

  return {
    incomePaid,
    incomePending,
    expensesPaid: 0,
    expensesPending: 0,
    netIncome,
    margin,
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}
