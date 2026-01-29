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
  const monthMovements = movements.filter((movement) => {
    if (movement.monthKey !== monthKey) return false;
    if (!includeCancelled && movement.status === "cancelled") return false;
    return true;
  });

  // Solo 2 estados: pending | cancelled
  const incomePending = sumBy(monthMovements, (item) =>
    item.status === "pending" ? item.tax?.total ?? item.amount : 0,
  );

  const incomeCancelled = sumBy(monthMovements, (item) =>
    item.status === "cancelled" ? item.tax?.total ?? item.amount : 0,
  );

  // Si no hay "paid", netIncome = pending (lo que aún se espera cobrar)
  // Si luego quieres "neto real", lo calculamos desde transferencias o cierres.
  const netIncome = incomePending;

  // Margen: con 2 estados, no tiene mucho sentido sin "pagado" y sin gastos reales.
  // Lo dejamos simple y estable.
  const margin = incomePending > 0 ? 100 : 0;

  return {
    incomePending,
    incomeCancelled,
    // mantenemos estos campos en 0 para no romper UI hasta que actualicemos el page.tsx
    expensesPaid: 0,
    expensesPending: 0,
    netIncome,
    margin,
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}
