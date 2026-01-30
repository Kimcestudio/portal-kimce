"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/AuthProvider";
import FinanceTabs from "@/components/finance/FinanceTabs";
import FinanceHeroCard from "@/components/finance/FinanceHeroCard";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";
import FinanceFilterBar from "@/components/finance/FinanceFilterBar";
import FinanceTable from "@/components/finance/FinanceTable";
import FinancePendingList from "@/components/finance/FinancePendingList";
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import FinanceMonthlyChart from "@/components/finance/FinanceMonthlyChart";
import FinanceModal, {
  type CollaboratorFormValues,
  type CollaboratorPaymentFormValues,
  type ExpenseFormValues,
  type IncomeFormValues,
  type TransferFormValues,
} from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import Card from "@/components/ui/Card";
import {
  calcKpis,
  computeAlerts,
  computeCashFlow,
  computeMonthProjection,
  computeMonthlySeries,
  computeYearToDateTotals,
  filterMovements,
} from "@/lib/finance/analytics";
import { financeRefs } from "@/lib/finance/refs";
import {
  formatDateOnly,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getStatusLabel,
  getMonthKey,
  getMonthKeyFromDate,
} from "@/lib/finance/utils";
import type {
  Collaborator,
  CollaboratorPayment,
  Expense,
  FinanceFilters,
  FinanceModalType,
  FinanceMovement,
  FinanceStatus,
  FinanceTabKey,
  TransferMovement,
} from "@/lib/finance/types";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import {
  createCollaborator,
  createCollaboratorPayment,
  createExpense,
  createIncomeMovement,
  createTransfer,
  deleteCollaboratorPayment,
  deleteExpense,
  deleteFinanceMovement,
  deleteTransfer,
  updateCollaboratorPayment,
  updateCollaboratorPaymentStatus,
  updateExpense,
  updateExpenseStatus,
  updateFinanceMovementStatus,
  updateIncomeMovement,
  updateTransfer,
  updateTransferStatus,
} from "@/services/finance";
import { db } from "@/services/firebase/client";
import { Pencil, Trash2 } from "lucide-react";

const tabLabels: Record<FinanceTabKey, string> = {
  dashboard: "Dashboard",
  movimientos: "Movimientos",
  pagos: "Pagos a colaboradores",
  gastos: "Gastos",
  cuentas: "Cuentas & Caja",
  cierre: "Cierre de mes",
};

