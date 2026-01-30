import type {
  CollaboratorPayment,
  Expense,
  FinanceFilters,
  FinanceMovement,
  FinanceStatus,
  TransferMovement,
} from "@/lib/finance/types";
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
  payments: CollaboratorPayment[],
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
  const monthPayments = payments.filter((payment) => {
    const paymentMonthKey = payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago);
    return (
      paymentMonthKey === monthKey &&
      payment.status !== "cancelled" &&
      (account === "all" || payment.cuentaOrigen === account)
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
  const paymentsPaid = sumBy(monthPayments, (payment) =>
    isPaid(payment.status) ? payment.montoFinal : 0,
  );
  const paymentsPending = sumBy(monthPayments, (payment) =>
    payment.status === "pending" ? payment.montoFinal : 0,
  );
  const incomeProjected = incomePaid + incomePending;
  const expensesProjected = expensesPaid + expensesPending + paymentsPending;
  const projectedNet = incomeProjected - expensesProjected;
  const projectedMargin = incomeProjected > 0 ? (projectedNet / incomeProjected) * 100 : 0;
  return {
    incomePaid,
    incomePending,
    incomeProjected,
    expensesPaid,
    expensesPending,
    paymentsPaid,
    paymentsPending,
    expensesProjected,
    projectedNet,
    projectedMargin,
  };
}

export function computeCashFlow({
  movements,
  expenses,
  payments,
  transfers,
  monthKey,
  year,
  account = "all",
}: {
  movements: FinanceMovement[];
  expenses: Expense[];
  payments: CollaboratorPayment[];
  transfers: TransferMovement[];
  monthKey?: string;
  year?: number;
  account?: FinanceFilters["account"];
}) {
  const matchesPeriod = (value: string | null | undefined) => {
    if (!value) return false;
    if (monthKey) return value === monthKey;
    if (year) return value.startsWith(`${year}-`);
    return true;
  };

  const incomePaid = sumBy(movements, (movement) => {
    if (!matchesPeriod(movement.monthKey)) return 0;
    if (movement.status === "pending" || movement.status === "cancelled") return 0;
    if (account !== "all" && movement.accountDestination !== account) return 0;
    return movement.tax?.total ?? movement.amount;
  });

  const expensesPaid = sumBy(expenses, (expense) => {
    const expenseMonthKey = expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto);
    if (!matchesPeriod(expenseMonthKey)) return 0;
    if (expense.status === "pending" || expense.status === "cancelled") return 0;
    if (account !== "all" && expense.cuentaOrigen !== account) return 0;
    return expense.monto;
  });

  const paymentsPaid = sumBy(payments, (payment) => {
    const paymentMonthKey = payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago);
    if (!matchesPeriod(paymentMonthKey)) return 0;
    if (payment.status === "pending" || payment.status === "cancelled") return 0;
    if (account !== "all" && payment.cuentaOrigen !== account) return 0;
    return payment.montoFinal;
  });

  const transferTotals = transfers.reduce(
    (totals, transfer) => {
      const transferMonthKey = getMonthKeyFromDate(transfer.fecha);
      if (!matchesPeriod(transferMonthKey)) return totals;
      if (transfer.status === "pending" || transfer.status === "cancelled") return totals;
      if (account === "all") {
        if (transfer.tipoMovimiento === "INGRESO_CAJA") {
          totals.in += transfer.monto;
        }
        if (transfer.tipoMovimiento === "SALIDA_CAJA") {
          totals.out += transfer.monto;
        }
        return totals;
      }
      if (transfer.tipoMovimiento === "TRANSFERENCIA") {
        if (transfer.cuentaOrigen === account) totals.out += transfer.monto;
        if (transfer.cuentaDestino === account) totals.in += transfer.monto;
      }
      if (transfer.tipoMovimiento === "INGRESO_CAJA" && transfer.cuentaDestino === account) {
        totals.in += transfer.monto;
      }
      if (transfer.tipoMovimiento === "SALIDA_CAJA" && transfer.cuentaOrigen === account) {
        totals.out += transfer.monto;
      }
      return totals;
    },
    { in: 0, out: 0 },
  );

  const cashIn = incomePaid + transferTotals.in;
  const cashOut = expensesPaid + paymentsPaid + transferTotals.out;
  return {
    incomePaid,
    expensesPaid,
    paymentsPaid,
    transferIn: transferTotals.in,
    transferOut: transferTotals.out,
    cashIn,
    cashOut,
    net: cashIn - cashOut,
  };
}

export function computeYearToDateTotals(
  movements: FinanceMovement[],
  expenses: Expense[],
  payments: CollaboratorPayment[],
  year: number,
  endMonth: number,
  account: FinanceFilters["account"] = "all",
) {
  const yearPrefix = `${year}-`;
  const lastMonthKey = `${year}-${String(endMonth).padStart(2, "0")}`;
  const isWithinRange = (monthKey: string) =>
    monthKey.startsWith(yearPrefix) && monthKey <= lastMonthKey;

  const filteredMovements = movements.filter((movement) => {
    if (movement.status === "cancelled") return false;
    if (!isWithinRange(movement.monthKey)) return false;
    return account === "all" || movement.accountDestination === account;
  });
  const filteredExpenses = expenses.filter((expense) => {
    const expenseMonthKey = expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto);
    if (!expenseMonthKey || !isWithinRange(expenseMonthKey)) return false;
    if (expense.status === "cancelled") return false;
    return account === "all" || expense.cuentaOrigen === account;
  });
  const filteredPayments = payments.filter((payment) => {
    const paymentMonthKey = payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago);
    if (!paymentMonthKey || !isWithinRange(paymentMonthKey)) return false;
    if (payment.status === "cancelled") return false;
    return account === "all" || payment.cuentaOrigen === account;
  });
  const totalIncome = sumBy(filteredMovements, (movement) => movement.tax?.total ?? movement.amount);
  const totalExpenses =
    sumBy(filteredExpenses, (expense) => expense.monto) +
    sumBy(filteredPayments, (payment) => payment.montoFinal);
  const net = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  return {
    totalIncome,
    totalExpenses,
    net,
    margin,
    movements: filteredMovements,
    expenses: filteredExpenses,
    payments: filteredPayments,
  };
}

export function computeMonthlySeries(
  movements: FinanceMovement[],
  expenses: Expense[],
  payments: CollaboratorPayment[],
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
    const monthPayments = payments.filter((payment) => {
      const paymentMonthKey = payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago);
      return (
        paymentMonthKey === monthKey &&
        payment.status !== "cancelled" &&
        (account === "all" || payment.cuentaOrigen === account)
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
    const paymentsPaid = sumBy(monthPayments, (payment) =>
      isPaid(payment.status) ? payment.montoFinal : 0,
    );
    const paymentsPending = sumBy(monthPayments, (payment) =>
      payment.status === "pending" ? payment.montoFinal : 0,
    );
    const incomeTotal = incomePaid + incomePending;
    const expensesTotal = expensesPaid + expensesPending + paymentsPaid + paymentsPending;
    const net = incomeTotal - expensesTotal;
    return {
      monthKey,
      incomePaid,
      incomePending,
      expensesPaid,
      expensesPending,
      paymentsPaid,
      paymentsPending,
      incomeTotal,
      expensesTotal,
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