export default function FinanceModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("dashboard");
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<CollaboratorPayment[]>([]);
  const [transfers, setTransfers] = useState<TransferMovement[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<FinanceModalType>("income");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [editingMovement, setEditingMovement] = useState<FinanceMovement | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingPayment, setEditingPayment] = useState<CollaboratorPayment | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<TransferMovement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "summary" | "income" | "expenses" | "payments" | "accounts"
  >("summary");
  const [isAnnualView, setIsAnnualView] = useState(false);
  const [annualYear, setAnnualYear] = useState(() => new Date().getFullYear());

  const logDev = (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  const [filters, setFilters] = useState<FinanceFilters>({
    monthKey: getMonthKey(new Date()),
    status: "all",
    account: "all",
    category: "all",
    includeCancelled: true,
  });

  useEffect(() => {
    let movementsLoaded = false;
    let expensesLoaded = false;
    let paymentsLoaded = false;
    let transfersLoaded = false;
    let collaboratorsLoaded = false;

    const markLoaded = () => {
      if (
        movementsLoaded &&
        expensesLoaded &&
        paymentsLoaded &&
        transfersLoaded &&
        collaboratorsLoaded
      ) {
        setIsLoading((prev) => {
          if (prev) logDev("[FINANCE] loading complete");
          return false;
        });
      }
    };

    const handleSnapshotError = (label: string, error: { code?: string }) => {
      // eslint-disable-next-line no-console
      console.error(`[FINANCE] ${label} snapshot error`, error.code ?? error);
      if (process.env.NODE_ENV === "development") {
        setToast({ message: `No tienes permisos para ver ${label}.`, tone: "error" });
      }
    };

    const movementsQuery = query(financeRefs.incomesRef, orderBy("createdAt", "desc"));
    const unsubscribeMovements = onSnapshot(
      movementsQuery,
      (snapshot) => {
        const normalized = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as FinanceMovement;
          return {
            ...data,
            id: doc.id,
            monthKey:
              data.monthKey ?? getMonthKeyFromDate(data.incomeDate) ?? getMonthKey(new Date()),
          };
        });
        setMovements(normalized);
        logDev("[FINANCE] movements snapshot", normalized.length);
        if (!movementsLoaded) {
          movementsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("movimientos", error);
        movementsLoaded = true;
        markLoaded();
      },
    );

    const expensesQuery = query(financeRefs.expensesRef, orderBy("createdAt", "desc"));
    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as Expense;
          return {
            ...data,
            id: doc.id,
          };
        });
        setExpenses(items);
        logDev("[FINANCE] expenses snapshot", items.length);
        if (!expensesLoaded) {
          expensesLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("gastos", error);
        expensesLoaded = true;
        markLoaded();
      },
    );

    const paymentsQuery = query(financeRefs.collaboratorPaymentsRef, orderBy("createdAt", "desc"));
    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as CollaboratorPayment;
          return {
            ...data,
            id: doc.id,
          };
        });
        setPayments(items);
        logDev("[FINANCE] payments snapshot", items.length);
        if (!paymentsLoaded) {
          paymentsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("pagos", error);
        paymentsLoaded = true;
        markLoaded();
      },
    );

    const transfersQuery = query(financeRefs.transfersRef, orderBy("createdAt", "desc"));
    const unsubscribeTransfers = onSnapshot(
      transfersQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as TransferMovement;
          return {
            ...data,
            id: doc.id,
          };
        });
        setTransfers(items);
        logDev("[FINANCE] transfers snapshot", items.length);
        if (!transfersLoaded) {
          transfersLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("transferencias", error);
        transfersLoaded = true;
        markLoaded();
      },
    );

    const collaboratorsQuery = query(financeRefs.collaboratorsRef, orderBy("createdAt", "desc"));
    const unsubscribeCollaborators = onSnapshot(
      collaboratorsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as Collaborator;
          return {
            ...data,
            id: doc.id,
          };
        });
        setCollaborators(items);
        logDev("[FINANCE] collaborators snapshot", items.length);
        if (!collaboratorsLoaded) {
          collaboratorsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("colaboradores", error);
        collaboratorsLoaded = true;
        markLoaded();
      },
    );

    return () => {
      unsubscribeMovements();
      unsubscribeExpenses();
      unsubscribePayments();
      unsubscribeTransfers();
      unsubscribeCollaborators();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "movimientos" && activeTab !== "gastos") return;
    console.log("[FINANCE] projectId:", db.app.options.projectId);
    console.log("[FINANCE] income collection path:", financeRefs.incomesRef.path);
    console.log("[FINANCE] expense collection path:", financeRefs.expensesRef.path);
  }, [activeTab]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredMovements = useMemo(() => filterMovements(movements, filters), [movements, filters]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const monthKey = getMonthKeyFromDate(expense.fechaGasto);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && expense.status === "cancelled") return false;
      if (filters.status !== "all" && expense.status !== filters.status) return false;
      if (filters.account !== "all" && expense.cuentaOrigen !== filters.account) return false;
      return true;
    });
  }, [expenses, filters]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const monthKey = getMonthKeyFromDate(payment.fechaPago);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && payment.status === "cancelled") return false;
      if (filters.status !== "all" && payment.status !== filters.status) return false;
      if (filters.account !== "all" && payment.cuentaOrigen !== filters.account) return false;
      return true;
    });
  }, [filters, payments]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const monthKey = getMonthKeyFromDate(transfer.fecha);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && transfer.status === "cancelled") return false;
      if (filters.status !== "all" && transfer.status !== filters.status) return false;
      if (
        filters.account !== "all" &&
        transfer.cuentaOrigen !== filters.account &&
        transfer.cuentaDestino !== filters.account
      ) {
        return false;
      }
      return true;
    });
  }, [filters, transfers]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const addYear = (monthKey?: string | null) => {
      if (!monthKey) return;
      const [yearPart] = monthKey.split("-");
      const year = Number(yearPart);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    };
    movements.forEach((movement) => addYear(movement.monthKey));
    expenses.forEach((expense) => addYear(expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto)));
    payments.forEach((payment) => addYear(payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago)));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses, movements, payments]);

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!availableYears.includes(annualYear)) {
      setAnnualYear(availableYears[0]);
    }
  }, [annualYear, availableYears]);

  const collaboratorLookup = useMemo(() => {
    return new Map(collaborators.map((collaborator) => [collaborator.id, collaborator.nombreCompleto]));
  }, [collaborators]);

  const kpis = useMemo(
    () => calcKpis(movements, expenses, filters.monthKey, filters.includeCancelled, filters.account),
    [expenses, filters.account, filters.includeCancelled, filters.monthKey, movements],
  );

  const projection = useMemo(
    () => computeMonthProjection(movements, expenses, payments, filters.monthKey, filters.account),
    [expenses, filters.account, filters.monthKey, movements, payments],
  );

  const monthlyCashFlow = useMemo(
    () =>
      computeCashFlow({
        movements,
        expenses,
        payments,
        transfers,
        monthKey: filters.monthKey,
        account: filters.account,
      }),
    [expenses, filters.account, filters.monthKey, movements, payments, transfers],
  );

  const selectedMonthInfo = useMemo(() => {
    const [yearPart, monthPart] = filters.monthKey.split("-");
    return {
      year: Number(yearPart),
      month: Number(monthPart),
    };
  }, [filters.monthKey]);

  const monthlySeries = useMemo(
    () => computeMonthlySeries(movements, expenses, payments, filters.monthKey, 12, filters.account),
    [expenses, filters.account, filters.monthKey, movements, payments],
  );

  const annualSeries = useMemo(
    () =>
      computeMonthlySeries(
        movements,
        expenses,
        payments,
        `${annualYear}-12`,
        12,
        filters.account,
      ),
    [annualYear, expenses, filters.account, movements, payments],
  );

  const ytdTotals = useMemo(() => {
    const year = isAnnualView ? annualYear : selectedMonthInfo.year;
    const endMonth = isAnnualView ? 12 : selectedMonthInfo.month;
    return computeYearToDateTotals(
      movements,
      expenses,
      payments,
      Number.isNaN(year) ? annualYear : year,
      Number.isNaN(endMonth) ? 12 : endMonth,
      filters.account,
    );
  }, [
    annualYear,
    expenses,
    filters.account,
    isAnnualView,
    movements,
    payments,
    selectedMonthInfo.month,
    selectedMonthInfo.year,
  ]);

  const annualCashFlow = useMemo(
    () =>
      computeCashFlow({
        movements,
        expenses,
        payments,
        transfers,
        year: annualYear,
        account: filters.account,
      }),
    [annualYear, expenses, filters.account, movements, payments, transfers],
  );

  const annualStats = useMemo(() => {
    if (annualSeries.length === 0) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        net: 0,
        margin: 0,
        avgNet: 0,
        bestMonth: null as (typeof annualSeries)[number] | null,
        worstMonth: null as (typeof annualSeries)[number] | null,
      };
    }
    const totalIncome = annualSeries.reduce((sum, row) => sum + row.incomeTotal, 0);
    const totalExpenses = annualSeries.reduce((sum, row) => sum + row.expensesTotal, 0);
    const net = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
    const bestMonth = annualSeries.reduce(
      (best, row) => (best && best.net > row.net ? best : row),
      annualSeries[0],
    );
    const worstMonth = annualSeries.reduce(
      (worst, row) => (worst && worst.net < row.net ? worst : row),
      annualSeries[0],
    );
    const avgNet = annualSeries.length > 0 ? net / annualSeries.length : 0;
    return { totalIncome, totalExpenses, net, margin, avgNet, bestMonth, worstMonth };
  }, [annualSeries]);

  const annualChartData = useMemo(() => {
    return annualSeries.map((row) => ({
      month: formatMonthLabel(row.monthKey),
      income: row.incomeTotal,
      expenses: row.expensesTotal,
      net: row.net,
    }));
  }, [annualSeries]);

  const actualExpenses = kpis.expensesPaid + projection.paymentsPaid;
  const actualNet = kpis.incomePaid - actualExpenses;
  const realVsProjectedRows = useMemo(
    () => [
      {
        label: "Ingresos",
        real: kpis.incomePaid,
        projected: projection.incomeProjected,
      },
      {
        label: "Egresos",
        real: actualExpenses,
        projected: projection.expensesProjected,
      },
      {
        label: "Utilidad",
        real: actualNet,
        projected: projection.projectedNet,
      },
    ],
    [
      actualExpenses,
      actualNet,
      kpis.incomePaid,
      projection.expensesProjected,
      projection.incomeProjected,
      projection.projectedNet,
    ],
  );

  const heroContent = useMemo(() => {
    if (isAnnualView) {
      return {
        title: `Estado del año – ${annualYear}`,
        incomeLabel: "Ingresos totales",
        expensesLabel: "Egresos totales",
        cashFlowLabel: "Flujo de caja anual",
        netLabel: "Utilidad anual",
        marginLabel: "Margen anual",
        incomePaid: annualStats.totalIncome,
        expensesPaid: annualStats.totalExpenses,
        cashFlow: annualCashFlow.net,
        netIncome: annualStats.net,
        margin: annualStats.margin,
      };
    }
    return {
      title: `Estado del mes – ${formatMonthLabel(filters.monthKey)}`,
      incomeLabel: "Ingresos cobrados",
      expensesLabel: "Gastos pagados",
      cashFlowLabel: "Flujo de caja",
      netLabel: "Utilidad neta",
      marginLabel: "Margen neto",
      incomePaid: kpis.incomePaid,
      expensesPaid: kpis.expensesPaid,
      cashFlow: monthlyCashFlow.net,
      netIncome: kpis.netIncome,
      margin: kpis.margin,
    };
  }, [
    annualCashFlow.net,
    annualStats.margin,
    annualStats.net,
    annualStats.totalExpenses,
    annualStats.totalIncome,
    annualYear,
    filters.monthKey,
    isAnnualView,
    kpis.expensesPaid,
    kpis.incomePaid,
    kpis.margin,
    kpis.netIncome,
    monthlyCashFlow.net,
  ]);

  const alerts = useMemo(() => {
    if (isAnnualView) return [];
    return computeAlerts({
      projectedIncome: projection.incomeProjected,
      projectedExpenses: projection.expensesProjected,
      projectedNet: projection.projectedNet,
      projectedMargin: projection.projectedMargin,
      incomePending: projection.incomePending,
    });
  }, [isAnnualView, projection]);

  const monthSummary = useMemo(() => {
    const monthMovements = movements.filter((movement) => {
      if (movement.monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && movement.status === "cancelled") return false;
      return true;
    });
    const total = monthMovements.reduce(
      (sum, movement) => sum + (movement.tax?.total ?? movement.amount),
      0
    );
    const igv = monthMovements.reduce((sum, movement) => sum + (movement.tax?.igv ?? 0), 0);
    const net = total - igv;
    const paid = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status !== "pending" ? movement.tax?.total ?? movement.amount : 0),
      0,
    );
    const pending = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "pending" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    return { total, paid, pending, igv, net };
  }, [filters.includeCancelled, filters.monthKey, movements]);

  const detailTotals = useMemo(() => {
    const incomeTotal = filteredMovements.reduce(
      (sum, item) => sum + (item.tax?.total ?? item.amount),
      0,
    );
    const expenseTotal = filteredExpenses.reduce((sum, item) => sum + item.monto, 0);
    const paymentTotal = filteredPayments.reduce((sum, item) => sum + item.montoFinal, 0);
    const transferTotal = filteredTransfers.reduce((sum, item) => sum + item.monto, 0);
    return { incomeTotal, expenseTotal, paymentTotal, transferTotal };
  }, [filteredExpenses, filteredMovements, filteredPayments, filteredTransfers]);

  const incomeSummary = useMemo(() => {
    const map = new Map<
      string,
      { clientName: string; status: FinanceStatus; total: number; count: number }
    >();
    filteredMovements.forEach((movement) => {
      const key = `${movement.clientName}-${movement.status}`;
      const current = map.get(key) ?? {
        clientName: movement.clientName,
        status: movement.status,
        total: 0,
        count: 0,
      };
      current.total += movement.tax?.total ?? movement.amount;
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredMovements]);

  const expenseSummary = useMemo(() => {
    const map = new Map<
      string,
      { categoria: Expense["categoria"]; status: FinanceStatus; total: number; count: number }
    >();
    filteredExpenses.forEach((expense) => {
      const key = `${expense.categoria}-${expense.status}`;
      const current = map.get(key) ?? {
        categoria: expense.categoria,
        status: expense.status,
        total: 0,
        count: 0,
      };
      current.total += expense.monto;
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const paymentSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    filteredPayments.forEach((payment) => {
      const name = collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador";
      const current = map.get(name) ?? { name, total: 0, count: 0 };
      current.total += payment.montoFinal;
      current.count += 1;
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [collaboratorLookup, filteredPayments]);

  const exportDetailCsv = () => {
    const rows: string[][] = [
      ["Tipo", "Nombre", "Estado", "Monto", "Fecha"],
    ];
    filteredMovements.forEach((movement) => {
      rows.push([
        "Ingreso",
        movement.clientName,
        movement.status,
        `${movement.tax?.total ?? movement.amount}`,
        movement.incomeDate,
      ]);
    });
    filteredExpenses.forEach((expense) => {
      rows.push([
        "Gasto",
        expense.categoria,
        expense.status,
        `${expense.monto}`,
        expense.fechaGasto,
      ]);
    });
    filteredPayments.forEach((payment) => {
      rows.push([
        "Pago colaborador",
        collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador",
        payment.status,
        `${payment.montoFinal}`,
        payment.fechaPago,
      ]);
    });
    filteredTransfers.forEach((transfer) => {
      rows.push([
        "Transferencia",
        transfer.tipoMovimiento,
        transfer.status,
        `${transfer.monto}`,
        transfer.fecha,
      ]);
    });
    const csvContent = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `desglose-finanzas-${filters.monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openModal = (type: FinanceModalType) => {
    setModalType(type);
    setIsModalOpen(true);
    setIsSubmitting(false);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingPayment(null);
    setEditingTransfer(null);
  };

  const handleCreateMovement = async (type: FinanceModalType, values: unknown) => {
    if (isSubmitting) return false;
    setIsSubmitting(true);
    try {
      if (type === "income") {
        const payload = values as IncomeFormValues;
        const rate = Math.max(0, payload.taxRate) / 100;
        const amount = Math.max(0, payload.amount);
        const taxEnabled = payload.taxEnabled;
        let base = amount;
        let igv = 0;
        let total = amount;
        if (taxEnabled && rate > 0) {
          if (payload.taxMode === "inclusive") {
            base = amount / (1 + rate);
            igv = amount - base;
            total = amount;
          } else {
            base = amount;
            igv = amount * rate;
            total = amount + igv;
          }
        }
        const incomePayload = {
          clientName: payload.clientName,
          projectService: payload.projectService,
          amount,
          incomeDate: payload.incomeDate,
          expectedPayDate: payload.expectedPayDate || null,
          accountDestination: payload.accountDestination,
          status: payload.status,
          reference: payload.reference,
          notes: payload.notes,
          tax: {
            enabled: payload.taxEnabled,
            rate: payload.taxRate,
            mode: payload.taxMode,
            base,
            igv,
            total,
          },
          recurring: {
            enabled: payload.recurringEnabled,
            freq: payload.recurringFreq,
            dayOfMonth: payload.recurringFreq === "monthly" ? payload.recurringDayOfMonth : null,
            startAt: payload.recurringStartAt || null,
            endAt: payload.recurringEndAt || null,
          },
        };
        if (editingMovement) {
          await updateIncomeMovement(editingMovement.id, incomePayload);
          setToast({ message: "Ingreso actualizado", tone: "success" });
        } else {
          await createIncomeMovement(incomePayload);
          setToast({ message: "Ingreso creado", tone: "success" });
        }
      }

      if (type === "collaborator") {
        const payload = values as CollaboratorFormValues;
        await createCollaborator({
          nombreCompleto: payload.nombreCompleto,
          rolPuesto: payload.rolPuesto,
          tipoPago: payload.tipoPago,
          montoBase: payload.montoBase,
          moneda: payload.moneda,
          cuentaPagoPreferida: payload.cuentaPagoPreferida,
          diaPago: payload.diaPago === "" ? null : payload.diaPago,
          fechaPago: payload.fechaPago ? new Date(payload.fechaPago).toISOString() : null,
          inicioContrato: new Date(payload.inicioContrato).toISOString(),
          finContrato: payload.finContrato ? new Date(payload.finContrato).toISOString() : null,
          activo: payload.activo,
          notas: payload.notas,
        });
        setToast({ message: "Colaborador creado", tone: "success" });
      }

      if (type === "collaborator_payment") {
        const payload = values as CollaboratorPaymentFormValues;
        const paymentPayload = {
          colaboradorId: payload.colaboradorId,
          periodo: payload.periodo,
          montoBase: payload.montoBase,
          bono: payload.bono,
          descuento: payload.descuento,
          devolucion: payload.devolucion,
          montoFinal: payload.montoFinal,
          fechaPago: payload.fechaPago,
          cuentaOrigen: payload.cuentaOrigen,
          status: payload.status,
          referencia: payload.referencia,
          notas: payload.notas,
        };
        if (editingPayment) {
          await updateCollaboratorPayment(editingPayment.id, paymentPayload);
          setToast({ message: "Pago actualizado", tone: "success" });
        } else {
          await createCollaboratorPayment(paymentPayload);
          setToast({ message: "Pago registrado", tone: "success" });
        }
      }

      if (type === "expense") {
        const payload = values as ExpenseFormValues;
        const expensePayload = {
          tipoGasto: payload.tipoGasto,
          categoria: payload.categoria,
          descripcion: payload.descripcion,
          monto: payload.monto,
          fechaGasto: payload.fechaGasto,
          cuentaOrigen: payload.cuentaOrigen,
          status: payload.status,
          requiereDevolucion: payload.requiereDevolucion,
          devolucionMonto: payload.requiereDevolucion ? payload.devolucionMonto : null,
          referencia: payload.referencia,
          notas: payload.notas,
        };
        if (editingExpense) {
          await updateExpense(editingExpense.id, expensePayload);
          setToast({ message: "Gasto actualizado", tone: "success" });
        } else {
          await createExpense(expensePayload);
          setToast({ message: "Gasto creado", tone: "success" });
        }
      }

      if (type === "transfer") {
        const payload = values as TransferFormValues;
        const isTransfer = payload.tipoMovimiento === "TRANSFERENCIA";
        const transferPayload = {
          tipoMovimiento: payload.tipoMovimiento,
          cuentaOrigen:
            isTransfer || payload.tipoMovimiento === "SALIDA_CAJA" ? payload.cuentaOrigen || null : null,
          cuentaDestino:
            isTransfer || payload.tipoMovimiento === "INGRESO_CAJA" ? payload.cuentaDestino || null : null,
          monto: payload.monto,
          fecha: payload.fecha,
          status: payload.status,
          referencia: payload.referencia,
          notas: payload.notas,
        };
        if (editingTransfer) {
          await updateTransfer(editingTransfer.id, transferPayload);
          setToast({ message: "Movimiento actualizado", tone: "success" });
        } else {
          await createTransfer(transferPayload);
          setToast({ message: "Movimiento creado", tone: "success" });
        }
      }
      setEditingMovement(null);
      setEditingExpense(null);
      setEditingPayment(null);
      setEditingTransfer(null);
      setIsModalOpen(false);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[FINANCE] save error", error);
      const message =
        error instanceof Error && error.message
          ? `Error al guardar: ${error.message}`
          : "Error inesperado al guardar.";
      setToast({ message, tone: "error" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMovement = (movement: FinanceMovement) => {
    setEditingMovement(movement);
    setEditingExpense(null);
    setEditingPayment(null);
    setEditingTransfer(null);
    setModalType("income");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditingMovement(null);
    setEditingPayment(null);
    setEditingTransfer(null);
    setModalType("expense");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditPayment = (payment: CollaboratorPayment) => {
    setEditingPayment(payment);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingTransfer(null);
    setModalType("collaborator_payment");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditTransfer = (transfer: TransferMovement) => {
    setEditingTransfer(transfer);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingPayment(null);
    setModalType("transfer");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const incomeInitialValues: Partial<IncomeFormValues> | null = editingMovement
    ? {
        clientName: editingMovement.clientName,
        projectService: editingMovement.projectService ?? "",
        amount:
          editingMovement.tax?.enabled && editingMovement.tax.mode === "exclusive"
            ? editingMovement.tax.base
            : editingMovement.tax?.total ?? editingMovement.amount,
        incomeDate: formatDateOnly(editingMovement.incomeDate) ?? editingMovement.incomeDate,
        expectedPayDate: formatDateOnly(editingMovement.expectedPayDate) ?? "",
        accountDestination: editingMovement.accountDestination,
        status: editingMovement.status,
        reference: editingMovement.reference ?? "",
        notes: editingMovement.notes ?? "",
        taxEnabled: editingMovement.tax?.enabled ?? false,
        taxRate: editingMovement.tax?.rate ?? 18,
        taxMode: editingMovement.tax?.mode ?? "exclusive",
        recurringEnabled: editingMovement.recurring?.enabled ?? false,
        recurringFreq: editingMovement.recurring?.freq ?? "monthly",
        recurringDayOfMonth: editingMovement.recurring?.dayOfMonth ?? 1,
        recurringStartAt: formatDateOnly(editingMovement.recurring?.startAt) ?? "",
        recurringEndAt: formatDateOnly(editingMovement.recurring?.endAt) ?? "",
      }
    : null;

  const expenseInitialValues: Partial<ExpenseFormValues> | null = editingExpense
    ? {
        tipoGasto: editingExpense.tipoGasto,
        categoria: editingExpense.categoria,
        descripcion: editingExpense.descripcion,
        monto: editingExpense.monto,
        fechaGasto: formatDateOnly(editingExpense.fechaGasto) ?? editingExpense.fechaGasto,
        cuentaOrigen: editingExpense.cuentaOrigen,
        status: editingExpense.status,
        requiereDevolucion: editingExpense.requiereDevolucion,
        devolucionMonto: editingExpense.devolucionMonto ?? 0,
        referencia: editingExpense.referencia ?? "",
        notas: editingExpense.notas ?? "",
      }
    : null;

  const paymentInitialValues: Partial<CollaboratorPaymentFormValues> | null = editingPayment
    ? {
        colaboradorId: editingPayment.colaboradorId,
        periodo: editingPayment.periodo,
        montoBase: editingPayment.montoBase,
        bono: editingPayment.bono ?? 0,
        descuento: editingPayment.descuento ?? 0,
        devolucion: editingPayment.devolucion ?? 0,
        montoFinal: editingPayment.montoFinal,
        fechaPago: formatDateOnly(editingPayment.fechaPago) ?? editingPayment.fechaPago,
        cuentaOrigen: editingPayment.cuentaOrigen,
        status: editingPayment.status,
        referencia: editingPayment.referencia ?? "",
        notas: editingPayment.notas ?? "",
      }
    : null;

  const transferInitialValues: Partial<TransferFormValues> | null = editingTransfer
    ? {
        tipoMovimiento: editingTransfer.tipoMovimiento,
        cuentaOrigen: editingTransfer.cuentaOrigen ?? undefined,
        cuentaDestino: editingTransfer.cuentaDestino ?? undefined,
        monto: editingTransfer.monto,
        fecha: formatDateOnly(editingTransfer.fecha) ?? editingTransfer.fecha,
        status: editingTransfer.status,
        referencia: editingTransfer.referencia ?? "",
        notas: editingTransfer.notas ?? "",
      }
    : null;

  const modalInitialValues = useMemo(() => {
    switch (modalType) {
      case "collaborator":
        return null;
      case "expense":
        return expenseInitialValues;
      case "collaborator_payment":
        return paymentInitialValues;
      case "transfer":
        return transferInitialValues;
      case "income":
      default:
        return incomeInitialValues;
    }
  }, [
    expenseInitialValues,
    incomeInitialValues,
    modalType,
    paymentInitialValues,
    transferInitialValues,
  ]);

  const handleStatusChange = async (id: string, status: FinanceStatus) => {
    await updateFinanceMovementStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleExpenseStatusChange = async (id: string, status: FinanceStatus) => {
    await updateExpenseStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleTransferStatusChange = async (id: string, status: FinanceStatus) => {
    await updateTransferStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handlePaymentStatusChange = async (id: string, status: FinanceStatus) => {
    await updateCollaboratorPaymentStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleDeleteMovement = async (id: string) => {
    if (!window.confirm("¿Eliminar este ingreso?")) return;
    await deleteFinanceMovement(id);
    setToast({ message: "Movimiento eliminado", tone: "success" });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    await deleteExpense(id);
    setToast({ message: "Gasto eliminado", tone: "success" });
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm("¿Eliminar este pago?")) return;
    await deleteCollaboratorPayment(id);
    setToast({ message: "Pago eliminado", tone: "success" });
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    await deleteTransfer(id);
    setToast({ message: "Movimiento eliminado", tone: "success" });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <FinanceGate>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Admin / Finanzas / {tabLabels[activeTab]}
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">Finanzas</h1>
              <p className="text-sm text-slate-500">
                {isAnnualView
                  ? `${annualYear} · Resumen anual de finanzas.`
                  : `${formatMonthLabel(filters.monthKey)} · Control mensual de ingresos.`}
              </p>
              {process.env.NODE_ENV === "development" && db.app.options.projectId ? (
                <p className="text-xs text-slate-400">
                  Firebase Project: {db.app.options.projectId}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "pagos" ? (
                <button
                  type="button"
                  onClick={() => openModal("collaborator")}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Nuevo colaborador
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  openModal(
                    activeTab === "gastos"
                      ? "expense"
                      : activeTab === "cuentas"
                        ? "transfer"
                        : activeTab === "pagos"
                          ? "collaborator_payment"
                          : "income",
                  )
                }
                className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
              >
                {activeTab === "gastos"
                  ? "Nuevo gasto"
                  : activeTab === "cuentas"
                    ? "Transferencia / Movimiento"
                    : activeTab === "pagos"
                      ? "Registrar pago"
                      : "Nuevo ingreso"}
              </button>
            </div>
          </div>

          {toast ? (
            <div
              className={`rounded-2xl border px-4 py-2 text-xs ${
                toast.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {toast.message}
            </div>
          ) : null}

          <FinanceTabs active={activeTab} onChange={(key) => setActiveTab(key)} />
          <FinanceFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
            }}
          />

          {isLoading ? (
            <FinanceSkeleton />
          ) : (
            <div className="space-y-6">
              {activeTab === "dashboard" ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${!isAnnualView ? "bg-white text-slate-900 shadow-sm" : ""}`}
                        onClick={() => setIsAnnualView(false)}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${isAnnualView ? "bg-white text-slate-900 shadow-sm" : ""}`}
                        onClick={() => setIsAnnualView(true)}
                      >
                        Anual
                      </button>
                    </div>
                    {isAnnualView ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Año</span>
                        <select
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                          value={annualYear}
                          onChange={(event) => setAnnualYear(Number(event.target.value))}
                        >
                          {availableYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setDetailTab("summary");
                        setIsDetailOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      Ver desglose
                    </button>
                  </div>
                  <FinanceHeroCard
                    title={heroContent.title}
                    incomeLabel={heroContent.incomeLabel}
                    expensesLabel={heroContent.expensesLabel}
                    cashFlowLabel={heroContent.cashFlowLabel}
                    netLabel={heroContent.netLabel}
                    marginLabel={heroContent.marginLabel}
                    incomePaid={heroContent.incomePaid}
                    expensesPaid={heroContent.expensesPaid}
                    cashFlow={heroContent.cashFlow}
                    netIncome={heroContent.netIncome}
                    margin={heroContent.margin}
                  />
                  {isAnnualView ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <FinanceKpiCard
                          title="Ingresos acumulados"
                          value={annualStats.totalIncome}
                          tone="blue"
                        />
                        <FinanceKpiCard
                          title="Egresos acumulados"
                          value={annualStats.totalExpenses}
                          tone="rose"
                        />
                        <FinanceKpiCard title="Flujo de caja anual" value={annualCashFlow.net} tone="slate" />
                        <FinanceKpiCard title="Utilidad acumulada" value={annualStats.net} tone="green" />
                        <Card className="border border-transparent bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-white">
                          <div className="space-y-2 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Margen acumulado
                            </p>
                            <p className="text-2xl font-semibold text-slate-900">
                              {annualStats.margin.toFixed(1)}%
                            </p>
                          </div>
                        </Card>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Vista anual
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <FinanceKpiCard title="Total anual" value={annualStats.net} tone="green" />
                            <FinanceKpiCard title="Promedio mensual" value={annualStats.avgNet} tone="blue" />
                            <FinanceKpiCard
                              title="Mejor mes"
                              value={annualStats.bestMonth ? annualStats.bestMonth.net : 0}
                              tone="green"
                            />
                            <FinanceKpiCard
                              title="Peor mes"
                              value={annualStats.worstMonth ? annualStats.worstMonth.net : 0}
                              tone="rose"
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Gráfico mensual del año
                          </p>
                          <div className="mt-4">
                            {annualChartData.length === 0 ? (
                              <div className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                                Sin datos para el año seleccionado.
                              </div>
                            ) : (
                              <FinanceMonthlyChart data={annualChartData} />
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <FinanceKpiCard title="Ingresos cobrados" value={kpis.incomePaid} tone="blue" />
                        <FinanceKpiCard title="Pendiente por cobrar" value={kpis.incomePending} tone="amber" />
                        <FinanceKpiCard title="Gastos pagados" value={kpis.expensesPaid} tone="rose" />
                        <FinanceKpiCard title="Flujo de caja" value={monthlyCashFlow.net} tone="slate" />
                        <FinanceKpiCard title="Utilidad neta" value={kpis.netIncome} tone="green" />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Proyección del mes
                            </p>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                              Estimado
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-slate-500">Ingresos proyectados</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {formatCurrency(projection.incomeProjected)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Egresos proyectados</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {formatCurrency(projection.expensesProjected)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Utilidad proyectada</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {formatCurrency(projection.projectedNet)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Margen proyectado</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {projection.projectedMargin.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Real vs Proyectado
                          </p>
                          <div className="mt-4 space-y-4 text-sm">
                            {realVsProjectedRows.map((row) => {
                              const maxValue = Math.max(row.real, row.projected, 1);
                              const realPercent = (row.real / maxValue) * 100;
                              const projectedPercent = (row.projected / maxValue) * 100;
                              return (
                                <div key={row.label} className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-semibold text-slate-500">{row.label}</p>
                                    <p className="text-xs text-slate-500">
                                      {formatCurrency(row.real)} / {formatCurrency(row.projected)}
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Real</span>
                                        <span>{realPercent.toFixed(0)}%</span>
                                      </div>
                                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                                        <div
                                          className="h-2 rounded-full bg-indigo-500"
                                          style={{ width: `${realPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Proyectado</span>
                                        <span>{projectedPercent.toFixed(0)}%</span>
                                      </div>
                                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                                        <div
                                          className="h-2 rounded-full bg-slate-400"
                                          style={{ width: `${projectedPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Acumulado YTD {selectedMonthInfo.year}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <FinanceKpiCard title="Ingresos acumulados" value={ytdTotals.totalIncome} tone="blue" />
                          <FinanceKpiCard title="Egresos acumulados" value={ytdTotals.totalExpenses} tone="rose" />
                          <FinanceKpiCard title="Utilidad acumulada" value={ytdTotals.net} tone="green" />
                          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Margen acumulado
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-900">
                              {ytdTotals.margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Resumen mensual (últimos 12)
                          </p>
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                  <th className="px-2 py-2">Mes</th>
                                  <th className="px-2 py-2 text-right">Ingresos</th>
                                  <th className="px-2 py-2 text-right">Egresos</th>
                                  <th className="px-2 py-2 text-right">Utilidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthlySeries.map((row) => (
                                  <tr key={row.monthKey} className="border-t border-slate-100">
                                    <td className="px-2 py-2 text-xs text-slate-500">
                                      {formatMonthLabel(row.monthKey)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {formatCurrency(row.incomeTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {formatCurrency(row.expensesTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                                      {formatCurrency(row.net)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Insights & alertas
                          </p>
                          <ul className="mt-3 space-y-2 text-sm">
                            {alerts.length === 0 ? (
                              <li className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                Sin alertas por ahora.
                              </li>
                            ) : (
                              alerts.map((alert, index) => (
                                <li
                                  key={`${alert.message}-${index}`}
                                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                                    alert.tone === "danger"
                                      ? "bg-rose-50 text-rose-700"
                                      : alert.tone === "warning"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-sky-50 text-sky-700"
                                  }`}
                                >
                                  {alert.message}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                      <FinancePendingList
                        title="Pendientes por cobrar"
                        items={filteredMovements.filter((movement) => movement.status === "pending")}
                        emptyLabel="Sin pendientes."
                      />
                    </>
                  )}
                </>
              ) : null}

              {activeTab === "movimientos" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <FinanceKpiCard title="Total" value={monthSummary.total} tone="slate" />
                    <FinanceKpiCard title="Cobrado" value={monthSummary.paid} tone="green" />
                    <FinanceKpiCard title="Pendiente" value={monthSummary.pending} tone="amber" />
                    <FinanceKpiCard title="IGV" value={monthSummary.igv} tone="blue" />
                    <FinanceKpiCard title="Neto" value={monthSummary.net} tone="rose" />
                  </div>
                  <FinanceTable
                    movements={filteredMovements}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteMovement}
                    onEdit={handleEditMovement}
                    disabled={isSubmitting}
                  />
                </>
              ) : null}

              {activeTab === "gastos" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(expense.fechaGasto)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{expense.descripcion}</p>
                            <p className="text-xs text-slate-500">{expense.referencia ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{expense.categoria}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={expense.status}
                              onChange={(status) => handleExpenseStatusChange(expense.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(expense.monto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleEditExpense(expense)}
                                disabled={isSubmitting}
                                aria-label="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleDeleteExpense(expense.id)}
                                disabled={isSubmitting}
                                aria-label="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin gastos registrados en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === "pagos" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Periodo</th>
                        <th className="px-4 py-3">Cuenta</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(payment.fechaPago)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador"}
                            </p>
                            <p className="text-xs text-slate-500">{payment.referencia ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{payment.periodo}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{payment.cuentaOrigen}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={payment.status}
                              onChange={(status) => handlePaymentStatusChange(payment.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(payment.montoFinal)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleEditPayment(payment)}
                                disabled={isSubmitting}
                                aria-label="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleDeletePayment(payment.id)}
                                disabled={isSubmitting}
                                aria-label="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin pagos registrados en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === "cuentas" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Cuenta origen</th>
                        <th className="px-4 py-3">Cuenta destino</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransfers.map((transfer) => (
                        <tr key={transfer.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(transfer.fecha)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.tipoMovimiento}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaOrigen ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaDestino ?? "—"}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={transfer.status}
                              onChange={(status) => handleTransferStatusChange(transfer.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(transfer.monto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleEditTransfer(transfer)}
                                disabled={isSubmitting}
                                aria-label="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => handleDeleteTransfer(transfer.id)}
                                disabled={isSubmitting}
                                aria-label="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin transferencias registradas en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </FinanceGate>

      {isDetailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Desglose del mes · {formatMonthLabel(filters.monthKey)}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">Detalle financiero</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                  onClick={exportDetailCsv}
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              {[
                { key: "summary", label: "Resumen" },
                { key: "income", label: "Ingresos" },
                { key: "expenses", label: "Gastos" },
                { key: "payments", label: "Pagos a colaboradores" },
                { key: "accounts", label: "Cuentas & Caja" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key as typeof detailTab)}
                  className={`rounded-full px-3 py-1 ${
                    detailTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {detailTab === "summary" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FinanceKpiCard title="Ingresos del mes" value={detailTotals.incomeTotal} tone="blue" />
                    <FinanceKpiCard title="Gastos del mes" value={detailTotals.expenseTotal} tone="rose" />
                    <FinanceKpiCard title="Pagos a colaboradores" value={detailTotals.paymentTotal} tone="amber" />
                    <FinanceKpiCard title="Movimientos caja" value={detailTotals.transferTotal} tone="slate" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">KPI del mes</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Ingresos cobrados</span>
                          <span className="font-semibold">{formatCurrency(kpis.incomePaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Gastos pagados</span>
                          <span className="font-semibold">{formatCurrency(kpis.expensesPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Utilidad neta</span>
                          <span className="font-semibold">{formatCurrency(kpis.netIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Margen neto</span>
                          <span className="font-semibold">{kpis.margin.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Proyección del mes
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Ingresos proyectados</span>
                          <span className="font-semibold">{formatCurrency(projection.incomeProjected)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Egresos proyectados</span>
                          <span className="font-semibold">{formatCurrency(projection.expensesProjected)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Utilidad proyectada</span>
                          <span className="font-semibold">{formatCurrency(projection.projectedNet)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Margen proyectado</span>
                          <span className="font-semibold">{projection.projectedMargin.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {detailTab === "income" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeSummary.map((row) => (
                        <tr key={`${row.clientName}-${row.status}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.clientName}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(row.status)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {incomeSummary.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin ingresos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "expenses" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseSummary.map((row) => (
                        <tr key={`${row.categoria}-${row.status}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.categoria}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(row.status)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {expenseSummary.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin gastos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "payments" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSummary.map((row) => (
                        <tr key={row.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.name}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {paymentSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin pagos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "accounts" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransfers.map((transfer) => (
                        <tr key={transfer.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(transfer.fecha)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {transfer.tipoMovimiento}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(transfer.status)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(transfer.monto)}
                          </td>
                        </tr>
                      ))}
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin movimientos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <FinanceModal
        isOpen={isModalOpen}
        modalType={modalType}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMovement(null);
          setEditingExpense(null);
          setEditingPayment(null);
          setEditingTransfer(null);
        }}
        onSubmit={handleCreateMovement}
        disabled={isSubmitting}
        isSubmitting={isSubmitting}
        initialValues={modalInitialValues}
      />
    </div>
  );
}
